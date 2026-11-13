import { test } from "node:test";
import assert from "node:assert/strict";
import { calorieWeek } from "../app/lib/week.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

const item = (kcal: number): FoodItem => ({ id: "i", name: "x", amount: 1, unit: "จาน", estimated: false, kind: "food", note: null, box: null, kcal, protein: 0, carbs: 0, fat: 0 });
const meal = (date: string, ...kcals: number[]): Entry => ({
  id: date + kcals.join(), date, slot: "lunch", title: "m", items: kcals.map(item), source: "manual", photoId: null, recipe: null, createdAt: 1, updatedAt: 1,
});

test("weekly calories: Mon→Sun, average skips empty days, counts days over target", () => {
  const entries = [meal("2026-11-09", 500, 700), meal("2026-11-09", 300), meal("2026-11-11", 1800), meal("2026-11-02", 9999)];
  const w = calorieWeek(entries, "2026-11-12", "2026-11-13", 1500);
  assert.equal(w.start, "2026-11-09");
  assert.equal(w.end, "2026-11-15");
  assert.deepEqual(w.days.map((d) => d.kcal), [1500, 0, 1800, 0, 0, 0, 0]);
  assert.equal(w.loggedDays, 2);
  assert.equal(w.avg, 1650);
  assert.equal(w.overDays, 1); // exactly on target is not "over"
  assert.deepEqual(w.days.map((d) => d.future), [false, false, false, false, false, true, true]);
});

test("weekly calories: no meals → no average", () => {
  const w = calorieWeek([], "2026-11-13", "2026-11-13", 1500);
  assert.equal(w.avg, null);
  assert.equal(w.loggedDays, 0);
});
