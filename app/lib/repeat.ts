// "Eat again": meals she logged before, ready to log again in one tap.
// The copy keeps the same numbers (no AI call, no credit spent).

import { newId, pickMacros, sumMacros } from "./nutrition.ts";
import { entryPhotoIds } from "./mealPhotos.ts";
import type { Entry, MealSlot } from "./types.ts";

/** Same title + same total kcal = the same meal. */
export function mealKey(e: Pick<Entry, "title" | "items">): string {
  const kcal = Math.round(sumMacros(e.items.map(pickMacros)).kcal);
  return `${e.title.trim().toLowerCase()}|${kcal}`;
}

/** Her different meals, the day she ate them most recently first. Empty meals are skipped. */
export function recentMeals(entries: Entry[], limit = Infinity): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  const newest = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
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

/** Meals whose name (or a food inside) contains the search words. Empty search = all. */
export function searchMeals(list: Entry[], query: string): Entry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return list;
  return list.filter((e) => {
    // Round 79: the other-language names find a meal too (type "mackerel" for a Thai-named meal).
    const text = [e.title, e.alt?.th, e.alt?.en, ...e.items.flatMap((i) => [i.name, i.alt?.th, i.alt?.en])].filter(Boolean).join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** A fresh copy of a meal for another day / meal slot. The photo is shared, not copied. */
export function copyMeal(e: Entry, date: string, slot: MealSlot, now = Date.now()): Entry {
  return {
    ...e,
    id: newId("en"),
    date,
    slot,
    items: e.items.map((i) => ({ ...i, id: newId("it") })),
    ...(e.extraPhotoIds ? { extraPhotoIds: [...e.extraPhotoIds] } : {}),
    recipe: e.recipe ? { ...e.recipe } : null,
    createdAt: now,
    updatedAt: now,
  };
}

/** How many recent meals the Add food sheet shows directly (Phase 2C-1). */
export const SHEET_RECENT_COUNT = 3;

/**
 * Which meal a repeated food is saved under. Viewing today: the meal slot for the moment the sheet was opened
 * (so what the row says is what gets saved). Viewing another day: the slot the food had before.
 */
export function repeatSlot(e: Pick<Entry, "slot">, viewedDate: string, today: string, slotAtOpen: MealSlot): MealSlot {
  return viewedDate === today ? slotAtOpen : e.slot;
}

/** Accidental double taps: after one repeat, further taps are ignored for this long (ms). */
export const REPEAT_LOCK_MS = 900;

/** A photo may be shared by copies: only delete it when no other meal uses it. */
export function photoStillUsed(entries: Entry[], photoId: string, exceptId: string): boolean {
  return entries.some((e) => e.id !== exceptId && entryPhotoIds(e).includes(photoId));
}
