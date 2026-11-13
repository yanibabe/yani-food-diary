// "Eat again": meals she logged before, ready to log again in one tap.
// The copy keeps the same numbers (no AI call, no credit spent).

import { newId, pickMacros, sumMacros } from "./nutrition.ts";
import type { Entry, MealSlot } from "./types.ts";

/** Same title + same total kcal = the same meal. */
export function mealKey(e: Pick<Entry, "title" | "items">): string {
  const kcal = Math.round(sumMacros(e.items.map(pickMacros)).kcal);
  return `${e.title.trim().toLowerCase()}|${kcal}`;
}

/** Her most recent different meals, newest first. Empty meals are skipped. */
export function recentMeals(entries: Entry[], limit = 6): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  const newest = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  for (const e of newest) {
    if (e.items.length === 0) continue;
    const k = mealKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** A fresh copy of a meal for another day / meal slot. The photo is shared, not copied. */
export function copyMeal(e: Entry, date: string, slot: MealSlot, now = Date.now()): Entry {
  return {
    ...e,
    id: newId("en"),
    date,
    slot,
    items: e.items.map((i) => ({ ...i, id: newId("it") })),
    recipe: e.recipe ? { ...e.recipe } : null,
    createdAt: now,
    updatedAt: now,
  };
}

/** A photo may be shared by copies: only delete it when no other meal uses it. */
export function photoStillUsed(entries: Entry[], photoId: string, exceptId: string): boolean {
  return entries.some((e) => e.id !== exceptId && e.photoId === photoId);
}
