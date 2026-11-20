// Phase 2C-2: one search, three groups (meals she logged, her recipes, ingredients). Finding and ordering only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GROUP_PREVIEW, mealRank, recipeRank, searchLoggedMeals, searchMyRecipes, visibleRows } from "../app/lib/unifiedSearch.ts";
import { recentMeals } from "../app/lib/repeat.ts";
import type { Entry, Recipe } from "../app/lib/types.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/page.tsx");
const ingSheet = read("../app/components/AddIngredientSheet.tsx");

const item = (name: string, kcal = 100, alt?: { th?: string; en?: string }) => ({ id: `it_${name}`, name, alt, amount: 1, unit: "plate", kcal, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });
const meal = (id: string, title: string, date: string, items: ReturnType<typeof item>[] = [item(title)], alt?: { th?: string; en?: string }): Entry =>
  ({ id, date, slot: "lunch", title, alt, items, recipe: null, createdAt: Date.parse(date), updatedAt: 1 }) as unknown as Entry;
const recipe = (id: string, name: string, ingredients: string[] = [], updatedAt = 1, alt?: { th?: string; en?: string }): Recipe =>
  ({ id, name, alt, servings: 2, cookedWeight: null, ingredients: ingredients.map((n) => ({ id: n, name: n, amount: 1, unit: "g", label: null, gramsPerUnit: null, photoId: null })), steps: [], coverPhotoId: null, createdAt: 1, updatedAt }) as unknown as Recipe;

test("ranking: exact, then starts-with, then contains, then only a food inside", () => {
  assert.equal(mealRank(meal("a", "ข้าวมันไก่", "2026-11-01"), "ข้าวมันไก่"), 0);
  assert.equal(mealRank(meal("a", "ข้าวมันไก่ทอด", "2026-11-01"), "ข้าวมันไก่"), 1);
  assert.equal(mealRank(meal("a", "ข้าวมันไก่ทอด", "2026-11-01"), "ไก่"), 2);
  assert.equal(mealRank(meal("a", "จานเดียว", "2026-11-01", [item("ไก่ต้ม")]), "ไก่"), 3);
  assert.equal(mealRank(meal("a", "ข้าวผัด", "2026-11-01"), "ไก่"), Infinity);
  assert.equal(recipeRank(recipe("r", "Chicken curry"), "chicken"), 1);
  assert.equal(recipeRank(recipe("r", "Chicken curry"), "CHICKEN CURRY"), 0);
});

test("meals: exact name first, partial next, newest first inside one rank", () => {
  const list = recentMeals([
    meal("old", "ไก่ย่าง", "2026-11-01", [item("ไก่ย่าง", 300)]),
    meal("new", "ข้าวไก่ย่าง", "2026-11-10", [item("x", 400)]),
    meal("exact", "ไก่", "2026-10-01", [item("ไก่", 200)]),
    meal("none", "ผัดผัก", "2026-11-11"),
  ]);
  assert.deepEqual(searchLoggedMeals(list, "ไก่").map((e) => e.id), ["exact", "old", "new"]);
});

test("similar names stay separate when their numbers differ; identical ones are not repeated", () => {
  const list = recentMeals([
    meal("a", "ข้าวมันไก่", "2026-11-01", [item("a", 640)]),
    meal("b", "ข้าวมันไก่", "2026-11-02", [item("a", 640)]), // same name + same kcal = same meal
    meal("c", "ข้าวมันไก่", "2026-11-03", [item("a", 500)]), // different kcal = different meal
  ]);
  assert.equal(searchLoggedMeals(list, "ข้าวมันไก่").length, 2);
});

test("English words find a Thai-named meal and recipe through the other-language name", () => {
  const m = meal("m", "ข้าวมันไก่", "2026-11-01", [item("ข้าวมันไก่", 640, { en: "Hainanese chicken rice" })], { en: "Hainanese chicken rice" });
  assert.equal(searchLoggedMeals([m], "chicken").length, 1);
  assert.equal(searchLoggedMeals([m], "ข้าว").length, 1);
  const r = recipe("r", "แกงกะหรี่ไก่", [], 1, { en: "Chicken curry" });
  assert.equal(searchMyRecipes([r], "curry").length, 1);
});

test("several typed words must all be there; whitespace and case are ignored", () => {
  const rs = [recipe("1", "Chicken curry"), recipe("2", "Chicken soup")];
  assert.deepEqual(searchMyRecipes(rs, "  CHICKEN   curry ").map((r) => r.id), ["1"]);
  assert.deepEqual(searchMyRecipes(rs, "curry chicken").map((r) => r.id), ["1"]);
});

test("recipes: name matches before recipes that only contain the food; newest edit first", () => {
  const rs = [recipe("inside", "ซุปผัก", ["ไก่"], 5), recipe("p", "ไก่ทอด", [], 1), recipe("q", "ข้าวไก่", [], 9)];
  assert.deepEqual(searchMyRecipes(rs, "ไก่").map((r) => r.id), ["p", "q", "inside"]);
});

test("no match and empty words give nothing; nothing is changed", () => {
  const ms = [meal("a", "ข้าว", "2026-11-01")];
  const rs = [recipe("r", "ข้าว")];
  const snap = JSON.stringify([ms, rs]);
  assert.deepEqual(searchLoggedMeals(ms, "zzz"), []);
  assert.deepEqual(searchMyRecipes(rs, "zzz"), []);
  assert.deepEqual(searchLoggedMeals(ms, "   "), []);
  assert.equal(JSON.stringify([ms, rs]), snap);
});

test("long names are matched like any other", () => {
  const long = "ซุปผักรวมมิตรสูตรพิเศษของคุณยายที่ทำทุกวันอาทิตย์ตอนเย็นหลังบ้านเก่า";
  assert.equal(searchMyRecipes([recipe("r", long)], "ซุปผัก").length, 1);
  assert.equal(searchMyRecipes([recipe("r", long)], long).length, 1);
});

test("visibleRows: a few first, the rest after show more", () => {
  const rows = [1, 2, 3, 4, 5];
  assert.equal(GROUP_PREVIEW, 3);
  assert.deepEqual(visibleRows(rows, false), { shown: [1, 2, 3], hidden: 2 });
  assert.deepEqual(visibleRows(rows, true), { shown: rows, hidden: 0 });
  assert.deepEqual(visibleRows([1, 2], false), { shown: [1, 2], hidden: 0 });
});

test("the sheet shows the groups in a fixed order with Thai + English headings", () => {
  const a = page.indexOf('data-testid="group-logged"');
  const b = page.indexOf('data-testid="group-recipes"');
  const c = page.indexOf("<IngredientSearch", b);
  assert.ok(a > 0 && b > a && c > b, "meals, then recipes, then ingredients");
  for (const t of ["เคยบันทึกไว้", "Previously logged", "สูตรของฉัน", "My recipes", "วัตถุดิบและอาหารทั่วไป", "Ingredients & foods"]) assert.ok(page.includes(t), t);
});

test("meal results reuse the Repeat Meal logic (same row, same eatAgain)", () => {
  assert.match(page, /mealRow\(e, "logged-hit"\)/);
  assert.match(page, /mealRow\(e, "recent-meal-item"\)/);
  assert.match(page, /onClick=\{\(\) => eatAgain\(e\)\}/);
});

test("recipe results open the existing recipe page (servings there), keeping the viewed day", () => {
  assert.match(page, /href=\{`\/recipes\/\$\{r\.id\}\$\{q\}`\}/);
  assert.match(page, /totalsForRecipe\(r, lang\)/); // existing serving math, no new calculation
});

test("AI estimate is a fallback BELOW the matches, never above them", () => {
  assert.match(page, /belowSlot=\{/);
  assert.doesNotMatch(page, /topSlot=\{/);
  assert.match(page, /ไม่เจอที่ตรง\? ให้ AI ประมาณแคลอรี/);
  assert.match(ingSheet, /offerAi = !topSlot && !belowSlot/);
  const results = ingSheet.indexOf('data-testid="ai-results"');
  const below = ingSheet.indexOf("{belowSlot}");
  assert.ok(results > 0 && below > results);
});

test("ingredient search itself is untouched: quantity/unit pickers, sources and estimate badges remain", () => {
  for (const t of ['data-testid="ai-amount"', 'data-testid="ai-unit"', "ProvenanceBadge", 'data-testid="ai-estimate-note"', "searchLocal(", "createUsdaSearcher"]) assert.ok(ingSheet.includes(t), t);
});

test("no nutrition math and no storage shape changed by 2C-2", () => {
  const lib = read("../app/lib/unifiedSearch.ts");
  assert.doesNotMatch(lib, /kcal|macros|ingredientMacros|localStorage/i);
});
