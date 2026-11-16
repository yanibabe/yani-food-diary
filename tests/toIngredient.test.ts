import { test } from "node:test";
import assert from "node:assert/strict";
import { ingredientFromFood, ingredientFromLabel } from "../app/lib/food/toIngredient.ts";
import { ingredientMacros } from "../app/lib/recipe.ts";
import type { Food } from "../app/lib/food/provider.ts";
import type { Ingredient } from "../app/lib/types.ts";

const blank: Ingredient = { id: "i1", name: "", amount: 0, unit: "g", label: null, gramsPerUnit: null, photoId: null };
const milk: Food = { source: "off", sourceId: "8850000000002", name: "Fresh milk", brand: "Meiji", servingSize: "200 ml", kcal: 65, protein: 3.2, carbs: 4.8, fat: 3.6 };

test("barcode on a blank ingredient: name, label per 100, one whole pack in ml", () => {
  const p = ingredientFromFood(blank, milk)!;
  assert.equal(p.name, "Fresh milk · Meiji");
  assert.deepEqual(p.label, { basis: "per100", kcal: 65, protein: 3.2, carbs: 4.8, fat: 3.6 });
  assert.equal(p.unit, "ml");
  assert.equal(p.amount, 200);
  const r = ingredientMacros({ ...blank, ...p });
  assert.ok(r.ok && r.macros.kcal === 130);
});

test("barcode keeps what she typed: her name, amount and unit", () => {
  const typed: Ingredient = { ...blank, name: "นม", amount: 100, unit: "ml" };
  const p = ingredientFromFood(typed, milk)!;
  assert.equal(p.name, undefined);
  assert.equal(p.amount, undefined);
  assert.equal(p.unit, undefined);
  const r = ingredientMacros({ ...typed, ...p });
  assert.ok(r.ok && r.macros.kcal === 65);
});

test("barcode with a counted unit: 2 bottles → weight of one = the pack", () => {
  const typed: Ingredient = { ...blank, name: "นม", amount: 2, unit: "bottle" };
  const p = ingredientFromFood(typed, milk)!;
  assert.equal(p.gramsPerUnit, 200);
  const r = ingredientMacros({ ...typed, ...p });
  assert.ok(r.ok && r.macros.kcal === 260);
});

test("barcode product without calories → nothing to fill", () => {
  assert.equal(ingredientFromFood(blank, { ...milk, kcal: null }), null);
});

test("label photo: 20 g pack = 70 kcal → 350 per 100 g, missing nutrients count as 0", () => {
  const p = ingredientFromLabel(blank, { servingG: 20, liquid: false, kcal: 70, protein: 2, carbs: null, fat: 3 })!;
  assert.deepEqual(p.label, { basis: "per100", kcal: 350, protein: 10, carbs: 0, fat: 15 });
  assert.equal(p.name, undefined); // a label has no product name
  assert.equal(p.amount, 20);
  assert.equal(p.unit, "g");
  const r = ingredientMacros({ ...blank, name: "x", ...p });
  assert.ok(r.ok && r.macros.kcal === 70);
});

test("label photo with a bad pack size → nothing to fill", () => {
  assert.equal(ingredientFromLabel(blank, { servingG: 0, liquid: false, kcal: 70, protein: null, carbs: null, fat: null }), null);
});

// ---- Round 38: any photos of one product ----
import { ingredientFromPack } from "../app/lib/food/toIngredient.ts";
const avg = { kcal: 120, protein: 23, carbs: 0, fat: 2.5, unitG: null, gPerMl: null };

test("pack photos with label numbers: real numbers, name, whole pack size", () => {
  const { patch, kind } = ingredientFromPack(blank, {
    product: { name: "อกไก่นุ่ม · เบทาโกร", netG: 200, liquid: false },
    label: { servingG: 100, liquid: false, kcal: 110, protein: 22, carbs: 1, fat: 2 },
    average: null,
  });
  assert.equal(kind, "label");
  assert.equal(patch.name, "อกไก่นุ่ม · เบทาโกร");
  assert.equal(patch.amount, 200);
  assert.deepEqual(patch.label, { basis: "per100", kcal: 110, protein: 22, carbs: 1, fat: 2 });
});

test("pack photos with no numbers: keeps name + size and uses the average (estimate)", () => {
  const { patch, kind } = ingredientFromPack(blank, { product: { name: "อกไก่นุ่ม", netG: 200, liquid: false }, label: null, average: avg });
  assert.equal(kind, "average");
  assert.equal(patch.name, "อกไก่นุ่ม");
  assert.equal(patch.amount, 200);
  assert.equal(patch.label, undefined);
  assert.equal(patch.aiRef?.name, "อกไก่นุ่ม");
  const r = ingredientMacros({ ...blank, ...patch });
  assert.ok(r.ok && r.macros.kcal === 240 && r.source !== "label");
});

test("average is stored under the name she typed, and never replaces her label", () => {
  const typed: Ingredient = { ...blank, name: "ไก่", amount: 150, unit: "g" };
  const a = ingredientFromPack(typed, { product: { name: "อกไก่นุ่ม", netG: 200, liquid: false }, label: null, average: avg });
  assert.equal(a.patch.name, undefined);
  assert.equal(a.patch.amount, undefined);
  assert.equal(a.patch.aiRef?.name, "ไก่");
  const withLabel: Ingredient = { ...typed, label: { basis: "per100", kcal: 99, protein: 1, carbs: 1, fat: 1 } };
  const b = ingredientFromPack(withLabel, { product: { name: "อกไก่นุ่ม", netG: 200, liquid: false }, label: null, average: avg });
  assert.equal(b.patch.aiRef, undefined);
  assert.equal(b.kind, "nothing");
});

test("no numbers and no average: name + size only; nothing readable → nothing", () => {
  const a = ingredientFromPack(blank, { product: { name: "ซอสพิเศษ", netG: 300, liquid: true }, label: null, average: null });
  assert.equal(a.kind, "nameOnly");
  assert.equal(a.patch.unit, "ml");
  const b = ingredientFromPack(blank, { product: { name: null, netG: null, liquid: false }, label: null, average: null });
  assert.equal(b.kind, "nothing");
});
