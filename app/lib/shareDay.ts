// "Share this day": the plain facts that go on the picture.
// Pure data (no drawing), so it can be tested.

import { fmtAmount, pickMacros, sumMacros } from "./nutrition.ts";
import { macroSplit, type Split } from "./macroSplit.ts";
import { SLOTS, type Entry, type Macros, type MealSlot } from "./types.ts";

export type ShareMeal = {
  title: string;
  m: Macros;
  /** Small list of what was in it, e.g. "ข้าวสวย 150 กรัม · ไข่ดาว 1 ฟอง". Empty for a single item. */
  detail: string;
  /** The meal's photo (in IndexedDB), if it has one. */
  photoId: string | null;
};

export type ShareSlot = { slot: MealSlot; m: Macros; meals: ShareMeal[] };

export type ShareDay = { total: Macros; slots: ShareSlot[]; count: number; /** P/C/F share of the day's calories (same maths as the Today tiles), or null when nothing was eaten. */ split: Split | null };

/** Round to whole numbers so the picture and the totals always agree. */
function roundM(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
}

export function buildShareDay(entries: Entry[], date: string): ShareDay {
  const day = entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const slots = SLOTS.map((slot) => {
    const meals = day
      .filter((e) => e.slot === slot)
      .map((e) => ({
        title: e.title,
        m: roundM(sumMacros(e.items.map(pickMacros))),
        detail: e.items.length > 1 ? e.items.map((i) => `${i.name} ${fmtAmount(i.amount)} ${i.unit}`.trim()).join(" · ") : "",
        photoId: e.photoId ?? null,
      }));
    return { slot, meals, m: roundM(sumMacros(meals.map((x) => x.m))) };
  });
  // Same input as the Today tiles (the unrounded day total), so the percents match Today exactly.
  const split = macroSplit(sumMacros(day.flatMap((e) => e.items.map(pickMacros))));
  return { slots, total: roundM(sumMacros(slots.map((s) => s.m))), count: day.length, split };
}

/** File name for the picture, e.g. "snapcal-2026-11-16.png". */
export function shareFileName(date: string): string {
  return `snapcal-${date}.png`;
}

/** The texts for the three percents ("35%"), or null when there is nothing to show (empty / all-zero day). */
export function splitTexts(split: Split | null): { protein: string; carbs: string; fat: string } | null {
  if (!split) return null;
  return { protein: `${split.protein}%`, carbs: `${split.carbs}%`, fat: `${split.fat}%` };
}
