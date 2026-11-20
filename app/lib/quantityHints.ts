// Batch 1: one-tap amounts for the ingredient picker. Pure helpers: they only suggest numbers to put in the
// Amount box. The calories are still worked out by the existing ingredient math from whatever amount ends up there.

import { UNITS, type IngredientUnit } from "./types.ts";

/** A few usual amounts for a unit (what people really type: 100 g, 1 egg, 2 spoons…). */
export function quickAmounts(unit: IngredientUnit): number[] {
  switch (unit) {
    case "g":
    case "ml":
      return [50, 100, 150, 200];
    case "kg":
    case "l":
      return [0.5, 1, 1.5];
    case "oz":
      return [2, 4, 8];
    case "tsp":
    case "tbsp":
      return [1, 2, 3];
    case "cup":
      return [0.5, 1, 2];
    default:
      // pieces, plates, bowls…
      return UNITS[unit] ? [0.5, 1, 2, 3] : [1, 2, 3];
  }
}
