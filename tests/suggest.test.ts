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

test("AI ideas get the +15% margin, then ideas that no longer fit are dropped", () => {
  // 300 → 345 fits in 400; 360 → 414 does not.
  const { seven } = fitAiIdeas([idea("a", 300, 10), idea("b", 360, 30)], 400);
  assert.deepEqual(seven.map((i) => i.name), ["a"]);
  assert.equal(seven[0].kcal, 345);
  assert.equal(seven[0].margin, true);
});

test("ideas are split into 7-Eleven and delivery; delivery must name a shop", () => {
  const out = fitAiIdeas(
    [
      idea("ไข่ต้ม", 70, 6),
      idea("Chicken Salad", 160, 19, { place: "delivery", shop: " Subway " }),
      idea("mystery bowl", 200, 20, { place: "delivery", shop: null }),
    ],
    800,
  );
  assert.deepEqual(out.seven.map((i) => i.name), ["ไข่ต้ม"]);
  assert.equal(out.seven[0].shop, null);
  assert.deepEqual(out.delivery.map((i) => [i.shop, i.name]), [["Subway", "Chicken Salad"]]);
});

test("drops zero kcal and duplicates, most protein first, at most 3 per group", () => {
  const { seven } = fitAiIdeas(
    [idea("ไข่ต้ม", 70, 6), idea("ไข่ต้ม ", 70, 6), idea("air", 0, 0), idea("อกไก่", 100, 22), idea("c", 50, 1), idea("d", 50, 2)],
    800,
  );
  assert.deepEqual(seven.map((i) => i.name), ["อกไก่", "ไข่ต้ม", "d"]);
});

test("recipes: real numbers (no margin), only ones that fit, most protein first", () => {
  const recipes = [
    { id: "r1", name: "ไก่อบสมุนไพร", kcal: 320, protein: 35, carbs: 5, fat: 15 },
    { id: "r2", name: "ข้าวผัด", kcal: 600, protein: 15, carbs: 80, fat: 20 },
    { id: "r3", name: "ไข่ตุ๋น", kcal: 90, protein: 7, carbs: 2, fat: 6 },
  ];
  const out = recipeIdeas(recipes, 500);
  assert.deepEqual(out.map((i) => i.recipeId), ["r1", "r3"]);
  assert.equal(out[0].kcal, 320);
  assert.equal(out[0].margin, false);
});

test("light mode keeps only very light ideas", () => {
  const { seven } = fitAiIdeas([idea("soy milk", 70, 7), idea("onigiri", 180, 5)], -200);
  assert.deepEqual(seven.map((i) => i.name), ["soy milk"]); // 70 → 80.5 fits in 100; 180 does not
});
