import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTitleFix, mealsToCheck, parseTitleReply, parseTitleRequest, runTitleCheck, thaiText, titleSignature, MAX_TITLE_CALLS_PER_DAY, type MealLike } from "../app/lib/mealTitles.ts";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const meal = (id: string, date: string, title: string, items: MealLike["items"], alt?: MealLike["alt"]): MealLike => ({ id, date, title, items, ...(alt ? { alt } : {}) });
const herMeal = meal("m1", "2026-11-19", "ไก่ย่างเสียบไม้และไก่ทอด", [{ name: "ตูดไก่ปิ้ง" }, { name: "ตับไก่ปิ้ง" }, { name: "Fried fermented pork rib cartilage", alt: { th: "แหนมกระดูกอ่อนทอด", src: "Fried fermented pork rib cartilage" } }]);

test("Thai food names are what the check sends", () => {
  assert.equal(thaiText("Fried fermented pork rib cartilage", { th: "แหนมกระดูกอ่อนทอด", src: "Fried fermented pork rib cartilage" }), "แหนมกระดูกอ่อนทอด");
  assert.equal(thaiText("Fried chicken", { th: "ไก่ทอด", src: "Old name" }), "Fried chicken");
});

test("only recent meals, not typed by her, not checked for these foods", () => {
  const typed = meal("m2", "2026-11-19", "ของฉัน", [{ name: "ข้าว" }], { manual: true });
  const old = meal("m3", "2025-01-01", "เก่า", [{ name: "ข้าว" }]);
  assert.deepEqual(mealsToCheck([herMeal, typed, old], {}, "2026-11-19").map((m) => m.id), ["m1"]);
  assert.deepEqual(mealsToCheck([herMeal], { m1: titleSignature(herMeal) }, "2026-11-19"), []);
});

test("the Thai name becomes the real name, English its alt; a typed name is never touched", () => {
  const out = applyTitleFix(herMeal, { id: "m1", th: "ตูดไก่ปิ้ง ตับไก่ปิ้ง และแหนมกระดูกอ่อนทอด", en: "Grilled chicken tails, chicken liver and fried fermented pork cartilage" });
  assert.equal(out.title, "ตูดไก่ปิ้ง ตับไก่ปิ้ง และแหนมกระดูกอ่อนทอด");
  assert.deepEqual(out.alt, { en: "Grilled chicken tails, chicken liver and fried fermented pork cartilage", src: out.title });
  const typed = { ...herMeal, alt: { en: "Mine", manual: true } };
  assert.equal(applyTitleFix(typed, { id: "m1", th: "x", en: "y" }), typed);
});

test("request + reply checks; a reply that disagrees on the meat is dropped", () => {
  assert.equal(parseTitleRequest({ meals: [] }).ok, false);
  assert.equal(parseTitleRequest({ meals: [{ id: "a", title: "t", foods: ["ข้าว"] }] }).ok, true);
  const r = parseTitleReply({ meals: [
    { id: "a", title_th: "ข้าวแหนมหมู", title_en: "Rice with fried chicken" },
    { id: "b", title_th: "ข้าวเหนียว", title_en: "Sticky rice" },
    { id: "zz", title_th: "x", title_en: "y" },
  ] }, ["a", "b"]);
  assert.deepEqual(r.map((x) => x.id), ["b"]);
});

test("background pass: asks once, remembers, keeps a daily budget, pauses after a failure", async () => {
  const storage = mem();
  let asked = 0;
  const ask = async () => (asked++, [{ id: "m1", th: "ตูดไก่ปิ้ง ตับไก่ปิ้ง และแหนมกระดูกอ่อนทอด", en: "Grilled chicken tails, chicken liver and fried fermented pork cartilage" }]);
  const a = await runTitleCheck({ meals: [herMeal], ask, storage, today: "2026-11-19", online: true });
  assert.equal(a.fixes.length, 1);
  const fixed = applyTitleFix(herMeal, a.fixes[0]);
  const b = await runTitleCheck({ meals: [fixed], ask, storage, today: "2026-11-19", online: true });
  assert.equal(b.stoppedBy, "done");
  assert.equal(asked, 1);
  const s2 = mem();
  const fail = await runTitleCheck({ meals: [herMeal], ask: async () => { throw new Error("x"); }, storage: s2, today: "2026-11-19", online: true, now: 1000 });
  assert.equal(fail.stoppedBy, "failed");
  assert.equal((await runTitleCheck({ meals: [herMeal], ask, storage: s2, today: "2026-11-19", online: true, now: 2000 })).stoppedBy, "paused");
  const s3 = mem();
  s3.setItem("yfd:v1:titleRuns", JSON.stringify({ day: "2026-11-19", calls: MAX_TITLE_CALLS_PER_DAY, failedAt: 0 }));
  assert.equal((await runTitleCheck({ meals: [herMeal], ask, storage: s3, today: "2026-11-19", online: true })).stoppedBy, "budget");
});
