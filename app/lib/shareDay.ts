// "Share my day with my trainer": the plain facts that go on the picture.
// Pure data (no drawing), so it can be tested.

import { fmtAmount, pickMacros, sumMacros } from "./nutrition.ts";
import { SLOTS, type Entry, type Macros, type MealSlot } from "./types.ts";

export type ShareMeal = {
  title: string;
  m: Macros;
  /** Small list of what was in it, e.g. "ข้าวสวย 150 กรัม · ไข่ดาว 1 ฟอง". Empty for a single item. */
  detail: string;
};

export type ShareSlot = { slot: MealSlot; m: Macros; meals: ShareMeal[] };

export type ShareDay = { total: Macros; slots: ShareSlot[]; count: number };

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
      }));
    return { slot, meals, m: roundM(sumMacros(meals.map((x) => x.m))) };
  });
  return { slots, total: roundM(sumMacros(slots.map((s) => s.m))), count: day.length };
}

/** File name for the picture, e.g. "snapcal-2026-11-16.png". */
export function shareFileName(date: string): string {
  return `snapcal-${date}.png`;
}
