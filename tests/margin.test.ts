// Round 12: the +15% margin is only for amounts the AI guessed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { markMargin as marked } from "../app/lib/nutrition.ts";

const base = { name: "แซลมอน", amount: 120, unit: "กรัม", kcal: 200, protein: 24, carbs: 0, fat: 11, estimated: false, kind: "food" as const };

test("exact amount from the user: no margin", () => {
  const r = marked({ ...base, userAmount: true });
  assert.equal(r.margin, false);
  assert.equal(r.kcal, 200);
});

test("guessed amount: +15%", () => {
  const r = marked({ ...base, userAmount: false });
  assert.equal(r.margin, true);
  assert.ok(Math.abs(r.kcal - 230) < 1e-9);
  const old = marked(base); // AI left the flag out → treated as a guess
  assert.equal(old.margin, true);
});

// Round 27: numbers read from a printed nutrition label are real, so no margin.
test("numbers from a printed label: no margin", () => {
  const r = marked({ ...base, fromLabel: true });
  assert.equal(r.margin, false);
  assert.equal(r.kcal, 200);
  assert.equal(r.fromLabel, true);
});

test("no label and no exact amount: still +15%", () => {
  const r = marked({ ...base, fromLabel: false, userAmount: false });
  assert.equal(r.margin, true);
  assert.ok(Math.abs(r.kcal - 230) < 1e-9);
});
