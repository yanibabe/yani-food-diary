// Round 77: the bundled food table (app/data/food-db.json) as a second source for the ingredient search.
// SERVER ONLY. Live USDA search can answer with 12 odd foods and no plain one ("potato" → potato flour,
// potato pancakes…), so the same English words are also looked up in the local table, and both lists
// are ranked together. The ids ARE real USDA fdcIds, so a pick works exactly like a live USDA row.
//
// Rules (same as usdaNutrients.ts): a nutrient the table doesn't have stays null (unknown), never 0.
// The app's own reference rows ("ref:…", rough typical values) are NOT used here: they are not USDA foods.

import { foodById, searchFoods, type DbFood } from "../server/foodDb.ts";
import { densityFromPortions, stateFromDescription, type UsdaFood } from "./usdaNutrients.ts";
import type { UsdaDataType, UsdaPortion } from "../types.ts";

const TYPE_OF: Record<string, UsdaDataType> = { f: "foundation", s: "sr", n: "fndds" };
const ML_PER: Record<string, number> = { cup: 240, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, "fl oz": 29.57 };

/** "1 RACC" is USDA's standard serving; shown in plain words like readPortions does. */
function portionOf([label, grams]: [string, number]): UsdaPortion | null {
  if (!(grams > 0) || grams > 5000) return null;
  const m = label.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*(cup|tbsp|tablespoon|tsp|teaspoon|fl oz)\b/i);
  let ml: number | null = null;
  if (m) {
    const n = m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1]);
    ml = Math.round(n * ML_PER[m[2].toLowerCase()] * 10) / 10;
  }
  return { label: label.replace(/\bRACC\b/, "serving (RACC)"), grams, ml };
}

/** A food-table row → the same UsdaFood the live USDA answer becomes. null = not a USDA food (reference row). */
export function dbFoodToUsda(f: DbFood): UsdaFood | null {
  const dataType = TYPE_OF[f.src];
  const fdcId = Number(f.id);
  if (!dataType || !Number.isInteger(fdcId) || fdcId <= 0) return null;
  const portions = f.portions.map(portionOf).filter((p): p is UsdaPortion => !!p).slice(0, 8);
  const p = f.per100;
  return {
    fdcId,
    description: f.name,
    dataType,
    brand: null,
    category: null,
    nutrients: { kcal: p.kcal, energy: "1008", protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber, sugar: p.sugar, sodiumMg: p.sodiumMg, satFat: null, raw: [] },
    per: "g",
    state: stateFromDescription(f.name),
    portions,
    gPerMl: densityFromPortions(portions),
  };
}

/** The best local USDA foods for English search words (reference rows left out). */
export function localUsdaSearch(query: string, limit = 400): UsdaFood[] {
  const out: UsdaFood[] = [];
  for (const c of searchFoods(query, { limit: limit + 10, dedupe: false })) {
    const u = dbFoodToUsda(c);
    if (u) out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}

/** One food by USDA id, answered locally. null = not in the table (ask live USDA). */
export function localUsdaFood(fdcId: number): UsdaFood | null {
  if (!Number.isInteger(fdcId) || fdcId <= 0) return null;
  const f = foodById(String(fdcId));
  return f ? dbFoodToUsda(f) : null;
}
