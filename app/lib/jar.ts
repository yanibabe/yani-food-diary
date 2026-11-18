// Round 73: the nutrient jar ("โหลสารอาหาร"). Pure logic only (no React, no physics), so the tests can run it.
// One piece = a few grams of protein / carbs / fat. Pieces drop into a glass jar.

import { weekStart } from "./body.ts";
import { shiftDateKey } from "./date.ts";
import { pickMacros, sumMacros } from "./nutrition.ts";
import type { Entry } from "./types.ts";

export type JarMacro = "p" | "c" | "f";
export type JarGrams = Record<JarMacro, number>;
export type JarMode = "day" | "week";

export const JAR_MACROS: readonly JarMacro[] = ["p", "c", "f"];

/** Fixed flat colors and shapes: protein = blue heart, carbs = orange cloud, fat = yellow circle. */
export const JAR_COLORS: Record<JarMacro, string> = { p: "#7FBBDD", c: "#F58B05", f: "#FFC22F" };
export const JAR_SHAPES: Record<JarMacro, "heart" | "cloud" | "circle"> = { p: "heart", c: "cloud", f: "circle" };
export const JAR_KCAL_PER_G: Record<JarMacro, number> = { p: 4, c: 4, f: 9 };
export const JAR_NAMES: Record<JarMacro, { th: string; en: string }> = {
  p: { th: "โปรตีน", en: "Protein" },
  c: { th: "คาร์บ", en: "Carbs" },
  f: { th: "ไขมัน", en: "Fat" },
};

/** Grams per piece: 5 g for one day, 20 g for one week. */
export const JAR_BASE_UNIT: Record<JarMode, number> = { day: 5, week: 20 };
export const JAR_MAX_PIECES = 150;

/** localStorage key: the grams of today's jar she last saw. */
export const JAR_SEEN_KEY = "yfd:v1:jarSeen";

const ZERO: JarGrams = { p: 0, c: 0, f: 0 };

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Protein, carbs and fat grams of the meals on one day. */
export function dayGrams(entries: Entry[], date: string): JarGrams {
  const m = sumMacros(entries.filter((e) => e.date === date).flatMap((e) => e.items.map(pickMacros)));
  return { p: num(m.protein), c: num(m.carbs), f: num(m.fat) };
}

/** The week (Monday to Sunday) that holds `date`. */
export function weekRange(date: string): { start: string; end: string } {
  const start = weekStart(date);
  return { start, end: shiftDateKey(start, 6) };
}

/** Grams for the whole week that holds `date`, and how many days in it have meals. */
export function weekGrams(entries: Entry[], date: string): { grams: JarGrams; loggedDays: number } {
  const { start, end } = weekRange(date);
  const grams: JarGrams = { ...ZERO };
  const days = new Set<string>();
  for (const e of entries) {
    if (e.date < start || e.date > end) continue;
    days.add(e.date);
    const m = sumMacros(e.items.map(pickMacros));
    grams.p += num(m.protein);
    grams.c += num(m.carbs);
    grams.f += num(m.fat);
  }
  return { grams, loggedDays: days.size };
}

export const totalGrams = (g: JarGrams) => g.p + g.c + g.f;

/** Whole pieces for some grams. */
export function gramsToPieces(grams: number, unit: number): number {
  if (!(grams > 0) || !(unit > 0)) return 0;
  return Math.round(grams / unit);
}

export function piecesFor(g: JarGrams, unit: number): Record<JarMacro, number> {
  return { p: gramsToPieces(g.p, unit), c: gramsToPieces(g.c, unit), f: gramsToPieces(g.f, unit) };
}

export const totalPieces = (n: Record<JarMacro, number>) => n.p + n.c + n.f;

/** The grams-per-piece to use: the base unit, raised in steps of the base until there are at most 150 pieces. */
export function pickUnit(g: JarGrams, base: number): number {
  let unit = base;
  // 3 macros × 0.5 piece of rounding means a few extra steps at most; the loop is short.
  for (let i = 0; i < 10000 && totalPieces(piecesFor(g, unit)) > JAR_MAX_PIECES; i++) unit += base;
  return unit;
}

/** The % bar: share of total grams per macro, whole numbers that add up to exactly 100 (all 0 when empty). */
export function percentBar(g: JarGrams): JarGrams {
  const t = totalGrams(g);
  if (!(t > 0)) return { ...ZERO };
  const raw = JAR_MACROS.map((k) => ({ k, v: (Math.max(0, g[k]) / t) * 100 }));
  const out: JarGrams = { p: 0, c: 0, f: 0 };
  let used = 0;
  for (const r of raw) {
    out[r.k] = Math.floor(r.v);
    used += out[r.k];
  }
  // Largest remainder gets the leftovers (ties: protein, carbs, fat order).
  const order = [...raw].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)));
  for (let i = 0; used < 100; i++, used++) out[order[i % order.length].k] += 1;
  return out;
}

export function kcalFromGrams(k: JarMacro, grams: number): number {
  return grams * JAR_KCAL_PER_G[k];
}

// ---------------------------------------------------------------------------
// New pieces after logging
// ---------------------------------------------------------------------------

export type JarSeen = { date: string; p: number; c: number; f: number };

export function serializeSeen(date: string, g: JarGrams): string {
  return JSON.stringify({ date, p: Math.round(g.p * 10) / 10, c: Math.round(g.c * 10) / 10, f: Math.round(g.f * 10) / 10 });
}

export function parseSeen(raw: string | null | undefined): JarSeen | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<JarSeen> | null;
    if (!v || typeof v.date !== "string") return null;
    if (![v.p, v.c, v.f].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return null;
    return { date: v.date, p: v.p as number, c: v.c as number, f: v.f as number };
  } catch {
    return null;
  }
}

/**
 * Split today's pieces into "already there" (settled at once) and "new" (drop in last).
 * Another day, or nothing seen: everything is new. Only what grew counts as new; a smaller total (a meal deleted) is just settled.
 */
export function diffPieces(
  seen: JarSeen | null,
  date: string,
  now: JarGrams,
  unit: number,
): { settled: Record<JarMacro, number>; fresh: Record<JarMacro, number> } {
  const total = piecesFor(now, unit);
  if (!seen || seen.date !== date) return { settled: { p: 0, c: 0, f: 0 }, fresh: total };
  const settled = { p: 0, c: 0, f: 0 };
  const fresh = { p: 0, c: 0, f: 0 };
  for (const k of JAR_MACROS) {
    const had = Math.min(gramsToPieces(Math.min(seen[k], now[k]), unit), total[k]);
    settled[k] = had;
    fresh[k] = total[k] - had;
  }
  return { settled, fresh };
}

export type JarPour = { k: JarMacro; settled: boolean };

/** The pour list: settled pieces first (random order), then the new ones (random order). `rnd` gives 0..1. */
export function pourPlan(settled: Record<JarMacro, number>, fresh: Record<JarMacro, number>, rnd: () => number = Math.random): JarPour[] {
  const make = (n: Record<JarMacro, number>, isSettled: boolean) => {
    const list: JarPour[] = [];
    for (const k of JAR_MACROS) for (let i = 0; i < n[k]; i++) list.push({ k, settled: isSettled });
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  return [...make(settled, true), ...make(fresh, false)];
}
