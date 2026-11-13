// Water counter: how many glasses she drank each day.
// No React here, so the tests can use it.

/** One day's water. */
export type WaterLog = {
  date: string; // "YYYY-MM-DD"
  glasses: number;
  updatedAt: number;
};

/** One glass = 250 ml. */
export const GLASS_ML = 250;
export const DEFAULT_WATER_GOAL = 8;
export const WATER_GOAL_MIN = 1;
export const WATER_GOAL_MAX = 20;
/** Most glasses we keep for one day (stops a stuck finger from going wild). */
export const GLASSES_MAX = 40;

export function glassesOn(logs: WaterLog[], date: string): number {
  return logs.find((l) => l.date === date)?.glasses ?? 0;
}

/** Set a day's glasses (kept between 0 and GLASSES_MAX). A day with 0 is dropped. */
export function setGlasses(logs: WaterLog[], date: string, glasses: number, now = Date.now()): WaterLog[] {
  const n = Math.max(0, Math.min(GLASSES_MAX, Math.round(Number.isFinite(glasses) ? glasses : 0)));
  const rest = logs.filter((l) => l.date !== date);
  if (n === 0) return rest;
  return [...rest, { date, glasses: n, updatedAt: now }].sort((a, b) => a.date.localeCompare(b.date));
}

/** The goal to use: a saved goal if it makes sense, otherwise 8. */
export function waterGoal(saved: number | null | undefined): number {
  return saved != null && Number.isInteger(saved) && saved >= WATER_GOAL_MIN && saved <= WATER_GOAL_MAX ? saved : DEFAULT_WATER_GOAL;
}

export function clampGoal(n: number): number {
  return Math.max(WATER_GOAL_MIN, Math.min(WATER_GOAL_MAX, Math.round(n)));
}

/** Tapping glass number `n` (1-based): fills up to it, or empties it if it is the last full one. */
export function tapGlass(current: number, n: number): number {
  return n === current ? n - 1 : n;
}
