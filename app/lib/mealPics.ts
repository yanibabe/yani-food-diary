// Round 67: AI-drawn meal pictures. Pure helpers (no React, no browser storage) so the tests can use them.
// One picture per DISH NAME: the same name on another day reuses the picture (no new AI call).
// The picture itself is a small JPEG in IndexedDB (`photos` store, id "pic-…"); this map says which.

import { normalizeName } from "./foodRef.ts";
import { UNIT_LABEL, type FoodItem, type Ingredient } from "./types.ts";

export const MEAL_PICS_KEY = "yfd:v1:mealPics";
export const PIC_ID_PREFIX = "pic-";
/** Pictures are shrunk to this many pixels (square) before they are saved. */
export const PIC_SIZE = 512;
export const PIC_QUALITY = 0.8;

export type MealPic = {
  photoId: string;
  /** The English sentence the picture was drawn from ("" when she chose her own photo). */
  visual: string;
  createdAt: number;
  /** true = she chose her own photo for this dish (not drawn by the AI). */
  own?: boolean;
};
export type MealPics = Record<string, MealPic>;

/** Same dish → same key: the meal title, lower case, punctuation and extra spaces removed. */
export function dishKey(title: string): string {
  return normalizeName(title);
}

export function newPicId(random = Math.random): string {
  return `${PIC_ID_PREFIX}${Date.now().toString(36)}${random().toString(36).slice(2, 8)}`;
}

/** Read the saved text. Anything unreadable is left out, so a broken value never breaks the app. */
export function parseMealPics(raw: string | null | undefined): MealPics {
  if (!raw) return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: MealPics = {};
  for (const [k, p] of Object.entries(v as Record<string, unknown>)) {
    const o = p as Partial<MealPic> | null;
    if (!k || !o || typeof o.photoId !== "string" || !o.photoId) continue;
    out[k] = {
      photoId: o.photoId,
      visual: typeof o.visual === "string" ? o.visual : "",
      createdAt: typeof o.createdAt === "number" ? o.createdAt : 0,
      ...(o.own === true ? { own: true } : {}),
    };
  }
  return out;
}

export function findPic(pics: MealPics, title: string): MealPic | null {
  const k = dishKey(title);
  return k ? (pics[k] ?? null) : null;
}

export function withPic(pics: MealPics, title: string, pic: MealPic): MealPics {
  const k = dishKey(title);
  return k ? { ...pics, [k]: pic } : pics;
}

/** Draw a new picture in the background? Only if the dish has a name, has no picture yet, and no request is running for it. */
export function shouldDraw(pics: MealPics, title: string, inflight: ReadonlySet<string>): boolean {
  const k = dishKey(title);
  return !!k && !pics[k] && !inflight.has(k);
}

/** A picture file nobody points at any more (after "draw again"), so it can be deleted. */
export function orphanPicId(pics: MealPics, photoId: string | undefined): string | null {
  if (!photoId || !photoId.startsWith(PIC_ID_PREFIX)) return null;
  return Object.values(pics).some((p) => p.photoId === photoId) ? null : photoId;
}

/** The body sent to /api/meal-picture. */
export function pictureRequest(title: string, items: Pick<FoodItem, "name" | "amount" | "unit">[], extra: { hint?: string; visual?: string; lang: "th" | "en" }) {
  return {
    title,
    items: items.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })),
    ...(extra.hint?.trim() ? { hint: extra.hint.trim() } : {}),
    ...(extra.visual?.trim() ? { visual: extra.visual.trim() } : {}),
    lang: extra.lang,
  };
}

/** Round 68: the picture is drawn as soon as the photo is read. When she saves, what should happen with it?
 *  none = nothing special (same name: the normal rules already reuse it) · attach = copy the finished picture to the new name ·
 *  wait = it is still drawing: attach it when it arrives (no second call). Only a picture drawn EARLY in this visit is ever attached. */
export type EarlyPlan = "none" | "attach" | "wait";
export function planEarlyClaim(pics: MealPics, earlyTitle: string, newTitle: string, inflight: ReadonlySet<string>, earlyStarted: ReadonlySet<string>): EarlyPlan {
  const ek = dishKey(earlyTitle);
  const nk = dishKey(newTitle);
  if (!ek || !nk || ek === nk || !earlyStarted.has(ek)) return "none";
  if (pics[nk]) return "none"; // the new name already has its own picture: keep it
  if (pics[ek]) return "attach";
  if (inflight.has(ek)) return "wait";
  return "none";
}

/** Give `toTitle` the same picture as `fromTitle` (both point to the same file, so nothing is copied or drawn again). */
export function copyPic(pics: MealPics, fromTitle: string, toTitle: string): MealPics {
  const from = findPic(pics, fromTitle);
  return from ? withPic(pics, toTitle, from) : pics;
}

/** Round 70: a recipe's ingredients as picture items (name, amount, unit in English words). Same shape the meal pictures use. */
export function recipePictureItems(ingredients: Pick<Ingredient, "name" | "amount" | "unit">[]): Pick<FoodItem, "name" | "amount" | "unit">[] {
  return ingredients
    .filter((i) => i.name.trim() !== "")
    .map((i) => ({ name: i.name.trim(), amount: i.amount, unit: UNIT_LABEL[i.unit]?.en ?? String(i.unit) }));
}

/**
 * Round 83: pictures are stored under the meal NAME, so when Round 81 renamed meals, their pictures lost
 * their meal (the files are still on the phone). Find each lost picture's meal using only sure signs:
 *  1. time — a picture is drawn right after its meal is saved (within 2 minutes; closest wins), or
 *  2. the old name — the translation memory says the old name means the meal's current name, or the old
 *     name is the current name plus a weight ("ข้าวไข่เจียวแหนม 50 g"), or the old name was the food list itself
 *     ("Paleo Robbie / Grass fed rump steak"; a cut-short food name counts if 12+ letters match).
 * Never guesses from look-alike names. Returns [old key, new title] pairs to copy.
 */
export function lostPicLinks(
  pics: MealPics,
  meals: { title: string; createdAt?: string | number; alt?: { th?: string; en?: string }; items?: { name: string }[] }[],
  memory: Record<string, { th: string; en: string }>,
): [string, string][] {
  // Not used by any meal (a recipe cover counts too: a meal made from a recipe used to share its cover).
  const used = new Set(meals.map((m) => dishKey(m.title)));
  const lost = new Set(Object.keys(pics).filter((k) => !used.has(k)));
  const want = meals.filter((m) => !pics[dishKey(m.title)]);
  const out: [string, string][] = [];
  const done = new Set<string>();
  const link = (k: string, title: string) => {
    if (!lost.has(k) || done.has(dishKey(title))) return;
    lost.delete(k);
    done.add(dishKey(title));
    out.push([k, title]);
  };
  // 1. time, closest pairs first
  const near: { k: string; title: string; d: number }[] = [];
  for (const m of want) {
    const t = new Date(m.createdAt ?? 0).getTime();
    if (!t) continue;
    for (const k of lost) {
      const d = Math.abs(pics[k].createdAt - t);
      if (d <= 2 * 60 * 1000) near.push({ k, title: m.title, d });
    }
  }
  near.sort((a, b) => a.d - b.d).forEach((n) => link(n.k, n.title));
  // 2. old name
  const noWeight = (k: string) => k.replace(/\s*\d+(\.\d+)?\s*(g|กรัม|ml|มล)$/i, "");
  for (const m of want) {
    const names = new Set([m.title, m.alt?.th, m.alt?.en].filter(Boolean).map((s) => dishKey(s!)));
    const foods = dishKey((m.items ?? []).map((i) => i.name).join(" "));
    for (const k of [...lost]) {
      const p = memory[Object.keys(memory).find((src) => dishKey(src) === k) ?? ""];
      const sameFoods = foods.length >= 12 && k.startsWith(foods);
      if ((p && (names.has(dishKey(p.th)) || names.has(dishKey(p.en)))) || names.has(noWeight(k)) || sameFoods) link(k, m.title);
    }
  }
  return out;
}
