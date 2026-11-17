// Round 48: close results stay up front; not-close USDA rows go behind one link; same food listed once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSuggestions, searchLocal, splitResults, usdaSuggestions, type Suggestion } from "../app/lib/ingredientSearch.ts";
import type { CustomIngredient } from "../app/lib/customIngredients.ts";

const u = (fdcId: number, description: string, kcal: number, extra: Record<string, unknown> = {}) =>
  ({
    fdcId,
    description,
    dataType: "Foundation",
    brand: null,
    category: null,
    nutrients: { kcal, energy: "atwater", protein: 5, carbs: 10, fat: 2, fiber: null, sugar: null, sodiumMg: null, satFat: null, raw: [] },
    per: "g",
    state: null,
    portions: [],
    gPerMl: null,
    ...extra,
  }) as never;

const rows = (): Suggestion[] =>
  usdaSuggestions([
    u(1, "Restaurant, Chinese, fried rice, without meat", 150, { differences: ["name"], close: false }),
    u(2, "Restaurant, Chinese, fried rice, without meat", 150, { differences: ["name"], close: false }),
    u(3, "Rice, fried, NFS", 160, { differences: ["name"], close: false }),
    u(4, "Egg, whole, raw", 143, { differences: [], close: true }),
    u(5, "Egg, white, raw", 52, { differences: [], close: true }),
    u(6, "Egg, yolk, raw", 322, { differences: [], close: true }),
    u(7, "Rice, raw", 360, { differences: ["state"], close: false }),
  ]);

test("same name + same numbers → one row", () => {
  const m = mergeSuggestions([], rows());
  assert.equal(m.filter((s) => s.name.startsWith("Restaurant")).length, 1);
});

test("same name, different numbers → both stay", () => {
  const m = mergeSuggestions([], usdaSuggestions([u(1, "Rice, fried", 150, { differences: ["name"] }), u(2, "Rice, fried", 170, { differences: ["name"] })]));
  assert.equal(m.length, 2);
});

test("close rows are main; name-differs and conflict rows are other", () => {
  const { main, other } = splitResults(mergeSuggestions([], rows()));
  assert.deepEqual(main.map((s) => s.id).sort(), ["usda:4", "usda:5", "usda:6"]);
  assert.equal(other.length, 3);
  assert.ok(other.every((s) => !s.close));
});

test("egg white / yolk / whole stay separate rows", () => {
  const { main } = splitResults(mergeSuggestions([], rows()));
  assert.equal(new Set(main.map((s) => s.name)).size, 3);
});

test("her custom foods and local rows are never hidden", () => {
  const c = { id: "c1", name: "ข้าวผัดกะเพรา", kcal: 500, basis: "perUnit", per: "g", state: null, updatedAt: 1 } as unknown as CustomIngredient;
  const local = searchLocal("ข้าวผัดกะเพรา", { lang: "th", custom: [c] }).items;
  assert.ok(local.length > 0);
  const { main, other } = splitResults(mergeSuggestions(local, rows()));
  for (const l of local) assert.ok(main.some((s) => s.id === l.id));
  assert.ok(other.every((s) => s.kind === "usda"));
});

test("nothing is lost: main + other = all deduped rows", () => {
  const m = mergeSuggestions([], rows());
  const { main, other } = splitResults(m);
  assert.equal(main.length + other.length, m.length);
});

test("no close match at all → main has no USDA rows", () => {
  const { main, other } = splitResults(mergeSuggestions([], rows().filter((s) => !s.close)));
  assert.equal(main.length, 0);
  assert.equal(other.length, 3);
});
