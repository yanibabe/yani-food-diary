// Run with: npm test   (uses Node's built-in test runner, no extra install)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mealFromRecipe, recipeTotals, ingredientMacros } from "../app/lib/recipe.ts";
import { estimateEnergy, activityLevel, bmrMifflin } from "../app/lib/energy.ts";
import { thaiDateKey, shiftDateKey } from "../app/lib/date.ts";
import { changeAmount, blankItem } from "../app/lib/nutrition.ts";
import type { Ingredient, Profile } from "../app/lib/types.ts";

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const omeletIngredients: Ingredient[] = [
  { id: "a", name: "ไข่ไก่", amount: 3, unit: "egg", label: null, gramsPerUnit: null, photoId: null },
  {
    id: "b",
    name: "แหนม",
    amount: 100,
    unit: "g",
    // label from a pack: per 100 g
    label: { basis: "per100", kcal: 190, protein: 17, carbs: 5, fat: 11 },
    gramsPerUnit: null,
    photoId: null,
  },
  { id: "c", name: "น้ำมันพืช", amount: 15, unit: "ml", label: null, gramsPerUnit: null, photoId: null },
];

test("Case 2: omelet with naem, 2 servings, eat 0.5 serving = one quarter", () => {
  const t = recipeTotals(omeletIngredients, 2, null);
  assert.equal(t.complete, true);
  const meal = mealFromRecipe(omeletIngredients, 2, null, "servings", 0.5)!;
  close(meal.fraction, 0.25);
  close(meal.macros.kcal, t.total.kcal / 4);
  close(meal.macros.protein, t.total.protein / 4);
  close(meal.macros.carbs, t.total.carbs / 4);
  close(meal.macros.fat, t.total.fat / 4);
});

test("label values beat the built-in estimate", () => {
  const r = ingredientMacros(omeletIngredients[1]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.source, "label");
    close(r.macros.kcal, 190);
  }
});

test("label per 100 g + amount in eggs asks for weight per egg", () => {
  const ing: Ingredient = {
    ...omeletIngredients[0],
    label: { basis: "per100", kcal: 140, protein: 12, carbs: 1, fat: 10 },
  };
  const r = ingredientMacros(ing);
  assert.equal(r.ok, false);
  const fixed = ingredientMacros({ ...ing, gramsPerUnit: 55 });
  assert.ok(fixed.ok);
  if (fixed.ok) close(fixed.macros.kcal, 140 * 1.65);
});

test("grams mode uses cooked weight", () => {
  const meal = mealFromRecipe(omeletIngredients, 2, 400, "grams", 100)!;
  close(meal.fraction, 0.25);
  assert.equal(mealFromRecipe(omeletIngredients, 2, null, "grams", 100), null);
});

test("meal-only ingredient change does not touch the original list", () => {
  const changed = omeletIngredients.map((i) => (i.id === "a" ? { ...i, amount: 2 } : i));
  assert.equal(omeletIngredients[0].amount, 3);
  const a = recipeTotals(omeletIngredients, 2, null).total.kcal;
  const b = recipeTotals(changed, 2, null).total.kcal;
  assert.ok(b < a);
});

test("Mifflin–St Jeor matches the published formula", () => {
  close(bmrMifflin("female", 55, 160, 30), 10 * 55 + 6.25 * 160 - 5 * 30 - 161);
  close(bmrMifflin("male", 70, 175, 30), 10 * 70 + 6.25 * 175 - 5 * 30 + 5);
});

test("energy estimate: maintenance separate from suggested target", () => {
  const p: Profile = {
    age: 30, heightCm: 160, weightKg: 55, sex: "female",
    daily: "sitting", exercise: "3-5", goal: "lose-0.25",
    pregnant: false, breastfeeding: false,
  };
  const r = estimateEnergy(p);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.level.factor, 1.55); // sitting + exercise 3–5 days = moderate
    assert.equal(r.maintenance, Math.round(1239 * 1.55));
    assert.ok(r.suggested < r.maintenance);
  }
});

test("no automatic estimate for under 18, pregnant, breastfeeding", () => {
  const base: Profile = {
    age: 30, heightCm: 160, weightKg: 55, sex: "female",
    daily: "sitting", exercise: "none", goal: "maintain",
    pregnant: false, breastfeeding: false,
  };
  assert.equal(estimateEnergy({ ...base, age: 16 }).ok, false);
  assert.equal(estimateEnergy({ ...base, pregnant: true }).ok, false);
  assert.equal(estimateEnergy({ ...base, breastfeeding: true }).ok, false);
});

test("safety floor applies", () => {
  const r = estimateEnergy({
    age: 60, heightCm: 150, weightKg: 45, sex: "female",
    daily: "sitting", exercise: "none", goal: "lose-0.5",
    pregnant: false, breastfeeding: false,
  });
  assert.ok(r.ok && r.suggested === 1200 && r.floorApplied);
});

test("activity levels map to the 5 standard factors", () => {
  assert.equal(activityLevel("sitting", "none").factor, 1.2);
  assert.equal(activityLevel("physical", "twice").factor, 1.9);
  assert.equal(activityLevel("light", "none").factor, 1.375);
  assert.equal(activityLevel("standing", "1-2").factor, 1.55);
});

test("Thai date: 23:30 UTC is already the next day in Bangkok", () => {
  assert.equal(thaiDateKey(new Date("2026-11-11T23:30:00Z")), "2026-11-12");
  assert.equal(thaiDateKey(new Date("2026-11-11T16:59:00Z")), "2026-11-11");
  assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
});

test("changing amount scales the item (half the chicken = half the kcal)", () => {
  const chicken = { ...blankItem(), name: "ไก่ทอด", amount: 1, unit: "ชิ้น", kcal: 300, protein: 25, carbs: 10, fat: 18 };
  const half = changeAmount(chicken, 0.5);
  close(half.kcal, 150);
  close(half.fat, 9);
});
