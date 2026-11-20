// Phase 2C-1: recent meals in the Add Food sheet, soft secondary buttons, unified AI wording.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPEAT_LOCK_MS, repeatSlot, SHEET_RECENT_COUNT } from "../app/lib/repeat.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/page.tsx");
const addFlow = read("../app/components/AddFlow.tsx");
const barcode = read("../app/components/BarcodeLookup.tsx");
const review = read("../app/components/MealReview.tsx");
const ingredient = read("../app/components/AddIngredientSheet.tsx");

test("sheet shows at most 3 recent meals", () => {
  assert.equal(SHEET_RECENT_COUNT, 3);
  assert.match(page, /recent\.slice\(0, SHEET_RECENT_COUNT\)/);
  assert.match(page, /data-testid="recent-meals"/);
  assert.match(page, /data-testid="recent-meal-item"/);
});

test("repeatSlot: today uses the meal slot at open, other days keep the original slot", () => {
  assert.equal(repeatSlot({ slot: "breakfast" }, "2026-11-20", "2026-11-20", "lunch"), "lunch");
  assert.equal(repeatSlot({ slot: "breakfast" }, "2026-11-18", "2026-11-20", "lunch"), "breakfast");
  assert.equal(repeatSlot({ slot: "dinner" }, "2026-11-21", "2026-11-20", "snack"), "dinner");
});

test("eatAgain ignores double taps and reuses copyMeal", () => {
  assert.equal(REPEAT_LOCK_MS, 900);
  assert.match(page, /if \(repeatLocked\.current\) return;/);
  assert.match(page, /repeatLocked\.current = true;/);
  assert.match(page, /REPEAT_LOCK_MS/);
  assert.match(page, /copyMeal\(e, date, repeatSlot\(e, date, today, slotAtOpen\)\)/);
});

test("see-all keeps the full Repeat view entry point", () => {
  assert.match(page, /data-testid="eat-again-tile"/);
  assert.match(page, /setAgainView\(true\)/);
});

test("each recent row names its destination meal", () => {
  assert.match(page, /data-testid="recent-meal-where"/);
  assert.match(page, /บันทึกเป็น/);
});

test("recipes and manual entry are soft buttons", () => {
  assert.match(page, /data-testid="add-sheet-links"/);
  assert.match(page, /data-testid="add-sheet-recipes"/);
  assert.match(page, /data-testid="add-sheet-manual"/);
  assert.match(page, /openLayer\(\{ ?kind: "manual" ?\}\)/);
});

test("AI estimate wording is unified (no old วิเคราะห์ / Check with AI button)", () => {
  for (const src of [addFlow, barcode, ingredient]) assert.doesNotMatch(src, /Check with AI/);
  assert.match(addFlow, /ให้ AI ประมาณแคลอรี/);
  assert.match(addFlow, /Let AI estimate/);
  assert.match(barcode, /ถ่ายรูปอาหารให้ AI ประมาณแคลอรี/);
  assert.match(ingredient, /ให้ AI ประมาณแคลอรี/);
});

test("the four AI kinds stay distinct", () => {
  assert.match(review, /อธิบายเพิ่ม/);
  assert.match(read("../app/components/ChatFab.tsx"), /ถามผู้ช่วย/);
  assert.match(page, /เหลือเท่านี้ กินอะไรดี/);
});

test("lock resets itself, so a later repeat is allowed; saves are instant (no pending async save)", () => {
  assert.match(page, /setTimeout\(\(\) => \{\s*repeatLocked\.current = false;\s*\}, REPEAT_LOCK_MS\)/);
  const store = read("../app/lib/store.tsx");
  assert.doesNotMatch(store.slice(store.indexOf("const upsertEntry"), store.indexOf("const deleteEntry")), /await |\.then\(/);
});

test("two legitimate repeats of one meal make two separate records on any date", async () => {
  const { copyMeal } = await import("../app/lib/repeat.ts");
  const e = { id: "en_1", date: "2026-11-01", slot: "breakfast", title: "x", items: [{ id: "it_1", name: "x", amount: 1, unit: "u", kcal: 100 }], recipe: null, createdAt: 1, updatedAt: 1 } as never;
  const a = copyMeal(e, "2026-11-18", "breakfast", 10);
  const b = copyMeal(e, "2026-11-18", "breakfast", 5000);
  assert.notEqual(a.id, b.id);
  assert.equal(a.date, "2026-11-18");
  assert.notEqual(a.items[0].id, b.items[0].id);
});
