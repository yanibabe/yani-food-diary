import { findRef } from "./foodRef.ts";
import { scaleMacros, sumMacros, ZERO } from "./nutrition.ts";
import type { Ingredient, Macros, Recipe } from "./types.ts";

export type IngredientResult =
  | { ok: true; macros: Macros; source: "label" | "estimate"; refName: string | null }
  | {
      ok: false;
      reason: "need-weight-per-unit" | "no-data";
      message: string;
    };

/**
 * Work out one ingredient's calories and nutrients.
 * Order: label values first; built-in estimate only if there is no label.
 * If units don't match (e.g. label per 100 g but amount in "ฟอง"), it asks
 * for the weight of one unit instead of guessing.
 */
export function ingredientMacros(ing: Ingredient): IngredientResult {
  const amount = ing.amount > 0 ? ing.amount : 0;
  const isCountUnit = ing.unit === "egg" || ing.unit === "piece";
  const gpu = ing.gramsPerUnit && ing.gramsPerUnit > 0 ? ing.gramsPerUnit : null;
  const unitWord = ing.unit === "egg" ? "ฟอง" : "ชิ้น";

  if (ing.label) {
    const label: Macros = ing.label;
    if (ing.label.basis === "per100") {
      let grams: number;
      if (isCountUnit) {
        if (!gpu)
          return {
            ok: false,
            reason: "need-weight-per-unit",
            message: `ฉลากเป็นค่าต่อ 100 กรัม แต่ใส่เป็น${unitWord} — ช่วยใส่น้ำหนักต่อ 1 ${unitWord}`,
          };
        grams = amount * gpu;
      } else {
        grams = amount; // g, or ml treated as the label's 100 ml
      }
      return { ok: true, macros: scaleMacros(label, grams / 100), source: "label", refName: null };
    }
    // perUnit: label is for one egg / one piece
    if (isCountUnit) {
      return { ok: true, macros: scaleMacros(label, amount), source: "label", refName: null };
    }
    if (!gpu)
      return {
        ok: false,
        reason: "need-weight-per-unit",
        message: "ฉลากเป็นค่าต่อ 1 ชิ้น แต่ใส่เป็นกรัม/มล. — ช่วยใส่น้ำหนักต่อ 1 ชิ้น",
      };
    return { ok: true, macros: scaleMacros(label, amount / gpu), source: "label", refName: null };
  }

  const ref = findRef(ing.name);
  if (!ref)
    return {
      ok: false,
      reason: "no-data",
      message: "ยังไม่มีค่าสารอาหาร — กรอกค่าจากฉลากได้เลย",
    };

  let grams: number;
  if (ing.unit === "g") grams = amount;
  else if (ing.unit === "ml") grams = amount * (ref.gPerMl ?? 1);
  else {
    const w = gpu ?? ref.unitG ?? null;
    if (!w)
      return {
        ok: false,
        reason: "need-weight-per-unit",
        message: `ช่วยใส่น้ำหนักต่อ 1 ${unitWord} เพื่อคำนวณ`,
      };
    grams = amount * w;
  }
  return { ok: true, macros: scaleMacros(ref.per100, grams / 100), source: "estimate", refName: ref.names[0] };
}

export type RecipeTotals = {
  total: Macros;
  perServing: Macros;
  /** grams per serving, if the cooked weight is known */
  perServingGrams: number | null;
  problems: { ingredientId: string; message: string }[];
  hasEstimate: boolean;
  complete: boolean;
};

export function recipeTotals(
  ingredients: Ingredient[],
  servings: number,
  cookedWeight: number | null,
): RecipeTotals {
  const problems: RecipeTotals["problems"] = [];
  const parts: Macros[] = [];
  let hasEstimate = false;
  for (const ing of ingredients) {
    const r = ingredientMacros(ing);
    if (r.ok) {
      parts.push(r.macros);
      if (r.source === "estimate") hasEstimate = true;
    } else {
      problems.push({ ingredientId: ing.id, message: r.message });
    }
  }
  const total = parts.length ? sumMacros(parts) : { ...ZERO };
  const s = servings > 0 ? servings : 1;
  return {
    total,
    perServing: scaleMacros(total, 1 / s),
    perServingGrams: cookedWeight && cookedWeight > 0 ? cookedWeight / s : null,
    problems,
    hasEstimate,
    complete: problems.length === 0,
  };
}

export function totalsForRecipe(r: Recipe): RecipeTotals {
  return recipeTotals(r.ingredients, r.servings, r.cookedWeight);
}

/**
 * How much of the whole recipe this meal is.
 * servings mode: eaten servings / recipe servings.
 * grams mode: eaten grams / cooked weight (needs cookedWeight).
 */
export function portionFraction(
  mode: "servings" | "grams",
  value: number,
  recipeServings: number,
  cookedWeight: number | null,
): number | null {
  if (!(value > 0)) return null;
  if (mode === "servings") return recipeServings > 0 ? value / recipeServings : null;
  if (!cookedWeight || cookedWeight <= 0) return null;
  return value / cookedWeight;
}

/** Nutrients for one meal from a recipe, using this meal's ingredient amounts. */
export function mealFromRecipe(
  ingredients: Ingredient[],
  recipeServings: number,
  cookedWeight: number | null,
  mode: "servings" | "grams",
  value: number,
): { macros: Macros; fraction: number } | null {
  const fraction = portionFraction(mode, value, recipeServings, cookedWeight);
  if (fraction == null) return null;
  const t = recipeTotals(ingredients, recipeServings, cookedWeight);
  if (!t.complete) return null;
  return { macros: scaleMacros(t.total, fraction), fraction };
}
