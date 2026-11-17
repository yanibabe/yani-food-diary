// Round 44: "Search food" — one searched Ingredient becomes one meal item (nothing saved here).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ingredientToItem } from "../app/lib/searchFood.ts";
import { buildIngredient, aiSuggestion, localSuggestions, suggestionFromPick } from "../app/lib/ingredientSearch.ts";
import { addCustom } from "../app/lib/customIngredients.ts";
import type { Ingredient, UsdaPick } from "../app/lib/types.ts";

const find = (q: string, id: string) => localSuggestions(q, { lang: "th" }).find((s) => s.id === id)!;

const usdaIng = (over: Partial<UsdaPick> = {}, amount = 200, unit: "g" | "ml" = "g"): Ingredient => ({
  id: "i1",
  name: "ข้าวสวย",
  amount,
  unit,
  label: null,
  gramsPerUnit: null,
  photoId: null,
  usda: {
    name: "ข้าวสวย",
    fdcId: 169757,
    description: "Rice, white, cooked",
    dataType: "sr",
    per100: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
    per: unit,
    energy: "1008",
    ...over,
  },
});

test("USDA food: numbers scale from USDA per 100 g, source = database/USDA, never verified, no buffer", () => {
  const item = ingredientToItem(usdaIng(), "it1", "th", 20)!;
  assert.equal(item.kcal, 260);
  assert.equal(item.protein, 5.4);
  assert.equal(item.carbs, 56.4);
  assert.equal(item.fat, 0.6);
  assert.equal(item.unit, "g");
  assert.equal(item.prov!.source, "database");
  assert.equal(item.prov!.via, "usda");
  assert.notEqual(item.prov!.verification, "verified");
  assert.equal(item.estimated, false);
  // her 20% buffer never touches a database food
  assert.equal(item.aiKcal, undefined);
  assert.equal(item.bufferPct, undefined);
  // frozen USDA values kept (so "ate half" in review rescales from USDA)
  assert.equal(item.usda!.fdcId, 169757);
  assert.equal(item.ref!.source, "usda");
  assert.equal((item.usda as Record<string, unknown>).name, undefined);
});

test("USDA food in a counted unit: no frozen snapshot (the amount is not grams), numbers still right", () => {
  const ing = { ...usdaIng(), amount: 2, unit: "piece" as const, gramsPerUnit: 100 };
  const item = ingredientToItem(ing, "it1", "en")!;
  assert.equal(item.kcal, 260);
  assert.equal(item.unit, "piece");
  assert.equal(item.usda, undefined);
});

test("USDA nutrients it did not give stay unknown, not 0", () => {
  const item = ingredientToItem(usdaIng({ missing: ["fat"], per100: { kcal: 100, protein: 5, carbs: 10, fat: 0 } }, 100), "it1")!;
  assert.deepEqual(item.missing, ["fat"]);
  assert.equal(item.kcal, 100);
});

test("reference food: 2 eggs → estimate, source reference, not verified, no buffer", () => {
  const s = find("ไข่", "ref:egg");
  const item = ingredientToItem(buildIngredient(s, 2, "egg", { id: "i" }), "it2", "th", 15)!;
  assert.equal(item.amount, 2);
  assert.equal(item.unit, "ฟอง");
  assert.ok(item.kcal > 100 && item.kcal < 220);
  assert.equal(item.prov!.source, "reference");
  assert.notEqual(item.prov!.verification, "verified");
  assert.equal(item.estimated, true);
  assert.equal(item.bufferPct, undefined);
  assert.equal(item.name, s.name);
  assert.equal(item.kind, "food");
  assert.equal(item.missing, undefined);
});

test("AI estimate: marked AI estimate, and ONLY it gets her calorie buffer (kcal only)", () => {
  const s = aiSuggestion("ขนมแปลก", { kcal: 200, protein: 4, carbs: 30, fat: 8, unitG: null, gPerMl: null })!;
  const ing = buildIngredient(s, 100, "g", { id: "i" });
  const plain = ingredientToItem(ing, "a", "th", 0)!;
  assert.equal(plain.prov!.source, "ai");
  assert.equal(plain.prov!.verification, "estimated");
  assert.equal(plain.kcal, 200);
  assert.equal(plain.estimated, true);
  // she typed the weight (100 g) → the AI did not guess the amount → no buffer
  const weighed = ingredientToItem(ing, "a", "th", 10)!;
  assert.equal(weighed.bufferPct, undefined);
  assert.equal(weighed.kcal, 200);
  // a counted unit (AI guessed the weight of one piece) → buffer applies, kcal only
  const s2 = aiSuggestion("ขนมแปลก", { kcal: 200, protein: 4, carbs: 30, fat: 8, unitG: 100, gPerMl: null })!;
  const ing2 = buildIngredient(s2, 1, "piece", { id: "i2" });
  const buffered = ingredientToItem(ing2, "a", "th", 10)!;
  assert.equal(buffered.aiKcal, 200);
  assert.equal(buffered.bufferPct, 10);
  assert.equal(buffered.kcal, 220);
  // protein / carbs / fat never change
  assert.equal(buffered.protein, 4);
  assert.equal(buffered.carbs, 30);
  assert.equal(buffered.fat, 8);
});

test("her own typed food: 'typed by you', unverified, unknown nutrients stay unknown, no buffer", () => {
  const added = addCustom([], { name: "ซอสบ้าน", kcal: 120, protein: null, carbs: 20, fat: undefined, per: "g" }, 1, "c1");
  assert.ok(added.ok);
  const s = suggestionFromPick({ kind: "custom", id: "c1", name: "ซอสบ้าน" }, "th", added.list)!;
  const item = ingredientToItem(buildIngredient(s, 50, "g", { id: "i" }), "it3", "th", 20)!;
  assert.equal(item.kcal, 60);
  assert.equal(item.carbs, 10);
  assert.deepEqual(item.missing, ["protein", "fat"]);
  assert.equal(item.prov!.source, "user");
  assert.equal(item.prov!.verification, "unverified");
  assert.equal(item.bufferPct, undefined);
});

test("units: g and ml stay 'g' / 'ml'; counted units use her language", () => {
  const milk = find("นม", "ref:milk");
  const ml = ingredientToItem(buildIngredient(milk, 250, "ml", { id: "i" }), "m")!;
  assert.equal(ml.unit, "ml");
  assert.equal(ml.amount, 250);
  assert.ok(ml.kcal > 0);
  const g = ingredientToItem(buildIngredient(milk, 100, "g", { id: "i" }), "m")!;
  assert.equal(g.unit, "g");
  const egg = find("ไข่", "ref:egg");
  assert.equal(ingredientToItem(buildIngredient(egg, 1, "egg", { id: "i" }), "e", "en")!.unit, "egg");
  assert.equal(ingredientToItem(buildIngredient(egg, 1, "egg", { id: "i" }), "e", "th")!.unit, "ฟอง");
});

test("a question the math still has (weight of one piece) → no item, nothing is guessed", () => {
  const s = find("นม", "ref:milk");
  const bad = buildIngredient(s, 2, "piece", { id: "i" });
  assert.equal(ingredientToItem(bad, "x"), null);
});

test("a dairy food is flagged dairy like other paths", () => {
  const s = find("นม", "ref:milk");
  assert.equal(ingredientToItem(buildIngredient(s, 100, "ml", { id: "i" }), "m")!.dairy, true);
});
