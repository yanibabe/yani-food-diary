// Round 40 final checks (before deploy):
// 1. Her weight ≠ "verified": a weighed item is still an AI estimate, and guessed oil/sauce stay guesses.
// 2. Portion edits always work from the AI's own kcal: no double buffer, P/C/F scale but get no buffer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canBuffer, isBuffered, originalKcal, setBuffer, startBuffer, bufferSummary } from "../app/lib/calorieBuffer.ts";
import { changeAmount } from "../app/lib/nutrition.ts";
import { itemProvenance, provFromAi } from "../app/lib/provenance.ts";
import type { FoodItem } from "../app/lib/types.ts";

const item = (over: Partial<FoodItem> = {}): FoodItem => ({
  id: "it1",
  name: "อาหาร",
  amount: 1,
  unit: "จาน",
  kcal: 600,
  protein: 30,
  carbs: 70,
  fat: 20,
  estimated: true,
  kind: "food",
  note: null,
  box: null,
  prov: provFromAi({ userAmount: false, estimated: true, kind: "food" }),
  ...over,
});

const close = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} ${a} ≈ ${b}`);

// ---- 1. partly known amounts ----

test("her weight never makes AI numbers 'verified'", () => {
  for (const estimated of [true, false]) {
    for (const kind of ["food", "extra"]) {
      const p = provFromAi({ userAmount: true, estimated, kind });
      assert.equal(p.source, "ai");
      assert.equal(p.verification, "estimated", `${kind} estimated=${estimated}`);
      assert.notEqual(p.verification, "verified");
    }
  }
  assert.equal(itemProvenance(item({ prov: provFromAi({ userAmount: true, estimated: false }) })).verification, "estimated");
});

test("weight given + clear recipe → exact amount; weight given + guessed recipe → amount known, recipe estimated", () => {
  assert.equal(provFromAi({ userAmount: true, estimated: false, kind: "food" }).via, "exact-amount");
  assert.equal(provFromAi({ userAmount: true, estimated: true, kind: "food" }).via, "amount-known");
  assert.equal(provFromAi({ userAmount: false, estimated: false, kind: "food" }).via, "guess");
  // Neither gets a buffer: she gave the amount (the rule she approved).
  assert.equal(canBuffer(item({ prov: provFromAi({ userAmount: true, estimated: false }) })), false);
  assert.equal(canBuffer(item({ prov: provFromAi({ userAmount: true, estimated: true }) })), false);
});

test("guessed oil / sauce is a guess even if the AI wrongly says userAmount", () => {
  const p = provFromAi({ userAmount: true, estimated: true, kind: "extra" });
  assert.equal(p.via, "guess");
  const oil = item({ name: "น้ำมันผัด", kind: "extra", amount: 1, unit: "ช้อนโต๊ะ", kcal: 120, protein: 0, carbs: 0, fat: 13.6, prov: p });
  assert.equal(canBuffer(oil), true);
  close(startBuffer(oil, 15).kcal, 138);
  // Oil she measured herself ("1 tbsp", AI sure) stays exact.
  const measured = provFromAi({ userAmount: true, estimated: false, kind: "extra" });
  assert.equal(measured.via, "exact-amount");
  assert.equal(canBuffer(oil.prov ? { ...oil, prov: measured } : oil), false);
});

test("weighed chicken + guessed frying oil: only the oil is buffered, P/C/F never change", () => {
  const chicken = item({
    id: "c", name: "อกไก่ทอด", amount: 200, unit: "กรัม", kcal: 330, protein: 62, carbs: 0, fat: 7, estimated: false,
    prov: provFromAi({ userAmount: true, estimated: false, kind: "food" }),
  });
  const oil = item({
    id: "o", name: "น้ำมันทอด", kind: "extra", amount: 1, unit: "ช้อนโต๊ะ", kcal: 120, protein: 0, carbs: 0, fat: 13.6, estimated: true,
    prov: provFromAi({ userAmount: false, estimated: true, kind: "extra" }),
  });
  const meal = [chicken, oil].map((i) => startBuffer(i, 15));
  assert.equal(meal[0].kcal, 330);
  assert.equal(isBuffered(meal[0]), false);
  close(meal[1].kcal, 138);
  assert.equal(meal[1].fat, 13.6);
  assert.equal(meal[0].protein, 62);
  const s = bufferSummary(meal);
  close(s.aiKcal, 450);
  close(s.trackingKcal, 468);
});

// ---- 2. portion edits + buffer ----

test("600 kcal, ate half, 15% → AI 300, counted 345; P/C/F halve with no buffer", () => {
  const start = startBuffer(item(), 15);
  assert.equal(start.aiKcal, 600);
  close(start.kcal, 690);
  const half = changeAmount(start, 0.5);
  close(half.aiKcal ?? NaN, 300);
  close(half.kcal, 345);
  assert.equal(half.bufferPct, 15);
  close(half.protein, 15);
  close(half.carbs, 35);
  close(half.fat, 10);
});

test("many edits in a row never stack the buffer", () => {
  let it = startBuffer(item(), 15);
  for (const amt of [0.5, 2, 1 / 3, 1.5, 0.25, 1, 1, 0.5]) {
    it = changeAmount(it, amt);
    close(it.aiKcal ?? NaN, 600 * amt, `aiKcal at ${amt}`);
    close(it.kcal, 600 * amt * 1.15, `kcal at ${amt}`);
    close(it.protein, 30 * amt, `protein at ${amt}`);
    close(it.fat, 20 * amt, `fat at ${amt}`);
  }
  // Setting the same % again (or changing it) still works from the AI's kcal.
  close(setBuffer(it, 15).kcal, 345);
  close(setBuffer(setBuffer(it, 20), 15).kcal, 345);
  close(setBuffer(it, 0).kcal, 300);
});

test("AI chat 'ate half': the AI sees its own kcal, so the new buffer is not on top of the old one", () => {
  const start = startBuffer(item(), 15); // counted 690
  // MealReview sends originalKcal (600) to the AI, never the counted 690.
  assert.equal(originalKcal(start), 600);
  const aiAnswer = originalKcal(start) / 2; // AI halves what it saw → 300
  const updated = startBuffer(
    item({ kcal: aiAnswer, protein: 15, carbs: 35, fat: 10, amount: 0.5, prov: provFromAi({ userAmount: false, estimated: true }) }),
    start.bufferPct ?? 0,
  );
  close(updated.kcal, 345);
  assert.equal(updated.aiKcal, 300);
  // Twice more → still exactly +15% of the AI's number.
  const again = startBuffer(item({ kcal: originalKcal(updated) / 2, amount: 0.25, prov: updated.prov }), updated.bufferPct ?? 0);
  close(again.kcal, 172.5);
});
