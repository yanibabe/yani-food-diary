import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLabelFix, findFix, fixIsValid, removeFix, upsertFix, type LabelFix } from "../app/lib/food/labelFix.ts";
import type { Food } from "../app/lib/food/provider.ts";

// Her real case: Open Food Facts said 300 kcal / 100 g, serving 30 g; the pack says 20 g = 70 kcal.
const taro: Food = { source: "off", sourceId: "8850000000001", name: "Taro", brand: null, servingSize: "30 g", kcal: 300, protein: 26.7, carbs: 50, fat: 0 };
const fix: LabelFix = { code: "8850000000001", servingG: 20, liquid: false, kcal: 70, protein: null, carbs: null, fat: null, updatedAt: 1 };

test("applyLabelFix: 20 g pack = 70 kcal → 350 kcal per 100 g, 20 g eaten = 70 kcal", () => {
  const f = applyLabelFix(taro, fix);
  assert.equal(f.kcal, 350);
  assert.equal(f.servingSize, "20 g");
  assert.equal(((f.kcal ?? 0) * 20) / 100, 70);
  assert.equal(f.protein, 26.7); // blank in the fix → database number kept
  const g = applyLabelFix(taro, { ...fix, protein: 4, fat: 1 });
  assert.equal(g.protein, 20);
  assert.equal(g.fat, 5);
  assert.equal(applyLabelFix(taro, { ...fix, liquid: true }).servingSize, "20 mL");
});

test("fixIsValid", () => {
  assert.ok(fixIsValid({ servingG: 20, kcal: 70 }));
  assert.ok(fixIsValid({ servingG: 20, kcal: 0 }));
  assert.ok(!fixIsValid({ servingG: 0, kcal: 70 }));
  assert.ok(!fixIsValid({ servingG: 20, kcal: NaN }));
});

test("find / upsert / remove by barcode", () => {
  let list = upsertFix([], fix);
  list = upsertFix(list, { ...fix, kcal: 72 });
  assert.equal(list.length, 1);
  assert.equal(findFix(list, fix.code)?.kcal, 72);
  assert.equal(findFix(list, "123"), null);
  assert.deepEqual(removeFix(list, fix.code), []);
});
