import { matchRef, refByKey, type RefFood } from "./foodRef.ts";
import { trFor, type Lang } from "./i18n.ts";
import { scaleMacros, sumMacros, ZERO } from "./nutrition.ts";
import { ingredientProvenance, joinMissing, recipeProvenance } from "./provenance.ts";
import { PIECE_LIKE, UNITS, unitKind, type FoodState, type Ingredient, type MacroKey, type Macros, type Provenance, type Recipe } from "./types.ts";

export type IngredientResult =
  | {
      ok: true;
      macros: Macros;
      source: "label" | "estimate";
      refName: string | null;
      /** Round 39: where the numbers came from + how sure. */
      prov: Provenance;
      /** Round 39: nutrients the source didn't give (counted as 0 in the sum, shown as unknown). */
      missing: MacroKey[];
      /** Round 39: the state the values are for, if known. */
      state: FoodState | null;
    }
  | {
      ok: false;
      reason: "need-weight-per-unit" | "need-density" | "ambiguous" | "no-data";
      message: string;
      /** For "ambiguous": the reference foods she can pick from. */
      options?: RefFood[];
    };

/**
 * Grams in 1 ml for this ingredient: her own number first, then the AI's, then the reference table.
 * null = not known. Round 39: the app never assumes 1 g/ml any more.
 */
export function densityFor(ing: Ingredient, aiGPerMl: number | null | undefined, refGPerMl: number | null | undefined): number | null {
  const ok = (v: number | null | undefined) => (v != null && v > 0.2 && v < 3 ? v : null);
  return ok(ing.gPerMl) ?? ok(aiGPerMl) ?? ok(refGPerMl);
}

/**
 * Work out one ingredient's calories and nutrients.
 * Order: label values first; then the reference food she picked; then the AI's values for
 * this name; then a CLEAR match in the small built-in table. An unclear name is never
 * matched by itself — it asks her to pick. kg and liters are turned into grams / ml.
 * If units don't match (e.g. label per 100 g but amount in "ฟอง"), it asks
 * for the weight of one unit instead of guessing. Spoons/cups of a food that is
 * counted per 100 g need its density; if it isn't known, it asks.
 */
export function ingredientMacros(ing: Ingredient, lang: Lang = "th"): IngredientResult {
  const t = trFor(lang);
  const raw = ing.amount > 0 ? ing.amount : 0;
  // Every weight unit → grams, every volume unit → ml. Counted units stay as a count.
  const kind = unitKind(ing.unit);
  const def = UNITS[ing.unit] ?? UNITS.g;
  const amount = kind === "count" ? raw : raw * def.factor;
  const isCountUnit = kind === "count";
  const gpu = ing.gramsPerUnit && ing.gramsPerUnit > 0 ? ing.gramsPerUnit : null;
  const unitWord = isCountUnit ? def[lang] : t("ชิ้น", "piece");
  const name = ing.name.trim();
  const ai = ing.aiRef && ing.aiRef.name === name ? ing.aiRef : null;
  const picked = ing.refPick && ing.refPick.name === name ? refByKey(ing.refPick.key) : null;
  const match = picked || ai ? null : matchRef(name);
  const clear = match?.kind === "exact" ? match.food : null;
  const needDensity = (): IngredientResult => ({
    ok: false,
    reason: "need-density",
    message: t(
      `ช่วยใส่น้ำหนักต่อ 1 ${def[lang]} (กรัม) — ของแต่ละอย่างหนักไม่เท่ากัน`,
      `Please add the weight of 1 ${def[lang]} in grams — every food weighs a different amount`,
    ),
  });

  if (ing.label) {
    const label: Macros = ing.label;
    const done = (factor: number): IngredientResult => ({
      ok: true,
      macros: scaleMacros(label, factor),
      source: "label",
      refName: null,
      prov: ingredientProvenance(ing, "label"),
      missing: joinMissing(ing.label!.missing),
      state: null,
    });
    if (ing.label.basis === "per100") {
      if (isCountUnit) {
        if (!gpu)
          return {
            ok: false,
            reason: "need-weight-per-unit",
            message: t(
              `ฉลากเป็นค่าต่อ 100 กรัม แต่ใส่เป็น${unitWord} — ช่วยใส่น้ำหนักต่อ 1 ${unitWord}`,
              `The label is per 100 g, but the amount is in ${unitWord}s — please add the weight of 1 ${unitWord}`,
            ),
          };
        return done((amount * gpu) / 100);
      }
      // Older labels (no `per`) count the same kind as the amount, exactly as before Round 39.
      const per = ing.label.per ?? (kind === "volume" ? "ml" : "g");
      const have = kind === "volume" ? "ml" : "g";
      if (per === have) return done(amount / 100);
      const d = densityFor(ing, ai?.gPerMl, (picked ?? clear)?.gPerMl);
      if (!d) return needDensity();
      // label per 100 g, amount in ml → grams = ml × density; label per 100 ml, amount in g → ml = g ÷ density
      return done((have === "ml" ? amount * d : amount / d) / 100);
    }
    // perUnit: label is for one egg / one piece
    if (isCountUnit) return done(amount);
    if (!gpu)
      return {
        ok: false,
        reason: "need-weight-per-unit",
        message: t(
          "ฉลากเป็นค่าต่อ 1 ชิ้น แต่ใส่เป็นกรัม/มล. — ช่วยใส่น้ำหนักต่อ 1 ชิ้น",
          "The label is per 1 piece, but the amount is in g/ml — please add the weight of 1 piece",
        ),
      };
    return done(amount / gpu);
  }

  if (!picked && !ai && match?.kind === "ask")
    return {
      ok: false,
      reason: "ambiguous",
      message: t("ชื่อนี้มีได้หลายแบบ ค่าต่างกันมาก — เลือกว่าเป็นแบบไหน", "This name can mean different foods with very different values — pick which one"),
      options: match.options,
    };

  const refFood = picked ?? (ai ? null : clear);
  const ref = ai
    ? { per100: ai.per100, unitG: ai.unitG ?? undefined, gPerMl: ai.gPerMl ?? undefined }
    : refFood;
  if (!ref)
    return {
      ok: false,
      reason: "no-data",
      message: t("ยังไม่มีค่าสารอาหาร — ให้ AI หาค่า หรือกรอกค่าจากฉลาก", "No nutrition values yet — let the AI look them up, or add them from the label"),
    };

  let grams: number;
  if (kind === "mass") grams = amount;
  else if (kind === "volume") {
    const d = densityFor(ing, ai?.gPerMl, refFood?.gPerMl);
    if (!d) return needDensity();
    grams = amount * d;
  } else {
    // The AI's / table's "one piece" weight only fits the unit it was made for.
    const refUnitFor = ai ? (ai.unitFor ?? null) : null;
    const refFits = refUnitFor ? refUnitFor === ing.unit : PIECE_LIKE.includes(ing.unit);
    const w = gpu ?? (refFits ? ref.unitG : null) ?? null;
    if (!w)
      return {
        ok: false,
        reason: "need-weight-per-unit",
        message: t(`ช่วยใส่น้ำหนักต่อ 1 ${unitWord} เพื่อคำนวณ`, `Please add the weight of 1 ${unitWord} to work it out`),
      };
    grams = amount * w;
  }
  return {
    ok: true,
    macros: scaleMacros(ref.per100, grams / 100),
    source: "estimate",
    refName: ai ? "AI" : refFood!.label[lang],
    prov: ingredientProvenance(ing, ai ? "ai" : picked ? "pick" : "ref", !ai && !!refFood?.exact),
    missing: [],
    state: ai ? (ai.state ?? null) : (refFood!.state ?? null),
  };
}

export type RecipeTotals = {
  total: Macros;
  perServing: Macros;
  /** grams per serving, if the cooked weight is known */
  perServingGrams: number | null;
  problems: { ingredientId: string; message: string }[];
  hasEstimate: boolean;
  complete: boolean;
  /** Round 39: nutrients at least one ingredient didn't give (totals may be too low for these). */
  missing: MacroKey[];
  /** Round 39: the recipe's numbers are as sure as its least sure ingredient. */
  prov: Provenance;
};

export function recipeTotals(
  ingredients: Ingredient[],
  servings: number,
  cookedWeight: number | null,
  lang: Lang = "th",
): RecipeTotals {
  const problems: RecipeTotals["problems"] = [];
  const parts: Macros[] = [];
  const provs: Provenance[] = [];
  const missing: MacroKey[][] = [];
  let hasEstimate = false;
  for (const ing of ingredients) {
    const r = ingredientMacros(ing, lang);
    if (r.ok) {
      parts.push(r.macros);
      provs.push(r.prov);
      missing.push(r.missing);
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
    missing: joinMissing(...missing),
    prov: recipeProvenance(provs),
  };
}

export function totalsForRecipe(r: Recipe, lang: Lang = "th"): RecipeTotals {
  return recipeTotals(r.ingredients, r.servings, r.cookedWeight, lang);
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
): { macros: Macros; fraction: number; missing: MacroKey[]; prov: Provenance } | null {
  const fraction = portionFraction(mode, value, recipeServings, cookedWeight);
  if (fraction == null) return null;
  const t = recipeTotals(ingredients, recipeServings, cookedWeight);
  if (!t.complete) return null;
  return { macros: scaleMacros(t.total, fraction), fraction, missing: t.missing, prov: t.prov };
}
