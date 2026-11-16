// "Share this day": what goes on the picture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareDay, shareFileName } from "../app/lib/shareDay.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

const item = (name: string, kcal: number, p: number, c: number, f: number, amount = 1, unit = "จาน"): FoodItem => ({
  id: name, name, amount, unit, kcal, protein: p, carbs: c, fat: f, estimated: false, kind: "food", note: null, box: null,
});
const entry = (id: string, date: string, slot: Entry["slot"], title: string, items: FoodItem[], createdAt: number): Entry => ({
  id, date, slot, title, items, source: "manual", photoId: null, recipe: null, createdAt, updatedAt: createdAt,
});

test("only that day, grouped by meal, in the order eaten, totals add up", () => {
  const entries = [
    entry("a", "2026-11-16", "lunch", "ข้าวมันไก่", [item("ข้าวมันไก่", 600.4, 25.4, 70.2, 22.6)], 2),
    entry("b", "2026-11-16", "breakfast", "ข้าวไข่ดาว", [item("ข้าวสวย", 240, 4, 52, 0.5, 150, "กรัม"), item("ไข่ดาว", 130, 6.4, 0.5, 11, 1, "ฟอง")], 1),
    entry("c", "2026-11-15", "lunch", "เมื่อวาน", [item("x", 999, 1, 1, 1)], 0),
    entry("d", "2026-11-16", "lunch", "ชาเย็น", [item("ชาเย็น", 200, 2, 35, 6)], 3),
  ];
  const d = buildShareDay(entries, "2026-11-16");
  assert.equal(d.count, 3);
  assert.deepEqual(d.slots.map((s) => s.slot), ["breakfast", "lunch", "dinner", "snack"]);
  assert.deepEqual(d.slots[1].meals.map((m) => m.title), ["ข้าวมันไก่", "ชาเย็น"]);
  assert.equal(d.slots[2].meals.length, 0);
  assert.deepEqual(d.slots[0].meals[0].m, { kcal: 370, protein: 10, carbs: 53, fat: 12 });
  assert.equal(d.slots[0].meals[0].detail, "ข้าวสวย 150 กรัม · ไข่ดาว 1 ฟอง");
  assert.equal(d.slots[1].meals[0].detail, "");
  assert.deepEqual(d.total, { kcal: 370 + 600 + 200, protein: 10 + 25 + 2, carbs: 53 + 70 + 35, fat: 12 + 23 + 6 });
});

test("empty day and file name", () => {
  const d = buildShareDay([], "2026-11-16");
  assert.equal(d.count, 0);
  assert.equal(d.total.kcal, 0);
  assert.equal(shareFileName("2026-11-16"), "snapcal-2026-11-16.png");
});
