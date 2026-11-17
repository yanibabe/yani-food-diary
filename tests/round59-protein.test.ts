import { test } from "node:test";
import assert from "node:assert/strict";
import { macroTargets, proteinPerKg, proteinTargetG, estimateEnergy } from "../app/lib/energy.ts";
import type { Profile } from "../app/lib/types.ts";

const base: Profile = {
  name: "T", reason: "lose", age: 30, heightCm: 160, weightKg: 60, sex: "female", daily: "sitting", exercise: "none",
  targetWeightKg: 55, duration: 3, durationUnit: "month", pregnant: false, breastfeeding: false,
} as Profile;

test("per-kg rule: lose 1.4, muscle 1.6, others none", () => {
  assert.equal(proteinPerKg("lose"), 1.4);
  assert.equal(proteinPerKg("muscle"), 1.6);
  assert.equal(proteinPerKg("maintain"), null);
  assert.equal(proteinPerKg("gain"), null);
  assert.equal(proteinPerKg(undefined), null);
});

test("lose weight: 60 kg → 84 g; muscle: 60 kg → 96 g; maintain/gain → null", () => {
  assert.equal(proteinTargetG(base), 84);
  assert.equal(proteinTargetG({ ...base, reason: "muscle" }), 96);
  assert.equal(proteinTargetG({ ...base, reason: "maintain" }), null);
  assert.equal(proteinTargetG({ ...base, reason: "gain" }), null);
  assert.equal(proteinTargetG(null), null);
  assert.equal(proteinTargetG({ ...base, weightKg: 0 }), null);
});

test("the 35% ceiling: 120 kg on 1,500 kcal cannot get more than 131 g", () => {
  assert.equal(proteinTargetG({ ...base, weightKg: 120 }), 168); // no calories given: weight rule only
  assert.equal(proteinTargetG({ ...base, weightKg: 120 }, 1500), 131); // floor(1500*0.35/4)
  assert.equal(proteinTargetG(base, 1800), 84); // normal case is not touched
});

test("macros still add up to the day's calories when protein is by weight", () => {
  const kcal = 1800;
  const g = proteinTargetG(base, kcal)!;
  const m = macroTargets(kcal, g);
  assert.equal(Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9), kcal);
  assert.ok(m.carbs > 0);
});

test("keep / gain weight keep the old 20/50/30 split", () => {
  const m = macroTargets(2000, null);
  assert.equal(Math.round(m.protein), 100);
  assert.equal(Math.round(m.carbs), 250);
  assert.equal(Math.round(m.fat), 67);
});

test("the estimate explains the protein line for 'lose' and returns the same grams", () => {
  const r = estimateEnergy(base, "en");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.proteinG, proteinTargetG(base, r.suggested));
    assert.ok(r.steps.some((s) => s.includes("Protein 1.4 g × 60 kg")));
  }
});
