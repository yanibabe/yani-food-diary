// Round 35: fill one recipe ingredient from a scan, so she doesn't have to type it.
// - Barcode → the product (per 100 g) from Open Food Facts (with her own label fix, if she saved one).
// - Photo of the label → the AI reads the pack's numbers (per one pack) → turned into per 100 g.
// What she already typed is kept: her name, her amount and her unit.
// No React and no browser storage here, so the tests can use it.

import { unitKind, type Ingredient } from "../types.ts";
import { servingGrams, servingIsLiquid, type Food } from "./provider.ts";

/** What the label-photo AI answers: numbers for ONE pack / serving as printed. */
export type PackLabel = {
  servingG: number;
  liquid: boolean;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Shared rules: label per 100 g + the pack size fill only the empty fields. */
function fill(ing: Ingredient, name: string | null, per100: { kcal: number; protein: number; carbs: number; fat: number }, packG: number | null, liquid: boolean): Partial<Ingredient> {
  const patch: Partial<Ingredient> = {
    label: { basis: "per100", kcal: r1(per100.kcal), protein: r1(per100.protein), carbs: r1(per100.carbs), fat: r1(per100.fat) },
  };
  if (!ing.name.trim() && name) patch.name = name;
  if (!(ing.amount > 0)) {
    // Nothing typed yet → one whole pack, in g (or mL for drinks).
    patch.unit = liquid ? "ml" : "g";
    if (packG) patch.amount = packG;
  } else if (unitKind(ing.unit) === "count" && !ing.gramsPerUnit && packG) {
    // She counts in packs / sachets / bottles → one of them weighs one pack.
    patch.gramsPerUnit = packG;
  }
  return patch;
}

/** A product found by barcode → the fields to change on the ingredient. null = no calories to use. */
export function ingredientFromFood(ing: Ingredient, food: Food): Partial<Ingredient> | null {
  if (food.kcal == null) return null;
  const name = [food.name, food.brand].filter(Boolean).join(" · ") || null;
  return fill(
    ing,
    name,
    { kcal: food.kcal, protein: food.protein ?? 0, carbs: food.carbs ?? 0, fat: food.fat ?? 0 },
    servingGrams(food.servingSize),
    servingIsLiquid(food.servingSize),
  );
}

/** The label photo's per-pack numbers → the fields to change on the ingredient. */
export function ingredientFromLabel(ing: Ingredient, label: PackLabel): Partial<Ingredient> | null {
  const s = label.servingG;
  if (!(s > 0) || !Number.isFinite(label.kcal)) return null;
  const per = (v: number | null) => ((v ?? 0) / s) * 100;
  return fill(ing, null, { kcal: per(label.kcal), protein: per(label.protein), carbs: per(label.carbs), fat: per(label.fat) }, s, label.liquid);
}
