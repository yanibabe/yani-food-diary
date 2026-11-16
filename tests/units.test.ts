import assert from "node:assert/strict";
import test from "node:test";
import { ingredientMacros } from "../app/lib/recipe.ts";
import { UNITS, type Ingredient } from "../app/lib/types.ts";

const base: Ingredient = {
  id: "x", name: "น้ำปลา", amount: 1, unit: "g", label: { basis: "per100", kcal: 100, protein: 10, carbs: 10, fat: 0 },
  gramsPerUnit: null, photoId: null,
};
const kcal = (i: Ingredient) => {
  const r = ingredientMacros(i);
  assert.ok(r.ok, JSON.stringify(r));
  return Math.round(r.macros.kcal * 100) / 100;
};

test("weight units turn into grams", () => {
  assert.equal(kcal({ ...base, amount: 2, unit: "kg" }), 2000);
  assert.equal(kcal({ ...base, amount: 500, unit: "mg" }), 0.5);
  assert.equal(kcal({ ...base, amount: 1, unit: "oz" }), 28.35);
  assert.equal(kcal({ ...base, amount: 1, unit: "lb" }), 453.6);
});

test("spoons and cups turn into ml", () => {
  assert.equal(kcal({ ...base, amount: 1, unit: "tbsp" }), 15);
  assert.equal(kcal({ ...base, amount: 2, unit: "tsp" }), 10);
  assert.equal(kcal({ ...base, amount: 1, unit: "cup" }), 240);
});

test("a counted unit asks for the weight of one, then uses it", () => {
  const can = { ...base, amount: 1, unit: "can" as const };
  const r = ingredientMacros(can);
  assert.ok(!r.ok && r.reason === "need-weight-per-unit" && r.message.includes("กระป๋อง"));
  assert.equal(kcal({ ...can, gramsPerUnit: 155 }), 155);
});

test("the AI's weight of one only fits the unit it was asked for", () => {
  const garlic: Ingredient = {
    id: "g", name: "กระเทียม", amount: 3, unit: "clove", label: null, gramsPerUnit: null, photoId: null,
    aiRef: { name: "กระเทียม", per100: { kcal: 149, protein: 6, carbs: 33, fat: 0.5 }, unitG: 4, gPerMl: null, unitFor: "clove" },
  };
  assert.equal(kcal(garlic), 17.88); // 3 × 4 g
  const asHead = ingredientMacros({ ...garlic, unit: "head" });
  assert.ok(!asHead.ok); // 4 g is one clove, not one head
  // old AI answers (no unitFor) still work for a plain piece / fruit
  const old = { ...garlic, unit: "piece" as const, aiRef: { ...garlic.aiRef!, unitFor: undefined } };
  assert.equal(kcal(old), 17.88);
  assert.ok(!ingredientMacros({ ...old, unit: "clove" }).ok);
});

test("every unit has a Thai and English name", () => {
  for (const u of Object.values(UNITS)) assert.ok(u.th && u.en && u.factor > 0);
});
