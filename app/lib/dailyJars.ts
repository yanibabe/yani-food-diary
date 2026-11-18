// Round 74: the three daily goal jars on Today. Pure logic only (no React, no physics), so the tests can run it.
// Protein has ONE goal line. Carbs and fat have a soft "good range" band (a share of the day's calories).

import type { JarMacro } from "./jar.ts";

export const DAILY_STEPS = 20; // 20 pieces = the jar is "full" (the line / the top of the band)
export const DAILY_MAX_PIECES = 60;
export const DAILY_SEEN_KEY = "yfd:v1:dailyJarSeen";
export const DEFAULT_KCAL = 1600; // used only when there is no usable calorie target

/** Share of the day's calories that is a good range (carbs 45–65%, fat 20–35%). */
export const RANGE_SHARE = { c: [0.45, 0.65], f: [0.2, 0.35] } as const;
const KCAL_PER_G = { c: 4, f: 9 } as const;

export type DailyJarCfg = {
  /** Grams that fill the jar: the protein target, or the top of the good range. */
  full: number;
  /** Protein only: the goal line. */
  goal?: number;
  /** Carbs / fat only: the good range in whole grams. */
  range?: [number, number];
};
export type DailyCfg = Record<JarMacro, DailyJarCfg>;

const pos = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

export function dailyJarConfig(kcalTarget: number, proteinTarget: number): DailyCfg {
  const kcal = pos(kcalTarget) || DEFAULT_KCAL;
  const goal = Math.max(1, Math.round(pos(proteinTarget) || (kcal * 0.2) / 4));
  const rng = (k: "c" | "f"): [number, number] => {
    const lo = Math.max(1, Math.round((kcal * RANGE_SHARE[k][0]) / KCAL_PER_G[k]));
    const hi = Math.max(lo + 1, Math.round((kcal * RANGE_SHARE[k][1]) / KCAL_PER_G[k]));
    return [lo, hi];
  };
  const c = rng("c");
  const f = rng("f");
  return { p: { full: goal, goal }, c: { full: c[1], range: c }, f: { full: f[1], range: f } };
}

export type DailyStatus =
  | { kind: "none" }
  | { kind: "short"; n: number } // protein below the goal
  | { kind: "done" } // protein reached or above (never a warning)
  | { kind: "low"; n: number } // carbs / fat below the range
  | { kind: "ok" } // inside the range
  | { kind: "over"; n: number }; // above the range

export function dailyStatus(k: JarMacro, grams: number, cfg: DailyJarCfg): DailyStatus {
  const g = Math.round(pos(grams));
  if (g <= 0) return { kind: "none" };
  if (k === "p") {
    const left = Math.round(cfg.goal ?? cfg.full) - g;
    return left > 0 ? { kind: "short", n: left } : { kind: "done" };
  }
  const [lo, hi] = cfg.range ?? [0, cfg.full];
  if (g < lo) return { kind: "low", n: lo - g };
  if (g <= hi) return { kind: "ok" };
  return { kind: "over", n: g - hi };
}

export function statusText(s: DailyStatus, lang: "th" | "en"): string {
  const th = lang !== "en";
  switch (s.kind) {
    case "none":
      return th ? "ยังไม่มี" : "None yet";
    case "short":
      return th ? `ขาดอีก ${s.n} g` : `${s.n} g to go`;
    case "done":
      return th ? "ครบแล้ว 💙" : "Reached 💙";
    case "low":
      return th ? `อีก ${s.n} g ถึงช่วง` : `${s.n} g to the range`;
    case "ok":
      return th ? "อยู่ในช่วงดี ✓" : "In the good range ✓";
    case "over":
      return th ? `เลยช่วงมา ${s.n} g` : `${s.n} g past the range`;
  }
}

/** Which colour class the status line wears. */
export function statusTone(s: DailyStatus): "muted" | "ok" | "over" {
  return s.kind === "done" || s.kind === "ok" ? "ok" : s.kind === "over" ? "over" : "muted";
}

/** The small line under the big number: "เป้า 81 g" or "ช่วงดี 180–260 g". */
export function targetLine(k: JarMacro, cfg: DailyJarCfg, lang: "th" | "en"): string {
  const th = lang !== "en";
  if (k === "p") return th ? `เป้า ${Math.round(cfg.goal ?? cfg.full)} g` : `Goal ${Math.round(cfg.goal ?? cfg.full)} g`;
  const [lo, hi] = cfg.range ?? [0, cfg.full];
  return th ? `ช่วงดี ${lo}–${hi} g` : `Good range ${lo}–${hi} g`;
}

/** Pieces for some grams: 20 pieces = `full` grams, at most 60. */
export function dailyPieces(grams: number, full: number, cap = DAILY_MAX_PIECES): number {
  if (!(pos(grams) > 0) || !(full > 0)) return 0;
  return Math.min(cap, Math.round((grams / full) * DAILY_STEPS));
}

/** Height of `grams` above the floor, given the calibrated height of a pile of 20 pieces (= `full` grams). Linear. */
export function gramsToHeight(grams: number, full: number, pileHeight: number): number {
  if (!(full > 0)) return 0;
  return (Math.max(0, grams) / full) * pileHeight;
}

/** The y (canvas, top = 0) of a line for `grams`. */
export function gramsToY(grams: number, full: number, floorY: number, pileTopY: number): number {
  return floorY - gramsToHeight(grams, full, floorY - pileTopY);
}

/** The y of the pile top: the average of a few calibration runs, each the mean y of its highest pieces, minus the piece size. */
export function pileTop(runs: number[][], highest = 3, pieceR = 0): number {
  const tops = runs
    .filter((ys) => ys.length > 0)
    .map((ys) => {
      const s = [...ys].sort((a, b) => a - b).slice(0, Math.min(highest, ys.length));
      return s.reduce((a, b) => a + b, 0) / s.length;
    });
  if (tops.length === 0) return 0;
  return tops.reduce((a, b) => a + b, 0) / tops.length - pieceR;
}

// ---- what she has already seen (pieces per jar), so only new pieces drop in ----
export type DailySeen = { date: string; p: number; c: number; f: number };

export const serializeDailySeen = (date: string, n: Record<JarMacro, number>) => JSON.stringify({ date, p: n.p, c: n.c, f: n.f });

export function parseDailySeen(raw: string | null | undefined): DailySeen | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DailySeen> | null;
    if (!v || typeof v.date !== "string") return null;
    if (![v.p, v.c, v.f].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return null;
    return { date: v.date, p: v.p as number, c: v.c as number, f: v.f as number };
  } catch {
    return null;
  }
}

/** How many pieces of each jar settle at once: all of them when not animating, else only what she saw today. */
export function settledCount(seen: DailySeen | null, date: string, k: JarMacro, now: number, animate: boolean): number {
  if (!animate) return now;
  if (!seen || seen.date !== date) return 0;
  return Math.min(seen[k], now);
}
