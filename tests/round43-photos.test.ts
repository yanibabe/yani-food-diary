// Round 43: many photos for one meal (cover + extras).
import { test } from "node:test";
import assert from "node:assert/strict";
import { boxesForPhotoCount, entryPhotoIds, MAX_MEAL_PHOTOS, parseAnalyzeImages } from "../app/lib/mealPhotos.ts";
import { copyMeal, photoStillUsed } from "../app/lib/repeat.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

const img = (n = 1) => `data:image/jpeg;base64,AAAA${n}`;
const item = (box: FoodItem["box"] = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }): FoodItem => ({
  id: "i1", name: "x", amount: 1, unit: "จาน", kcal: 100, protein: 1, carbs: 2, fat: 3, estimated: false, kind: "food", note: null, box,
});
const meal = (id: string, extra: Partial<Entry> = {}): Entry => ({
  id, date: "2026-11-10", slot: "lunch", title: "m", items: [item()], source: "photo", photoId: null, recipe: null, createdAt: 1, updatedAt: 1, ...extra,
});

test("request: 1 to 4 images are accepted", () => {
  for (let n = 1; n <= MAX_MEAL_PHOTOS; n++) {
    const r = parseAnalyzeImages({ images: Array.from({ length: n }, (_, i) => img(i)) });
    assert.equal(r.ok && r.images.length, n);
  }
});

test("request: the old single `image` field still works", () => {
  const r = parseAnalyzeImages({ image: img() });
  assert.deepEqual(r, { ok: true, images: [img()] });
});

test("request: no pictures, 5 pictures and bad formats are rejected", () => {
  assert.deepEqual(parseAnalyzeImages({}), { ok: false, reason: "none" });
  assert.deepEqual(parseAnalyzeImages({ image: null }), { ok: false, reason: "none" });
  assert.deepEqual(parseAnalyzeImages({ images: [] }), { ok: false, reason: "none" });
  assert.deepEqual(parseAnalyzeImages({ images: Array.from({ length: 5 }, () => img()) }), { ok: false, reason: "too-many" });
  assert.deepEqual(parseAnalyzeImages({ images: [img(), "http://x/y.jpg"] }), { ok: false, reason: "bad-format" });
  assert.deepEqual(parseAnalyzeImages({ images: [img(), 5] }), { ok: false, reason: "bad-format" });
  assert.deepEqual(parseAnalyzeImages({ image: "data:text/html;base64,AAA" }), { ok: false, reason: "bad-format" });
});

test("photo ids: cover first, then extras; old meals work", () => {
  assert.deepEqual(entryPhotoIds(meal("a", { photoId: "p1", extraPhotoIds: ["p2", "p3"] })), ["p1", "p2", "p3"]);
  assert.deepEqual(entryPhotoIds(meal("a", { photoId: "p1" })), ["p1"]);
  assert.deepEqual(entryPhotoIds(meal("a")), []);
});

test("photoStillUsed: counts extras of other meals, ignores the meal itself", () => {
  const a = meal("a", { photoId: "p1", extraPhotoIds: ["p2"] });
  const b = meal("b", { photoId: "p9", extraPhotoIds: ["p2"] });
  assert.equal(photoStillUsed([a, b], "p2", "a"), true);
  assert.equal(photoStillUsed([a, b], "p1", "a"), false);
  assert.equal(photoStillUsed([a, b], "p9", "a"), true);
  assert.equal(photoStillUsed([a], "p2", "a"), false);
  // old entries without extras
  assert.equal(photoStillUsed([meal("o", { photoId: "p1" }), meal("q")], "p1", "q"), true);
});

test("copyMeal: eat again shares the extra photos (own list, not the same array)", () => {
  const a = meal("a", { photoId: "p1", extraPhotoIds: ["p2", "p3"] });
  const c = copyMeal(a, "2026-11-12", "dinner", 5);
  assert.equal(c.photoId, "p1");
  assert.deepEqual(c.extraPhotoIds, ["p2", "p3"]);
  assert.notEqual(c.extraPhotoIds, a.extraPhotoIds);
  assert.equal(photoStillUsed([a, c], "p3", "a"), true);
  // old entry: no extraPhotoIds key appears
  const old = copyMeal(meal("o", { photoId: "p1" }), "2026-11-12", "dinner", 5);
  assert.equal("extraPhotoIds" in old, false);
});

test("boxes: dropped only when there is more than one photo", () => {
  const items = [item(), item({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 })];
  assert.deepEqual(boxesForPhotoCount(items, 1), items);
  assert.equal(boxesForPhotoCount(items, 1)[0].box?.x, 0.1);
  assert.ok(boxesForPhotoCount(items, 2).every((i) => i.box === null));
  assert.ok(boxesForPhotoCount(items, 4).every((i) => i.box === null));
  assert.notEqual(items[0].box, null); // original not changed
});
