// Round 39 fix: plain water (and other real 0-kcal ingredients) must work in recipes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRef } from "../app/lib/foodRef.ts";
import { ingredientMacros, recipeTotals } from "../app/lib/recipe.ts";
import { energyCheck } from "../app/lib/nutrition.ts";
import { IngredientRefSchema, cleanIngredientRef } from "../app/lib/ingredientRef.ts";
import type { Ingredient } from "../app/lib/types.ts";

const ing = (p: Partial<Ingredient>): Ingredient => ({ id: "i", name: "", amount: 100, unit: "g", label: null, gramsPerUnit: null, photoId: null, ...p });
const key = (name: string) => {
  const m = matchRef(name);
  return m.kind === "exact" ? m.food.key : m.kind;
};

test("plain water is recognised by every common name, without the AI", () => {
  for (const n of ["น้ำ", "น้ำเปล่า", "น้ำดื่ม", "น้ำสะอาด", "น้ำต้มสุก", "plain water", "drinking water", "still water", "Water", "water (plain)"])
    assert.equal(key(n), "water", n);
});

test("drinks that are NOT plain water never match water (and are never offered as water)", () => {
  for (const n of ["น้ำมะพร้าว", "coconut water", "flavored water", "vitamin water", "น้ำหวาน", "น้ำซุป", "น้ำซุปไก่", "chicken broth", "น้ำผึ้ง", "น้ำส้ม", "น้ำอัดลม", "น้ำแข็งใส", "water spinach", "watermelon"]) {
    const m = matchRef(n);
    assert.ok(m.kind === "none" || (m.kind === "exact" ? m.food.key !== "water" : !m.options.some((f) => f.key === "water")), n);
  }
});

test("other foods starting with น้ำ keep their own match", () => {
  assert.equal(key("น้ำปลา"), "fish-sauce");
  assert.equal(key("น้ำมันหอย"), "oyster-sauce");
  assert.equal(key("น้ำมันพืช"), "oil");
  assert.equal(key("น้ำตาล"), "sugar");
});

test("water is exactly 0 in grams, ml and liters — a known zero, not missing data", () => {
  for (const [amount, unit] of [[250, "g"], [250, "ml"], [1.5, "l"]] as const) {
    const r = ingredientMacros(ing({ name: "น้ำเปล่า", amount, unit }));
    assert.ok(r.ok, unit);
    assert.deepEqual(r.macros, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    assert.deepEqual(r.missing, []); // every value known
    assert.equal(r.source, "estimate"); // same result shape as other table foods
    assert.equal(r.prov.source, "reference");
    assert.equal(r.prov.verification, "unverified"); // not "estimated" (AI), not "verified"
  }
  assert.equal(energyCheck({ kcal: 0, protein: 0, carbs: 0, fat: 0 }).status, "ok");
});

test("water in a recipe adds no calories and does not mark the recipe as an estimate", () => {
  const t = recipeTotals([
    ing({ id: "a", name: "x", amount: 50, label: { basis: "per100", kcal: 200, protein: 10, carbs: 20, fat: 5, via: "typed" } }),
    ing({ id: "b", name: "น้ำ", amount: 500, unit: "ml" }),
  ]);
  assert.equal(t.total.kcal, 100);
  assert.equal(t.complete, true);
  assert.deepEqual(t.missing, []);
  assert.equal(t.prov.verification, "unverified");
});

test("AI answer of 0 kcal is kept (ice, salt, diet drinks) — zero is not 'no data'", () => {
  const zero = IngredientRefSchema.parse({ known: true, kcal: 0, protein: 0, carbs: 0, fat: 0, unitG: null, gPerMl: null, state: "prepared" });
  const r = cleanIngredientRef(zero, null);
  assert.ok(r);
  assert.equal(r.kcal, 0);
  assert.deepEqual(cleanIngredientRef(IngredientRefSchema.parse({ known: true, kcal: "0" }), null)?.kcal, 0);
});

test("AI answer with NO calorie number, or 'not a food', is still rejected", () => {
  assert.equal(cleanIngredientRef(IngredientRefSchema.parse({ known: true }), null), null);
  assert.equal(cleanIngredientRef(IngredientRefSchema.parse({ known: true, kcal: null }), null), null);
  assert.equal(cleanIngredientRef(IngredientRefSchema.parse({ known: true, kcal: "abc" }), null), null);
  assert.equal(cleanIngredientRef(IngredientRefSchema.parse({ known: false, kcal: 0 }), null), null);
  assert.equal(cleanIngredientRef(IngredientRefSchema.parse({ known: true, kcal: 120, protein: 22 }), null)?.kcal, 120);
});

test("a label with 0 kcal (e.g. diet drink) is a real value", () => {
  const r = ingredientMacros(ing({ name: "โค้กซีโร่", amount: 325, unit: "ml", label: { basis: "per100", kcal: 0, protein: 0, carbs: 0, fat: 0, via: "typed" } }));
  assert.ok(r.ok && r.macros.kcal === 0 && r.missing.length === 0);
});
