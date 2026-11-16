// Round 41: USDA FoodData Central. Every test uses mocked USDA answers (no key, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UsdaClient, UsdaError, TtlCache, usdaConfig } from "../app/lib/food/usda.ts";
import { mockUsdaFetch, MOCK_FOODS } from "../app/lib/food/usdaMock.ts";
import { mapNutrients, normalizeUsdaFood, toSnap, toUnit, stateFromDescription, readPortions, densityFromPortions, dataTypeOf } from "../app/lib/food/usdaNutrients.ts";
import { attrsOf, compare, englishQuery, isCloseMatch, rankFoods, coreWords } from "../app/lib/food/usdaMatch.ts";
import { searchUsda } from "../app/lib/food/usdaSearch.ts";
import { applyUsdaToItem } from "../app/lib/food/toItem.ts";
import { ingredientMacros, recipeTotals } from "../app/lib/recipe.ts";
import { itemProvenance, sourceLabel, recipeProvenance } from "../app/lib/provenance.ts";
import { canBuffer, startBuffer, bufferSummary, setBuffer } from "../app/lib/calorieBuffer.ts";
import { changeAmount } from "../app/lib/nutrition.ts";
import { makeBackup, parseBackup } from "../app/lib/backup.ts";
import type { FoodItem, Ingredient, UsdaPick } from "../app/lib/types.ts";

const fixture = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const client = (o: Parameters<typeof mockUsdaFetch>[0] = {}) => new UsdaClient({ apiKey: "test-key", fetch: mockUsdaFetch(o), sleep: async () => {}, timeoutMs: 50 });
const food = (id: number) => normalizeUsdaFood(MOCK_FOODS.find((f) => f.fdcId === id))!;
const snapOf = (id: number) => toSnap(food(id), 1)!;
const pick = (id: number, name: string, extra: Partial<UsdaPick> = {}): UsdaPick => ({ ...snapOf(id), name, ...extra });
const ing = (over: Partial<Ingredient>): Ingredient => ({ id: "i1", name: "x", amount: 100, unit: "g", label: null, gramsPerUnit: null, photoId: null, ...over });
const aiItem = (over: Partial<FoodItem> = {}): FoodItem => ({
  id: "a", name: "อกไก่ทอด", amount: 1, unit: "ชิ้น", kcal: 300, protein: 30, carbs: 10, fat: 15, estimated: true, kind: "food", note: null, box: null,
  prov: { source: "ai", verification: "estimated", via: "guess" }, ...over,
});

// ---------------- nutrient ID mapping + units ----------------

test("real USDA details (Foundation chicken breast): kcal from 2048 (no 1008), lower-case units", () => {
  const f = normalizeUsdaFood(fixture("usda-detail-chicken-breast.json"))!;
  assert.equal(f.dataType, "foundation");
  assert.equal(f.nutrients.energy, "2048");
  assert.equal(f.nutrients.kcal, 112.2);
  assert.equal(f.nutrients.protein, 22.53);
  assert.equal(f.nutrients.fat, 1.93);
  assert.equal(f.nutrients.carbs, 0); // a real 0 from USDA, not missing
  assert.equal(f.state, "raw");
  assert.equal(f.nutrients.sodiumMg, 65.75);
});

test("real USDA search hits: nutrientId + upper-case units are read the same way", () => {
  const s = fixture("usda-search-chicken.json");
  const foods = s.foods.map(normalizeUsdaFood);
  const breast = foods.find((f: { fdcId: number }) => f.fdcId === 2646170);
  assert.ok(breast.nutrients.kcal! > 100 && breast.nutrients.kcal! < 120);
  assert.ok(breast.nutrients.protein! > 20);
  const fndds = foods.find((f: { dataType: string }) => f.dataType === "fndds");
  assert.equal(fndds.nutrients.energy, "1008");
});

test("energy priority: 1008 → 2048 → 2047 → kJ ÷ 4.184; never from protein/carbs/fat", () => {
  assert.equal(mapNutrients([{ nutrientId: 2047, unitName: "KCAL", value: 100 }, { nutrientId: 1008, unitName: "KCAL", value: 120 }]).energy, "1008");
  assert.equal(mapNutrients([{ nutrientId: 2047, unitName: "KCAL", value: 100 }, { nutrientId: 2048, unitName: "KCAL", value: 105 }]).kcal, 105);
  const kj = mapNutrients([{ nutrientId: 1062, unitName: "kJ", value: 418.4 }]);
  assert.equal(kj.kcal, 100);
  assert.equal(kj.energy, "kj");
  const none = mapNutrients([{ nutrientId: 1003, unitName: "G", value: 20 }, { nutrientId: 1004, unitName: "G", value: 10 }]);
  assert.equal(none.kcal, null); // never invented from 4/4/9
});

test("units: mg → g; kcal in a kJ unit is ignored; duplicates keep the first usable value", () => {
  assert.equal(toUnit(500, "MG", "g"), 0.5);
  assert.equal(toUnit(100, "kJ", "kcal"), null);
  const n = mapNutrients([
    { nutrientId: 1008, unitName: "kJ", value: 999 }, // wrong unit for 1008 → ignored
    { nutrientId: 1008, unitName: "KCAL", value: 50 },
    { nutrientId: 1003, unitName: "MG", value: 2500 },
    { nutrientId: 1003, unitName: "G", value: 99 }, // duplicate → ignored
  ]);
  assert.equal(n.kcal, 50);
  assert.equal(n.protein, 2.5);
  assert.equal(n.raw.length, 2);
});

test("carbs: 1005 by difference first, then 1050 by summation", () => {
  assert.equal(mapNutrients([{ nutrientId: 1050, unitName: "G", value: 7 }, { nutrientId: 1005, unitName: "G", value: 9 }]).carbs, 9);
  assert.equal(mapNutrients([{ nutrientId: 1050, unitName: "G", value: 7 }]).carbs, 7);
  // old nutrient numbers (abridged format) work too
  assert.equal(mapNutrients([{ number: "205", unitName: "g", amount: 4 }]).carbs, 4);
});

test("missing nutrients stay unknown (null), never 0; the snapshot lists them", () => {
  const laver = food(999001);
  assert.equal(laver.nutrients.fat, null);
  const s = toSnap(laver)!;
  assert.deepEqual(s.missing, ["fat"]);
  const item = applyUsdaToItem(aiItem(), s, 50);
  assert.deepEqual(item.missing, ["fat"]);
  // a food without any energy value can't be used at all
  assert.equal(toSnap(normalizeUsdaFood({ fdcId: 5, dataType: "SR Legacy", description: "X", foodNutrients: [{ nutrientId: 1003, unitName: "G", value: 3 }] })!), null);
});

test("zero-calorie water from USDA is a real 0, not missing", () => {
  const w = toSnap(food(171881))!;
  assert.equal(w.per100.kcal, 0);
  assert.equal(w.missing, undefined);
  const r = ingredientMacros(ing({ name: "น้ำเปล่า", amount: 500, unit: "ml", usda: { ...w, name: "น้ำเปล่า", gPerMl: 1 } }));
  assert.ok(r.ok && r.macros.kcal === 0 && r.missing.length === 0);
  // Round 39.1 unchanged: plain water without USDA is still 0 from the reference table.
  const ref = ingredientMacros(ing({ name: "น้ำเปล่า", amount: 500, unit: "ml" }));
  assert.ok(ref.ok && ref.macros.kcal === 0);
});

test("data types: Foundation / SR Legacy / FNDDS / Branded; others refused", () => {
  assert.equal(dataTypeOf("Survey (FNDDS)"), "fndds");
  assert.equal(dataTypeOf("SR Legacy"), "sr");
  assert.equal(dataTypeOf("Experimental"), null);
  assert.equal(normalizeUsdaFood({ fdcId: 1, dataType: "Experimental", description: "x", foodNutrients: [] }), null);
  const b = food(555001);
  assert.equal(b.dataType, "branded");
  assert.equal(b.brand, "SAMPLE FARM");
});

test("state from USDA description: 'baked … from raw' is cooked, not raw", () => {
  assert.equal(stateFromDescription("Chicken breast, baked, broiled, or roasted, skin eaten, from raw"), "cooked");
  assert.equal(stateFromDescription("Rice, white, long-grain, regular, raw, enriched"), "raw");
  assert.equal(stateFromDescription("Shrimp, dried"), "dried");
});

test("household measures → portions and a density from a cup weight", () => {
  const p = readPortions({ foodPortions: [{ gramWeight: 158, amount: 1, measureUnit: { name: "cup" }, modifier: "" }, { gramWeight: 0, amount: 1 }] });
  assert.equal(p.length, 1);
  assert.equal(p[0].ml, 240);
  assert.equal(densityFromPortions(p), 0.66);
  assert.equal(densityFromPortions([{ label: "1 RACC", grams: 114, ml: null }]), null);
});

// ---------------- Thai → English + matching ----------------

test("raw vs cooked rice: different searches, different foods, both shown — never auto-picked", async () => {
  assert.equal(englishQuery("ข้าวสวย"), "rice white cooked");
  assert.equal(englishQuery("ข้าวสาร"), "rice white raw");
  const cooked = await searchUsda(client(), { name: "ข้าวสวย" }, null);
  assert.equal(cooked.results[0].fdcId, 169757); // cooked first
  assert.ok(cooked.results.find((r) => r.fdcId === 169756)!.differences.includes("state")); // raw rice flagged
  const raw = await searchUsda(client(), { name: "ข้าวสาร" }, null);
  assert.equal(raw.results[0].fdcId, 169756);
  assert.ok(raw.results.find((r) => r.fdcId === 169757)!.differences.includes("state"));
  // "beans and white rice" never looks like plain rice
  const mixed = cooked.results.find((r) => r.fdcId === 2708990)!;
  assert.ok(mixed.differences.includes("food"));
  assert.equal(mixed.close, false);
  // "meat and skin" is not a mixed dish
  assert.ok(!compare(food(2727569), "อกไก่ติดหนังดิบ", "chicken breast meat and skin raw").differences.includes("food"));
});

test("plain 'ข้าว' (raw or cooked not said) is never a 'close match'", async () => {
  const out = await searchUsda(client(), { name: "ข้าว" }, null);
  assert.ok(out.results.length >= 2);
  assert.ok(out.results.every((r) => !r.close));
});

test("chicken cuts and preparation: breast ≠ thigh, skinless ≠ skin-on, fried ≠ roasted, raw ≠ cooked", async () => {
  assert.equal(englishQuery("อกไก่ไม่ติดหนัง"), "chicken breast skinless");
  assert.equal(englishQuery("อกไก่ทอด"), "chicken breast fried");
  const a = attrsOf("อกไก่ติดหนัง");
  assert.equal(a.cut, "breast");
  assert.equal(a.skin, true);
  assert.equal(attrsOf("Chicken breast, baked, broiled, or roasted, skin not eaten, from raw").skin, false);

  const out = await searchUsda(client(), { name: "อกไก่ไม่ติดหนัง" }, null);
  const by = (id: number) => out.results.find((r) => r.fdcId === id)!;
  assert.equal(out.results[0].fdcId, 2646170); // skinless raw breast first
  assert.ok(by(2727569).differences.includes("skin"));
  const thigh = rankFoods([food(171140)], "อกไก่", "chicken breast")[0];
  assert.ok(thigh.differences.includes("cut"));

  const fried = await searchUsda(client(), { name: "อกไก่ทอด" }, null);
  assert.equal(fried.results[0].fdcId, 171478); // the fried one
  assert.ok(fried.results.find((r) => r.fdcId === 171477)!.differences.includes("method")); // roasted ≠ fried
  assert.ok(fried.results.find((r) => r.fdcId === 2646170)!.differences.includes("state")); // raw ≠ fried
});

test("raw vs cooked meat: very different kcal per 100 g, so a state difference is always shown", () => {
  const raw = compare(food(2646170), "อกไก่สุก", "chicken breast cooked");
  assert.ok(raw.differences.includes("state"));
  assert.ok(food(171477).nutrients.kcal! > food(2646170).nutrients.kcal! * 1.3);
});

test("oyster sauce ≠ oil: Thai 'น้ำมันหอย' searches oyster sauce; oil is flagged as a different food", async () => {
  assert.equal(englishQuery("น้ำมันหอย"), "oyster sauce");
  assert.equal(englishQuery("น้ำมันพืช"), "oil vegetable");
  const out = await searchUsda(client(), { name: "น้ำมันหอย" }, null);
  assert.equal(out.results[0].fdcId, 174531);
  const oil = compare(food(171413), "น้ำมันหอย", "oyster sauce");
  assert.ok(oil.differences.includes("food"));
  assert.deepEqual(coreWords("oyster sauce"), ["oyster", "sauce"]);
});

test("ambiguous / unknown Thai names: AI translation only gets the NAME; no translation → no results, no crash", async () => {
  const seen: string[] = [];
  const out = await searchUsda(client(), { name: "ปลาแซลมอนญี่ปุ่นย่างซีอิ๊ว" }, async (n) => (seen.push(n), "salmon"));
  assert.deepEqual(seen, []); // "แซลมอน" is in the safe list → no AI needed
  assert.ok(out.query.startsWith("salmon"));
  const unknown = await searchUsda(client(), { name: "ขนมครกใบเตย" }, async (n) => (seen.push(n), null));
  assert.deepEqual(seen, ["ขนมครกใบเตย"]);
  assert.equal(unknown.results.length, 0);
  const typed = await searchUsda(client(), { name: "ไก่", query: "chicken thigh raw" }, null);
  assert.equal(typed.queryFrom, "typed");
  assert.equal(typed.results[0].fdcId, 171140);
});

test("close-match hint only when nothing differs; she still has to confirm", () => {
  const r = compare(food(2646170), "อกไก่ไม่ติดหนังดิบ", "chicken breast skinless raw");
  assert.deepEqual(r.differences, []);
  assert.equal(isCloseMatch(r, "อกไก่ไม่ติดหนังดิบ", "chicken breast skinless raw"), true);
  assert.equal(isCloseMatch(compare(food(2646170), "อกไก่", "chicken breast"), "อกไก่", "chicken breast"), false); // raw/cooked not said
});

test("Branded foods are a separate search from generic ingredients", async () => {
  const generic = await searchUsda(client(), { name: "yogurt" }, null);
  assert.ok(generic.results.every((r) => r.dataType !== "branded"));
  const branded = await searchUsda(client(), { name: "yogurt", branded: true }, null);
  assert.ok(branded.results.length > 0 && branded.results.every((r) => r.dataType === "branded"));
  const item = applyUsdaToItem(aiItem(), toSnap(branded.results[0])!, 150);
  assert.equal(item.prov?.via, "usda-branded");
});

// ---------------- API failures, rate limits, cache, key ----------------

test("API failures become clear errors (rate limit, auth, server error, network, timeout, bad answer)", async () => {
  await assert.rejects(client({ fail: 429 }).search("rice"), (e: UsdaError) => e.code === "rate-limited");
  await assert.rejects(client({ fail: 403 }).search("rice"), (e: UsdaError) => e.code === "auth");
  await assert.rejects(client({ fail: 500 }).search("rice"), (e: UsdaError) => e.code === "http");
  await assert.rejects(client({ fail: "network" }).search("rice"), (e: UsdaError) => e.code === "network");
  await assert.rejects(client({ fail: "timeout" }).search("rice"), (e: UsdaError) => e.code === "timeout");
  const bad = new UsdaClient({ apiKey: "k", fetch: (async () => new Response("not json", { status: 200 })) as typeof fetch });
  await assert.rejects(bad.search("rice"), (e: UsdaError) => e.code === "bad-response");
});

test("429 is not retried (protects the hourly limit); a 500 is retried once", async () => {
  const calls: string[] = [];
  await assert.rejects(client({ fail: 429, calls }).search("rice"));
  assert.equal(calls.length, 1);
  const calls2: string[] = [];
  await assert.rejects(client({ fail: 500, calls: calls2 }).search("rice"));
  assert.equal(calls2.length, 2);
});

test("the key goes in a header, never in the web address or an error message", async () => {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const f = (async (u: string, init: RequestInit) => {
    urls.push(String(u));
    headers.push(init.headers as Record<string, string>);
    return new Response("{}", { status: 500 });
  }) as unknown as typeof fetch;
  const c = new UsdaClient({ apiKey: "SECRET-123", fetch: f, sleep: async () => {} });
  const err = await c.search("rice").catch((e) => e as Error);
  assert.ok(urls.every((u) => !u.includes("SECRET-123")));
  assert.equal(headers[0]["X-Api-Key"], "SECRET-123");
  assert.ok(!String(err.message).includes("SECRET-123"));
});

test("cache: the same search and the same details are fetched once", async () => {
  const calls: string[] = [];
  const c = client({ calls });
  await c.search("rice white cooked");
  await c.search("rice white cooked");
  await c.food(169757);
  await c.food(169757);
  assert.equal(calls.length, 2);
  let now = 0;
  const t = new TtlCache<number>(1000, 2, () => now);
  t.set("a", 1);
  now = 2000;
  assert.equal(t.get("a"), undefined);
  t.set("b", 1);
  t.set("c", 2);
  t.set("d", 3);
  assert.equal(t.size, 2);
});

test("details: unknown id → null; household measures come with the food", async () => {
  const c = client();
  assert.equal(await c.food(123), null);
  const rice = (await c.food(169757))!;
  assert.equal(rice.portions[0].grams, 158);
  assert.equal(rice.gPerMl, 0.66);
});

test("config: no key → off; DEMO_KEY refused in production", () => {
  assert.deepEqual(usdaConfig({}), { ok: false, reason: "no-key" });
  assert.deepEqual(usdaConfig({ USDA_API_KEY: "DEMO_KEY", NODE_ENV: "production" }), { ok: false, reason: "demo-key-in-production" });
  assert.equal(usdaConfig({ USDA_API_KEY: "abc", NODE_ENV: "production" }).ok, true);
  assert.equal(usdaConfig({ USDA_API_KEY: "DEMO_KEY", NODE_ENV: "development" }).ok, true);
});

// ---------------- recipes: source priority + units ----------------

test("source priority in a recipe: her label > USDA > her reference pick / AI / reference table", () => {
  const chicken = pick(2646170, "อกไก่");
  const withLabel = ingredientMacros(ing({ name: "อกไก่", amount: 100, label: { basis: "per100", kcal: 99, protein: 1, carbs: 1, fat: 1, via: "typed" }, usda: chicken }));
  assert.ok(withLabel.ok && withLabel.macros.kcal === 99 && withLabel.prov.source === "user");
  const u = ingredientMacros(ing({ name: "อกไก่", amount: 200, usda: chicken, aiRef: { name: "อกไก่", per100: { kcal: 300, protein: 1, carbs: 1, fat: 1 }, unitG: null, gPerMl: null } }));
  assert.ok(u.ok);
  assert.equal(u.ok && Math.round(u.macros.kcal), 224);
  assert.deepEqual(u.ok && u.prov, { source: "database", verification: "unverified", via: "usda" });
  assert.equal(u.ok && sourceLabel(u.prov).en, "USDA");
  // USDA is never "verified" (the match is hers, not checked)
  assert.notEqual(u.ok && u.prov.verification, "verified");
});

test("renaming the ingredient stops using the USDA pick (never applied to a different food)", () => {
  const r = ingredientMacros(ing({ name: "อกไก่ทอด", usda: pick(2646170, "อกไก่") }));
  assert.ok(!r.ok || r.prov.via !== "usda");
});

test("USDA in spoons / cups / pieces: USDA's own cup weight, her density, or it asks", () => {
  const sauce = pick(174531, "น้ำมันหอย", { gPerMl: 1.2 });
  const tbsp = ingredientMacros(ing({ name: "น้ำมันหอย", amount: 2, unit: "tbsp", usda: sauce }));
  assert.ok(tbsp.ok);
  assert.equal(tbsp.ok && Math.round(tbsp.macros.kcal * 10) / 10, Math.round(51 * 0.36 * 10) / 10); // 2 × 15 ml × 1.2 g/ml = 36 g
  const noDensity = ingredientMacros(ing({ name: "น้ำมันหอย", amount: 2, unit: "tbsp", usda: { ...sauce, gPerMl: null } }));
  assert.ok(!noDensity.ok && noDensity.reason === "need-density");
  const pieces = ingredientMacros(ing({ name: "อกไก่", amount: 1, unit: "piece", usda: pick(2646170, "อกไก่") }));
  assert.ok(!pieces.ok && pieces.reason === "need-weight-per-unit");
  const withW = ingredientMacros(ing({ name: "อกไก่", amount: 1, unit: "piece", gramsPerUnit: 114, usda: pick(2646170, "อกไก่") }));
  assert.ok(withW.ok && Math.round(withW.macros.kcal) === 128);
});

test("a recipe mixing USDA + AI is as sure as its least sure part", () => {
  const t = recipeTotals(
    [
      ing({ id: "a", name: "อกไก่", amount: 100, usda: pick(2646170, "อกไก่") }),
      ing({ id: "b", name: "ซอสพิเศษ", amount: 10, aiRef: { name: "ซอสพิเศษ", per100: { kcal: 100, protein: 0, carbs: 25, fat: 0 }, unitG: null, gPerMl: null } }),
    ],
    1,
    null,
  );
  assert.equal(t.prov.verification, "estimated");
  assert.equal(recipeProvenance([{ source: "database", verification: "unverified", via: "usda" }]).verification, "unverified");
});

// ---------------- diary items + Smart Calorie Buffer ----------------

test("USDA item: no buffer, only once, P/C/F from USDA; other AI items in the same meal keep their buffer", () => {
  const chicken = startBuffer(aiItem(), 15);
  assert.equal(chicken.kcal, 345);
  const oil = startBuffer(aiItem({ id: "o", name: "น้ำมันทอด", kind: "extra", kcal: 90, protein: 0, carbs: 0, fat: 10 }), 15);
  const usda = applyUsdaToItem(chicken, snapOf(171478), 150);
  assert.equal(usda.kcal, Math.round(187 * 1.5)); // 281, no +15%
  assert.equal(usda.aiKcal, undefined);
  assert.equal(usda.bufferPct, undefined);
  assert.equal(usda.protein, 50.1);
  assert.equal(canBuffer(usda), false);
  assert.deepEqual(startBuffer(usda, 20), usda);
  assert.deepEqual(setBuffer(usda, 20), usda); // no aiKcal → never touched
  const sum = bufferSummary([usda, oil]);
  assert.equal(sum.extra, Math.round(90 * 0.15 * 100) / 100); // only the oil's buffer
  // changing the amount scales USDA numbers, never adds a buffer
  const more = changeAmount(usda, 300);
  assert.equal(more.kcal, usda.kcal * 2);
  assert.equal(more.aiKcal, undefined);
});

test("USDA item keeps her item name, kind and dairy mark; its source is USDA", () => {
  const before = aiItem({ name: "อกไก่ของแม่", kind: "food", dairy: false });
  const it = applyUsdaToItem(before, snapOf(2646170), 120);
  assert.equal(it.name, "อกไก่ของแม่");
  assert.equal(it.unit, "g");
  assert.equal(it.ref?.source, "usda");
  assert.equal(it.ref?.sourceId, "2646170");
  assert.equal(it.usda?.description, "Chicken, breast, boneless, skinless, raw");
  assert.deepEqual(itemProvenance(it), { source: "database", verification: "unverified", via: "usda" });
  assert.equal(it.estimated, false);
});

// ---------------- old records + backups ----------------

test("old diary items and recipes without USDA fields work exactly as before", () => {
  const old: FoodItem = { id: "o", name: "ข้าวผัด", amount: 1, unit: "จาน", kcal: 575, protein: 20, carbs: 80, fat: 18, estimated: true, kind: "food", note: null, box: null, margin: true };
  assert.equal(itemProvenance(old).source, "ai");
  assert.equal(canBuffer(old), false);
  const oldRecipe = ingredientMacros(ing({ name: "ไข่ไก่", amount: 2, unit: "egg" }));
  assert.ok(oldRecipe.ok && Math.round(oldRecipe.macros.kcal) === 143);
  const oldOff = { ...old, ref: { source: "off" as const, sourceId: "123" }, margin: undefined };
  assert.equal(itemProvenance(oldOff).source, "unknown"); // Round 39 rule unchanged
});

test("backup: items and recipes with USDA snapshots survive a backup + restore unchanged", () => {
  const entries = [{ id: "e1", date: "2026-11-16", slot: "lunch", title: "x", items: [applyUsdaToItem(aiItem(), snapOf(169757), 200)], source: "text", photoId: null, recipe: null, createdAt: 1, updatedAt: 1 }];
  const recipes = [{ id: "r1", name: "r", servings: 1, cookedWeight: null, ingredients: [ing({ name: "ข้าวสวย", usda: pick(169757, "ข้าวสวย") })], steps: [], coverPhotoId: null, createdAt: 1, updatedAt: 1 }];
  const data = { entries: JSON.stringify(entries), recipes: JSON.stringify(recipes), goals: null, body: null, water: null, labelFixes: null, buddy: null, lang: null };
  const back = parseBackup(JSON.stringify(makeBackup(data, {}, 5)));
  assert.ok(back.ok);
  assert.deepEqual(JSON.parse(back.ok ? back.backup.data.entries! : "null"), entries);
  assert.deepEqual(JSON.parse(back.ok ? back.backup.data.recipes! : "null"), recipes);
});

// ---------------- found with the REAL USDA API (2026-11-16) ----------------
const real = (fdcId: number, dataType: string, description: string) =>
  normalizeUsdaFood({ fdcId, dataType, description, foodNutrients: [{ nutrientId: 1008, unitName: "KCAL", value: 100 }] })!;

test("real-API lessons: sticky / black / wild rice are not plain white rice", () => {
  for (const [id, d] of [[169711, "Rice, white, glutinous, unenriched, cooked"], [2710825, "Rice, black, unenriched, raw"], [2710821, "Wild rice, dry, raw"]] as const) {
    const r = compare(real(id, "SR Legacy", d), id === 169711 ? "ข้าวสวย" : "ข้าวสาร", id === 169711 ? "rice white cooked" : "rice white raw");
    assert.ok(r.differences.includes("food"), d);
  }
  assert.deepEqual(compare(real(168930, "SR Legacy", "Rice, white, medium-grain, cooked, unenriched"), "ข้าวสวย", "rice white cooked").differences, []);
  // she can still ask for sticky rice on purpose
  assert.deepEqual(compare(real(169711, "SR Legacy", "Rice, white, glutinous, unenriched, cooked"), "ข้าวเหนียว", "rice white glutinous cooked").differences, []);
});

test("real-API lessons: lunch meat, rotisserie, stewed and battered chicken are flagged", () => {
  assert.ok(compare(real(2759004, "Foundation", "Lunchmeat, chicken breast, sliced"), "อกไก่ต้ม", "chicken breast boiled").differences.includes("food"));
  assert.ok(compare(real(2705964, "Survey (FNDDS)", "Chicken breast, rotisserie, skin not eaten"), "อกไก่ต้ม", "chicken breast boiled").differences.includes("method"));
  assert.ok(compare(real(2705965, "Survey (FNDDS)", "Chicken breast, stewed, skin eaten"), "อกไก่ต้ม", "chicken breast boiled").differences.includes("method"));
  assert.ok(compare(real(171475, "SR Legacy", "Chicken, broilers or fryers, breast, meat and skin, cooked, fried, batter"), "อกไก่ทอด", "chicken breast fried").differences.includes("food"));
  assert.ok(compare(real(1999627, "Foundation", "Mushroom, oyster"), "น้ำมันหอย", "oyster sauce").differences.includes("food"));
});

test("USDA's RACC serving is shown in plain words", () => {
  assert.equal(readPortions({ foodPortions: [{ gramWeight: 114, amount: 1, measureUnit: { name: "RACC" } }] })[0].label, "1 serving (RACC)");
});

test("portion labels always say how many (USDA modifier 'cup' → '1 cup')", () => {
  const p = readPortions({ foodPortions: [{ gramWeight: 186, amount: 1, measureUnit: { name: "undetermined" }, modifier: "cup" }, { gramWeight: 30, amount: 2, measureUnit: { name: "tbsp" }, modifier: "" }] });
  assert.equal(p[0].label, "1 cup");
  assert.equal(p[0].ml, 240);
  assert.equal(p[1].label, "2 tbsp");
  assert.equal(p[1].ml, 30);
  assert.equal(englishQuery("ฟักเขียว"), "waxgourd");
});
