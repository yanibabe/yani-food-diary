// Round 11: kilograms / liters, and the AI's per-100 g values for ingredients without a label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ingredientMacros } from "../app/lib/recipe.ts";
import type { Ingredient } from "../app/lib/types.ts";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const potato: Ingredient = {
  id: "p", name: "มันฝรั่ง", amount: 100, unit: "g", label: null, gramsPerUnit: null, photoId: null,
  aiRef: { name: "มันฝรั่ง", per100: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 }, unitG: 170, gPerMl: null },
};

test("AI values: 100 g potato = the AI's per-100 g numbers; 1 kg = ten times", () => {
  const r = ingredientMacros(potato);
  assert.ok(r.ok && r.source === "estimate" && r.refName === "AI");
  if (r.ok) close(r.macros.kcal, 77);
  const kg = ingredientMacros({ ...potato, amount: 1, unit: "kg" });
  assert.ok(kg.ok);
  if (kg.ok) { close(kg.macros.kcal, 770); close(kg.macros.carbs, 170); }
  const piece = ingredientMacros({ ...potato, amount: 2, unit: "piece" });
  assert.ok(piece.ok);
  if (piece.ok) close(piece.macros.kcal, 77 * 3.4); // 2 × 170 g
});

test("AI values are only used for the name they were looked up for", () => {
  const renamed = ingredientMacros({ ...potato, name: "มันเทศ" });
  assert.ok(!renamed.ok && renamed.reason === "no-data");
  // label still wins over the AI
  const withLabel = ingredientMacros({ ...potato, label: { basis: "per100", kcal: 90, protein: 2, carbs: 20, fat: 0 } });
  assert.ok(withLabel.ok && withLabel.source === "label");
  if (withLabel.ok) close(withLabel.macros.kcal, 90);
});

test("kg and liters with labels and built-in values", () => {
  const label = { basis: "per100" as const, kcal: 50, protein: 1, carbs: 10, fat: 0 };
  const a = ingredientMacros({ ...potato, aiRef: null, amount: 0.5, unit: "kg", label });
  assert.ok(a.ok); if (a.ok) close(a.macros.kcal, 250);
  const milk = ingredientMacros({ id: "m", name: "นมจืด", amount: 1, unit: "l", label: null, gramsPerUnit: null, photoId: null });
  assert.ok(milk.ok); if (milk.ok) close(milk.macros.kcal, 61 * 10.3); // 1000 ml × 1.03 g/ml
});
