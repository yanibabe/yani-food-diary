// Round 71: the share-day picture layout (heights, missing pictures, totals).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareDay } from "../app/lib/shareDay.ts";
import { CARD_MIN_H, CARD_W, layoutShareCard, wrapText, type CardInput, type Cmd, type Measure } from "../app/lib/shareCard.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";
import type { MealPics } from "../app/lib/mealPics.ts";

/** A fake ruler: every letter is about half its size wide (Thai and English alike). */
const measure: Measure = (t, size) => Array.from(t).length * size * 0.5;

const item = (name: string, kcal: number, p: number, c: number, f: number, amount = 1, unit = "จาน", estimated = false): FoodItem => ({
  id: name, name, amount, unit, kcal, protein: p, carbs: c, fat: f, estimated, kind: "food", note: null, box: null,
});
const entry = (id: string, slot: Entry["slot"], title: string, items: FoodItem[], createdAt: number, photoId: string | null = null): Entry => ({
  id, date: "2026-11-18", slot, title, items, source: "manual", photoId, recipe: null, createdAt, updatedAt: createdAt,
});
const input = (entries: Entry[], pics: MealPics = {}, extra: Partial<CardInput> = {}): CardInput => ({
  day: buildShareDay(entries, "2026-11-18", pics),
  date: "2026-11-18", dateLabel: "วันพุธ 18 พ.ย. 2569", name: "Yani", target: 1800,
  macroTargets: { protein: 90, carbs: 220, fat: 60 }, water: { glasses: 0, goal: 8 }, lang: "th", ...extra,
});
const texts = (cmds: Cmd[]) => cmds.flatMap((c) => (c.t === "text" ? [c.s] : []));

test("empty day: still a full-size portrait with a quiet line", () => {
  const card = layoutShareCard(input([]), measure);
  assert.equal(card.w, CARD_W);
  assert.equal(card.h, CARD_MIN_H);
  assert.ok(texts(card.cmds).includes("ยังไม่ได้บันทึกอาหาร"));
});

test("one meal, no picture: soft tile, no pic command, totals and macros shown", () => {
  const card = layoutShareCard(input([entry("a", "lunch", "ข้าวมันไก่", [item("ข้าวมันไก่", 600, 25, 70, 22)], 1)]), measure);
  assert.equal(card.cmds.filter((c) => c.t === "pic").length, 0);
  const t = texts(card.cmds);
  assert.ok(t.includes("600"));
  assert.ok(t.includes("25") && t.includes("70") && t.includes("22"));
  assert.ok(t.includes("/ 90 g"));
  assert.ok(t.some((s) => s.startsWith("ข้าวมันไก่ 1 จาน")));
  assert.equal(card.h, CARD_MIN_H);
});

test("picture comes from the dish map first, then the meal's own photo", () => {
  const pics: MealPics = { "ข้าวมันไก่": { photoId: "pic-1", visual: "", createdAt: 1 } };
  const day = buildShareDay(
    [entry("a", "lunch", "ข้าวมันไก่", [item("x", 1, 1, 1, 1)], 1, "own-9"), entry("b", "dinner", "ต้มยำ", [item("y", 1, 1, 1, 1)], 2, "own-8"), entry("c", "snack", "ชา", [item("z", 1, 1, 1, 1)], 3)],
    "2026-11-18",
    pics,
  );
  assert.deepEqual(day.slots.flatMap((s) => s.meals.map((m) => m.picId)), ["pic-1", "own-8", null]);
  const card = layoutShareCard({ ...input([]), day }, measure);
  assert.deepEqual(card.cmds.flatMap((c) => (c.t === "pic" ? [c.id] : [])), ["pic-1", "own-8"]);
});

test("8+ meals: the picture grows tall, rows never overlap, nothing is cut off", () => {
  const entries = Array.from({ length: 10 }, (_, i) =>
    entry(`m${i}`, (["breakfast", "lunch", "dinner", "snack"] as const)[i % 4], `เมนูที่ ${i + 1} ข้าวผัดกระเพราหมูสับไข่ดาวราดข้าวสวยร้อนๆ พิเศษมากๆๆ`, [item("ข้าวสวย", 240, 4, 52, 1, 150, "กรัม"), item("หมูสับ", 200, 20, 1, 12, 100, "กรัม", true)], i + 1),
  );
  const card = layoutShareCard(input(entries), measure);
  assert.ok(card.h > CARD_MIN_H * 2, `height ${card.h}`);
  assert.equal(card.rows.length, 10);
  const rows = [...card.rows].sort((a, b) => a.y - b.y);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].y >= rows[i - 1].y + rows[i - 1].h - 1);
  // Every drawn thing sits inside the picture
  for (const c of card.cmds) if (c.t === "text") assert.ok(c.y <= card.h && c.y > 0);
  // Long Thai names wrap to at most 2 lines (+ foods lines)
  const titleTexts = texts(card.cmds).filter((s) => s.startsWith("เมนูที่") || s.endsWith("…"));
  assert.ok(titleTexts.length >= 10);
});

test("wrapText: max lines respected, last line ends with an ellipsis when cut, short text untouched", () => {
  const long = "กขคงจฉชซฌญ".repeat(10);
  const lines = wrapText(measure, long, 30, 400, 300, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith("…"));
  for (const l of lines) assert.ok(measure(l, 30, 400) <= 300);
  assert.deepEqual(wrapText(measure, "ข้าว", 30, 400, 300, 2), ["ข้าว"]);
});

test("water and weight chips only when logged; ~ marks only on estimates", () => {
  const e = [entry("a", "breakfast", "โจ๊ก", [item("โจ๊ก", 300, 10, 40, 5, 1, "ถ้วย", true)], 1)];
  const none = texts(layoutShareCard(input(e), measure).cmds);
  assert.ok(!none.includes("น้ำ") && !none.includes("น้ำหนัก"));
  const withBoth = texts(layoutShareCard(input(e, {}, { water: { glasses: 6, goal: 8 }, weightKg: 54.24 }), measure).cmds);
  assert.ok(withBoth.includes("6 / 8 แก้ว"));
  assert.ok(withBoth.includes("54.2 kg"));
  assert.ok(withBoth.includes("~300"));
  assert.ok(withBoth.some((s) => s.includes("โจ๊ก 1 ถ้วย ~")));
  const sure = texts(layoutShareCard(input([entry("a", "lunch", "ไข่", [{ ...item("ไข่", 70, 6, 0, 5), prov: { source: "usda", verification: "verified" } } as FoodItem], 1)]), measure).cmds);
  assert.ok(sure.includes("70"));
});

test("day totals on the card equal the sum of meals", () => {
  const d = buildShareDay([entry("a", "lunch", "a", [item("a", 400.4, 20, 30, 10)], 1), entry("b", "dinner", "b", [item("b", 500.4, 25, 40, 15)], 2)], "2026-11-18");
  assert.equal(d.total.kcal, 400 + 500);
  const t = texts(layoutShareCard({ ...input([]), day: d }, measure).cmds);
  assert.ok(t.includes("900"));
});
