// Run with: npm test   (uses Node's built-in test runner, no extra install)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mealFromRecipe, recipeTotals, ingredientMacros } from "../app/lib/recipe.ts";
import { estimateEnergy, activityLevel, bmrMifflin, weightPlan, macroTargets, proteinTargetG } from "../app/lib/energy.ts";
import { fillProfile, isOnboarded } from "../app/lib/profile.ts";
import { thaiDateKey, shiftDateKey } from "../app/lib/date.ts";
import { changeAmount, blankItem } from "../app/lib/nutrition.ts";
import type { Ingredient, Profile } from "../app/lib/types.ts";

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const omeletIngredients: Ingredient[] = [
  { id: "a", name: "ไข่ไก่", amount: 3, unit: "egg", label: null, gramsPerUnit: null, photoId: null },
  {
    id: "b",
    name: "แหนม",
    amount: 100,
    unit: "g",
    // label from a pack: per 100 g
    label: { basis: "per100", kcal: 190, protein: 17, carbs: 5, fat: 11 },
    gramsPerUnit: null,
    photoId: null,
  },
  { id: "c", name: "น้ำมันพืช", amount: 15, unit: "ml", label: null, gramsPerUnit: null, photoId: null },
];

test("Case 2: omelet with naem, 2 servings, eat 0.5 serving = one quarter", () => {
  const t = recipeTotals(omeletIngredients, 2, null);
  assert.equal(t.complete, true);
  const meal = mealFromRecipe(omeletIngredients, 2, null, "servings", 0.5)!;
  close(meal.fraction, 0.25);
  close(meal.macros.kcal, t.total.kcal / 4);
  close(meal.macros.protein, t.total.protein / 4);
  close(meal.macros.carbs, t.total.carbs / 4);
  close(meal.macros.fat, t.total.fat / 4);
});

test("label values beat the built-in estimate", () => {
  const r = ingredientMacros(omeletIngredients[1]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.source, "label");
    close(r.macros.kcal, 190);
  }
});

test("label per 100 g + amount in eggs asks for weight per egg", () => {
  const ing: Ingredient = {
    ...omeletIngredients[0],
    label: { basis: "per100", kcal: 140, protein: 12, carbs: 1, fat: 10 },
  };
  const r = ingredientMacros(ing);
  assert.equal(r.ok, false);
  const fixed = ingredientMacros({ ...ing, gramsPerUnit: 55 });
  assert.ok(fixed.ok);
  if (fixed.ok) close(fixed.macros.kcal, 140 * 1.65);
});

test("grams mode uses cooked weight", () => {
  const meal = mealFromRecipe(omeletIngredients, 2, 400, "grams", 100)!;
  close(meal.fraction, 0.25);
  assert.equal(mealFromRecipe(omeletIngredients, 2, null, "grams", 100), null);
});

test("meal-only ingredient change does not touch the original list", () => {
  const changed = omeletIngredients.map((i) => (i.id === "a" ? { ...i, amount: 2 } : i));
  assert.equal(omeletIngredients[0].amount, 3);
  const a = recipeTotals(omeletIngredients, 2, null).total.kcal;
  const b = recipeTotals(changed, 2, null).total.kcal;
  assert.ok(b < a);
});

test("Mifflin–St Jeor matches the published formula", () => {
  close(bmrMifflin("female", 55, 160, 30), 10 * 55 + 6.25 * 160 - 5 * 30 - 161);
  close(bmrMifflin("male", 70, 175, 30), 10 * 70 + 6.25 * 175 - 5 * 30 + 5);
});

test("energy estimate: maintenance separate from suggested target", () => {
  const p: Profile = {
    age: 30, heightCm: 160, weightKg: 55, sex: "female",
    daily: "sitting", exercise: "3-5", targetWeightKg: 52, duration: 3, durationUnit: "month",
    pregnant: false, breastfeeding: false,
  };
  const r = estimateEnergy(p);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.level.factor, 1.55); // sitting + exercise 3–5 days = moderate
    assert.equal(r.maintenance, Math.round(1239 * 1.55));
    assert.ok(r.suggested < r.maintenance);
  }
});

test("no automatic estimate for under 18, pregnant, breastfeeding", () => {
  const base: Profile = {
    age: 30, heightCm: 160, weightKg: 55, sex: "female",
    daily: "sitting", exercise: "none", targetWeightKg: 55, duration: 3, durationUnit: "month",
    pregnant: false, breastfeeding: false,
  };
  assert.equal(estimateEnergy({ ...base, age: 16 }).ok, false);
  assert.equal(estimateEnergy({ ...base, pregnant: true }).ok, false);
  assert.equal(estimateEnergy({ ...base, breastfeeding: true }).ok, false);
});

test("safety floor applies", () => {
  const r = estimateEnergy({
    age: 60, heightCm: 150, weightKg: 45, sex: "female",
    daily: "sitting", exercise: "none", targetWeightKg: 40, duration: 2, durationUnit: "month",
    pregnant: false, breastfeeding: false,
  });
  assert.ok(r.ok && r.suggested === 1200 && r.floorApplied);
});

test("activity levels map to the 5 standard factors", () => {
  assert.equal(activityLevel("sitting", "none").factor, 1.2);
  assert.equal(activityLevel("physical", "twice").factor, 1.9);
  assert.equal(activityLevel("light", "none").factor, 1.375);
  assert.equal(activityLevel("standing", "1-2").factor, 1.55);
});

test("Thai date: 23:30 UTC is already the next day in Bangkok", () => {
  assert.equal(thaiDateKey(new Date("2026-11-11T23:30:00Z")), "2026-11-12");
  assert.equal(thaiDateKey(new Date("2026-11-11T16:59:00Z")), "2026-11-11");
  assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
});

test("changing amount scales the item (half the chicken = half the kcal)", () => {
  const chicken = { ...blankItem(), name: "ไก่ทอด", amount: 1, unit: "ชิ้น", kcal: 300, protein: 25, carbs: 10, fat: 18 };
  const half = changeAmount(chicken, 0.5);
  close(half.kcal, 150);
  close(half.fat, 9);
});

const base: Profile = {
  age: 29, heightCm: 150, weightKg: 79.35, sex: "female",
  daily: "sitting", exercise: "none", targetWeightKg: 70, duration: 6, durationUnit: "month",
  pregnant: false, breastfeeding: false,
};

test("target weight + time: 9.35 kg in 6 months", () => {
  const plan = weightPlan(base);
  assert.equal(plan.direction, "lose");
  close(plan.changeKg, 9.35, 1e-9);
  close(plan.wantedKgPerWeek, 9.35 / ((6 * 30.44) / 7));
  assert.equal(plan.tooFast, false);
  close(plan.dailyDelta, -(plan.wantedKgPerWeek * 7700) / 7);
  const r = estimateEnergy(base);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.maintenance, Math.round(1425.25 * 1.2));
    assert.equal(r.suggested, Math.round((1425.25 * 1.2 + plan.dailyDelta) / 10) * 10);
  }
});

test("too fast: capped at the safe pace (1% body weight/week, max 1 kg)", () => {
  const plan = weightPlan({ ...base, duration: 1 });
  assert.equal(plan.tooFast, true);
  close(plan.safeMaxKgPerWeek, 0.7935);
  close(plan.usedKgPerWeek, 0.7935);
  assert.equal(plan.safeWeeks, Math.ceil(9.35 / 0.7935));
  const r = estimateEnergy({ ...base, duration: 1 });
  assert.ok(r.ok && r.floorApplied && r.suggested === 1200);
});

test("same weight = keep; gain is capped at 0.5 kg/week", () => {
  assert.equal(weightPlan({ ...base, targetWeightKg: 79.2 }).direction, "keep");
  const g = weightPlan({ ...base, targetWeightKg: 85, duration: 2, durationUnit: "week" });
  assert.equal(g.direction, "gain");
  assert.ok(g.tooFast);
  close(g.usedKgPerWeek, 0.5);
});

test("days and weeks units", () => {
  close(weightPlan({ ...base, duration: 70, durationUnit: "day" }).wantedKgPerWeek, 9.35 / 10);
  close(weightPlan({ ...base, duration: 20, durationUnit: "week" }).wantedKgPerWeek, 9.35 / 20);
});

// ---- Round 3: reason for using the app ----

test("maintain: target = maintenance, target weight is ignored", () => {
  const r = estimateEnergy({ ...base, reason: "maintain", targetWeightKg: 60 });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.plan.direction, "keep");
    assert.equal(r.suggested, Math.round((1425.25 * 1.2) / 10) * 10);
    assert.equal(r.proteinG, null);
  }
});

test("build muscle: +10% of maintenance and protein 1.6 g/kg", () => {
  const r = estimateEnergy({ ...base, reason: "muscle", targetWeightKg: 60 });
  assert.ok(r.ok);
  if (r.ok) {
    const maint = 1425.25 * 1.2;
    assert.equal(r.suggested, Math.round((maint * 1.1) / 10) * 10);
    assert.equal(r.proteinG, Math.round(79.35 * 1.6));
  }
  assert.equal(proteinTargetG({ ...base, reason: "lose" }), null);
});

test("lose / gain must point the right way", () => {
  assert.ok(estimateEnergy({ ...base, reason: "lose" }).ok);
  const wrong = estimateEnergy({ ...base, reason: "gain" }); // target 70 < 79.35
  assert.equal(wrong.ok, false);
  const r = estimateEnergy({ ...base, reason: "gain", targetWeightKg: 82, duration: 6 });
  assert.ok(r.ok && r.plan.direction === "gain" && r.suggested > r.maintenance);
});

test("macro targets: default 20/50/30, muscle uses the protein target", () => {
  const d = macroTargets(2000);
  close(d.protein, 100);
  close(d.carbs, 250);
  const m = macroTargets(2000, 127);
  assert.equal(m.protein, 127);
  close(m.fat, 600 / 9);
  close(m.carbs, (2000 - 127 * 4 - 600) / 4);
});

test("old profile (no name/reason) is not onboarded and gets a pre-filled reason", () => {
  const old = { ...base } as Profile; // saved before Round 3: no name, no reason
  const goals = { targetKcal: 1500, targetSource: "calc" as const, profile: old, maintenanceKcal: 1710, skippedEstimate: false };
  assert.equal(isOnboarded(goals), false);
  const filled = fillProfile(old)!;
  assert.equal(filled.reason, "lose");
  assert.equal(filled.name, "");
  assert.equal(filled.age, 29);
  assert.equal(isOnboarded({ ...goals, profile: { ...filled, name: "ยานี่" } }), true);
  assert.equal(isOnboarded({ ...goals, profile: null }), false);
});

// ---- Round 4: English / Thai ----
import { thaiDateLabel } from "../app/lib/date.ts";
import { pickAll, trFor } from "../app/lib/i18n.ts";
import { REASON_LABEL } from "../app/lib/energy.ts";

test("language: same numbers in Thai and English, words change", () => {
  const p: Profile = { ...base, reason: "lose" };
  const th = estimateEnergy(p, "th");
  const en = estimateEnergy(p, "en");
  assert.ok(th.ok && en.ok);
  if (!th.ok || !en.ok) return;
  assert.equal(en.suggested, th.suggested); // the math never depends on language
  assert.match(en.steps[1], /Activity level "Very low"/);
  assert.match(th.steps[1], /ระดับกิจกรรม "น้อยมาก"/);
  assert.equal(estimateEnergy({ ...p }).ok && estimateEnergy({ ...p }).steps[1], th.steps[1]); // Thai is the default
});

test("language: warnings and recipe messages in English", () => {
  const under = estimateEnergy({ ...base, age: 16 }, "en");
  assert.ok(!under.ok && /adults 18 and over/.test(under.message));
  const egg: Ingredient = { id: "e", name: "egg", amount: 2, unit: "egg", label: { basis: "per100", kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, gramsPerUnit: null, photoId: null };
  const r = ingredientMacros(egg, "en");
  assert.ok(!r.ok && /weight of 1 egg/.test(r.message));
  const est = ingredientMacros({ ...egg, label: null, name: "ไข่ไก่" }, "en");
  assert.ok(est.ok && est.refName === "egg");
});

test("language: date label and label lists", () => {
  assert.equal(thaiDateLabel("2026-11-12", "en"), "Thursday, 12 Nov 2026");
  assert.match(thaiDateLabel("2026-11-12"), /พฤหัสบดี/);
  assert.equal(pickAll(REASON_LABEL, "en").muscle, "Build muscle");
  assert.equal(trFor("en")("วันนี้", "Today"), "Today");
  assert.equal(trFor("th")("วันนี้", "Today"), "วันนี้");
});
