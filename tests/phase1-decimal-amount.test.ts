// Phase 1, issue 1: typing "0.5" must not leave the calories at 0.
import test from "node:test";
import assert from "node:assert/strict";
import { changeAmount, editAmount } from "../app/lib/nutrition.ts";
import type { FoodItem } from "../app/lib/types.ts";

const rice: FoodItem = { id: "a", name: "Rice", amount: 100, unit: "g", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } as FoodItem;

/** Type a string into the amount box one key at a time, like NumberField does. */
function type(item: FoodItem, keys: string[]): FoodItem {
  let base: FoodItem | null = item.amount > 0 ? item : null;
  let cur = item;
  let text = "";
  for (const k of keys) {
    text += k;
    const t = text.replace(",", ".");
    if (Number.isNaN(Number(t)) || t === "") continue; // NumberField ignores these
    cur = editAmount(cur, base, Number(t));
    if (cur.amount > 0) base = cur;
  }
  return cur;
}

test("the old behaviour lost the numbers at 0 (why this fix exists)", () => {
  const zero = changeAmount(rice, 0);
  assert.equal(changeAmount(zero, 0.5).kcal, 0);
});

test('typing "0", ".", "5" ends with half the calories', () => {
  const r = type(rice, ["0", ".", "5"]);
  assert.equal(r.amount, 0.5);
  assert.ok(Math.abs(r.kcal - 0.65) < 1e-9);
  assert.ok(Math.abs(r.protein - 0.0135) < 1e-9);
});

test('typing ".5" and "0.5" and "00.5" all give the same result', () => {
  for (const keys of [[".", "5"], ["0", ".", "5"], ["0", "0", ".", "5"]]) {
    const r = type(rice, keys);
    assert.equal(r.amount, 0.5);
    assert.ok(Math.abs(r.kcal - 0.65) < 1e-9, keys.join(""));
  }
});

test("typing 1.5 servings of a 1-serving item", () => {
  const bowl = { ...rice, amount: 1, unit: "bowl", kcal: 250 } as FoodItem;
  const r = type(bowl, ["1", ".", "5"]);
  assert.equal(r.amount, 1.5);
  assert.equal(r.kcal, 375);
});

test("an amount of exactly 0 is allowed and gives 0 kcal (but can be undone)", () => {
  const z = type(rice, ["0"]);
  assert.equal(z.kcal, 0);
  assert.equal(editAmount(z, rice, 100).kcal, 130);
});

test("her own numbers typed at amount 0 are never overwritten", () => {
  const z = changeAmount(rice, 0);
  const typed = { ...z, kcal: 50 } as FoodItem;
  assert.equal(editAmount(typed, rice, 2).kcal, 50);
});

test("a base from another item is ignored", () => {
  const z = changeAmount(rice, 0);
  assert.equal(editAmount(z, { ...rice, id: "other" } as FoodItem, 2).kcal, 0);
});

test("normal edits (no zero on the way) are unchanged", () => {
  const r = editAmount(rice, rice, 250);
  assert.equal(r.kcal, 325);
  assert.deepEqual(editAmount(rice, rice, -1), rice);
});
