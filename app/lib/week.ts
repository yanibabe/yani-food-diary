// Weekly calories: kcal per day for one Monday → Sunday week, and the average.
// No React here, so the tests can use it.

import { weekStart } from "./body.ts";
import { shiftDateKey } from "./date.ts";
import { pickMacros, sumMacros } from "./nutrition.ts";
import type { Entry } from "./types.ts";

export type DayKcal = {
  date: string;
  /** Total kcal eaten that day. 0 when nothing was logged. */
  kcal: number;
  /** true when at least one meal was saved that day. */
  logged: boolean;
  /** true for days after today (nothing to show yet). */
  future: boolean;
};

export type CalorieWeek = {
  start: string;
  end: string;
  days: DayKcal[];
  /** Average kcal over the days that have meals. Null when no day has meals. */
  avg: number | null;
  loggedDays: number;
  /** How many logged days went over the target. */
  overDays: number;
};

/** The week (Mon → Sun) that holds `date`. Empty days do not pull the average down. */
export function calorieWeek(entries: Entry[], date: string, today: string, target: number): CalorieWeek {
  const start = weekStart(date);
  const days: DayKcal[] = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDateKey(start, i);
    const list = entries.filter((e) => e.date === d);
    const kcal = sumMacros(list.flatMap((e) => e.items.map(pickMacros))).kcal;
    days.push({ date: d, kcal, logged: list.length > 0, future: d > today });
  }
  const logged = days.filter((d) => d.logged);
  const avg = logged.length ? logged.reduce((a, d) => a + d.kcal, 0) / logged.length : null;
  return {
    start,
    end: shiftDateKey(start, 6),
    days,
    avg,
    loggedDays: logged.length,
    overDays: logged.filter((d) => d.kcal > target).length,
  };
}
