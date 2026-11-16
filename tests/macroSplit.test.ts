// Macro split: percent of calories from protein / carbs / fat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { macroSplit } from "../app/lib/macroSplit.ts";

const total = (s: { protein: number; carbs: number; fat: number }) => s.protein + s.carbs + s.fat;

test("uses calories, not grams (fat counts 9 per gram)", () => {
  // 50 g protein = 200, 50 g carbs = 200, 400/9 g fat = 400 → 25 / 25 / 50
  assert.deepEqual(macroSplit({ protein: 50, carbs: 50, fat: 400 / 9 }), { protein: 25, carbs: 25, fat: 50 });
});

test("always adds up to exactly 100", () => {
  for (const g of [
    { protein: 1, carbs: 1, fat: 0 },
    { protein: 33, carbs: 33, fat: 14.67 },
    { protein: 50, carbs: 65, fat: 31 },
    { protein: 0.3, carbs: 7.1, fat: 2.2 },
    { protein: 120, carbs: 0, fat: 0 },
  ]) {
    assert.equal(total(macroSplit(g)!), 100, JSON.stringify(g));
  }
});

test("nothing eaten → no split", () => {
  assert.equal(macroSplit({ protein: 0, carbs: 0, fat: 0 }), null);
});
