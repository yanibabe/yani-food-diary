// "What can I eat with what's left": the app checks the AI's ideas before she sees them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitIdeas, kcalRoom, type RawIdea } from "../app/lib/suggest.ts";

const idea = (name: string, kcal: number, protein: number, extra: Partial<RawIdea> = {}): RawIdea => ({
  name, amount: 1, unit: "ชิ้น", place: "7-eleven", kcal, protein, carbs: 1, fat: 1, why: "", ...extra,
});

test("room: kcal left, or light mode when almost nothing (or less) is left", () => {
  assert.deepEqual(kcalRoom(450.7), { room: 450, light: false });
  assert.deepEqual(kcalRoom(100), { room: 100, light: false });
  assert.deepEqual(kcalRoom(60), { room: 100, light: true });
  assert.deepEqual(kcalRoom(0), { room: 100, light: true });
  assert.deepEqual(kcalRoom(-300), { room: 100, light: true });
});

test("adds the +15% margin, then drops ideas that no longer fit", () => {
  // 300 → 345 fits in 400; 360 → 414 does not.
  const out = fitIdeas([idea("a", 300, 10), idea("b", 360, 30)], 400, []);
  assert.deepEqual(out.map((i) => i.name), ["a"]);
  assert.equal(out[0].kcal, 345);
  assert.equal(out[0].margin, true);
});

test("drops zero kcal and duplicates, most protein first, at most 4", () => {
  const out = fitIdeas(
    [idea("ไข่ต้ม", 70, 6), idea("ไข่ต้ม ", 70, 6), idea("air", 0, 0), idea("อกไก่", 100, 22), idea("c", 50, 1), idea("d", 50, 2), idea("e", 50, 3)],
    800,
    [],
  );
  assert.deepEqual(out.map((i) => i.name), ["อกไก่", "ไข่ต้ม", "e", "d"]);
});

test("recipe ideas use her recipe's real numbers (no margin); unknown recipes are dropped", () => {
  const recipes = [{ id: "r1", name: "ไก่อบสมุนไพร", kcal: 320, protein: 35, carbs: 5, fat: 15 }];
  const out = fitIdeas(
    [idea("wrong name", 100, 1, { place: "recipe", recipeId: "r1" }), idea("ghost", 100, 50, { place: "recipe", recipeId: "nope" })],
    500,
    recipes,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "ไก่อบสมุนไพร");
  assert.equal(out[0].kcal, 320);
  assert.equal(out[0].margin, false);
});

test("light mode keeps only very light ideas", () => {
  const out = fitIdeas([idea("soy milk", 70, 7), idea("onigiri", 180, 5)], -200, []);
  assert.deepEqual(out.map((i) => i.name), ["soy milk"]); // 70 → 80.5 fits in 100; 180 does not
});
