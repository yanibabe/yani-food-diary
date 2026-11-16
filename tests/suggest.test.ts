// "What can I eat with what's left": the app checks every idea before she sees it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitAiIdeas, kcalRoom, recipeIdeas, type RawIdea } from "../app/lib/suggest.ts";

const idea = (name: string, kcal: number, protein: number, extra: Partial<RawIdea> = {}): RawIdea => ({
  name, amount: 1, unit: "ชิ้น", place: "7-eleven", kcal, protein, carbs: 1, fat: 1, why: "", ...extra,
});

test("room: kcal left, or light mode when almost nothing (or less) is left", () => {
  assert.deepEqual(kcalRoom(450.7), { room: 450, light: false });
  assert.deepEqual(kcalRoom(100), { room: 100, light: false });
  assert.deepEqual(kcalRoom(60), { room: 100, light: true });
  assert.deepEqual(kcalRoom(-300), { room: 100, light: true });
});

// Round 40 (updated on purpose): no automatic +15%; her optional buffer is used instead (kcal only).
test("AI ideas: 0% by default; with a 15% buffer, ideas that no longer fit are dropped", () => {
  const plain = fitAiIdeas([idea("a", 300, 10), idea("b", 360, 30)], 400);
  assert.deepEqual(plain.seven.map((i) => i.name), ["b", "a"]);
  assert.equal(plain.seven[1].kcal, 300);
  assert.equal(plain.seven[1].bufferPct, 0);
  // 300 → 345 fits in 400; 360 → 414 does not.
  const { seven } = fitAiIdeas([idea("a", 300, 10), idea("b", 360, 30)], 400, undefined, 15);
  assert.deepEqual(seven.map((i) => i.name), ["a"]);
  assert.equal(seven[0].kcal, 345);
  assert.equal(seven[0].aiKcal, 300);
  assert.equal(seven[0].bufferPct, 15);
  assert.equal(seven[0].protein, 10); // never buffered
});

test("ideas are split into 7-Eleven and menu; a menu idea needs ingredients and steps", () => {
  const out = fitAiIdeas(
    [
      idea("ไข่ต้ม", 70, 6, { ingredients: ["should be dropped"], steps: ["x"] }),
      idea("ยำอกไก่", 220, 32, { place: "menu", ingredients: [" อกไก่ 150 g ", ""], steps: ["ต้ม", "คลุก"] }),
      idea("no recipe", 200, 20, { place: "menu", ingredients: null, steps: null }),
      idea("no steps", 200, 20, { place: "menu", ingredients: ["ไข่"], steps: [] }),
    ],
    800,
  );
  assert.deepEqual(out.seven.map((i) => i.name), ["ไข่ต้ม"]);
  assert.deepEqual(out.seven[0].ingredients, []);
  assert.deepEqual(out.menu.map((i) => i.name), ["ยำอกไก่"]);
  assert.deepEqual(out.menu[0].ingredients, ["อกไก่ 150 g"]);
  assert.deepEqual(out.menu[0].steps, ["ต้ม", "คลุก"]);
  assert.equal(out.menu[0].aiKcal, 220);
  assert.equal(out.menu[0].bufferPct, 0);
});

test("drops zero kcal and duplicates, most protein first, at most 3 per group", () => {
  const { seven } = fitAiIdeas(
    [idea("ไข่ต้ม", 70, 6), idea("ไข่ต้ม ", 70, 6), idea("air", 0, 0), idea("อกไก่", 100, 22), idea("c", 50, 1), idea("d", 50, 2)],
    800,
  );
  assert.deepEqual(seven.map((i) => i.name), ["อกไก่", "ไข่ต้ม", "d"]);
});

test("recipes: real numbers (no buffer), only ones that fit, most protein first", () => {
  const recipes = [
    { id: "r1", name: "ไก่อบสมุนไพร", kcal: 320, protein: 35, carbs: 5, fat: 15 },
    { id: "r2", name: "ข้าวผัด", kcal: 600, protein: 15, carbs: 80, fat: 20 },
    { id: "r3", name: "ไข่ตุ๋น", kcal: 90, protein: 7, carbs: 2, fat: 6 },
  ];
  const out = recipeIdeas(recipes, 500);
  assert.deepEqual(out.map((i) => i.recipeId), ["r1", "r3"]);
  assert.equal(out[0].kcal, 320);
  assert.equal(out[0].aiKcal, null);
  assert.equal(out[0].bufferPct, 0);
});

test("light mode keeps only very light ideas", () => {
  const { seven } = fitAiIdeas([idea("soy milk", 70, 7), idea("onigiri", 180, 5)], -200);
  assert.deepEqual(seven.map((i) => i.name), ["soy milk"]); // 70 → 80.5 fits in 100; 180 does not
});
