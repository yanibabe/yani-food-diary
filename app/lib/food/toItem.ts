// Turn an outside-database food (per 100 g) into one meal item for the grams eaten.
// Label values: no +15% margin. A missing nutrient counts as 0 and the item is marked "estimated".

import type { FoodItem } from "../types.ts";
import type { Food } from "./provider.ts";

export function foodToItem(food: Food, grams: number, id: string, fallbackName: string): FoodItem {
  const f = grams > 0 ? grams / 100 : 0;
  const per = (v: number | null) => Math.round((v ?? 0) * f * 10) / 10;
  const missing = [food.kcal, food.protein, food.carbs, food.fat].some((v) => v == null);
  return {
    id,
    name: food.name ?? fallbackName,
    amount: grams,
    unit: "g",
    kcal: Math.round((food.kcal ?? 0) * f),
    protein: per(food.protein),
    carbs: per(food.carbs),
    fat: per(food.fat),
    estimated: missing,
    kind: "food",
    note: food.brand,
    box: null,
    margin: false,
    ref: { source: food.source, sourceId: food.sourceId },
  };
}
