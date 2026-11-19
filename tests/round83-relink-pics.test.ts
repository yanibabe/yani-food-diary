// Round 83: AI pictures are stored under the meal name; meals renamed by Round 81 get theirs back.
import test from "node:test";
import assert from "node:assert/strict";
import { lostPicLinks, type MealPics } from "../app/lib/mealPics.ts";

const at = (iso: string) => new Date(iso).getTime();
const pic = (iso: string) => ({ photoId: "p", visual: "v", createdAt: at(iso) });

test("a picture drawn within 2 minutes of the meal comes back; closest wins", () => {
  const pics: MealPics = { "sticky rice": pic("2026-11-19T05:00:10Z"), "grilled chicken skewers": pic("2026-11-19T05:00:40Z") };
  const meals = [
    { title: "ตูดไก่ปิ้ง", createdAt: "2026-11-19T04:59:30Z" },
    { title: "ข้าวเหนียว", createdAt: "2026-11-19T05:00:20Z" },
  ];
  assert.deepEqual(lostPicLinks(pics, meals, {}), [["sticky rice", "ข้าวเหนียว"], ["grilled chicken skewers", "ตูดไก่ปิ้ง"]]);
});

test("old name found through memory, weight, or the food list", () => {
  const old = "2026-01-01T00:00:00Z";
  const pics: MealPics = { "plain greek yogurt": pic(old), "ข้าวไข่เจียวแหนม 50 g": pic(old), "butter paprika potato": pic(old) };
  const meals = [
    { title: "กรีกโยเกิร์ตรสธรรมชาติ", createdAt: "2026-11-18T00:00:00Z" },
    { title: "ข้าวไข่เจียวแหนม", createdAt: "2026-11-18T00:00:00Z" },
    { title: "มันฝรั่งผัดเนยปาปริก้า", createdAt: "2026-11-18T00:00:00Z", items: [{ name: "Butter Paprika Pota" }] },
  ];
  const memory = { "Plain Greek yogurt": { th: "กรีกโยเกิร์ตรสธรรมชาติ", en: "Plain Greek yogurt" } };
  assert.equal(lostPicLinks(pics, meals, memory).length, 3);
});

test("never guesses: look-alike names, far times and meals that already have a picture are left alone", () => {
  const pics: MealPics = { "แตงโมหั่นชิ้น": pic("2026-11-10T00:00:00Z"), "ข้าวมันไก่": pic("2026-11-10T00:00:00Z") };
  const meals = [
    { title: "แตงโมปั่น", createdAt: "2026-11-19T00:00:00Z", items: [{ name: "แตงโม" }] },
    { title: "ข้าวมันไก่", createdAt: "2026-11-10T00:00:30Z" },
    { title: "ไก่ทอด", createdAt: "2026-11-12T00:00:00Z", items: [{ name: "ไก่ทอด" }] },
  ];
  assert.deepEqual(lostPicLinks(pics, meals, {}), []);
});
