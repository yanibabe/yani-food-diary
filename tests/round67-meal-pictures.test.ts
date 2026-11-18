import { test } from "node:test";
import assert from "node:assert/strict";
import { backupCounts, makeBackup, parseBackup, restoreAction } from "../app/lib/backup.ts";
import { dishKey, findPic, newPicId, orphanPicId, parseMealPics, pictureRequest, shouldDraw, withPic, type MealPics } from "../app/lib/mealPics.ts";
import { PICTURE_STYLE, imagePrompt, visualPrompt } from "../app/lib/mealPictureText.ts";

const base = {
  entries: JSON.stringify([{ id: "a" }]),
  recipes: null,
  goals: null,
  body: null,
  water: null,
  labelFixes: null,
  buddy: null,
  lang: null,
};
const pic = { photoId: "pic-1", visual: "Thai น้ำปลาพริก: small bowl of fish sauce", createdAt: 5 };

test("same dish name (any case, spacing, punctuation) = same key, so the picture is reused", () => {
  assert.equal(dishKey("  Pad  Thai! "), dishKey("pad thai"));
  assert.equal(dishKey("ข้าวผัด (หมู)"), dishKey("ข้าวผัด หมู"));
  assert.notEqual(dishKey("ข้าวผัด"), dishKey("ข้าวมันไก่"));
  let pics: MealPics = {};
  pics = withPic(pics, "Pad Thai", pic);
  assert.equal(findPic(pics, "pad  thai")?.photoId, "pic-1");
  assert.equal(findPic(pics, "som tam"), null);
});

test("a picture is requested only when the dish has none and none is running", () => {
  const pics = withPic({}, "Pad Thai", pic);
  assert.equal(shouldDraw(pics, "pad thai", new Set()), false);
  assert.equal(shouldDraw(pics, "Som Tam", new Set()), true);
  assert.equal(shouldDraw(pics, "Som Tam", new Set([dishKey("som tam")])), false);
  assert.equal(shouldDraw(pics, "   ", new Set()), false);
  assert.deepEqual(withPic(pics, "", pic), pics);
});

test("saved pictures are read safely; broken values are ignored", () => {
  assert.deepEqual(parseMealPics(null), {});
  assert.deepEqual(parseMealPics("{oops"), {});
  assert.deepEqual(parseMealPics("[1]"), {});
  const ok = parseMealPics(JSON.stringify({ "pad thai": pic, bad: { photoId: 3 }, own: { photoId: "pic-2", visual: "", createdAt: 1, own: true } }));
  assert.deepEqual(Object.keys(ok).sort(), ["own", "pad thai"]);
  assert.equal(ok.own.own, true);
});

test("a replaced picture file is deleted only when nothing else uses it", () => {
  const pics = withPic({}, "a", { ...pic, photoId: "pic-9" });
  assert.equal(orphanPicId(pics, "pic-1"), "pic-1");
  assert.equal(orphanPicId(pics, "pic-9"), null);
  assert.equal(orphanPicId(pics, "ph-real-photo"), null); // her real photos are never deleted here
  assert.equal(orphanPicId(pics, undefined), null);
  assert.match(newPicId(), /^pic-/);
});

test("the request sends only name/amount/unit, and the hint or visual only when given", () => {
  const items = [{ name: "น้ำปลา", amount: 2, unit: "ช้อนโต๊ะ", kcal: 10 } as never];
  const r = pictureRequest("น้ำปลาพริก", items, { hint: "  ใส่หอมแดง ", lang: "th" });
  assert.deepEqual(r, { title: "น้ำปลาพริก", items: [{ name: "น้ำปลา", amount: 2, unit: "ช้อนโต๊ะ" }], hint: "ใส่หอมแดง", lang: "th" });
  assert.equal("visual" in pictureRequest("x", [], { visual: " ", lang: "en" }), false);
});

test("server prompts: style text is exact and the hint reaches the text model", () => {
  assert.equal(imagePrompt("A bowl."), `A bowl. ${PICTURE_STYLE}`);
  assert.match(PICTURE_STYLE, /^Overhead top-down food photo shot straight down/);
  assert.match(PICTURE_STYLE, /No text, no hands, no people\.$/);
  const p = visualPrompt({ title: "ข้าวผัด", items: [{ name: "ข้าว", amount: 1, unit: "จาน" }], hint: "ไม่มีมะนาว" });
  assert.match(p, /ข้าว 1 จาน/);
  assert.match(p, /ไม่มีมะนาว/);
});

test("backup keeps mealPics and its picture files, and survives the trip to a file", () => {
  const mealPics = JSON.stringify({ "pad thai": pic });
  const b = makeBackup({ ...base, mealPics }, { "pic-1": "data:image/jpeg;base64,AAA", "ph-1": "data:image/jpeg;base64,BBB" }, 7);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.equal(res.backup.data.mealPics, mealPics);
  assert.deepEqual(Object.keys(res.backup.photos).sort(), ["ph-1", "pic-1"]);
  assert.deepEqual(res.backup, b);
  assert.equal(backupCounts(res.backup).photos, 2);
  assert.equal(restoreAction("mealPics", mealPics), "set");
});

test("old backup files without mealPics still restore, and keep the pictures on the phone", () => {
  const old = { app: "snapcal", version: 1, savedAt: 1, data: { ...base }, photos: {} };
  const res = parseBackup(JSON.stringify(old));
  assert.ok(res.ok);
  assert.equal(res.backup.data.mealPics, null);
  assert.equal(restoreAction("mealPics", res.backup.data.mealPics), "keep");
});

test("a broken mealPics value in a file is refused", () => {
  const b = makeBackup({ ...base, mealPics: "[1,2]" }, {}, 1);
  assert.ok(!parseBackup(JSON.stringify(b)).ok);
});
