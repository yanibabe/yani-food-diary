import type { Lang } from "./i18n.ts";
import type { MealSlot } from "./types.ts";

const TZ = "Asia/Bangkok";

/** Today's date in Thailand, as "YYYY-MM-DD". */
export function thaiDateKey(d: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function thaiHour(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return Number(h);
}

/** Guess the meal from the time of day in Thailand. */
export function guessSlot(d: Date = new Date()): MealSlot {
  const h = thaiHour(d);
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 16 && h < 22) return "dinner";
  return "snack";
}

/** Move a "YYYY-MM-DD" key by some days (calendar math, no time zone drift). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** e.g. "พฤหัสบดี 12 พ.ย. 2569" or "Thursday, 12 Nov 2026" */
export function thaiDateLabel(key: string, lang: Lang = "th"): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(t);
}

/** Meals saved before Round 6 used "brunch". Split them by the time they were saved. */
export function upgradeSlot(slot: string, createdAt: number): MealSlot {
  if (slot === "breakfast" || slot === "lunch" || slot === "dinner" || slot === "snack") return slot;
  if (slot === "brunch") return thaiHour(new Date(createdAt)) < 11 ? "breakfast" : "lunch";
  return guessSlot(new Date(createdAt));
}
