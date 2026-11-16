// Round 41: turn a USDA FoodData Central food into SnapCal's numbers. Pure functions only.
//
// USDA sends nutrients in three shapes:
//   search results:   { nutrientId, nutrientNumber, unitName: "KCAL", value }
//   food details:     { nutrient: { id, number, unitName: "kcal" }, amount }
//   abridged details: { number, unitName, amount }
// All are read here. Values for Foundation, SR Legacy, FNDDS and Branded foods are per 100 g
// (Branded drinks: per 100 ml when the pack is measured in ml).
//
// Rules:
// - A nutrient USDA did not send is UNKNOWN (null), never 0. A 0 USDA sent is a real 0 (water).
// - kcal: 1008 "Energy" (kcal) first. Foundation foods often have no 1008, only
//   2048 "Energy (Atwater Specific Factors)" and 2047 "Energy (Atwater General Factors)":
//   then 2048, then 2047. Last: 1062 Energy in kJ ÷ 4.184 (a unit change, not a guess).
//   kcal is NEVER worked out from protein / carbs / fat.
// - carbs: 1005 "Carbohydrate, by difference" first, then 1050 "Carbohydrate, by summation".
// - Units are checked: grams may come as G / MG / UG; a nutrient in a unit we don't expect is ignored.
// - If one nutrient comes twice, the first usable value wins (no adding, no mixing).

import type { FoodState, MacroKey, Macros, UsdaDataType, UsdaEnergyBasis, UsdaPortion, UsdaRawNutrient, UsdaSnap } from "../types.ts";

/** USDA nutrient ids (nutrient.id / nutrientId) and the old numbers (nutrient.number / nutrientNumber). */
export const USDA_NUTRIENTS = {
  energyKcal: { id: 1008, number: "208" },
  energyAtwaterSpecific: { id: 2048, number: "958" },
  energyAtwaterGeneral: { id: 2047, number: "957" },
  energyKj: { id: 1062, number: "268" },
  protein: { id: 1003, number: "203" },
  fat: { id: 1004, number: "204" },
  carbsByDifference: { id: 1005, number: "205" },
  carbsBySummation: { id: 1050, number: "205.2" },
  fiber: { id: 1079, number: "291" },
  sugars: { id: 2000, number: "269" },
  sugarsFoundation: { id: 1063, number: "269.3" },
  sodium: { id: 1093, number: "307" },
  saturatedFat: { id: 1258, number: "606" },
} as const;

type NutrientKey = keyof typeof USDA_NUTRIENTS;
const BY_NUMBER = new Map<string, NutrientKey>(Object.entries(USDA_NUTRIENTS).map(([k, v]) => [v.number, k as NutrientKey]));
const BY_ID = new Map<number, NutrientKey>(Object.entries(USDA_NUTRIENTS).map(([k, v]) => [v.id, k as NutrientKey]));

/** The unit each nutrient must end up in. */
const WANT: Record<NutrientKey, "kcal" | "kj" | "g" | "mg"> = {
  energyKcal: "kcal",
  energyAtwaterSpecific: "kcal",
  energyAtwaterGeneral: "kcal",
  energyKj: "kj",
  protein: "g",
  fat: "g",
  carbsByDifference: "g",
  carbsBySummation: "g",
  fiber: "g",
  sugars: "g",
  sugarsFoundation: "g",
  sodium: "mg",
  saturatedFat: "g",
};

/** A value in `unit` → the wanted unit. null = a unit we can't safely change. */
export function toUnit(value: number, unit: string, want: "kcal" | "kj" | "g" | "mg"): number | null {
  const u = unit.trim().toLowerCase();
  if (want === "kcal") return u === "kcal" ? value : null;
  if (want === "kj") return u === "kj" ? value : null;
  const toG: Record<string, number> = { g: 1, mg: 0.001, ug: 0.000001, "µg": 0.000001 };
  if (!(u in toG)) return null;
  const grams = value * toG[u];
  return want === "g" ? grams : grams * 1000;
}

type RawIn = Record<string, unknown>;

/** One nutrient row in any of USDA's shapes → id/number/unit/value. null = can't read it. */
export function readNutrientRow(row: RawIn): { key: NutrientKey; id: number; unit: string; value: number } | null {
  const inner = (row.nutrient && typeof row.nutrient === "object" ? row.nutrient : null) as RawIn | null;
  const idRaw = inner?.id ?? row.nutrientId;
  const numRaw = inner?.number ?? row.nutrientNumber ?? row.number;
  const unitRaw = inner?.unitName ?? row.unitName;
  const valRaw = row.amount ?? row.value;
  const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
  const key = (Number.isFinite(id) ? BY_ID.get(id) : undefined) ?? (numRaw != null ? BY_NUMBER.get(String(numRaw)) : undefined);
  if (!key) return null;
  const value = typeof valRaw === "number" ? valRaw : typeof valRaw === "string" && valRaw.trim() ? Number(valRaw) : NaN;
  if (!Number.isFinite(value) || value < 0) return null; // no number = unknown, never 0
  if (typeof unitRaw !== "string") return null;
  return { key, id: USDA_NUTRIENTS[key].id, unit: unitRaw, value };
}

export type UsdaNutrients = {
  kcal: number | null;
  energy: UsdaEnergyBasis | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodiumMg: number | null;
  satFat: number | null;
  raw: UsdaRawNutrient[];
};

/** All the nutrient rows → SnapCal's nutrients per 100 g. Missing = null (unknown). */
export function mapNutrients(rows: unknown): UsdaNutrients {
  const got = new Map<NutrientKey, number>();
  const raw: UsdaRawNutrient[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== "object") continue;
    const n = readNutrientRow(r as RawIn);
    if (!n || got.has(n.key)) continue; // first usable value wins
    const v = toUnit(n.value, n.unit, WANT[n.key]);
    if (v == null) continue;
    got.set(n.key, v);
    raw.push({ id: n.id, unit: n.unit, value: n.value });
  }
  const g = (k: NutrientKey) => (got.has(k) ? got.get(k)! : null);
  let kcal: number | null = null;
  let energy: UsdaEnergyBasis | null = null;
  if (g("energyKcal") != null) [kcal, energy] = [g("energyKcal"), "1008"];
  else if (g("energyAtwaterSpecific") != null) [kcal, energy] = [g("energyAtwaterSpecific"), "2048"];
  else if (g("energyAtwaterGeneral") != null) [kcal, energy] = [g("energyAtwaterGeneral"), "2047"];
  else if (g("energyKj") != null) [kcal, energy] = [g("energyKj")! / 4.184, "kj"];
  return {
    kcal: kcal == null ? null : round1(kcal),
    energy,
    protein: nr(g("protein")),
    carbs: nr(g("carbsByDifference") ?? g("carbsBySummation")),
    fat: nr(g("fat")),
    fiber: nr(g("fiber")),
    sugar: nr(g("sugars") ?? g("sugarsFoundation")),
    sodiumMg: nr(g("sodium")),
    satFat: nr(g("saturatedFat")),
    raw,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const nr = (v: number | null) => (v == null ? null : round2(v));

/** USDA's data type text → ours. null = a data type we don't use (e.g. Experimental). */
export function dataTypeOf(v: unknown): UsdaDataType | null {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("foundation")) return "foundation";
  if (s.startsWith("sr legacy") || s === "sr") return "sr";
  if (s.includes("fndds") || s.startsWith("survey")) return "fndds";
  if (s.startsWith("branded")) return "branded";
  return null;
}

/** The names USDA's search wants for each data type. */
export const USDA_DATA_TYPE_NAME: Record<UsdaDataType, string> = {
  foundation: "Foundation",
  sr: "SR Legacy",
  fndds: "Survey (FNDDS)",
  branded: "Branded",
};

/** Plain words: what each data set is. */
export const DATA_TYPE_LABEL: Record<UsdaDataType, { th: string; en: string }> = {
  foundation: { th: "USDA วัตถุดิบ (วิเคราะห์จริง)", en: "USDA Foundation" },
  sr: { th: "USDA SR Legacy", en: "USDA SR Legacy" },
  fndds: { th: "USDA อาหารปรุงแล้ว (FNDDS)", en: "USDA FNDDS" },
  branded: { th: "USDA สินค้าแบรนด์", en: "USDA Branded" },
};

/** The state a USDA description says. "baked … from raw" = cooked (from raw tells how it started). */
export function stateFromDescription(desc: string): FoodState | null {
  const d = desc.toLowerCase().replace(/\bfrom (raw|fresh|frozen|dry|dried|canned)\b/g, " ");
  if (/\b(cooked|boiled|steamed|fried|roasted|baked|broiled|grilled|stewed|braised|rotisserie|poached|microwaved|sauteed|sautéed|scrambled|toasted)\b/.test(d)) return "cooked";
  if (/\b(dried|dehydrated)\b/.test(d)) return "dried";
  if (/\b(raw|uncooked|dry)\b/.test(d)) return "raw";
  return null;
}

/** USDA's household measures → our portions. Only real gram weights; "RACC"/"Quantity not specified" kept as plain labels. */
export function readPortions(food: RawIn): UsdaPortion[] {
  const list: UsdaPortion[] = [];
  const mlPer: Record<string, number> = { cup: 240, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, "fl oz": 29.57, ml: 1, milliliter: 1 };
  const portions = Array.isArray(food.foodPortions) ? (food.foodPortions as RawIn[]) : [];
  for (const p of portions) {
    const grams = typeof p.gramWeight === "number" ? p.gramWeight : NaN;
    if (!(grams > 0) || grams > 5000) continue;
    const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : 1;
    const unitName = p.measureUnit && typeof p.measureUnit === "object" ? String((p.measureUnit as RawIn).name ?? "") : "";
    const desc = String(p.portionDescription ?? p.modifier ?? "").trim();
    // "RACC" = USDA's standard serving size. Shown in plain words.
    const unitWord = unitName === "RACC" ? "serving (RACC)" : unitName && unitName !== "undetermined" ? unitName : "";
    const named = desc && !/^quantity not specified$/i.test(desc) ? (unitWord && !desc.toLowerCase().includes(unitWord.toLowerCase()) ? `${unitWord} ${desc}` : desc) : unitWord || "serving";
    // Always say how many: "cup" → "1 cup" (unless USDA's text already starts with a number).
    const label = (/^\d/.test(named) ? named : `${amount} ${named}`).replace(/\s+/g, " ").trim();
    // ml of this portion, when it is a cup / spoon / fl oz measure (for grams-per-ml).
    const text = `${unitWord} ${desc}`.toLowerCase();
    const mlKey = Object.keys(mlPer).find((k) => new RegExp(`\\b${k}\\b`).test(text));
    let ml: number | null = mlKey ? amount * mlPer[mlKey] : null;
    // "1 cup" in a description like "1 cup, chopped" has amount 1 already; "2 tbsp" in the text overrides.
    const m = desc.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(cup|tbsp|tablespoon|tsp|teaspoon|fl oz)/i);
    if (m) {
      const n = m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1]);
      ml = n * mlPer[m[2].toLowerCase()];
    }
    list.push({ label, grams: round1(grams), ml: ml && ml > 0 ? round1(ml) : null });
    if (list.length >= 8) break;
  }
  return list;
}

/**
 * Grams in 1 ml from USDA's own cup / spoon weights. Only for foods measured as a liquid or
 * a pourable solid (0.2–2.5 g/ml). Several measures → the first one. null = unknown (the app asks).
 */
export function densityFromPortions(portions: UsdaPortion[]): number | null {
  for (const p of portions) {
    if (!p.ml) continue;
    const d = p.grams / p.ml;
    if (d > 0.2 && d < 2.5) return round2(d);
  }
  return null;
}

/** Is a Branded product measured in ml (a drink)? Then its numbers are per 100 ml. */
function brandedPer(food: RawIn): "g" | "ml" {
  const u = String(food.servingSizeUnit ?? "").toLowerCase();
  return u === "ml" || u === "mlt" ? "ml" : "g";
}

/** A food from search or details, ready to show and to use. kcal null = can't be used (no energy value). */
export type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: UsdaDataType;
  brand: string | null;
  category: string | null;
  nutrients: UsdaNutrients;
  per: "g" | "ml";
  state: FoodState | null;
  portions: UsdaPortion[];
  gPerMl: number | null;
};

/** One raw USDA food (search hit or details) → UsdaFood. null = not a food we can use. Never throws. */
export function normalizeUsdaFood(food: unknown): UsdaFood | null {
  if (!food || typeof food !== "object") return null;
  const f = food as RawIn;
  const fdcId = typeof f.fdcId === "number" ? f.fdcId : Number(f.fdcId);
  const dataType = dataTypeOf(f.dataType);
  const description = typeof f.description === "string" ? f.description.trim() : "";
  if (!Number.isInteger(fdcId) || fdcId <= 0 || !dataType || !description) return null;
  const cat = f.foodCategory;
  const category = typeof cat === "string" ? cat : cat && typeof cat === "object" ? String((cat as RawIn).description ?? "") || null : typeof f.brandedFoodCategory === "string" ? f.brandedFoodCategory : null;
  const brand = dataType === "branded" ? [f.brandName, f.brandOwner].find((b) => typeof b === "string" && b.trim()) : null;
  const portions = readPortions(f);
  return {
    fdcId,
    description,
    dataType,
    brand: typeof brand === "string" ? brand.trim() : null,
    category,
    nutrients: mapNutrients(f.foodNutrients),
    per: dataType === "branded" ? brandedPer(f) : "g",
    state: stateFromDescription(description),
    portions,
    gPerMl: densityFromPortions(portions),
  };
}

/** Which of protein / carbs / fat USDA did not give. */
export function usdaMissing(n: UsdaNutrients): MacroKey[] {
  return (["protein", "carbs", "fat"] as const).filter((k) => n[k] == null);
}

/** A food she confirmed → the frozen copy kept on the ingredient / item. null = no kcal value (can't be used). */
export function toSnap(food: UsdaFood, now = Date.now()): UsdaSnap | null {
  const n = food.nutrients;
  if (n.kcal == null || !n.energy) return null;
  const per100: Macros = { kcal: n.kcal, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0 };
  const snap: UsdaSnap = {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    per100,
    per: food.per,
    energy: n.energy,
    state: food.state,
    raw: n.raw,
    fetchedAt: now,
  };
  if (food.brand) snap.brand = food.brand;
  const missing = usdaMissing(n);
  if (missing.length) snap.missing = missing;
  const extra: NonNullable<UsdaSnap["extra"]> = {};
  if (n.fiber != null) extra.fiber = n.fiber;
  if (n.sugar != null) extra.sugar = n.sugar;
  if (n.sodiumMg != null) extra.sodiumMg = n.sodiumMg;
  if (n.satFat != null) extra.satFat = n.satFat;
  if (Object.keys(extra).length) snap.extra = extra;
  return snap;
}
