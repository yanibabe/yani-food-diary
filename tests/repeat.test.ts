// "Eat again": recent meals list, copying a meal, and shared photos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyMeal, photoStillUsed, recentMeals } from "../app/lib/repeat.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

const item = (kcal: number, id = "i1"): FoodItem => ({
  id, name: "x", amount: 1, unit: "จาน", kcal, protein: 1, carbs: 2, fat: 3, estimated: false, kind: "food", note: null, box: null,
});
const meal = (id: string, title: string, kcal: number, createdAt: number, extra: Partial<Entry> = {}): Entry => ({
  id, date: "2026-11-10", slot: "breakfast", title, items: [item(kcal)], source: "text", photoId: null, recipe: null,
  createdAt, updatedAt: createdAt, ...extra,
});

test("recent meals: newest first, same meal only once, empty meals skipped", () => {
  const list = recentMeals([
    meal("a", "ข้าวโอ๊ต", 300, 1),
    meal("b", "ส้มตำ", 150, 2),
    meal("c", "ข้าวโอ๊ต ", 300, 3), // same title (extra space) + same kcal → same meal
    meal("d", "ข้าวโอ๊ต", 450, 4), // bigger bowl → a different meal
    { ...meal("e", "ว่าง", 0, 5), items: [] },
  ]);
  assert.deepEqual(list.map((e) => e.id), ["d", "c", "b"]);
});

test("recent meals: stops at the limit", () => {
  const many = Array.from({ length: 10 }, (_, i) => meal(`m${i}`, `meal ${i}`, 100 + i, i));
  assert.equal(recentMeals(many, 6).length, 6);
  assert.equal(recentMeals(many, 6)[0].id, "m9");
});

test("copy meal: new ids, new day + slot, same numbers and photo", () => {
  const old = meal("a", "ข้าวมันไก่", 600, 1, { photoId: "ph_1", slot: "lunch" });
  const c = copyMeal(old, "2026-11-13", "dinner", 99);
  assert.notEqual(c.id, old.id);
  assert.notEqual(c.items[0].id, old.items[0].id);
  assert.equal(c.date, "2026-11-13");
  assert.equal(c.slot, "dinner");
  assert.equal(c.items[0].kcal, 600);
  assert.equal(c.photoId, "ph_1");
  assert.equal(c.createdAt, 99);
  assert.equal(old.date, "2026-11-10"); // the old meal is not changed
});

test("shared photo: kept while another meal still uses it", () => {
  const a = meal("a", "x", 1, 1, { photoId: "ph_1" });
  const b = meal("b", "x", 1, 2, { photoId: "ph_1" });
  assert.equal(photoStillUsed([a, b], "ph_1", "a"), true);
  assert.equal(photoStillUsed([a], "ph_1", "a"), false);
});
