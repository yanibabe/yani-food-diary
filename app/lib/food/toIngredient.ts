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

// ---------------------------------------------------------------------------
// Round 38: any photos of one product (front, back, label…).
// Real label numbers win. No numbers → average values for that food (an estimate).
// ---------------------------------------------------------------------------

/** What /api/food/pack-photos answers. */
export type PackResult = {
  product: { name: string | null; netG: number | null; liquid: boolean };
  label: PackLabel | null;
  /** Typical values per 100 g for that food, only when the photos had no numbers. */
  average: { kcal: number; protein: number; carbs: number; fat: number; unitG: number | null; gPerMl: number | null } | null;
};

/** How it filled: real label, average estimate, only the name/size, or nothing new. */
export type PackFill = { patch: Partial<Ingredient>; kind: "label" | "average" | "nameOnly" | "nothing" };

export function ingredientFromPack(ing: Ingredient, r: PackResult): PackFill {
  const typedName = ing.name.trim();
  const name = typedName || r.product.name || "";
  const packG = r.product.netG && r.product.netG > 0 ? r.product.netG : null;

  if (r.label && r.label.servingG > 0 && Number.isFinite(r.label.kcal)) {
    const s = r.label.servingG;
    const per = (v: number | null) => ((v ?? 0) / s) * 100;
    const patch = fill(
      ing,
      r.product.name,
      { kcal: per(r.label.kcal), protein: per(r.label.protein), carbs: per(r.label.carbs), fat: per(r.label.fat) },
      packG ?? s,
      r.label.liquid || r.product.liquid,
    );
    return { patch, kind: "label" };
  }

  // No numbers in the photos: keep the name and pack size she can see.
  const patch: Partial<Ingredient> = {};
  if (!typedName && r.product.name) patch.name = r.product.name;
  if (!(ing.amount > 0) && packG) {
    patch.amount = packG;
    patch.unit = r.product.liquid ? "ml" : "g";
  } else if (ing.amount > 0 && unitKind(ing.unit) === "count" && !ing.gramsPerUnit && packG) {
    patch.gramsPerUnit = packG;
  }
  // Her own label numbers (typed earlier) are never replaced by an average.
  if (r.average && name && !ing.label) {
    const a = r.average;
    patch.aiRef = { name, per100: { kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat }, unitG: a.unitG, gPerMl: a.gPerMl, unitFor: null };
    return { patch, kind: "average" };
  }
  return { patch, kind: Object.keys(patch).length ? "nameOnly" : "nothing" };
}
