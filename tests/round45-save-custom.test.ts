// Round 45: "Save as my ingredient" on the Search food page — save → found first next time → edit/delete → duplicates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { blankItem } from "../app/lib/nutrition.ts";
import { customInputFromItem, findSameName, itemBasis, itemFromCustom, saveItemAsCustom } from "../app/lib/saveCustomFromItem.ts";
import { deleteCustom, editCustom, loadCustom, parseCustom, saveCustom, type CustomIngredient } from "../app/lib/customIngredients.ts";
import { searchLocal } from "../app/lib/ingredientSearch.ts";
import type { FoodItem } from "../app/lib/types.ts";

const item = (over: Partial<FoodItem> = {}): FoodItem => ({ ...blankItem("g"), id: "it1", name: "Zorbo", amount: 100, unit: "g", kcal: 250, protein: 10, carbs: 30, fat: 5, ...over });
const fakeStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test("basis: grams / ml words vs a serving", () => {
  assert.equal(itemBasis({ unit: "g" }), "g");
  assert.equal(itemBasis({ unit: "กรัม" }), "g");
  assert.equal(itemBasis({ unit: "ml" }), "ml");
  assert.equal(itemBasis({ unit: "จาน" }), "unit");
});

test("per 100 g: 200 g with 500 kcal saves as 250 kcal per 100 g", () => {
  const input = customInputFromItem(item({ amount: 200, kcal: 500, protein: 20, carbs: 60, fat: 10 }))!;
  assert.equal(input.basis, "per100");
  assert.equal(input.per, "g");
  assert.equal(input.kcal, 250);
  assert.equal(input.protein, 10);
});

test("per serving: 2 plates with 700 kcal saves as 350 kcal per 1 plate", () => {
  const input = customInputFromItem(item({ amount: 2, unit: "จาน", kcal: 700 }))!;
  assert.equal(input.basis, "perUnit");
  assert.equal(input.kcal, 350);
});

test("numbers she left empty stay unknown, never 0", () => {
  const r = saveItemAsCustom([], item({ missing: ["protein", "fat"] }), 1000);
  assert.ok(r.ok);
  assert.equal(r.item.protein, null);
  assert.equal(r.item.fat, null);
  assert.equal(r.item.carbs, 30);
});

test("no amount or no kcal or no name: not saved", () => {
  assert.equal(saveItemAsCustom([], item({ amount: 0 }), 1).ok, false);
  const noName = saveItemAsCustom([], item({ name: "  " }), 1);
  assert.deepEqual(noName.ok === false && noName.error, "name");
});

test("save → stored → found FIRST in the next search with kind 'custom' (the Mine tag)", () => {
  const st = fakeStorage();
  const r = saveItemAsCustom(loadCustom(st), item({ name: "Egg" }), 1000);
  assert.ok(r.ok);
  saveCustom(r.list, st);
  const list = loadCustom(st);
  assert.equal(list.length, 1);
  const found = searchLocal("egg", { lang: "en", custom: list, prefs: [] });
  assert.equal(found.items[0].kind, "custom");
  assert.equal(found.items[0].name, "Egg");
  // her numbers are typed by her, never verified
  assert.equal(found.items[0].custom!.kcal, 250);
});

test("an unknown word is found by its saved name", () => {
  const r = saveItemAsCustom([], item(), 1000);
  assert.ok(r.ok);
  const found = searchLocal("zorbo", { lang: "th", custom: r.list, prefs: [] });
  assert.equal(found.items[0]?.kind, "custom");
});

test("edit and delete work on a saved one", () => {
  const r = saveItemAsCustom([], item(), 1000);
  assert.ok(r.ok);
  const e = editCustom(r.list, r.item.id, { name: "Zorbo", kcal: 300, protein: 12 }, 2000);
  assert.ok(e.ok);
  assert.equal(e.item.kcal, 300);
  assert.equal(e.item.id, r.item.id);
  assert.deepEqual(deleteCustom(e.list, r.item.id), []);
});

test("duplicate name: a clear 'duplicate' answer with the existing one (not a crash), case-insensitive", () => {
  const first = saveItemAsCustom([], item(), 1000);
  assert.ok(first.ok);
  const again = saveItemAsCustom(first.list, item({ name: "  zorbo " }), 2000);
  assert.equal(again.ok, false);
  assert.ok(!again.ok && again.error === "duplicate");
  if (!again.ok && again.error === "duplicate") assert.equal(again.existing.id, first.item.id);
  assert.equal(findSameName(first.list, "ZORBO")?.id, first.item.id);
  assert.equal(findSameName(first.list, "other"), null);
});

test("'use the existing one': rebuilt item keeps the review item's id, uses her saved numbers, keeps her grams", () => {
  const first = saveItemAsCustom([], item(), 1000);
  assert.ok(first.ok);
  const c: CustomIngredient = first.item;
  const rebuilt = itemFromCustom(c, { id: "it9", amount: 200, unit: "g" }, "en")!;
  assert.equal(rebuilt.id, "it9");
  assert.equal(rebuilt.kcal, 500);
  assert.equal(rebuilt.amount, 200);
  assert.notEqual(rebuilt.prov?.verification, "verified");
  // different unit: starts at 100 g
  const start = itemFromCustom(c, { id: "it9", amount: 1, unit: "จาน" }, "en")!;
  assert.equal(start.amount, 100);
  assert.equal(start.kcal, 250);
});

test("a per-serving saved one comes back as 1 serving", () => {
  const r = saveItemAsCustom([], item({ amount: 1, unit: "จาน", kcal: 400, name: "Bowl" }), 1000);
  assert.ok(r.ok);
  const back = itemFromCustom(r.item, { id: "x", amount: 3, unit: "จาน" }, "en")!;
  assert.equal(back.amount, 1);
  assert.equal(back.kcal, 400);
});

test("saved text survives a round trip", () => {
  const r = saveItemAsCustom([], item(), 1000);
  assert.ok(r.ok);
  assert.equal(parseCustom(JSON.stringify(r.list))[0].name, "Zorbo");
});
