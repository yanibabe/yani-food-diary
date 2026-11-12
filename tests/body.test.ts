import { test } from "node:test";
import assert from "node:assert/strict";
import { summary, upsertLog, weekStart, lastDays, type BodyLog } from "../app/lib/body.ts";

const close = (a: number | null, b: number, eps = 1e-9) => assert.ok(a != null && Math.abs(a - b) < eps, `${a} != ${b}`);

test("weeks start on Monday", () => {
  assert.equal(weekStart("2026-11-12"), "2026-11-09"); // Thursday → Monday
  assert.equal(weekStart("2026-11-09"), "2026-11-09"); // Monday
  assert.equal(weekStart("2026-11-15"), "2026-11-09"); // Sunday
});

test("upsert keeps weight and steps on the same day, removes empty days", () => {
  let logs: BodyLog[] = [];
  logs = upsertLog(logs, "2026-11-12", { weightKg: 60 }, 1);
  logs = upsertLog(logs, "2026-11-12", { steps: 8000 }, 2);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].weightKg, 60);
  assert.equal(logs[0].steps, 8000);
  logs = upsertLog(logs, "2026-11-12", { weightKg: null, steps: null }, 3);
  assert.equal(logs.length, 0);
});

test("weekly average, change vs last week, progress to target", () => {
  const L = (date: string, weightKg: number | null, steps: number | null = null): BodyLog => ({ date, weightKg, steps, updatedAt: 0 });
  const logs = [
    L("2026-11-03", 62, 5000), // last week
    L("2026-11-05", 61.6, 7000),
    L("2026-11-10", 61, 9000), // this week
    L("2026-11-12", 60.6, null),
  ];
  const s = summary(logs, "2026-11-12", 63, 58);
  close(s.lastWeek.avgWeight, 61.8);
  close(s.thisWeek.avgWeight, 60.8);
  close(s.change, -1);
  assert.equal(s.thisWeek.stepDays, 1);
  close(s.lastWeek.avgSteps, 6000);
  assert.equal(s.startWeight, 62); // first logged weight beats profile weight
  close(s.toGo, 2.6);
  close(s.progress, 1.4 / 4);
});

test("no target or no weight → no progress, no crash", () => {
  const s = summary([], "2026-11-12", 60, 0);
  assert.equal(s.progress, null);
  assert.equal(s.change, null);
  assert.equal(s.latest, null);
  assert.equal(lastDays([], "2026-11-12", 7).length, 7);
});
