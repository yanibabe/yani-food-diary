import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailyJarConfig,
  dailyPieces,
  dailyStatus,
  gramsToHeight,
  gramsToY,
  parseDailySeen,
  pileTop,
  serializeDailySeen,
  settledCount,
  statusText,
  statusTone,
  targetLine,
} from "../app/lib/dailyJars.ts";

test("ranges: carbs 45-65% and fat 20-35% of the day's calories", () => {
  const c = dailyJarConfig(1600, 81);
  assert.deepEqual(c.c.range, [180, 260]);
  assert.deepEqual(c.f.range, [36, 62]);
  assert.equal(c.p.goal, 81);
  assert.equal(c.p.full, 81);
  assert.equal(c.c.full, 260);
  assert.equal(c.f.full, 62);
});

test("no target falls back to 1600 kcal and a 20% protein goal", () => {
  const c = dailyJarConfig(0, NaN);
  assert.deepEqual(c.c.range, [180, 260]);
  assert.equal(c.p.goal, 80);
});

test("protein status: none, short, then done (never a warning for more)", () => {
  const { p } = dailyJarConfig(1600, 81);
  assert.deepEqual(dailyStatus("p", 0, p), { kind: "none" });
  assert.deepEqual(dailyStatus("p", 50, p), { kind: "short", n: 31 });
  assert.deepEqual(dailyStatus("p", 81, p), { kind: "done" });
  assert.deepEqual(dailyStatus("p", 150, p), { kind: "done" });
  assert.equal(statusText({ kind: "short", n: 31 }, "th"), "ขาดอีก 31 g");
  assert.equal(statusText({ kind: "done" }, "th"), "ครบแล้ว 💙");
  assert.equal(statusText({ kind: "none" }, "th"), "ยังไม่มี");
});

test("carbs and fat status: low, ok, over", () => {
  const { c } = dailyJarConfig(1600, 81);
  assert.deepEqual(dailyStatus("c", 100, c), { kind: "low", n: 80 });
  assert.deepEqual(dailyStatus("c", 180, c), { kind: "ok" });
  assert.deepEqual(dailyStatus("c", 260, c), { kind: "ok" });
  assert.deepEqual(dailyStatus("c", 275, c), { kind: "over", n: 15 });
  assert.equal(statusText({ kind: "low", n: 80 }, "th"), "อีก 80 g ถึงช่วง");
  assert.equal(statusText({ kind: "ok" }, "th"), "อยู่ในช่วงดี ✓");
  assert.equal(statusText({ kind: "over", n: 15 }, "th"), "เลยช่วงมา 15 g");
  assert.equal(statusTone({ kind: "over", n: 1 }), "over");
  assert.equal(statusTone({ kind: "ok" }), "ok");
  assert.equal(statusTone({ kind: "done" }), "ok");
  assert.equal(statusTone({ kind: "low", n: 1 }), "muted");
});

test("target lines", () => {
  const c = dailyJarConfig(1600, 81);
  assert.equal(targetLine("p", c.p, "th"), "เป้า 81 g");
  assert.equal(targetLine("c", c.c, "th"), "ช่วงดี 180–260 g");
  assert.equal(targetLine("f", c.f, "en"), "Good range 36–62 g");
});

test("pieces: 20 = full, capped at 60", () => {
  assert.equal(dailyPieces(81, 81), 20);
  assert.equal(dailyPieces(40.5, 81), 10);
  assert.equal(dailyPieces(0, 81), 0);
  assert.equal(dailyPieces(-5, 81), 0);
  assert.equal(dailyPieces(NaN, 81), 0);
  assert.equal(dailyPieces(10, 0), 0);
  assert.equal(dailyPieces(1000, 81), 60);
});

test("grams to height is linear from the floor", () => {
  assert.equal(gramsToHeight(81, 81, 60), 60);
  assert.equal(gramsToHeight(40.5, 81, 60), 30);
  assert.equal(gramsToHeight(0, 81, 60), 0);
  assert.equal(gramsToHeight(-3, 81, 60), 0);
  // floor y 150, pile top y 90: protein at the goal sits exactly on the pile top
  assert.equal(gramsToY(81, 81, 150, 90), 90);
  assert.equal(gramsToY(0, 81, 150, 90), 150);
  assert.equal(gramsToY(180, 260, 150, 90).toFixed(2), (150 - (60 * 180) / 260).toFixed(2));
});

test("pile top averages the highest pieces of several runs", () => {
  const runs = [
    [100, 90, 80, 70, 60],
    [100, 92, 82, 72, 62],
  ];
  // run 1: mean of 60,70,80 = 70; run 2: mean of 62,72,82 = 72; average 71; minus piece size 8
  assert.equal(pileTop(runs, 3, 8), 63);
  assert.equal(pileTop([], 3, 8), 0);
  assert.equal(pileTop([[50]], 3, 0), 50);
});

test("seen memory and what settles at once", () => {
  const raw = serializeDailySeen("2026-11-18", { p: 5, c: 10, f: 3 });
  const seen = parseDailySeen(raw);
  assert.deepEqual(seen, { date: "2026-11-18", p: 5, c: 10, f: 3 });
  for (const bad of [null, "", "x", "{}", '{"date":"d","p":-1,"c":0,"f":0}']) assert.equal(parseDailySeen(bad), null);
  assert.equal(settledCount(seen, "2026-11-18", "c", 14, true), 10); // 4 are new
  assert.equal(settledCount(seen, "2026-11-18", "c", 7, true), 7); // meal deleted
  assert.equal(settledCount(seen, "2026-11-19", "c", 14, true), 0); // another day: all drop
  assert.equal(settledCount(null, "2026-11-18", "p", 9, true), 0);
  assert.equal(settledCount(null, "2026-11-18", "p", 9, false), 9); // reduced motion / past day
});
