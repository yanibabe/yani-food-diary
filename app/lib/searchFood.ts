// Round 44: "Search food". One searched food (an Ingredient made by the search box) → one meal item.
// Pure functions only (no React, no browser) so the tests can run them.
//
// Rules (same as the recipe path, nothing new is invented):
//  - Numbers come from ingredientMacros(), the same math the recipe uses. Provenance is its `prov`:
//    USDA / reference / AI estimate / her typed numbers. Never "verified".
//  - A nutrient the source did not give stays unknown (item.missing), never a real 0.
//  - The Smart Calorie Buffer is added to a fresh AI guess only (startBuffer decides). Nothing else.
//  - Nothing is saved here: the item goes to the normal review screen first.

import { aiDairy } from "./dairy.ts";
import type { Lang } from "./i18n.ts";
import { startBuffer } from "./calorieBuffer.ts";
import { ingredientMacros } from "./recipe.ts";
import { UNITS, type FoodItem, type Ingredient } from "./types.ts";

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The unit word shown in the review: "g" and "ml" as they are, other units in her language. */
export function unitWord(ing: Pick<Ingredient, "unit">, lang: Lang): string {
  const u = UNITS[ing.unit] ?? UNITS.g;
  return ing.unit === "g" || ing.unit === "ml" ? u.en : u[lang];
}

/**
 * Turn the chosen ingredient into one meal item. null = the math still has a question
 * (weight of one piece, density…): the screen does not let her add until that is answered.
 */
export function ingredientToItem(ing: Ingredient, id: string, lang: Lang = "th", bufferPct = 0): FoodItem | null {
  const res = ingredientMacros(ing, lang);
  if (!res.ok) return null;
  const item: FoodItem = {
    id,
    name: ing.name.trim(),
    amount: ing.amount,
    unit: unitWord(ing, lang),
    kcal: Math.round(res.macros.kcal),
    protein: r1(res.macros.protein),
    carbs: r1(res.macros.carbs),
    fat: r1(res.macros.fat),
    // Same as the recipe path: an estimate when the source is an estimate (reference table, AI).
    estimated: res.prov.verification === "estimated",
    kind: "food",
    note: null,
    box: null,
    dairy: aiDairy(ing.name, undefined),
    prov: res.prov,
  };
  if (res.missing.length) item.missing = [...res.missing];
  // A USDA food she picked in plain grams / ml: keep USDA's frozen numbers on the item, so a later
  // "ate half" in review rescales from USDA's own values (same as Round 41).
  if (ing.usda && ing.usda.name === item.name && (ing.unit === "g" || ing.unit === "ml") && ing.usda.per === ing.unit) {
    const { name: _n, portions: _p, gPerMl: _g, ...snap } = ing.usda;
    void _n;
    void _p;
    void _g;
    item.usda = snap;
    item.ref = { source: "usda", sourceId: String(snap.fdcId) };
  }
  // Round 40: a fresh AI guess may get her buffer (kcal only). Every other source is returned unchanged.
  // If she typed the weight herself (g / ml) the AI did not guess the amount → no buffer (her Round 40 rule).
  if (ing.unit === "g" || ing.unit === "ml") return item;
  return startBuffer(item, bufferPct);
}
