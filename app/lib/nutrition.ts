import type { Box, FoodItem, Macros } from "./types.ts";

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((acc, m) => addMacros(acc, m), { ...ZERO });
}

export function pickMacros(m: Macros): Macros {
  return { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
}

// Round 40: the old automatic +15% (AI_MARGIN / withMargin / markMargin) is gone.
// The optional, kcal-only buffer lives in calorieBuffer.ts.

/** Change an item's amount and scale its numbers in proportion. */
export function changeAmount(item: FoodItem, newAmount: number): FoodItem {
  if (!(newAmount >= 0)) return item;
  if (item.amount > 0) {
    const f = newAmount / item.amount;
    const out: FoodItem = { ...item, ...scaleMacros(item, f), amount: newAmount };
    // Round 40: the AI's own kcal scales too, so the buffer stays the same %.
    if (item.aiKcal != null) out.aiKcal = item.aiKcal * f;
    return out;
  }
  return { ...item, amount: newAmount };
}

/**
 * Phase 1: typing an amount like "0.5" passes through "0" first. Scaling by 0 wipes the numbers, and from
 * amount 0 there is nothing left to scale back from. `base` is the last version of the item that had a
 * real amount (the editor remembers it). When the item sits at amount 0 with its numbers still all 0
 * (nothing typed by her), the new amount scales from `base`, so "0" → "0." → "0.5" ends with the right
 * calories. If she typed her own numbers meanwhile, those are kept (no scaling from base).
 */
export function editAmount(item: FoodItem, base: FoodItem | null | undefined, newAmount: number): FoodItem {
  if (!(newAmount >= 0)) return item;
  const wiped = item.amount === 0 && item.kcal === 0 && item.protein === 0 && item.carbs === 0 && item.fat === 0;
  if (wiped && newAmount > 0 && base && base.id === item.id && base.amount > 0) return changeAmount(base, newAmount);
  return changeAmount(item, newAmount);
}

export function round(n: number, digits = 0): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

/** Show a number nicely: whole kcal, 1 decimal for grams. */
export function fmtKcal(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
export function fmtG(n: number): string {
  const r = round(n, 1);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
export function fmtAmount(n: number): string {
  const r = round(n, 2);
  return String(r);
}

export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Round 39: a 4/4/9 check. A HINT only — it never changes any number.
// Protein and carbs give about 4 kcal per gram, fat about 9. Real labels can differ because
// fibre gives only ~2 kcal/g, sugar alcohols less, alcohol ~7 kcal/g, and labels round their
// numbers. So only a clear gap counts: more than 20 kcal AND more than 20%.
// ---------------------------------------------------------------------------

export type EnergyCheck = {
  /** ok = close enough; high = more kcal than the nutrients explain; low = fewer; unknown = can't check. */
  status: "ok" | "high" | "low" | "unknown";
  /** kcal from protein×4 + carbs×4 + fat×9. */
  fromMacros: number;
};

export const ENERGY_CHECK_MIN_KCAL = 20;
export const ENERGY_CHECK_SHARE = 0.2;

export function energyCheck(m: Macros, missing?: readonly string[] | null): EnergyCheck {
  const fromMacros = Math.max(0, m.protein) * 4 + Math.max(0, m.carbs) * 4 + Math.max(0, m.fat) * 9;
  if (missing && missing.length) return { status: "unknown", fromMacros };
  if (!Number.isFinite(m.kcal) || !Number.isFinite(fromMacros)) return { status: "unknown", fromMacros };
  const bigger = Math.max(m.kcal, fromMacros);
  const allowed = Math.max(ENERGY_CHECK_MIN_KCAL, bigger * ENERGY_CHECK_SHARE);
  const gap = m.kcal - fromMacros;
  return { status: gap > allowed ? "high" : -gap > allowed ? "low" : "ok", fromMacros };
}

/** unit: the default unit word, in the app language (e.g. "จาน" / "plate"). */
export function blankItem(unit = "จาน"): FoodItem {
  return {
    id: newId("it"),
    name: "",
    amount: 1,
    unit,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    estimated: false,
    kind: "food",
    note: null,
    box: null,
    // Round 39: an item she adds herself = her own numbers.
    prov: { source: "user", verification: "unverified", via: "typed" },
  };
}

/** Make sure numbers from AI or a form are safe, non-negative numbers. */
export function cleanNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function cleanBox(b: Box | null | undefined): Box | null {
  if (!b) return null;
  const c = (v: number) => Math.min(1, Math.max(0, Number(v) || 0));
  const box = { x: c(b.x), y: c(b.y), w: c(b.w), h: c(b.h) };
  if (box.w <= 0.01 || box.h <= 0.01) return null;
  return box;
}
