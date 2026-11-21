// Professional nutrition reports (daily + weekly) for sharing with a trainer / coach.
// Pure (no React, no canvas) so the tests can run it: buildDayReport / buildWeekReport work out the numbers
// from the saved meals (same sums as Today). The pictures are laid out in shareCard.ts (daily) and shareWeekCard.ts (weekly).
// Rules the reports follow:
//   - A day or meal with NO entries is "not logged" (shown as a dash / "No data"), never as 0 kcal.
//   - Weekly averages divide by the days that have food logged (not by 7), and say so.
//   - A day with only one meal logged is marked "few meals" so it is not read as a complete day.
//   - "~" marks estimated values; incomplete nutrient data is called out.

import { shiftDateKey, thaiDateLabel } from "./date.ts";
import { weekStart } from "./body.ts";
import { fmtAmount, pickMacros, sumMacros } from "./nutrition.ts";
import { macroSplit, type Split } from "./macroSplit.ts";
import { isEstimated } from "./provenance.ts";
import { displayUnit } from "./unitNames.ts";
import type { NameAlt } from "./names.ts";
import type { Lang } from "./i18n.ts";
import { SLOTS, SLOT_LABEL, type Entry, type MealSlot } from "./types.ts";

// ---------------------------------------------------------------- shared drawing vocabulary

export type Measure = (text: string, size: number, weight: number) => number;
export const REPORT_W = 1080;

/** Cut a text to fit `maxW` (adds "…"). Works letter by letter, so Thai (no spaces) is fine. */
export function fitText(measure: Measure, text: string, size: number, weight: number, maxW: number): string {
  if (measure(text, size, weight) <= maxW) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join("").trimEnd() + "…", size, weight) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join("").trimEnd() + "…";
}

/** Wrap a text into at most `maxLines` lines (last line gets "…" when cut). Spaces break words; Thai breaks anywhere. */
export function wrapText(measure: Measure, text: string, size: number, weight: number, maxW: number, maxLines: number): string[] {
  const words = text.includes(" ") ? text.split(" ") : Array.from(text);
  const sep = text.includes(" ") ? " " : "";
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const next = cur ? cur + sep + words[i] : words[i];
    if (measure(next, size, weight) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = words[i];
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fitText(measure, kept[maxLines - 1] + sep + lines.slice(maxLines).join(sep), size, weight, maxW);
  return kept;
}

// ---------------------------------------------------------------- DAILY: the numbers

export type ReportMeal = { title: string; kcal: number; detail: string; est: boolean };
export type ReportSlot = { slot: MealSlot; label: string; logged: boolean; kcal: number; meals: ReportMeal[] };

export type DayReport = {
  lang: Lang;
  date: string;
  dateLabel: string;
  name: string;
  target: number;
  /** Whole-number totals of the foods logged that day. */
  total: { kcal: number; protein: number; carbs: number; fat: number };
  macroTargets: { protein: number; carbs: number; fat: number };
  split: Split | null;
  slots: ReportSlot[];
  mealCount: number;
  notLogged: MealSlot[];
  /** Some food has an estimated value ("~"). */
  hasEstimate: boolean;
  /** Some food is missing protein / carbs / fat (so those totals may be too low). */
  incompleteNutrients: boolean;
  /** Only shown when really logged (0 glasses = not logged). */
  water: { glasses: number; goal: number } | null;
  weightKg: number | null;
};

export function buildDayReport(i: {
  entries: Entry[];
  date: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  lang: Lang;
  name?: string;
  show?: (name: string, alt?: NameAlt) => string;
  water?: { glasses: number; goal: number } | null;
  weightKg?: number | null;
}): DayReport {
  const show = i.show ?? ((n: string) => n);
  const unit = (it: { unit: string; amount: number }) => displayUnit(it.unit, i.lang, it.amount);
  const day = i.entries.filter((e) => e.date === i.date).sort((a, b) => a.createdAt - b.createdAt);
  const slots: ReportSlot[] = SLOTS.map((slot) => {
    const list = day.filter((e) => e.slot === slot);
    const meals = list.map((e) => ({
      title: show(e.title, e.alt),
      kcal: Math.round(sumMacros(e.items.map(pickMacros)).kcal),
      detail: e.items.length > 1 ? e.items.map((it) => `${show(it.name, it.alt)} ${fmtAmount(it.amount)} ${unit(it)}`.trim()).join(" · ") : "",
      est: e.items.some((it) => isEstimated(it, e)),
    }));
    return { slot, label: SLOT_LABEL[slot][i.lang], logged: list.length > 0, kcal: meals.reduce((a, m) => a + m.kcal, 0), meals };
  });
  const sum = sumMacros(day.flatMap((e) => e.items.map(pickMacros)));
  return {
    lang: i.lang,
    date: i.date,
    dateLabel: thaiDateLabel(i.date, i.lang),
    name: (i.name ?? "").trim(),
    target: i.target,
    total: { kcal: Math.round(sum.kcal), protein: Math.round(sum.protein), carbs: Math.round(sum.carbs), fat: Math.round(sum.fat) },
    macroTargets: { protein: Math.round(i.macroTargets.protein), carbs: Math.round(i.macroTargets.carbs), fat: Math.round(i.macroTargets.fat) },
    split: macroSplit(sum),
    slots,
    mealCount: day.length,
    notLogged: slots.filter((s) => !s.logged).map((s) => s.slot),
    hasEstimate: day.some((e) => e.items.some((it) => isEstimated(it, e))),
    incompleteNutrients: day.some((e) => e.items.some((it) => (it.missing?.length ?? 0) > 0)),
    water: i.water && i.water.glasses > 0 ? i.water : null,
    weightKg: i.weightKg ?? null,
  };
}

// ---------------------------------------------------------------- WEEKLY: the numbers

export type ReportDay = {
  date: string;
  logged: boolean;
  future: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Meal types (breakfast, lunch…) that have something logged. */
  mealSlots: number;
  /** Logged, but only one meal type: may be an incomplete day. */
  few: boolean;
  over: boolean;
};

export type WeekReport = {
  lang: Lang;
  start: string;
  end: string;
  rangeLabel: string;
  name: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  days: ReportDay[];
  loggedDays: number;
  /** Averages are per LOGGED day (never divided by 7). Null when nothing is logged. */
  avg: { kcal: number; protein: number; carbs: number; fat: number } | null;
  /** avg kcal − target (negative = under). Null without data or target. */
  vsTarget: number | null;
  fewDays: number;
  overDays: number;
  hasEstimate: boolean;
  incompleteNutrients: boolean;
};

export function weekRangeText(start: string, end: string, lang: Lang): string {
  const part = (key: string, withYear: boolean) => {
    const [y, m, d] = key.split("-").map(Number);
    const parts = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("weekday")} ${get("day")} ${get("month")}${withYear ? ` ${get("year")}` : ""}`;
  };
  return `${part(start, false)} – ${part(end, true)}`;
}

export function buildWeekReport(i: {
  entries: Entry[];
  date: string;
  today: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  lang: Lang;
  name?: string;
}): WeekReport {
  const start = weekStart(i.date);
  const end = shiftDateKey(start, 6);
  const days: ReportDay[] = Array.from({ length: 7 }, (_, n) => {
    const date = shiftDateKey(start, n);
    const list = i.entries.filter((e) => e.date === date);
    const m = sumMacros(list.flatMap((e) => e.items.map(pickMacros)));
    const slots = new Set(list.map((e) => e.slot)).size;
    const logged = list.length > 0;
    return { date, logged, future: date > i.today, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, mealSlots: slots, few: logged && slots <= 1, over: logged && i.target > 0 && m.kcal > i.target };
  });
  const logged = days.filter((d) => d.logged);
  const n = logged.length;
  const sumOf = (k: "kcal" | "protein" | "carbs" | "fat") => logged.reduce((a, d) => a + d[k], 0);
  const avg = n ? { kcal: sumOf("kcal") / n, protein: sumOf("protein") / n, carbs: sumOf("carbs") / n, fat: sumOf("fat") / n } : null;
  const inWeek = i.entries.filter((e) => e.date >= start && e.date <= end);
  return {
    lang: i.lang,
    start,
    end,
    rangeLabel: weekRangeText(start, end, i.lang),
    name: (i.name ?? "").trim(),
    target: i.target,
    macroTargets: { protein: Math.round(i.macroTargets.protein), carbs: Math.round(i.macroTargets.carbs), fat: Math.round(i.macroTargets.fat) },
    days,
    loggedDays: n,
    avg,
    vsTarget: avg && i.target > 0 ? Math.round(avg.kcal) - Math.round(i.target) : null,
    fewDays: days.filter((d) => d.few).length,
    overDays: days.filter((d) => d.over).length,
    hasEstimate: inWeek.some((e) => e.items.some((it) => isEstimated(it, e))),
    incompleteNutrients: inWeek.some((e) => e.items.some((it) => (it.missing?.length ?? 0) > 0)),
  };
}

export function reportFileName(kind: "day" | "week", key: string): string {
  return kind === "day" ? `snapcal-day-${key}.png` : `snapcal-week-${key}.png`;
}
