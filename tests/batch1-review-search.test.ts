// Batch 1: ranking of the two "yours" groups, one-tap amounts, and the calmer Meal Review (source checks).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quickAmounts } from "../app/lib/quantityHints.ts";
import { topGroupFirst } from "../app/lib/unifiedSearch.ts";
import { UNITS, type IngredientUnit } from "../app/lib/types.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const review = read("../app/components/MealReview.tsx");
const ingSheet = read("../app/components/AddIngredientSheet.tsx");
const page = read("../app/page.tsx");

test("quickAmounts gives positive usual numbers for every unit", () => {
  for (const u of Object.keys(UNITS) as IngredientUnit[]) {
    const a = quickAmounts(u);
    assert.ok(a.length >= 3 && a.every((n) => n > 0), u);
  }
  assert.deepEqual(quickAmounts("g"), [50, 100, 150, 200]);
  assert.deepEqual(quickAmounts("egg"), [0.5, 1, 2, 3]);
});

test("topGroupFirst: recipes lead only when clearly better", () => {
  assert.equal(topGroupFirst(null, null), "recipes");
  assert.equal(topGroupFirst(2, null), "logged");
  assert.equal(topGroupFirst(null, 1), "recipes");
  assert.equal(topGroupFirst(1, 1), "logged");
  assert.equal(topGroupFirst(2, 0), "recipes");
  assert.equal(topGroupFirst(0, 2), "logged");
});

test("page orders the two groups by topGroupFirst, ingredients stay last", () => {
  assert.match(page, /topGroupFirst\(/);
  assert.match(page, /order-3/);
});

test("amount chips only fill the Amount box; the maths is not touched", () => {
  assert.match(ingSheet, /onClick=\{\(\) => setAmount\(n\)\}/);
  assert.match(ingSheet, /onClick=\{\(\) => setUnit\(u\)\}/);
  assert.match(ingSheet, /data-testid="ai-unit"/); // the full unit list is still there
  assert.doesNotMatch(read("../app/lib/quantityHints.ts"), /kcal|macros|ingredientMacros/i);
});

test("Meal Review: Save bar is sticky, Cancel is the quiet one", () => {
  assert.match(review, /data-testid="review-actions"/);
  assert.match(review, /sticky bottom-0/);
  const bar = review.slice(review.indexOf('data-testid="review-actions"'));
  assert.ok(bar.indexOf("btn-soft") < bar.indexOf("btn-primary"));
});

test("Meal Review: AI box and 'Save as' start folded; AI box opens by itself when the AI asked something", () => {
  assert.match(review, /useState\(!!firstQuestion\)/);
  assert.match(review, /const aiMoreOpen = aiOpen \|\| sending/);
  assert.match(review, /data-testid="slot-toggle"/);
  assert.match(review, /const \[slotOpen, setSlotOpen\] = useState\(false\)/);
});

test("Item editor: protein/carbs/fat fold away but open by themselves when a value is unknown", () => {
  assert.match(review, /useState\(\(\) => !!item\.missing\?\.length\)/);
  assert.match(review, /data-testid="item-nutrients-toggle"/);
  // every field and warning is still there
  for (const id of ['id="it-kcal"', 'id="it-p"', 'id="it-c"', 'id="it-f"', "<EnergyHint", 'checked={item.estimated}']) assert.ok(review.includes(id), id);
});

test("Item editor: Done is the primary button, Delete is quiet", () => {
  assert.match(review, /btn-primary w-full" onClick=\{onDone\}/);
  assert.match(review, /text-danger" onClick=\{onDelete\}/);
});

test("AI wording: no old analyse / check-with-AI wording left in screens", () => {
  for (const f of ["../app/page.tsx", "../app/components/AddFlow.tsx", "../app/components/MealReview.tsx", "../app/components/BarcodeLookup.tsx"]) assert.doesNotMatch(read(f), /Check with AI|วิเคราะห์/);
});

test("sticky Save bar leaves scroll room so a focused field is never hidden under it", () => {
  const css = read("../app/globals.css");
  assert.match(css, /\.add-layer,\s*html\s*\{\s*scroll-padding-bottom:\s*104px/);
});
