import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareDay, splitTexts } from "../app/lib/shareDay.ts";
import { macroSplit } from "../app/lib/macroSplit.ts";
import type { Entry } from "../app/lib/types.ts";

const entry = (id: string, slot: string, p: number, c: number, f: number): Entry =>
  ({ id, date: "2026-11-16", slot, title: id, createdAt: 1, items: [{ id, name: id, amount: 1, unit: "x", kcal: p * 4 + c * 4 + f * 9, protein: p, carbs: c, fat: f }] }) as unknown as Entry;

test("empty day shows no percents", () => {
  const d = buildShareDay([], "2026-11-16");
  assert.equal(d.split, null);
  assert.equal(splitTexts(d.split), null);
});

test("all-zero day shows no percents", () => {
  assert.equal(buildShareDay([entry("a", "breakfast", 0, 0, 0)], "2026-11-16").split, null);
});

test("percents match macroSplit of the day total and add to 100", () => {
  const d = buildShareDay([entry("a", "breakfast", 10.4, 30.4, 5.4), entry("b", "lunch", 20.4, 40.4, 12.4)], "2026-11-16");
  const want = macroSplit({ protein: 30.8, carbs: 70.8, fat: 17.8 })!;
  assert.deepEqual(d.split, want);
  assert.equal(want.protein + want.carbs + want.fat, 100);
  const t = splitTexts(d.split)!;
  assert.equal(t.protein, `${want.protein}%`);
  assert.equal(t.carbs, `${want.carbs}%`);
  assert.equal(t.fat, `${want.fat}%`);
});
