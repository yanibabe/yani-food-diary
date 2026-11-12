// Weight + steps: one small log per day, and the weekly summary math.
// No React here, so the tests can use it.

import { shiftDateKey } from "./date.ts";

/** What she logged on one day. Either part can be empty. */
export type BodyLog = {
  date: string; // "YYYY-MM-DD"
  weightKg: number | null;
  steps: number | null;
  updatedAt: number;
};

export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;
export const STEPS_MAX = 150_000;

export function validWeight(n: number | null): n is number {
  return n != null && Number.isFinite(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX;
}
export function validSteps(n: number | null): n is number {
  return n != null && Number.isFinite(n) && n >= 0 && n <= STEPS_MAX;
}

/** Put a day's values in (or take them out); drops a day when both are empty. */
export function upsertLog(logs: BodyLog[], date: string, patch: Partial<Pick<BodyLog, "weightKg" | "steps">>, now = Date.now()): BodyLog[] {
  const old = logs.find((l) => l.date === date);
  const next: BodyLog = { date, weightKg: old?.weightKg ?? null, steps: old?.steps ?? null, ...patch, updatedAt: now };
  const rest = logs.filter((l) => l.date !== date);
  if (next.weightKg == null && next.steps == null) return rest;
  return [...rest, next].sort((a, b) => a.date.localeCompare(b.date));
}

/** Monday of the week that holds this day (weeks run Monday → Sunday). */
export function weekStart(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return shiftDateKey(key, -((dow + 6) % 7));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type WeekStats = {
  start: string;
  end: string;
  avgWeight: number | null;
  weightDays: number;
  avgSteps: number | null;
  totalSteps: number;
  stepDays: number;
};

export function weekStats(logs: BodyLog[], start: string): WeekStats {
  const end = shiftDateKey(start, 6);
  const inWeek = logs.filter((l) => l.date >= start && l.date <= end);
  const w = inWeek.map((l) => l.weightKg).filter(validWeight);
  const s = inWeek.map((l) => l.steps).filter(validSteps);
  return {
    start,
    end,
    avgWeight: avg(w),
    weightDays: w.length,
    avgSteps: avg(s),
    totalSteps: s.reduce((a, b) => a + b, 0),
    stepDays: s.length,
  };
}

export type Summary = {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  /** This week's average minus last week's (kg). Null if a week has no weight. */
  change: number | null;
  latest: { date: string; weightKg: number } | null;
  /** Weight she started from: the first one she logged (or her profile weight). */
  startWeight: number | null;
  target: number | null;
  /** 0..1 of the way from start to target. Null when there is no target to move to. */
  progress: number | null;
  /** kg still to go (positive number), or null. */
  toGo: number | null;
};

export function summary(logs: BodyLog[], today: string, profileWeight: number | null, targetWeight: number | null): Summary {
  const ws = weekStart(today);
  const thisWeek = weekStats(logs, ws);
  const lastWeek = weekStats(logs, shiftDateKey(ws, -7));
  const change = thisWeek.avgWeight != null && lastWeek.avgWeight != null ? thisWeek.avgWeight - lastWeek.avgWeight : null;

  const withW = logs.filter((l) => validWeight(l.weightKg) && l.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const latestLog = withW.at(-1);
  const latest = latestLog ? { date: latestLog.date, weightKg: latestLog.weightKg as number } : null;
  const startWeight = withW[0]?.weightKg ?? (validWeight(profileWeight) ? profileWeight : null);
  const target = validWeight(targetWeight) ? targetWeight : null;

  let progress: number | null = null;
  let toGo: number | null = null;
  if (target != null && startWeight != null && latest) {
    const whole = target - startWeight;
    toGo = Math.abs(target - latest.weightKg);
    if (Math.abs(whole) >= 0.1) {
      progress = Math.min(1, Math.max(0, (latest.weightKg - startWeight) / whole));
    }
  }
  return { thisWeek, lastWeek, change, latest, startWeight, target, progress, toGo };
}

/** The last `days` days ending today, each with its log (or nothing). */
export function lastDays(logs: BodyLog[], today: string, days: number): { date: string; log: BodyLog | null }[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const out: { date: string; log: BodyLog | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = shiftDateKey(today, -i);
    out.push({ date: d, log: byDate.get(d) ?? null });
  }
  return out;
}
