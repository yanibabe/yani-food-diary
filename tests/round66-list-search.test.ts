import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterByName } from "../app/components/recipeFilter.ts";
import { filterMine, sortMine } from "../app/lib/myIngredients.ts";
import type { CustomIngredient } from "../app/lib/customIngredients.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/recipes/page.tsx");
const mine = read("../app/components/MyIngredients.tsx");

test("recipe filter: case-insensitive, trimmed, empty = all", () => {
  const l = [{ name: "Tom Yum" }, { name: "ผัดกะเพรา" }];
  assert.equal(filterByName(l, "  tom ").length, 1);
  assert.equal(filterByName(l, "").length, 2);
  assert.equal(filterByName(l, "zzz").length, 0);
});

test("ingredient filter finds by name", () => {
  const mk = (name: string) => ({ name, state: null, aliases: [] }) as unknown as CustomIngredient;
  const l = sortMine([mk("Watermelon"), mk("Rice")]);
  assert.deepEqual(filterMine(l, "water").map((c) => c.name), ["Watermelon"]);
});

test("page hides empty groups when searching and shows matches open", () => {
  assert.ok(page.includes("matched.filter("));
  assert.ok(page.includes(".filter(\n    (g) => g.items.length > 0"));
  assert.ok(page.includes("searching ? groups.map((g) => g.key)"));
});

test("header has + and magnifier for both tabs", () => {
  for (const id of ["new-recipe", "my-ingredients-add", "list-search-toggle"]) assert.ok(page.includes(`data-testid="${id}"`), id);
  assert.ok(read("../app/components/ListSearchField.tsx").includes('data-testid="list-search-input"'));
});

test("ingredient rows have no Edit/Delete buttons; delete lives in the sheet", () => {
  assert.equal(mine.includes("ai-custom-edit-btn"), false);
  assert.equal(mine.includes("ai-custom-delete"), false);
  assert.ok(read("../app/components/IngredientEditForm.tsx").includes("{ ...item, name: draft.name"));
});
