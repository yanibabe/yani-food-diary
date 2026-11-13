// Water counter: saving glasses per day, the goal, and tapping glasses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GLASSES_MAX, glassesOn, setGlasses, tapGlass, waterGoal, clampGoal } from "../app/lib/water.ts";

test("water: set, read, and drop a day at 0", () => {
  let logs = setGlasses([], "2026-11-13", 3, 1);
  logs = setGlasses(logs, "2026-11-12", 5, 2);
  assert.equal(glassesOn(logs, "2026-11-13"), 3);
  assert.equal(glassesOn(logs, "2026-11-11"), 0);
  assert.deepEqual(logs.map((l) => l.date), ["2026-11-12", "2026-11-13"]);
  logs = setGlasses(logs, "2026-11-13", 4, 3);
  assert.equal(glassesOn(logs, "2026-11-13"), 4);
  assert.equal(logs.length, 2);
  logs = setGlasses(logs, "2026-11-13", 0, 4);
  assert.deepEqual(logs.map((l) => l.date), ["2026-11-12"]);
});

test("water: glasses stay between 0 and the max", () => {
  assert.deepEqual(setGlasses([], "2026-11-13", -2), []);
  assert.equal(glassesOn(setGlasses([], "2026-11-13", 999), "2026-11-13"), GLASSES_MAX);
  assert.deepEqual(setGlasses([], "2026-11-13", Number.NaN), []);
});

test("water goal: 8 unless a sensible goal is saved", () => {
  assert.equal(waterGoal(undefined), 8);
  assert.equal(waterGoal(null), 8);
  assert.equal(waterGoal(10), 10);
  assert.equal(waterGoal(0), 8);
  assert.equal(waterGoal(2.5), 8);
  assert.equal(clampGoal(0), 1);
  assert.equal(clampGoal(25), 20);
});

test("tapping a glass fills up to it, tapping the last full one empties it", () => {
  assert.equal(tapGlass(3, 5), 5);
  assert.equal(tapGlass(3, 1), 1);
  assert.equal(tapGlass(3, 3), 2);
  assert.equal(tapGlass(1, 1), 0);
});
