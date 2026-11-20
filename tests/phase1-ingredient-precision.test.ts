// Phase 1, issue 4: saving a searched food as "my ingredient" must keep its per-100 g numbers,
// even when the amount in the search row is small.
import test from "node:test";
import assert from "node:assert/strict";
import { customInputFromItem, customInputFromIngredient } from "../app/lib/saveCustomFromItem.ts";
import { ingredientToItem } from "../app/lib/searchFood.ts";
import { ingredientMacros } from "../app/lib/recipe.ts";
import type { Ingredient } from "../app/lib/types.ts";

const per100 = { kcal: 52, protein: 0.26, carbs: 13.81, fat: 0.17 };
const apple = (amount: number, unit: "g" | "kg" = "g"): Ingredient => ({
  id: "i", name: "Apple", amount, unit, label: null, gramsPerUnit: null, photoId: null,
  aiRef: { name: "Apple", per100, unitG: null, gPerMl: null },
});

test("the old route (rounded item → per 100 g) distorts small amounts: this is the bug", () => {
  const item = ingredientToItem(apple(1), "x", "en", 0)!;
  const old = customInputFromItem(item)!;
  assert.equal(old.kcal, 100); // 52 kcal/100 g became 100 kcal/100 g
});

test("the new route keeps the exact per-100 g numbers for any amount", () => {
  for (const amount of [1, 2, 5, 37, 100, 250]) {
    const ing = apple(amount);
    const input = customInputFromIngredient(ing, "en")!;
    assert.ok(Math.abs((input.kcal as number) - 52) < 1e-9, `amount ${amount}: kcal ${input.kcal}`);
    assert.ok(Math.abs((input.protein as number) - 0.26) < 1e-9);
    assert.ok(Math.abs((input.carbs as number) - 13.81) < 1e-9);
    assert.ok(Math.abs((input.fat as number) - 0.17) < 1e-9);
    assert.equal(input.basis, "per100");
    assert.equal(input.per, "g");
  }
});

test("other units keep their old meaning (per 1 unit), just without the rounding", () => {
  const input = customInputFromIngredient(apple(0.2, "kg"), "en")!;
  assert.equal(input.basis, "perUnit");
  assert.ok(Math.abs((input.kcal as number) - 520) < 1e-9); // 52 kcal/100 g = 520 kcal per kg
});

test("a food whose numbers are not known yet gives nothing to save (never zeros)", () => {
  const noData: Ingredient = { id: "i", name: "Mystery food zzz", amount: 100, unit: "g", label: null, gramsPerUnit: null, photoId: null };
  assert.equal(customInputFromIngredient(noData, "en"), null);
});

test("normal amounts still match the old route (no regression where rounding did not matter)", () => {
  const item = ingredientToItem(apple(100), "x", "en", 0)!;
  const a = customInputFromItem(item)!;
  const b = customInputFromIngredient(apple(100), "en")!;
  assert.ok(Math.abs((a.kcal as number) - (b.kcal as number)) < 0.6);
  assert.equal(ingredientMacros(apple(100)).ok, true);
});
