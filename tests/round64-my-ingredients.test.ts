// Round 64: the "Add my ingredient" form logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createErrorText, createFromDraft, draftToInput, emptyDraft } from "../app/lib/createIngredientForm.ts";

const tr = (th: string, en: string) => en;
const ok = (name: string, kcal: number | null) => ({ ...emptyDraft(), name, kcal });

test("blank protein/carbs/fat stay unknown (null), never 0", () => {
  const r = createFromDraft([], ok("Chilli paste", 250), 1);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual([r.item.protein, r.item.carbs, r.item.fat], [null, null, null]);
});

test("name and kcal are required", () => {
  const a = createFromDraft([], ok("  ", 10), 1);
  const b = createFromDraft([], ok("Rice", null), 1);
  assert.deepEqual([a.ok, !a.ok && a.error], [false, "name"]);
  assert.deepEqual([b.ok, !b.ok && b.error], [false, "kcal"]);
});

test("unit / ml / state map into the input", () => {
  const i = draftToInput({ ...ok("Milk", 60), basis: "ml", state: "raw" });
  assert.equal(i.per, "ml");
  assert.equal(i.basis, "per100");
  assert.equal(i.state, "raw");
  assert.equal(draftToInput({ ...ok("Egg", 70), basis: "unit" }).basis, "perUnit");
});

test("duplicate is refused, list untouched; new item goes first", () => {
  const first = createFromDraft([], ok("Rice", 130), 1);
  assert.ok(first.ok);
  if (!first.ok) return;
  const dup = createFromDraft(first.list, ok("rice", 99), 2);
  assert.equal(dup.ok, false);
  assert.equal(first.list[0].kcal, 130);
  const second = createFromDraft(first.list, ok("Oats", 380), 3);
  assert.ok(second.ok);
  if (second.ok) assert.equal(second.list[0].name, "Oats");
});

test("friendly error text for every kind", () => {
  for (const e of ["name", "kcal", "number", "duplicate"] as const) assert.ok(createErrorText(e, tr).length > 5);
});
