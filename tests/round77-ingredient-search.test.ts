// Round 77: "add ingredient" finds plain foods. Live USDA can answer with 12 odd foods (potato flour,
// potato pancakes…) and no plain one; the bundled food table is searched too and both are ranked together.
// A fake USDA client is used: no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchUsda } from "../app/lib/food/usdaSearch.ts";
import { UsdaError } from "../app/lib/food/usda.ts";
import { dbFoodToUsda, localUsdaFood } from "../app/lib/food/usdaLocal.ts";
import { foodById } from "../app/lib/server/foodDb.ts";
import { normalizeUsdaFood, toSnap, type UsdaFood } from "../app/lib/food/usdaNutrients.ts";
import { findRef } from "../app/lib/foodRef.ts";

// What live USDA really answered for "potato": none of them is a plain potato.
function fake(id: number, description: string, dataType: "foundation" | "sr" | "fndds", kcal = 100): UsdaFood {
  return normalizeUsdaFood({ fdcId: id, description, dataType: { foundation: "Foundation", sr: "SR Legacy", fndds: "Survey (FNDDS)" }[dataType], foodNutrients: [{ nutrientId: 1008, unitName: "KCAL", value: kcal }, { nutrientId: 1003, unitName: "G", value: 2 }] })!;
}
const BAD_POTATO: UsdaFood[] = [
  fake(2709554, "Stewed potatoes", "fndds"),
  fake(2261422, "Flour, potato", "foundation"),
  fake(167943, "Bread, potato", "sr"),
  fake(168446, "Potato flour", "sr"),
  fake(170092, "Potato pancakes", "sr"),
  fake(2709556, "Potato patty", "fndds"),
  fake(2709560, "Soup, potato", "fndds"),
  fake(2709382, "Potato, NFS", "fndds"),
  fake(2709570, "Gnocchi", "fndds"),
  fake(2709571, "Potato puffs", "fndds"),
  fake(2709572, "Potato salad", "fndds"),
  fake(2709573, "Potato chips", "fndds"),
];
const client = (foods: UsdaFood[]) => ({ search: async () => foods });
const failing = (code: UsdaError["code"] = "network") => ({ search: async (): Promise<UsdaFood[]> => { throw new UsdaError(code, "down"); } });

function plainPotato(d: string) {
  return /^potato/i.test(d) && /\b(raw|boiled|baked)\b/i.test(d);
}

for (const name of ["potatoes", "potato", "มันฝรั่ง"]) {
  test(`"${name}": a plain potato is in the top 3 even when live USDA has none`, async () => {
    const out = await searchUsda(client(BAD_POTATO), { name }, null);
    assert.equal(out.query, name === "มันฝรั่ง" ? "potato" : name);
    if (name === "มันฝรั่ง") assert.equal(out.queryFrom, "alias");
    const top = out.results.slice(0, 3).map((r) => r.description);
    assert.ok(top.some(plainPotato), `top 3 was: ${top.join(" | ")}`);
    assert.ok(out.results.length <= 16);
    // processed products are not above the plain ones
    const firstBad = out.results.findIndex((r) => /flour|bread|soup|pancake|chips|puffs|gnocchi/i.test(r.description));
    const firstPlain = out.results.findIndex((r) => plainPotato(r.description));
    assert.ok(firstPlain >= 0 && (firstBad < 0 || firstPlain < firstBad));
  });
}

test("the same food from live USDA and the table is listed once", async () => {
  const live = [fake(170026, "Potatoes, flesh and skin, raw", "sr", 77), ...BAD_POTATO];
  const out = await searchUsda(client(live), { name: "potato" }, null);
  assert.equal(out.results.filter((r) => r.fdcId === 170026).length, 1);
});

test("live USDA down: local foods still answer, no error", async () => {
  for (const code of ["network", "timeout", "not-configured", "rate-limited"] as const) {
    const out = await searchUsda(failing(code), { name: "potatoes" }, null);
    assert.ok(out.results.length >= 3);
    assert.ok(plainPotato(out.results[0].description), out.results[0].description);
  }
});

test("live USDA down and nothing local: the error is still raised", async () => {
  await assert.rejects(searchUsda(failing(), { name: "zzzqqq" }, null), UsdaError);
});

test("branded search is untouched (no local foods)", async () => {
  let types: string[] = [];
  const out = await searchUsda({ search: async (_q, t) => ((types = t), []) }, { name: "potato", branded: true }, null);
  assert.deepEqual(types, ["branded"]);
  assert.equal(out.results.length, 0);
});

test("detail from the food table: same shape as a USDA row, per 100 g, portions, unknown stays null", () => {
  const f = localUsdaFood(170438)!;
  assert.equal(f.description, "Potatoes, boiled, cooked in skin, flesh, without salt");
  assert.equal(f.dataType, "sr");
  assert.equal(f.per, "g");
  assert.equal(f.state, "cooked");
  assert.equal(f.nutrients.kcal, 87);
  assert.equal(f.nutrients.energy, "1008");
  assert.equal(f.nutrients.satFat, null); // the table has no saturated fat: unknown, not 0
  assert.ok(f.portions.some((p) => p.label === "0.5 cup" && p.grams === 78 && p.ml === 120));
  const snap = toSnap(f)!; // the phone can freeze it like any USDA pick
  assert.equal(snap.fdcId, 170438);
  assert.equal(snap.per100.kcal, 87);
  assert.equal(localUsdaFood(99999999), null); // not in the table → the route asks live USDA
  assert.equal(localUsdaFood(-1), null);
});

test("a missing nutrient in the table stays null (never 0)", () => {
  const row = { ...foodById("2346401")!, per100: { ...foodById("2346401")!.per100, protein: null, fiber: null } };
  const f = dbFoodToUsda(row)!;
  assert.equal(f.nutrients.protein, null);
  assert.equal(f.nutrients.fiber, null);
  assert.equal(toSnap(f)!.missing?.includes("protein"), true);
});

test("reference rows (ref:…) are not turned into USDA foods", () => {
  const out = dbFoodToUsda({ id: "ref:egg", src: "r", name: "egg", per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: null, sugar: null, sodiumMg: null }, portions: [] });
  assert.equal(out, null);
});

test("the app's own Thai list now knows potato (raw and boiled)", () => {
  assert.equal(findRef("มันฝรั่งต้ม")?.key, "potato-boiled");
  assert.equal(findRef("potato")?.key, "potato");
  assert.equal(findRef("มันฝรั่งดิบ")?.key, "potato");
});

// Spot checks: with live-like answers that lack the plain food, the plain food still comes first.
const SPOT: [string, RegExp, UsdaFood[]][] = [
  ["carrot", /^Carrots, (mature, )?raw/, [fake(2709677, "Carrots, glazed, cooked", "fndds"), fake(169871, "Babyfood, carrots, toddler", "sr"), fake(2707845, "Muffin, carrot", "fndds")]],
  ["broccoli", /^Broccoli, raw/, [fake(2709656, "Fried broccoli", "fndds"), fake(170382, "Broccoli raab, cooked", "sr")]],
  ["banana", /^Bananas?, (overripe, )?raw/, [fake(167629, "Melon, banana (Navajo)", "sr"), fake(169394, "Pepper, banana, raw", "sr"), fake(2709225, "Banana, baked", "fndds")]],
  ["chicken breast", /^Chicken, breast.*raw/, [fake(174608, "Chicken breast, roll, oven-roasted", "sr"), fake(2705964, "Chicken breast, rotisserie, skin not eaten", "fndds")]],
  ["egg", /^Eggs?, /, [fake(174901, "Bagels, egg", "sr"), fake(172673, "Bread, egg", "sr"), fake(168772, "Egg custards, dry mix", "sr")]],
];
for (const [q, want, bad] of SPOT) {
  test(`spot check "${q}": plain food in the top 3`, async () => {
    const out = await searchUsda(client(bad), { name: q }, null);
    const top = out.results.slice(0, 3).map((r) => r.description);
    assert.ok(top.some((d) => want.test(d)), `top 3 was: ${top.join(" | ")}`);
  });
}

test("peel-only and egg-part foods are not the plain food", async () => {
  const out = await searchUsda(client(BAD_POTATO), { name: "potatoes" }, null);
  const top = out.results.slice(0, 8).map((r) => r.description);
  assert.ok(!top.some((d) => /, skin( only)?(,|$)/i.test(d) && !/flesh/i.test(d)), top.join(" | "));
  assert.ok(top.some((d) => /flesh and skin, raw/i.test(d)), top.join(" | "));
  const egg = await searchUsda(client([]), { name: "egg" }, null);
  assert.match(egg.results[0].description, /whole/i);
});
