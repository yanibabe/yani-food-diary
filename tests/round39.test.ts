// Round 39 — nutrition accuracy: careful matching, provenance, unknown nutrients, density, 4/4/9 check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRef, findRef, refByKey } from "../app/lib/foodRef.ts";
import { ingredientMacros, recipeTotals } from "../app/lib/recipe.ts";
import { energyCheck, blankItem } from "../app/lib/nutrition.ts";
import { itemProvenance, isEstimated, labelProvenance, recipeProvenance, joinMissing, provFromAi } from "../app/lib/provenance.ts";
import { foodToItem } from "../app/lib/food/toItem.ts";
import { applyLabelFix } from "../app/lib/food/labelFix.ts";
import { makeBackup, parseBackup } from "../app/lib/backup.ts";
import type { FoodItem, Ingredient } from "../app/lib/types.ts";
import type { Food } from "../app/lib/food/provider.ts";

const ing = (p: Partial<Ingredient>): Ingredient => ({ id: "i", name: "", amount: 100, unit: "g", label: null, gramsPerUnit: null, photoId: null, ...p });
const key = (name: string) => {
  const m = matchRef(name);
  return m.kind === "exact" ? m.food.key : m.kind;
};
const options = (name: string) => {
  const m = matchRef(name);
  return m.kind === "ask" ? m.options.map((f) => f.key) : [];
};

// ---- matching ----

test("oyster sauce: น้ำมันหอย is oyster sauce, not oil", () => {
  assert.equal(key("น้ำมันหอย"), "oyster-sauce");
  assert.equal(key("ซอสหอยนางรม"), "oyster-sauce");
  assert.equal(key("oyster sauce"), "oyster-sauce");
  assert.equal(key("น้ำมันพืช"), "oil");
});

test("rice: uncooked rice is its own food; plain ข้าว asks", () => {
  assert.equal(key("ข้าวสาร"), "rice-raw");
  assert.equal(key("uncooked rice"), "rice-raw");
  assert.equal(key("ข้าวสวย"), "rice");
  assert.equal(key("ข้าว"), "ask");
  assert.ok(options("ข้าว").includes("rice") && options("ข้าว").includes("rice-raw"));
  assert.equal(refByKey("rice-raw")!.per100.kcal, 360);
});

test("milks: condensed, evaporated, coconut, soy are their own foods", () => {
  assert.equal(key("นมข้นหวาน"), "condensed-milk");
  assert.equal(key("กะทิ"), "coconut-milk");
  assert.equal(key("นมถั่วเหลือง"), "ask"); // sweetened or not?
  assert.ok(options("นมถั่วเหลือง").includes("soy-milk-unsweet") && options("นมถั่วเหลือง").includes("soy-milk-sweet"));
  assert.notEqual(key("นมข้นหวาน"), "milk");
});

test("eggs: egg white / yolk are their own foods; plain ไข่ asks", () => {
  assert.equal(key("ไข่ขาว"), "egg-white");
  assert.equal(key("egg whites"), "egg-white");
  assert.equal(key("ไข่แดง"), "egg-yolk");
  assert.equal(key("ไข่ไก่"), "egg");
  assert.equal(key("ไข่"), "ask");
});

test("shrimp: dried shrimp is its own food; plain กุ้ง asks", () => {
  assert.equal(key("กุ้งแห้ง"), "dried-shrimp");
  assert.equal(key("กุ้ง"), "ask");
  assert.ok(options("กุ้ง").includes("dried-shrimp"));
});

test("chicken cuts: clear cut matches, unclear cut or cooked dish asks", () => {
  assert.equal(key("อกไก่"), "chicken-breast");
  assert.equal(key("chicken breast, raw"), "chicken-breast");
  assert.equal(key("อกไก่ติดหนัง"), "chicken-breast-skin");
  assert.equal(key("ไก่"), "ask");
  assert.equal(key("สะโพกไก่"), "ask"); // with or without skin?
  assert.equal(key("อกไก่ทอด"), "ask"); // fried — raw values would be wrong
});

test("no false matches: a short alias inside a different word doesn't count", () => {
  assert.equal(key("eggplant"), "none");
  assert.equal(key("ขนม"), "none");
  assert.equal(key("ขนมปัง"), "bread");
  assert.equal(findRef("ข้าว"), null); // findRef only gives clear matches
});

// ---- recipe math: never auto-pick, density never assumed ----

test("unclear ingredient asks instead of picking", () => {
  const r = ingredientMacros(ing({ name: "ข้าว" }));
  assert.ok(!r.ok && r.reason === "ambiguous" && (r.options?.length ?? 0) >= 2);
});

test("her pick is used, and marked as a reference estimate", () => {
  const r = ingredientMacros(ing({ name: "ข้าว", refPick: { name: "ข้าว", key: "rice-raw" } }));
  assert.ok(r.ok);
  assert.equal(r.macros.kcal, 360);
  assert.equal(r.state, "raw");
  assert.deepEqual(r.prov, { source: "reference", verification: "estimated", via: "picked" });
  // A pick for a different name is ignored (she renamed the ingredient).
  const renamed = ingredientMacros(ing({ name: "ข้าวสวย", refPick: { name: "ข้าว", key: "rice-raw" } }));
  assert.ok(renamed.ok && renamed.macros.kcal === 130);
});

test("an older AI lookup saved on a recipe still wins (old recipes keep their numbers)", () => {
  const r = ingredientMacros(ing({ name: "ข้าว", aiRef: { name: "ข้าว", per100: { kcal: 140, protein: 3, carbs: 30, fat: 0.3 }, unitG: null, gPerMl: null, unitFor: null } }));
  assert.ok(r.ok && r.macros.kcal === 140 && r.prov.source === "ai");
});

test("density: oil by the spoon uses its real weight; unknown density asks", () => {
  const oil = ingredientMacros(ing({ name: "น้ำมันพืช", amount: 1, unit: "tbsp" }));
  assert.ok(oil.ok);
  assert.equal(Math.round(oil.macros.kcal), Math.round(15 * 0.92 * 8.84)); // 15 ml × 0.92 g/ml
  const sauce = ingredientMacros(ing({ name: "น้ำมันหอย", amount: 1, unit: "tbsp" }));
  assert.ok(sauce.ok && Math.round(sauce.macros.kcal) === Math.round(15 * 1.2 * 0.51));
  const unknown = ingredientMacros(ing({ name: "อกไก่", amount: 1, unit: "cup" }));
  assert.ok(!unknown.ok && unknown.reason === "need-density");
  const hers = ingredientMacros(ing({ name: "อกไก่", amount: 1, unit: "tbsp", gPerMl: 0.5 }));
  assert.ok(hers.ok && Math.round(hers.macros.kcal) === Math.round(7.5 * 1.2));
});

test("labels: old label without `per` in ml unchanged; per-100 g label + spoons needs density", () => {
  const old = ingredientMacros(ing({ name: "x", amount: 200, unit: "ml", label: { basis: "per100", kcal: 65, protein: 3, carbs: 5, fat: 3.6 } }));
  assert.ok(old.ok && old.macros.kcal === 130);
  const perG = ing({ name: "x", amount: 1, unit: "tbsp", label: { basis: "per100", kcal: 400, protein: 0, carbs: 100, fat: 0, per: "g" } });
  const a = ingredientMacros(perG);
  assert.ok(!a.ok && a.reason === "need-density");
  const b = ingredientMacros({ ...perG, gPerMl: 0.8 });
  assert.ok(b.ok && b.macros.kcal === 48); // 15 ml × 0.8 = 12 g × 4
});

test("missing nutrients stay unknown and pass through to the recipe", () => {
  const r = ingredientMacros(ing({ name: "x", label: { basis: "per100", kcal: 200, protein: 5, carbs: 0, fat: 0, missing: ["carbs", "fat"], via: "photo" } }));
  assert.ok(r.ok);
  assert.deepEqual(r.missing, ["carbs", "fat"]);
  assert.deepEqual(r.prov, { source: "label", verification: "unverified", via: "photo" });
  const t = recipeTotals([ing({ id: "a", name: "x", label: { basis: "per100", kcal: 200, protein: 5, carbs: 0, fat: 0, missing: ["fat"] } }), ing({ id: "b", name: "อกไก่" })]);
  assert.deepEqual(t.missing, ["fat"]);
  assert.equal(t.prov.verification, "estimated"); // as sure as the least sure part
});

// ---- provenance ----

test("old saved items: provenance is worked out only where certain, else unknown", () => {
  const base: FoodItem = { ...blankItem(), prov: undefined, kcal: 100 };
  delete (base as Partial<FoodItem>).prov;
  assert.equal(itemProvenance({ ...base, margin: true }).source, "ai");
  assert.equal(itemProvenance({ ...base, fromLabel: true }).source, "label");
  assert.deepEqual(itemProvenance({ ...base, margin: false, ref: { source: "off", sourceId: "1" } }).source, "unknown"); // OFF or her fix — can't tell
  assert.equal(itemProvenance(base, { source: "manual" }).source, "user");
  assert.equal(itemProvenance(base).source, "unknown");
  assert.equal(isEstimated({ ...base, margin: true, estimated: false }), true);
  assert.equal(isEstimated({ ...base, estimated: false }, { source: "manual" }), false);
});

test("user-typed and label values are never 'verified'", () => {
  assert.equal(blankItem().prov!.verification, "unverified");
  assert.equal(labelProvenance({ basis: "per100", kcal: 1, protein: 0, carbs: 0, fat: 0, via: "typed" }).verification, "unverified");
  assert.equal(labelProvenance({ basis: "per100", kcal: 1, protein: 0, carbs: 0, fat: 0 }).source, "unknown"); // saved before Round 39
  assert.equal(provFromAi({ fromLabel: true }).source, "label");
  assert.equal(provFromAi({}).verification, "estimated");
  assert.equal(recipeProvenance([]).verification, "unknown");
});

test("barcode: her label fix is recorded as the source of the numbers", () => {
  const food: Food = { source: "off", sourceId: "8850000000001", name: "Snack", brand: null, servingSize: "20 g", kcal: 500, protein: null, carbs: null, fat: 25 };
  assert.deepEqual(foodToItem(food, 20, "a", "x").prov, { source: "database", verification: "unverified", via: "off" });
  const fixed = applyLabelFix(food, { code: food.sourceId, servingG: 20, liquid: false, kcal: 70, protein: 2, carbs: null, fat: 3, updatedAt: 1, via: "photo" });
  const it = foodToItem(fixed, 20, "a", "x");
  assert.equal(it.prov!.source, "label");
  assert.deepEqual(it.missing, ["carbs"]); // blank in her fix AND in the database → unknown, not 0
  assert.equal(it.protein, 2); // her number filled the database's gap
});

test("joinMissing keeps each nutrient once, in order", () => {
  assert.deepEqual(joinMissing(["fat"], undefined, ["protein", "fat"]), ["protein", "fat"]);
});

// ---- 4/4/9 check (a hint only, never changes numbers) ----

test("energy check allows rounding, fiber and small gaps; flags only clear gaps", () => {
  assert.equal(energyCheck({ kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 }).status, "ok"); // 113
  assert.equal(energyCheck({ kcal: 10, protein: 0, carbs: 5, fat: 0 }).status, "ok"); // gap 10 < 20 kcal
  assert.equal(energyCheck({ kcal: 50, protein: 0, carbs: 15, fat: 0 }).status, "ok"); // fiber / sugar alcohols: within 20%
  assert.equal(energyCheck({ kcal: 500, protein: 5, carbs: 10, fat: 5 }).status, "high");
  assert.equal(energyCheck({ kcal: 100, protein: 30, carbs: 30, fat: 10 }).status, "low");
  assert.equal(energyCheck({ kcal: 500, protein: 5, carbs: 0, fat: 0 }, ["carbs"]).status, "unknown");
});

// ---- backups keep the new fields ----

test("a backup round-trip keeps provenance, missing, refPick and density", () => {
  const entries = JSON.stringify([{ id: "e", items: [{ id: "i", prov: { source: "label", verification: "unverified", via: "photo" }, missing: ["fat"] }] }]);
  const recipes = JSON.stringify([{ id: "r", ingredients: [{ id: "g", refPick: { name: "ข้าว", key: "rice-raw" }, gPerMl: 0.85 }] }]);
  const b = makeBackup({ entries, recipes, goals: null, body: null, water: null, labelFixes: null, buddy: null, lang: null }, {}, 1);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.deepEqual(res.backup, b);
});
