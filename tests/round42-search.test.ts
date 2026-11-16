// Round 42: Search first — local suggestions, ranking, ambiguity, building ingredients, unit math.
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchLocal, localSuggestions, buildIngredient, quoteIngredient, suggestedUnits, suggestionFromPick, stateQuestion, type Suggestion } from "../app/lib/ingredientSearch.ts";
import { addCustom, recordPick, type CustomIngredient, type IngredientPrefPick } from "../app/lib/customIngredients.ts";
import { ingredientMacros, recipeTotals } from "../app/lib/recipe.ts";
import { ingredientProvenance } from "../app/lib/provenance.ts";
import { FOOD_REF } from "../app/lib/foodRef.ts";
import type { Recipe } from "../app/lib/types.ts";

const ids = (q: string, ctx = {}) => localSuggestions(q, { lang: "th", ...ctx }).map((s) => s.id);
const find = (q: string, id: string, ctx = {}) => localSuggestions(q, { lang: "th", ...ctx }).find((s) => s.id === id)!;

const myCurry = (now = 1) => {
  const r = addCustom([], { name: "แกงเขียวหวานแม่", kcal: 180, protein: 9, carbs: 6, fat: 13, per: "g" }, now, "c1");
  assert.ok(r.ok);
  return r.list;
};

// ---------------- Thai + English autocomplete ----------------

test("Thai: typing 'ไข่' lists whole egg, white and yolk as separate rows, nothing picked", () => {
  const r = searchLocal("ไข่", { lang: "th" });
  assert.deepEqual(r.items.map((s) => s.id).slice(0, 3).sort(), ["ref:egg", "ref:egg-white", "ref:egg-yolk"]);
  assert.equal(r.ambiguous, true);
  // each row says its own state and has its own numbers
  const egg = r.items.find((s) => s.id === "ref:egg")!;
  const white = r.items.find((s) => s.id === "ref:egg-white")!;
  const yolk = r.items.find((s) => s.id === "ref:egg-yolk")!;
  assert.equal(egg.state, "raw");
  assert.notEqual(egg.per100!.kcal, white.per100!.kcal);
  assert.notEqual(white.per100!.kcal, yolk.per100!.kcal);
});

test("English: 'egg', 'egg wh', 'EGG YOLK' and 'eggs' find the right foods; 'egg' is not 'eggplant'", () => {
  assert.ok(ids("egg").includes("ref:egg"));
  assert.equal(ids("egg wh")[0], "ref:egg-white");
  assert.equal(ids("EGG YOLK")[0], "ref:egg-yolk");
  assert.ok(ids("eggs").includes("ref:egg"));
  assert.ok(ids("eggplant").every((x) => !x.startsWith("ref:egg")));
});

test("prefix while typing works in both languages", () => {
  assert.ok(ids("chick").includes("ref:chicken-breast"));
  assert.ok(ids("oys").includes("ref:oyster-sauce"));
  assert.ok(ids("อกไ").includes("ref:chicken-breast"));
  assert.ok(ids("หมูส").includes("ref:pork-minced"));
});

test("Thai name finds the English-named food and the other way round", () => {
  assert.equal(find("น้ำปลา", "ref:fish-sauce").label.en, "fish sauce");
  assert.ok(ids("fish sauce").includes("ref:fish-sauce"));
  assert.ok(ids("pork belly").includes("ref:pork-belly"));
  assert.ok(ids("หมูสามชั้น").includes("ref:pork-belly"));
});

test("the row name follows the language", () => {
  const en = localSuggestions("egg white", { lang: "en" })[0];
  assert.equal(en.name, "egg white");
  const th = localSuggestions("egg white", { lang: "th" })[0];
  assert.equal(th.name, "ไข่ขาว");
});

test("empty box → nothing from the reference table (only her own foods and recents)", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("   "), []);
});

// ---------------- aliases + spelling ----------------

test("aliases and spellings find the same food", () => {
  assert.equal(ids("ซีอิ้วขาว")[0], "ref:soy-sauce");
  assert.equal(ids("ซีอิ๊ว")[0], "ref:soy-sauce");
  assert.equal(ids("shoyu")[0], "ref:soy-sauce");
  assert.equal(ids("กระทิ")[0], "ref:coconut-milk");
  assert.ok(ids("หัวหอม").includes("ref:onion"));
  assert.ok(ids("bean curd").includes("ref:tofu"));
});

test("a small typing slip in English still finds it, but is never 'close'", () => {
  const s = find("chiken breast", "ref:chicken-breast");
  assert.ok(s);
  assert.equal(s.close, false);
  const t = find("pork bely", "ref:pork-belly");
  assert.ok(t);
  assert.equal(t.close, false);
});

// ---------------- ambiguous names / never merge ----------------

test("milk: every kind is its own row (plain, soy sweet/unsweet, condensed, evaporated, coconut)", () => {
  const r = searchLocal("นม", { lang: "th" });
  for (const k of ["milk", "soy-milk-unsweet", "soy-milk-sweet", "condensed-milk", "evaporated-milk", "coconut-milk"]) assert.ok(r.items.some((s) => s.id === `ref:${k}`), k);
  assert.equal(r.ambiguous, true);
  const kcal = new Set(r.items.map((s) => s.per100!.kcal));
  assert.equal(kcal.size, r.items.length, "no two different milks share one row or one set of numbers");
  assert.ok(ids("milk").includes("ref:milk"));
  assert.ok(!ids("นม").includes("ref:bread"), "ขนมปัง is not นม");
});

test("rice: cooked and raw are two rows with different numbers; 'ข้าว' alone is ambiguous", () => {
  const r = searchLocal("ข้าว", { lang: "th" });
  const cooked = r.items.find((s) => s.id === "ref:rice")!;
  const raw = r.items.find((s) => s.id === "ref:rice-raw")!;
  assert.equal(cooked.state, "cooked");
  assert.equal(raw.state, "raw");
  assert.ok(raw.per100!.kcal > cooked.per100!.kcal * 2);
  assert.equal(r.ambiguous, true);
  assert.equal(ids("ข้าวสวย")[0], "ref:rice");
  assert.equal(ids("ข้าวสาร")[0], "ref:rice-raw");
  assert.ok(!ids("ข้าวสวย").includes("ref:rice-raw"));
  assert.ok(!ids("ข้าวสาร").includes("ref:rice"));
});

test("oyster sauce is never cooking oil, and oil is never oyster sauce", () => {
  assert.ok(!ids("น้ำมันหอย").includes("ref:oil"));
  assert.equal(ids("น้ำมันหอย")[0], "ref:oyster-sauce");
  assert.ok(!ids("oyster sauce").includes("ref:oil"));
  // typing "น้ำมัน" may still be on the way to "น้ำมันหอย": it is its own row, below the oil, never the oil
  assert.equal(ids("น้ำมัน")[0], "ref:oil");
  assert.notEqual(find("น้ำมัน", "ref:oyster-sauce")?.per100?.kcal, find("น้ำมัน", "ref:oil").per100!.kcal);
  assert.ok(!ids("oil").includes("ref:oyster-sauce"));
  assert.equal(ids("oil")[0], "ref:oil");
});

test("a state word in her words marks the other state as a conflict (shown, never close)", () => {
  const boiled = searchLocal("ไข่ต้ม", { lang: "th" });
  assert.equal(boiled.wantState, "cooked");
  const egg = boiled.items.find((s) => s.id === "ref:egg")!;
  assert.ok(egg, "still shown so she can see why it is not right");
  assert.equal(egg.conflict, true);
  assert.equal(egg.close, false);
  assert.equal(boiled.closeCount, 0);
  assert.equal(stateQuestion("ไข่ต้ม", egg), true);
  assert.equal(stateQuestion("ไข่", egg), false);
  // raw is fine with "สด"
  const fresh = find("กุ้งสด", "ref:shrimp");
  assert.equal(fresh.conflict, false);
  assert.equal(fresh.close, true);
  assert.ok(!ids("กุ้งสด").includes("ref:dried-shrimp"), "dried shrimp is not fresh shrimp");
  assert.ok(!ids("กุ้งแห้ง").includes("ref:shrimp"));
});

test("extra words that make a different food are not offered as that food (ผักบุ้ง is not mixed vegetables, อกไก่ทอด is not raw)", () => {
  assert.ok(!ids("ผักบุ้ง").includes("ref:vegetables"));
  const fried = find("อกไก่ทอด", "ref:chicken-breast");
  assert.equal(fried.conflict, true);
  assert.equal(fried.close, false);
});

test("plain water is only water: coconut water is not offered as water", () => {
  assert.ok(!ids("น้ำมะพร้าว").includes("ref:water"));
  assert.ok(!ids("coconut water").includes("ref:water"));
  assert.equal(find("น้ำเปล่า", "ref:water").close, true);
});

// ---------------- ranking ----------------

test("ranking: custom > her usual > recent > reference foods", () => {
  const custom: CustomIngredient[] = (() => {
    const r = addCustom([], { name: "ไข่ต้มของฉัน", kcal: 150, protein: 12, carbs: 1, fat: 10, per: "g", state: "cooked" }, 5, "c-egg");
    assert.ok(r.ok);
    return r.list;
  })();
  let prefs: IngredientPrefPick[] = [];
  prefs = recordPick(prefs, "ไข่", { kind: "ref", key: "egg-yolk", name: "ไข่แดง" }, 100);
  prefs = recordPick(prefs, "ไข่", { kind: "ref", key: "egg-yolk", name: "ไข่แดง" }, 200);
  prefs = recordPick(prefs, "ไข่ขาว", { kind: "ref", key: "egg-white", name: "ไข่ขาว" }, 300);
  const list = localSuggestions("ไข่", { lang: "th", custom, prefs });
  assert.equal(list[0].id, "custom:c-egg");
  assert.equal(list[0].kind, "custom");
  assert.equal(list[1].id, "ref:egg-yolk");
  assert.equal(list[1].kind, "preferred");
  assert.equal(list[1].uses, 2);
  assert.equal(list[2].id, "ref:egg-white");
  assert.equal(list[2].kind, "recent");
  assert.equal(list[3].id, "ref:egg");
  assert.equal(list[3].kind, "ref");
  // every food once
  assert.equal(new Set(list.map((s) => s.id)).size, list.length);
});

test("her custom food shows above unrelated database foods only when it fits; unrelated custom foods stay hidden", () => {
  const custom = myCurry();
  assert.equal(ids("แกง", { custom })[0], "custom:c1");
  assert.ok(!ids("ไข่", { custom }).includes("custom:c1"));
  assert.ok(!ids("milk", { custom }).includes("custom:c1"));
});

test("custom aliases work", () => {
  const r = addCustom([], { name: "Mom's curry", kcal: 180, protein: 9, carbs: 6, fat: 13, aliases: ["แกงแม่"] }, 1, "c9");
  assert.ok(r.ok);
  assert.equal(ids("แกงแม่", { custom: r.list })[0], "custom:c9");
  assert.equal(ids("mom", { custom: r.list })[0], "custom:c9");
});

test("empty box lists her custom foods, then recent picks (a deleted custom food is not listed)", () => {
  const custom = myCurry();
  let prefs: IngredientPrefPick[] = [];
  prefs = recordPick(prefs, "ไข่", { kind: "ref", key: "egg", name: "ไข่ไก่" }, 10);
  prefs = recordPick(prefs, "x", { kind: "custom", id: "gone", name: "ลบแล้ว" }, 20);
  const list = localSuggestions("", { lang: "th", custom, prefs });
  assert.deepEqual(list.map((s) => s.id), ["custom:c1", "ref:egg"]);
});

test("the limit is respected", () => {
  assert.ok(localSuggestions("นม", { lang: "th", limit: 3 }).length <= 3);
});

// ---------------- building the Ingredient (same fields as today's flows) ----------------

test("reference food → refPick, and the recipe math is the same as the old picker", () => {
  const s = find("ไข่ขาว", "ref:egg-white");
  const ing = buildIngredient(s, 2, "egg", { id: "i1" });
  assert.deepEqual(ing.refPick, { name: s.name, key: "egg-white" });
  assert.equal(ing.name, s.name);
  assert.equal(ing.label, null);
  const res = ingredientMacros(ing);
  assert.ok(res.ok);
  assert.ok(Math.abs(res.macros.kcal - (52 * 66) / 100) < 0.5);
  assert.equal(res.prov.source, "reference");
  assert.notEqual(res.prov.verification, "verified");
});

test("renaming the ingredient makes the pick stop applying (as before)", () => {
  const s = find("ไข่ขาว", "ref:egg-white");
  const ing = { ...buildIngredient(s, 100, "g", { id: "i1" }), name: "ไข่ขาวต้ม" };
  const res = ingredientMacros(ing);
  assert.equal(res.ok, false);
});

test("custom food → label (typed by you, unverified), unknown nutrients stay unknown, never 0", () => {
  const added = addCustom([], { name: "ซอสสูตรบ้าน", kcal: 120, protein: null, carbs: 20, fat: undefined, per: "g" }, 1, "c2");
  assert.ok(added.ok);
  const s = suggestionFromPick({ kind: "custom", id: "c2", name: "ซอสสูตรบ้าน" }, "th", added.list)!;
  assert.deepEqual(s.missing, ["protein", "fat"]);
  const ing = buildIngredient(s, 50, "g", { id: "i2" });
  assert.equal(ing.label!.via, "typed");
  assert.equal(ing.label!.basis, "per100");
  assert.deepEqual(ing.label!.missing, ["protein", "fat"]);
  const res = ingredientMacros(ing);
  assert.ok(res.ok);
  assert.equal(res.macros.kcal, 60);
  assert.deepEqual(res.missing, ["protein", "fat"]);
  assert.equal(res.prov.source, "user");
  assert.equal(res.prov.verification, "unverified");
  assert.equal(ingredientProvenance(ing, "label").verification, "unverified");
});

test("custom per-serving food: counted unit uses the label directly, grams need the weight of one serving", () => {
  const added = addCustom([], { name: "ขนมปังไส้กรอก", basis: "perUnit", kcal: 250, protein: 8, carbs: 30, fat: 11, gramsPerUnit: 90, unit: "piece" }, 1, "c3");
  assert.ok(added.ok);
  const s = suggestionFromPick({ kind: "custom", id: "c3", name: "ขนมปังไส้กรอก" }, "th", added.list)!;
  const two = quoteIngredient(s, 2, "piece");
  assert.ok(two.result.ok);
  if (two.result.ok) assert.equal(two.result.macros.kcal, 500);
  const g = quoteIngredient(s, 45, "g");
  assert.ok(g.result.ok);
  if (g.result.ok) assert.equal(g.result.macros.kcal, 125);
  assert.equal(suggestedUnits(s).default, "piece");
  // same food without the weight of one → the math asks, never guesses
  const noW = addCustom([], { name: "ซองกาแฟ", basis: "perUnit", kcal: 70 }, 1, "c4");
  assert.ok(noW.ok);
  const s2 = suggestionFromPick({ kind: "custom", id: "c4", name: "ซองกาแฟ" }, "th", noW.list)!;
  const q = quoteIngredient(s2, 30, "g");
  assert.equal(q.result.ok, false);
  if (!q.result.ok) assert.equal(q.result.reason, "need-weight-per-unit");
});

test("custom per 100 ml food: grams use her density; without it the math asks", () => {
  const a = addCustom([], { name: "ซุปบ้าน", per: "ml", kcal: 40, protein: 2, carbs: 5, fat: 1, gPerMl: 1.02 }, 1, "c5");
  const b = addCustom([], { name: "ซุปบ้านสอง", per: "ml", kcal: 40, protein: 2, carbs: 5, fat: 1 }, 1, "c6");
  assert.ok(a.ok && b.ok);
  const sa = suggestionFromPick({ kind: "custom", id: "c5", name: "ซุปบ้าน" }, "th", a.list)!;
  const sb = suggestionFromPick({ kind: "custom", id: "c6", name: "ซุปบ้านสอง" }, "th", b.list)!;
  const ok = quoteIngredient(sa, 200, "ml");
  assert.ok(ok.result.ok);
  if (ok.result.ok) assert.equal(ok.result.macros.kcal, 80);
  const grams = quoteIngredient(sa, 102, "g");
  assert.ok(grams.result.ok);
  if (grams.result.ok) assert.equal(Math.round(grams.result.macros.kcal), 40);
  const asks = quoteIngredient(sb, 100, "g");
  assert.equal(asks.result.ok, false);
  if (!asks.result.ok) assert.equal(asks.result.reason, "need-density");
});

// ---------------- quantity + unit conversions ----------------

test("units: kg → g, liters → ml, spoons use the food's own density, eggs use the weight of one", () => {
  const rice = find("ข้าวสวย", "ref:rice");
  const g = quoteIngredient(rice, 200, "g").result;
  const kg = quoteIngredient(rice, 0.2, "kg").result;
  const oz = quoteIngredient(rice, 2, "oz").result;
  assert.ok(g.ok && kg.ok && oz.ok);
  if (g.ok && kg.ok && oz.ok) {
    assert.equal(g.macros.kcal, 260);
    assert.equal(kg.macros.kcal, 260);
    assert.ok(Math.abs(oz.macros.kcal - (130 * 56.7) / 100) < 0.01);
  }
  const oil = find("น้ำมันพืช", "ref:oil");
  const tbsp = quoteIngredient(oil, 1, "tbsp").result;
  assert.ok(tbsp.ok);
  if (tbsp.ok) assert.ok(Math.abs(tbsp.macros.kcal - 884 * 0.92 * 0.15) < 0.01);
  const egg = quoteIngredient(find("ไข่ไก่", "ref:egg"), 2, "egg").result;
  assert.ok(egg.ok);
  if (egg.ok) assert.equal(Math.round(egg.macros.kcal), Math.round(143 * 1.0));
});

test("rice by the spoon: no density known → the math asks instead of guessing 1 g/ml", () => {
  const q = quoteIngredient(find("ข้าวสวย", "ref:rice"), 2, "tbsp");
  assert.equal(q.result.ok, false);
  if (!q.result.ok) assert.equal(q.result.reason, "need-density");
});

test("amounts that are 0, negative or not a number never become NaN or negative", () => {
  const s = find("ไข่ไก่", "ref:egg");
  for (const a of [0, -3, NaN, Infinity]) assert.equal(buildIngredient(s, a, "g").amount, 0);
  assert.equal(buildIngredient(s, 3, "nope" as never).unit, "g");
});

test("suggested units: eggs start in eggs, oil offers spoons, plain meat starts in grams", () => {
  assert.equal(suggestedUnits(find("ไข่ไก่", "ref:egg")).default, "egg");
  assert.ok(suggestedUnits(find("ไข่ไก่", "ref:egg")).units.includes("g"));
  assert.ok(suggestedUnits(find("น้ำมันพืช", "ref:oil")).units.includes("tbsp"));
  const chicken = suggestedUnits(find("อกไก่", "ref:chicken-breast"));
  assert.equal(chicken.default, "g");
  assert.ok(!chicken.units.includes("egg"));
});

// ---------------- old recipes still work ----------------

test("an old recipe (no new fields) still gives the same numbers", () => {
  const recipe: Recipe = {
    id: "r", name: "old", servings: 2, cookedWeight: null, steps: [], coverPhotoId: null, createdAt: 1, updatedAt: 1,
    ingredients: [
      { id: "a", name: "ไข่ไก่", amount: 2, unit: "egg", label: null, gramsPerUnit: null, photoId: null },
      { id: "b", name: "ข้าวสวย", amount: 200, unit: "g", label: null, gramsPerUnit: null, photoId: null },
    ],
  };
  const t = recipeTotals(recipe.ingredients, recipe.servings, null);
  assert.equal(t.problems.length, 0);
  assert.equal(Math.round(t.total.kcal), Math.round(143 + 260));
});

test("every reference food can be searched by its own name and comes back as itself", () => {
  for (const f of FOOD_REF) {
    const hit = localSuggestions(f.label.th, { lang: "th" }).find((s) => s.id === `ref:${f.key}`);
    assert.ok(hit, `${f.key} by Thai label`);
    const hit2 = localSuggestions(f.names.find((n) => /^[a-z ]+$/i.test(n)) ?? f.names[0], { lang: "en" }).find((s) => s.id === `ref:${f.key}`);
    assert.ok(hit2, `${f.key} by a name`);
  }
});
