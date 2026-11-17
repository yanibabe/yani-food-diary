// Round 47: the "My ingredients" list helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addCustom, deleteCustom, editCustom, type CustomIngredient } from "../app/lib/customIngredients.ts";
import { basisLabel, filterMine, macroText, sortMine } from "../app/lib/myIngredients.ts";

function build(): CustomIngredient[] {
  let list: CustomIngredient[] = [];
  for (const [name, kcal, state] of [["Zucchini bread", 250, null], ["กะเพราผัด", 180, "prepared"], ["Almond milk", 30, null]] as const) {
    const r = addCustom(list, { name, kcal, state, protein: 1, carbs: null, fat: 2 }, 1, `id_${name}`);
    assert.ok(r.ok);
    if (r.ok) list = r.list;
  }
  return list;
}

test("sort is by name and does not touch the saved order", () => {
  const list = build();
  const before = list.map((c) => c.id);
  const sorted = sortMine(list);
  assert.deepEqual(sorted.map((c) => c.name), ["กะเพราผัด", "Almond milk", "Zucchini bread"]);
  assert.deepEqual(list.map((c) => c.id), before);
});

test("filter by name, state word, case-insensitive; empty = all", () => {
  const list = build();
  assert.equal(filterMine(list, "").length, 3);
  assert.equal(filterMine(list, "ALMOND").length, 1);
  assert.equal(filterMine(list, "กะเพรา").length, 1);
  assert.equal(filterMine(list, "prepared").length, 1);
  assert.equal(filterMine(list, "nothing here").length, 0);
});

test("labels: unknown numbers show ?, never 0", () => {
  const c = build()[0];
  assert.equal(macroText(c), "P 1 · C ? · F 2");
  assert.equal(basisLabel({ basis: "per100", per: "g" }, "en"), "per 100 g");
  assert.equal(basisLabel({ basis: "per100", per: "ml" }, "th"), "ต่อ 100 มล.");
  assert.equal(basisLabel({ basis: "perUnit", per: "g" }, "en"), "per 1 unit");
});

test("edit and delete work on the full list", () => {
  const list = build();
  const e = editCustom(list, "id_Almond milk", { name: "Almond milk", kcal: 40 }, 2);
  assert.ok(e.ok);
  if (e.ok) assert.equal(e.item.kcal, 40);
  const left = deleteCustom(list, "id_Almond milk");
  assert.equal(left.length, 2);
  assert.equal(list.length, 3);
});
