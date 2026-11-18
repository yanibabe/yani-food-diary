import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JAR_MAX_PIECES,
  dayGrams,
  diffPieces,
  gramsToPieces,
  parseSeen,
  percentBar,
  pickUnit,
  piecesFor,
  pourPlan,
  serializeSeen,
  totalPieces,
  weekGrams,
  weekRange,
} from "../app/lib/jar.ts";
import type { Entry } from "../app/lib/types.ts";

const entry = (date: string, p: number, c: number, f: number): Entry =>
  ({ id: `${date}-${p}`, date, slot: "lunch", title: "x", items: [{ kcal: 0, protein: p, carbs: c, fat: f }], source: "manual" }) as unknown as Entry;

test("grams become whole pieces", () => {
  assert.equal(gramsToPieces(52, 5), 10);
  assert.equal(gramsToPieces(0, 5), 0);
  assert.equal(gramsToPieces(-3, 5), 0);
  assert.equal(gramsToPieces(NaN, 5), 0);
  assert.deepEqual(piecesFor({ p: 31, c: 65, f: 24 }, 5), { p: 6, c: 13, f: 5 });
});

test("the unit stays the base while there are 150 pieces or fewer, then goes up", () => {
  assert.equal(pickUnit({ p: 100, c: 300, f: 80 }, 5), 5); // 96 pieces
  assert.equal(pickUnit({ p: 250, c: 400, f: 100 }, 5), 5); // exactly 150
  const big = { p: 400, c: 800, f: 300 }; // 300 pieces at 5 g
  const u = pickUnit(big, 5);
  assert.ok(u > 5 && u % 5 === 0);
  assert.ok(totalPieces(piecesFor(big, u)) <= JAR_MAX_PIECES);
  assert.ok(totalPieces(piecesFor(big, u - 5)) > JAR_MAX_PIECES); // the smallest unit that fits
  const wk = { p: 500, c: 1200, f: 350 }; // a week at 20 g = 103
  assert.equal(pickUnit(wk, 20), 20);
  const wk2 = { p: 900, c: 2600, f: 700 };
  assert.ok(totalPieces(piecesFor(wk2, pickUnit(wk2, 20))) <= JAR_MAX_PIECES);
});

test("the % bar adds up to exactly 100", () => {
  for (const g of [
    { p: 1, c: 1, f: 1 },
    { p: 31, c: 65, f: 24 },
    { p: 10, c: 52, f: 6 },
    { p: 0.3, c: 99, f: 0.4 },
    { p: 0, c: 0, f: 7 },
  ]) {
    const b = percentBar(g);
    assert.equal(b.p + b.c + b.f, 100);
    assert.ok([b.p, b.c, b.f].every((n) => Number.isInteger(n) && n >= 0));
  }
  assert.deepEqual(percentBar({ p: 0, c: 0, f: 0 }), { p: 0, c: 0, f: 0 });
  assert.deepEqual(percentBar({ p: 50, c: 0, f: 50 }), { p: 50, c: 0, f: 50 });
});

test("week range is Monday to Sunday", () => {
  assert.deepEqual(weekRange("2026-11-18"), { start: "2026-11-16", end: "2026-11-22" }); // Wednesday
  assert.deepEqual(weekRange("2026-11-16"), { start: "2026-11-16", end: "2026-11-22" }); // Monday
  assert.deepEqual(weekRange("2026-11-22"), { start: "2026-11-16", end: "2026-11-22" }); // Sunday
});

test("day and week grams add the right meals", () => {
  const list = [entry("2026-11-15", 99, 99, 99), entry("2026-11-16", 10, 20, 5), entry("2026-11-16", 5, 5, 1), entry("2026-11-18", 30, 60, 20), entry("2026-11-23", 99, 99, 99)];
  assert.deepEqual(dayGrams(list, "2026-11-16"), { p: 15, c: 25, f: 6 });
  const w = weekGrams(list, "2026-11-18");
  assert.deepEqual(w.grams, { p: 45, c: 85, f: 26 });
  assert.equal(w.loggedDays, 2);
  assert.deepEqual(weekGrams([], "2026-11-18"), { grams: { p: 0, c: 0, f: 0 }, loggedDays: 0 });
});

test("new pieces are only the difference since she last saw the jar", () => {
  const now = { p: 40, c: 100, f: 20 }; // 8 / 20 / 4
  const seen = { date: "2026-11-18", p: 30, c: 100, f: 10 }; // 6 / 20 / 2
  const d = diffPieces(seen, "2026-11-18", now, 5);
  assert.deepEqual(d.settled, { p: 6, c: 20, f: 2 });
  assert.deepEqual(d.fresh, { p: 2, c: 0, f: 2 });
  // nothing seen, or another day: everything is new
  assert.deepEqual(diffPieces(null, "2026-11-18", now, 5).fresh, { p: 8, c: 20, f: 4 });
  assert.deepEqual(diffPieces({ ...seen, date: "2026-11-17" }, "2026-11-18", now, 5).settled, { p: 0, c: 0, f: 0 });
  // a meal was deleted: less than before, nothing new
  const less = diffPieces({ date: "2026-11-18", p: 100, c: 300, f: 90 }, "2026-11-18", now, 5);
  assert.deepEqual(less.fresh, { p: 0, c: 0, f: 0 });
  assert.deepEqual(less.settled, { p: 8, c: 20, f: 4 });
});

test("seen memory round-trips and rejects junk", () => {
  const raw = serializeSeen("2026-11-18", { p: 12.34, c: 50, f: 7 });
  assert.deepEqual(parseSeen(raw), { date: "2026-11-18", p: 12.3, c: 50, f: 7 });
  for (const bad of [null, "", "nope", "{}", '{"date":"x","p":-1,"c":0,"f":0}', '{"date":5,"p":1,"c":1,"f":1}']) assert.equal(parseSeen(bad), null);
});

test("the pour plan puts settled pieces first, new pieces last, and keeps every piece", () => {
  const plan = pourPlan({ p: 2, c: 3, f: 1 }, { p: 1, c: 0, f: 2 });
  assert.equal(plan.length, 9);
  assert.ok(plan.slice(0, 6).every((x) => x.settled));
  assert.ok(plan.slice(6).every((x) => !x.settled));
  assert.equal(plan.filter((x) => x.k === "c").length, 3);
  assert.equal(plan.slice(6).filter((x) => x.k === "f").length, 2);
});
