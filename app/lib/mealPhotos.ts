// Round 43: one meal can have up to 4 photos. The first is the cover (Entry.photoId);
// the others are Entry.extraPhotoIds. Old meals have no extras and work unchanged.

import type { Entry, FoodItem } from "./types.ts";

export const MAX_MEAL_PHOTOS = 4;

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,/;

export type ImagesParse = { ok: true; images: string[] } | { ok: false; reason: "none" | "too-many" | "bad-format" };

/** Read the pictures out of an /api/analyze request body. New `images` list, or the old single `image`. */
export function parseAnalyzeImages(body: { image?: unknown; images?: unknown }): ImagesParse {
  let raw: unknown[] = [];
  if (Array.isArray(body.images)) raw = body.images.filter((i) => i != null && i !== "");
  else if (typeof body.image === "string" && body.image) raw = [body.image];
  if (raw.length === 0) return { ok: false, reason: "none" };
  if (raw.length > MAX_MEAL_PHOTOS) return { ok: false, reason: "too-many" };
  if (!raw.every((i): i is string => typeof i === "string" && DATA_URL.test(i))) return { ok: false, reason: "bad-format" };
  return { ok: true, images: raw as string[] };
}

/** Every photo id of a meal, cover first. Old meals → just the cover (or nothing). */
export function entryPhotoIds(e: Pick<Entry, "photoId" | "extraPhotoIds">): string[] {
  const ids: string[] = [];
  if (e.photoId) ids.push(e.photoId);
  for (const id of e.extraPhotoIds ?? []) if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  return ids;
}

/** Boxes belong to one photo. With more than one photo they are dropped; with one, items stay as they are. */
export function boxesForPhotoCount<T extends Pick<FoodItem, "box">>(items: T[], photoCount: number): T[] {
  return photoCount > 1 ? items.map((i) => ({ ...i, box: null })) : items;
}
