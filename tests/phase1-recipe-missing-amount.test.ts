// Phase 1, issue 2: an ingredient without an amount must not count as "0 kcal, complete".
import test from "node:test";
import assert from "node:assert/strict";
import { ingredientMacros, recipeTotals } from "../app/lib/recipe.ts";
import type { Ingredient } from "../app/lib/types.ts";

const label = { basis: "per100" as const, kcal: 900, protein: 0, carbs: 0, fat: 100, via: "typed" as const };
const rice: Ingredient = { id: "1", name: "Rice", amount: 200, unit: "g", label: { basis: "per100", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, via: "typed" }, gramsPerUnit: null, photoId: null };
const oil: Ingredient = { id: "2", name: "Olive oil", amount: 0, unit: "g", label, gramsPerUnit: null, photoId: null };

test("a named ingredient with no amount is unfinished, in Thai and English", () => {
  const r = ingredientMacros(oil, "en");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "need-amount");
    assert.match(r.message, /amount/i);
  }
  const th = ingredientMacros(oil, "th");
  assert.equal(th.ok, false);
});

test("the recipe is not complete, lists the problem, and keeps the other numbers", () => {
  const t = recipeTotals([rice, oil], 2, null);
  assert.equal(t.complete, false);
  assert.deepEqual(t.problems.map((p) => p.ingredientId), ["2"]);
  assert.equal(t.total.kcal, 260); // rice only; nothing invented for the oil
});

test("adding the amount completes it with the right numbers", () => {
  const t = recipeTotals([rice, { ...oil, amount: 10 }], 2, null);
  assert.equal(t.complete, true);
  assert.equal(t.total.kcal, 350);
});

test("a typed label with no amount is also unfinished", () => {
  const typed: Ingredient = { ...oil, label: { ...label, kcal: 0, fat: 0 } };
  assert.equal(ingredientMacros(typed).ok, false);
});

test("a fully empty blank card behaves as before (not the new message)", () => {
  const blank: Ingredient = { id: "3", name: "", amount: 0, unit: "g", label: null, gramsPerUnit: null, photoId: null };
  const r = ingredientMacros(blank);
  assert.equal(r.ok, false);
  if (!r.ok) assert.notEqual(r.reason, "need-amount");
});

test("a real amount is unchanged: existing math stays exact", () => {
  const r = ingredientMacros({ ...rice, amount: 0.5, unit: "kg" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.macros.kcal, 650);
});
