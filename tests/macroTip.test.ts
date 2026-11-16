// The one-line tip under the macro tiles on Today.
import { test } from "node:test";
import assert from "node:assert/strict";
import { macroTip } from "../app/lib/macroTip.ts";

const T = { protein: 90, carbs: 180, fat: 53 };

test("nothing eaten → no tip", () => {
  assert.equal(macroTip({ kcal: 0, protein: 0, carbs: 0, fat: 0 }, T, 1600), null);
});

test("fat clearly over → fat tip first, with grams over", () => {
  const tip = macroTip({ kcal: 1500, protein: 40, carbs: 200, fat: 70 }, T, 1600)!;
  assert.equal(tip.key, "fat");
  assert.match(tip.th, /17 g/);
});

test("a tiny bit over is not 'over'", () => {
  const tip = macroTip({ kcal: 1550, protein: 88, carbs: 175, fat: 55 }, T, 1600)!;
  assert.equal(tip.key, "ok");
});

test("carbs over target → carbs tip", () => {
  assert.equal(macroTip({ kcal: 1400, protein: 80, carbs: 230, fat: 40 }, T, 1600)!.key, "carbs");
});

test("protein behind how far the day has got → protein tip with grams still needed", () => {
  const tip = macroTip({ kcal: 1240, protein: 42, carbs: 165, fat: 45 }, T, 1600)!;
  assert.equal(tip.key, "protein");
  assert.match(tip.th, /48 g/);
});

test("early in the day, low protein is fine if it keeps pace", () => {
  // 25% of calories, 25% of protein → no protein nagging
  assert.notEqual(macroTip({ kcal: 400, protein: 23, carbs: 45, fat: 13 }, T, 1600)!.key, "protein");
});

test("carbs running far ahead of calories → carbs tip", () => {
  // 30% of the day's calories but 60% of carbs
  assert.equal(macroTip({ kcal: 480, protein: 20, carbs: 108, fat: 2 }, T, 1600)!.key, "carbs");
});

test("balanced day → calm ok line", () => {
  assert.equal(macroTip({ kcal: 800, protein: 46, carbs: 90, fat: 26 }, T, 1600)!.key, "ok");
});
