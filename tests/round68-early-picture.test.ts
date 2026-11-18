import { test } from "node:test";
import assert from "node:assert/strict";
import { copyPic, dishKey, planEarlyClaim, withPic, type MealPics } from "../app/lib/mealPics.ts";
import { PICTURE_STYLE, VISUAL_SYSTEM } from "../app/lib/mealPictureText.ts";
import { ANALYZE_PHOTO_QUALITY, ANALYZE_PHOTO_SIDE } from "../app/lib/mealPhotos.ts";
import { FAST_VISION_OPTS } from "../app/lib/aiSpeed.ts";

const pic = { photoId: "pic-1", visual: "bowl", createdAt: 1 };
const started = new Set([dishKey("ส้มตำ")]);

test("same title: nothing special (the normal rules already reuse it, no second call)", () => {
  assert.equal(planEarlyClaim({}, "ส้มตำ", " ส้มตำ ", new Set([dishKey("ส้มตำ")]), started), "none");
});

test("renamed while the picture is still drawing: wait, then attach (no second call)", () => {
  assert.equal(planEarlyClaim({}, "ส้มตำ", "ส้มตำปู", new Set([dishKey("ส้มตำ")]), started), "wait");
});

test("renamed after the picture finished: attach to the new name, same file", () => {
  const pics: MealPics = withPic({}, "ส้มตำ", pic);
  assert.equal(planEarlyClaim(pics, "ส้มตำ", "ส้มตำปู", new Set(), started), "attach");
  const out = copyPic(pics, "ส้มตำ", "ส้มตำปู");
  assert.equal(out[dishKey("ส้มตำปู")].photoId, "pic-1");
  assert.equal(out[dishKey("ส้มตำ")].photoId, "pic-1"); // the first name keeps it too (cancel / dish map)
});

test("the new name already has a picture, or no early draw was started: leave things alone", () => {
  const pics = withPic(withPic({}, "ส้มตำ", pic), "ส้มตำปู", { ...pic, photoId: "pic-2" });
  assert.equal(planEarlyClaim(pics, "ส้มตำ", "ส้มตำปู", new Set(), started), "none");
  assert.equal(planEarlyClaim(withPic({}, "ส้มตำ", pic), "ส้มตำ", "อย่างอื่น", new Set(), new Set()), "none");
  assert.equal(planEarlyClaim({}, "ส้มตำ", "ส้มตำปู", new Set(), started), "none"); // early try failed: normal save draw takes over
  assert.equal(planEarlyClaim({}, "ส้มตำ", "", new Set(), started), "none");
});

test("copyPic does nothing when there is no source picture", () => {
  assert.deepEqual(copyPic({}, "a", "b"), {});
});

test("food only: style and description rules forbid scales, props, packaging", () => {
  assert.match(PICTURE_STYLE, /Nothing but the food in a simple plate, bowl or glass/);
  assert.match(PICTURE_STYLE, /no kitchen scales/);
  assert.match(PICTURE_STYLE, /No text, no hands, no people\.$/);
  assert.match(VISUAL_SYSTEM, /Never mention scales, tables, packaging/);
});

test("photo read settings: low reasoning, enough tokens, fastest provider, 1024px q0.7", () => {
  assert.equal(FAST_VISION_OPTS.reasoning.effort, "low");
  assert.ok(FAST_VISION_OPTS.max_tokens >= 3000);
  assert.equal(FAST_VISION_OPTS.provider.sort, "latency");
  assert.equal(ANALYZE_PHOTO_SIDE, 1024);
  assert.equal(ANALYZE_PHOTO_QUALITY, 0.7);
});
