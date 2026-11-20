// Phase 1, issue 3: the safe minimum is explained, the goal date follows the calories really used,
// and a target typed by hand is never changed.
import test from "node:test";
import assert from "node:assert/strict";
import { estimateEnergy, paceAtTarget, safeFloor, weightPlan, KCAL_PER_KG } from "../app/lib/energy.ts";
import type { Profile } from "../app/lib/types.ts";

const aggressive: Profile = {
  reason: "lose", age: 30, heightCm: 160, weightKg: 60, sex: "female", daily: "sitting", exercise: "none",
  targetWeightKg: 55, duration: 1, durationUnit: "month", pregnant: false, breastfeeding: false,
} as Profile;

test("safe minimum: 1,200 for women, 1,500 for men, unknown sex uses the lower one", () => {
  assert.equal(safeFloor("female"), 1200);
  assert.equal(safeFloor("male"), 1500);
  assert.equal(safeFloor(undefined), 1200);
});

test("when the plan needs less than the minimum, the result says so and keeps the raw number", () => {
  const r = estimateEnergy(aggressive);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.floorApplied, true);
  assert.equal(r.suggested, 1200);
  assert.ok(r.rawTarget < 1200, `raw ${r.rawTarget} should be under the floor`);
});

test("the goal date uses the floored target: slower than the planned pace", () => {
  const r = estimateEnergy(aggressive);
  if (!r.ok) return assert.fail("estimate failed");
  const plan = weightPlan(aggressive);
  const pace = paceAtTarget(r.maintenance, r.suggested, plan)!;
  assert.ok(pace.kgPerWeek < plan.usedKgPerWeek * 0.95, "real pace is slower than planned");
  assert.ok(pace.days! > plan.days, "so it takes longer than the planned days");
  // the numbers agree: deficit per day × days = kg to lose
  assert.ok(Math.abs(((r.maintenance - r.suggested) / KCAL_PER_KG) * pace.days! - plan.changeKg) < 0.01);
});

test("a normal plan (no floor) keeps its planned pace", () => {
  const easy = { ...aggressive, targetWeightKg: 58, duration: 6, durationUnit: "month" } as Profile;
  const r = estimateEnergy(easy);
  if (!r.ok) return assert.fail("estimate failed");
  assert.equal(r.floorApplied, false);
  const plan = weightPlan(easy);
  const pace = paceAtTarget(r.maintenance, r.suggested, plan)!;
  assert.ok(Math.abs(pace.kgPerWeek - plan.usedKgPerWeek) / plan.usedKgPerWeek < 0.05);
});

test("her own target is used as typed: higher than maintenance means no loss, and days is null", () => {
  const r = estimateEnergy(aggressive);
  if (!r.ok) return assert.fail("estimate failed");
  const plan = weightPlan(aggressive);
  assert.deepEqual(paceAtTarget(r.maintenance, r.maintenance + 200, plan), { kgPerWeek: 0, days: null });
  const manual = paceAtTarget(r.maintenance, 1000, plan)!;
  assert.ok(manual.kgPerWeek > 0 && manual.days! > 0);
});

test("gain plans and keep plans", () => {
  const gain = { ...aggressive, reason: "gain", weightKg: 50, targetWeightKg: 54, duration: 4, durationUnit: "month" } as Profile;
  const r = estimateEnergy(gain);
  if (!r.ok) return assert.fail("estimate failed");
  const pace = paceAtTarget(r.maintenance, r.suggested, weightPlan(gain))!;
  assert.ok(pace.kgPerWeek > 0 && pace.days! > 0);
  assert.equal(paceAtTarget(1800, 1800, weightPlan({ ...aggressive, targetWeightKg: 60 } as Profile)), null);
});

test("estimating never edits the profile it is given", () => {
  const before = JSON.stringify(aggressive);
  estimateEnergy(aggressive);
  assert.equal(JSON.stringify(aggressive), before);
});
