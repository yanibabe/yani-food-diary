// Turn an outside-database food (per 100 g) into one meal item for the grams eaten.
// Label values: no +15% margin.
// Round 39: a nutrient the database didn't give is kept as UNKNOWN (listed in `missing`),
// not shown as a real 0. The item is marked "estimated" only when the calories are unknown.
// Drinks: Open Food Facts gives drink values per 100 mL, so mL eaten × value per 100 is used as-is.

import type { FoodItem, Provenance, UsdaSnap } from "../types.ts";
import { missingFrom, usdaProvenance } from "../provenance.ts";
import { servingIsLiquid, type Food } from "./provider.ts";

/** Where a database food's numbers came from: the database itself, or her own label fix. */
export function foodProvenance(food: Food): Provenance {
  if (food.fixedBy === "photo") return { source: "label", verification: "unverified", via: "fix-photo" };
  if (food.fixedBy === "typed") return { source: "user", verification: "unverified", via: "fix-typed" };
  if (food.fixedBy === "unknown") return { source: "unknown", verification: "unknown", via: "fix" };
  return { source: "database", verification: "unverified", via: food.source };
}

export function foodToItem(food: Food, grams: number, id: string, fallbackName: string): FoodItem {
  const f = grams > 0 ? grams / 100 : 0;
  const per = (v: number | null) => Math.round((v ?? 0) * f * 10) / 10;
  const missing = missingFrom(food);
  const item: FoodItem = {
    id,
    name: food.name ?? fallbackName,
    amount: grams,
    unit: servingIsLiquid(food.servingSize) ? "mL" : "g",
    kcal: Math.round((food.kcal ?? 0) * f),
    protein: per(food.protein),
    carbs: per(food.carbs),
    fat: per(food.fat),
    estimated: food.kcal == null,
    kind: "food",
    note: food.brand,
    box: null,
    margin: false,
    ref: { source: food.source, sourceId: food.sourceId },
    prov: foodProvenance(food),
  };
  if (missing.length) item.missing = missing;
  return item;
}

// ---------------------------------------------------------------------------
// Round 41: she confirmed a USDA food for one meal item.
// - Only her own action does this (never by itself). Her name for the item is kept.
// - Numbers = USDA per 100 × the grams (or ml) she confirmed. Not an AI guess → no calorie buffer.
// - The AI's own kcal and buffer are dropped from THIS item only; other items in the meal
//   (e.g. the cooking oil the AI guessed) keep theirs.
// - Nutrients USDA didn't give stay unknown.
// ---------------------------------------------------------------------------

export function applyUsdaToItem(item: FoodItem, snap: UsdaSnap, amount: number): FoodItem {
  const f = amount > 0 ? amount / 100 : 0;
  const r1 = (v: number) => Math.round(v * f * 10) / 10;
  const { aiKcal: _a, bufferPct: _b, missing: _m, ...rest } = item;
  void _a;
  void _b;
  void _m;
  const out: FoodItem = {
    ...rest,
    amount,
    unit: snap.per === "ml" ? "ml" : "g",
    kcal: Math.round(snap.per100.kcal * f),
    protein: r1(snap.per100.protein),
    carbs: r1(snap.per100.carbs),
    fat: r1(snap.per100.fat),
    estimated: false,
    // Old items with the pre-Round-40 +15%: the new numbers don't have it.
    margin: false,
    fromLabel: false,
    ref: { source: "usda", sourceId: String(snap.fdcId) },
    prov: usdaProvenance(snap),
    usda: snap,
  };
  if (snap.missing?.length) out.missing = [...snap.missing];
  return out;
}
