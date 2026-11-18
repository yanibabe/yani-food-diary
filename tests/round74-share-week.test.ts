// Round 74 (part B): the weekly share card (week range, averages over logged days, pieces, % bar, ranges, day strip).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWeekFacts, goodRange, hashSeed, layoutShareWeek, packFallback, pieceOrder, seededRandom, weekPieces, weekRangeLabel, weekRows, WEEK_JAR_H, WEEK_COLORS,
} from "../app/lib/shareWeek.ts";
import { settlePieces } from "../app/lib/shareWeekJar.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";
import type { Measure } from "../app/lib/shareCard.ts";

const measure: Measure = (t, size) => Array.from(t).length * size * 0.5;
const item = (kcal: number, p: number, c: number, f: number): FoodItem => ({ id: "i", name: "x", amount: 1, unit: "จาน", kcal, protein: p, carbs: c, fat: f, estimated: false, kind: "food", note: null, box: null });
const meal = (date: string, it: FoodItem, id = date): Entry => ({ id, date, slot: "lunch", title: "x", items: [it], source: "manual", photoId: null, recipe: null, createdAt: 1, updatedAt: 1 });
const IN = { target: 1600, proteinTarget: 81, lang: "th" as const };

test("week range: Monday to Sunday, from any day inside it", () => {
  for (const d of ["2026-11-16", "2026-11-18", "2026-11-22"]) {
    const f = buildWeekFacts([], d, 1600);
    assert.equal(f.start, "2026-11-16");
    assert.equal(f.end, "2026-11-22");
    assert.equal(f.days.length, 7);
  }
  assert.equal(buildWeekFacts([], "2026-11-23", 1600).start, "2026-11-23");
});

test("week label: Thai, English, and across two months", () => {
  assert.equal(weekRangeLabel("2026-11-16", "2026-11-22", "th"), "16 – 22 พ.ย.");
  assert.equal(weekRangeLabel("2026-11-16", "2026-11-22", "en"), "Nov 16 – 22");
  assert.equal(weekRangeLabel("2026-11-30", "2026-12-06", "th"), "30 พ.ย. – 6 ธ.ค.");
  assert.equal(weekRangeLabel("2026-11-30", "2026-12-06", "en"), "Nov 30 – Dec 6");
});

test("averages divide by LOGGED days only; other weeks are ignored", () => {
  const e = [
    meal("2026-11-16", item(1000, 60, 100, 30), "a"),
    meal("2026-11-16", item(500, 20, 50, 10), "b"),
    meal("2026-11-18", item(1700, 100, 200, 50), "c"),
    meal("2026-11-09", item(9999, 999, 999, 999), "old"), // last week
    meal("2026-11-23", item(9999, 999, 999, 999), "next"), // next week
  ];
  const f = buildWeekFacts(e, "2026-11-20", 1600);
  assert.equal(f.loggedDays, 2);
  assert.equal(f.avgKcal, (1500 + 1700) / 2);
  assert.deepEqual(f.grams, { p: 180, c: 350, f: 90 });
  assert.deepEqual(f.avgG, { p: 90, c: 175, f: 45 });
});

test("empty week: no average, nothing to draw, still a card", () => {
  const f = buildWeekFacts([], "2026-11-18", 1600);
  assert.equal(f.loggedDays, 0);
  assert.equal(f.avgKcal, null);
  const card = layoutShareWeek({ entries: [], date: "2026-11-18", ...IN }, measure);
  assert.equal(card.jar.order.length, 0);
  assert.ok(card.cmds.some((c) => c.t === "text" && c.s === "–"));
  assert.ok(card.h > WEEK_JAR_H);
});

test("pieces: 1 piece = 20 g; over 150 pieces the grams per piece go up and the note says so", () => {
  const a = weekPieces({ p: 430, c: 1180, f: 300 });
  assert.deepEqual(a, { unit: 20, capped: false, counts: { p: 22, c: 59, f: 15 } });
  const big = weekPieces({ p: 1000, c: 3000, f: 1000 }); // 250 pieces at 20 g
  assert.equal(big.capped, true);
  assert.ok(big.unit > 20 && big.unit % 20 === 0);
  assert.ok(big.counts.p + big.counts.c + big.counts.f <= 150);
  const e = [meal("2026-11-16", item(1, 1000, 3000, 1000))];
  const card = layoutShareWeek({ entries: e, date: "2026-11-16", ...IN }, measure);
  assert.ok(card.capped && card.jar.order.length <= 150);
  assert.ok(card.cmds.some((c) => c.t === "text" && c.s.includes(`${card.unit} g`) && c.s.includes("ปรับ")));
});

test("% bar: share of grams, adds up to 100", () => {
  const e = [meal("2026-11-16", item(1, 43, 118, 30))];
  const card = layoutShareWeek({ entries: e, date: "2026-11-16", ...IN }, measure);
  assert.deepEqual(card.pct, { p: 22, c: 62, f: 16 }); // 43 / 118 / 30 of 191 g
});

test("good ranges and row fill", () => {
  const c = goodRange("c", 1600);
  const f = goodRange("f", 1600);
  assert.deepEqual([Math.round(c.lo), Math.round(c.hi)], [180, 260]);
  assert.deepEqual([Math.round(f.lo), Math.round(f.hi)], [36, 62]);
  const rows = weekRows({ p: 77, c: 197, f: 70 }, 1600, 81, "th");
  assert.equal(rows[0].text, "77 / 81 g");
  assert.equal(rows[1].text, "197 g · ช่วง 180–260");
  assert.equal(rows[2].text, "70 g · ช่วง 36–62");
  assert.ok(Math.abs(rows[0].fill - 77 / 81) < 1e-9);
  assert.ok(Math.abs(rows[1].fill - 197 / 260) < 1e-9);
  assert.equal(rows[2].fill, 1); // 70 / 62 capped
  assert.equal(weekRows({ p: 5, c: 0, f: 0 }, 1600, 0, "en")[0].fill, 0);
  assert.equal(weekRows({ p: 0, c: 0, f: 0 }, 1600, 81, "en")[1].text, "0 g · range 180–260");
});

test("day strip: grey = no log, orange = over target, blue = logged not over", () => {
  const e = [meal("2026-11-16", item(1500, 1, 1, 1)), meal("2026-11-17", item(1700, 1, 1, 1)), meal("2026-11-19", item(1600, 1, 1, 1))];
  const f = buildWeekFacts(e, "2026-11-16", 1600);
  const card = layoutShareWeek({ entries: e, date: "2026-11-16", ...IN }, measure);
  const strip = card.cmds.filter((c) => c.t === "rect" && c.h === 18).map((c) => (c as { fill: string }).fill);
  assert.deepEqual(f.days.map((d) => d.over), [false, true, false, false, false, false, false]);
  assert.deepEqual(strip, [WEEK_COLORS.ok, WEEK_COLORS.over, WEEK_COLORS.none, WEEK_COLORS.ok, WEEK_COLORS.none, WEEK_COLORS.none, WEEK_COLORS.none]);
});

test("same week = same seed, same order, same pile", async () => {
  const e = [meal("2026-11-16", item(1, 430, 1180, 300))];
  const a = layoutShareWeek({ entries: e, date: "2026-11-18", ...IN }, measure);
  const b = layoutShareWeek({ entries: e, date: "2026-11-18", ...IN }, measure);
  assert.equal(a.jar.seed, b.jar.seed);
  assert.deepEqual(a.jar.order, b.jar.order);
  assert.equal(hashSeed("a"), hashSeed("a"));
  assert.notEqual(hashSeed("a"), hashSeed("b"));
  assert.equal(seededRandom(5)(), seededRandom(5)());
  assert.deepEqual(pieceOrder({ p: 3, c: 2, f: 1 }, 7).slice().sort(), ["c", "c", "f", "p", "p", "p"]);
  const p1 = await settlePieces(a.jar.order, a.jar.w, a.jar.h, 33, a.jar.seed);
  const p2 = await settlePieces(b.jar.order, b.jar.w, b.jar.h, 33, b.jar.seed);
  assert.deepEqual(p1, p2);
  assert.equal(p1.length, a.jar.order.length);
});

test("settled pile stays inside the jar; the fallback pile too", async () => {
  const order = pieceOrder({ p: 40, c: 80, f: 30 }, 3);
  const W = 876;
  const H = WEEK_JAR_H;
  for (const pile of [await settlePieces(order, W, H, 33, 3), packFallback(order, W, H, 33, 3)]) {
    assert.equal(pile.length, 150);
    for (const p of pile) assert.ok(p.x > 30 && p.x < W - 30 && p.y > 0 && p.y < H - 30 + 1, `${p.x},${p.y}`);
  }
});
