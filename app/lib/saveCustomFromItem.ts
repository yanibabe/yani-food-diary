// Round 45: "Save as my ingredient" on the Search food page.
// She typed a name + numbers in the manual item editor. These pure functions turn that item into a saved custom
// ingredient (same store the recipe page uses), find a same-name one, and rebuild an item from a saved one.
// Her typed numbers are never "verified". A number she left empty stays unknown (never 0).

import type { Lang } from "./i18n.ts";
import { addCustom, type CustomIngredient, type CustomInput } from "./customIngredients.ts";
import { buildIngredient, suggestedUnits, suggestionFromPick } from "./ingredientSearch.ts";
import { ingredientMacros } from "./recipe.ts";
import { ingredientToItem } from "./searchFood.ts";
import { UNITS, type FoodItem, type Ingredient, type MacroKey, type Macros } from "./types.ts";

/** "g" / "ml" words she may type as the unit. */
const GRAM_RE = /^(g|กรัม|ก\.|gram|grams)$/i;
const ML_RE = /^(ml|มล\.?|มิลลิลิตร)$/i;

/** What the editor shows as "per what": grams, millilitres, or one unit (serving, piece, plate…). */
export function itemBasis(item: Pick<FoodItem, "unit">): "g" | "ml" | "unit" {
  const u = item.unit.trim();
  return GRAM_RE.test(u) ? "g" : ML_RE.test(u) ? "ml" : "unit";
}

/**
 * The item's numbers are for "amount unit". Grams / ml → numbers per 100 g / 100 ml. Any other unit → numbers per ONE unit.
 * null = nothing to save yet (no amount). Numbers she left unknown stay null.
 */
export function customInputFromItem(item: FoodItem, exact?: Macros): CustomInput | null {
  if (!(item.amount > 0)) return null;
  const basis = itemBasis(item);
  const k = basis === "unit" ? 1 / item.amount : 100 / item.amount;
  const missing = new Set<MacroKey>(item.missing ?? []);
  // Phase 1: `exact` = the unrounded numbers for this amount. An item's own numbers are rounded (whole kcal,
  // 0.1 g) for display, and dividing a rounded number by a small amount magnifies the rounding.
  const val = (key: "kcal" | MacroKey) => exact?.[key] ?? item[key];
  const scale = (key: MacroKey) => (missing.has(key) ? null : val(key) * k);
  return {
    name: item.name,
    ...(item.alt ? { alt: item.alt } : {}),
    basis: basis === "unit" ? "perUnit" : "per100",
    per: basis === "ml" ? "ml" : "g",
    kcal: val("kcal") * k,
    protein: scale("protein"),
    carbs: scale("carbs"),
    fat: scale("fat"),
  };
}

/**
 * A food picked in the search sheet → what to save as "my ingredient". Same as customInputFromItem, but the
 * per-100 g numbers come from the unrounded math, not from the rounded meal item. null = numbers not known yet.
 */
export function customInputFromIngredient(ing: Ingredient, lang: Lang = "th"): CustomInput | null {
  const res = ingredientMacros(ing, lang);
  if (!res.ok) return null;
  const item = ingredientToItem(ing, "save", lang, 0);
  return item ? customInputFromItem(item, res.macros) : null;
}

const keyOf = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

/** A saved ingredient with the same name (and no state), if any: the one the duplicate rule refers to. */
export function findSameName(list: CustomIngredient[], name: string): CustomIngredient | null {
  const k = keyOf(name);
  return list.find((c) => keyOf(c.name) === k && !c.state) ?? null;
}

/** Save the item as one of her ingredients. Duplicate name → says so and hands back the existing one. */
export function saveItemAsCustom(list: CustomIngredient[], item: FoodItem, now: number):
  | { ok: true; list: CustomIngredient[]; item: CustomIngredient }
  | { ok: false; error: "name" | "kcal" | "number" | "amount" }
  | { ok: false; error: "duplicate"; existing: CustomIngredient } {
  const input = customInputFromItem(item);
  if (!input) return { ok: false, error: "amount" };
  const r = addCustom(list, input, now);
  if (r.ok) return r;
  if (r.error === "duplicate") {
    const existing = findSameName(list, item.name);
    if (existing) return { ok: false, error: "duplicate", existing };
  }
  return { ok: false, error: r.error === "duplicate" ? "name" : r.error };
}

/**
 * "Use the existing one": the review item rebuilt from her saved ingredient (same id, so it replaces the typed one).
 * She keeps her typed amount when the unit fits (same g / ml); otherwise 100 g (or 1 unit) to start.
 */
export function itemFromCustom(c: CustomIngredient, old: Pick<FoodItem, "id" | "amount" | "unit">, lang: Lang = "th"): FoodItem | null {
  const sug = suggestionFromPick({ kind: "custom", id: c.id, name: c.name }, lang, [c], "custom");
  if (!sug) return null;
  const unit = suggestedUnits(sug).default;
  const kept = c.basis === "per100" && old.amount > 0 && itemBasis(old) === c.per;
  const amount = kept ? old.amount : c.basis === "per100" ? 100 : 1;
  const ing = buildIngredient(sug, amount, kept ? c.per : unit in UNITS ? unit : "g");
  if (!ingredientMacros(ing, lang).ok) return null;
  const item = ingredientToItem(ing, old.id, lang, 0);
  return item;
}
