import { test } from "node:test";
import assert from "node:assert/strict";
import { foodById, foodCount, nutrientsFor, searchFoods, tokenize } from "../app/lib/server/foodDb.ts";
import { buildPickPrompt, groundItems, parsePicks, passesSanity, skipReason, type PickFn, type VisionItem } from "../app/lib/server/foodDbPick.ts";

const quiet = { log: () => {} };
const item = (o: Partial<VisionItem>): VisionItem => ({ name: "x", kcal: 100, protein: 1, carbs: 1, fat: 1, grams: 100, en: "banana", state: "raw", ...o });
/** A fake pick call: always answers with the given candidate numbers, one per item in order. */
const picksOf = (...cs: number[]): PickFn => async () => JSON.stringify({ picks: cs.map((c, k) => ({ i: k + 1, c })) });

test("the table is big enough and loads", () => {
  assert.ok(foodCount() > 10000);
});

test("tokenize: plurals and small words", () => {
  assert.deepEqual(tokenize("Eggs, whole, with the Tomatoes"), ["egg", "whole", "tomato"]);
});

test("search: plain foods come back with ids and numbers", () => {
  const banana = searchFoods("banana", { limit: 6 });
  assert.ok(banana.length > 0 && banana.length <= 6);
  assert.ok(banana.some((c) => /^Bananas?, raw$/i.test(c.name)));
  assert.ok(banana.every((c) => typeof c.id === "string" && c.per100.kcal > 0));
  assert.deepEqual(searchFoods("zzzzqqq xyzxyz"), []);
});

test("search: state decides raw vs cooked rice", () => {
  const cooked = searchFoods("rice white", { state: "cooked" })[0];
  const raw = searchFoods("rice white", { state: "raw" })[0];
  assert.match(cooked.name, /cooked|steamed/i);
  assert.ok(cooked.per100.kcal < 200, `cooked rice ${cooked.per100.kcal}`);
  assert.match(raw.name, /raw|uncooked/i);
  assert.ok(raw.per100.kcal > 330, `raw rice ${raw.per100.kcal}`);
});

test("search: oyster sauce is not oil, and oil is oil", () => {
  assert.match(searchFoods("oyster sauce")[0].name, /oyster/i);
  const oil = searchFoods("vegetable oil")[0];
  assert.ok(oil.per100.kcal > 800);
  assert.ok(!/oyster/i.test(oil.name));
});

test("search: the app's own reference foods are a source too", () => {
  const ref = searchFoods("cooked white rice", { limit: 60 }).find((c) => c.src === "r");
  assert.ok(ref, "FOOD_REF rice is a candidate");
  assert.equal(ref.id, "ref:rice");
  assert.equal(foodById("ref:rice")?.per100.kcal, 130);
});

test("search: no look-alike duplicates and it is fast", () => {
  const t = performance.now();
  const r = searchFoods("rice white cooked", { state: "cooked" });
  assert.ok(performance.now() - t < 50);
  const keys = r.map((c) => `${c.per100.kcal}|${c.per100.protein}|${c.per100.carbs}|${c.per100.fat}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("kcal math: per 100 g x grams / 100; a missing nutrient stays null", () => {
  const food = { id: "t", src: "s" as const, name: "t", portions: [], per100: { kcal: 130, protein: 2.7, carbs: 28, fat: null, fiber: null, sugar: null, sodiumMg: 1 } };
  const n = nutrientsFor(food, 150);
  assert.equal(n.kcal, 195);
  assert.equal(n.protein, 4.1);
  assert.equal(n.carbs, 42);
  assert.equal(n.fat, null);
});

test("pick prompt: carries the state, the grams and every candidate", () => {
  const candidates = searchFoods("rice white", { state: "cooked", limit: 3 });
  const { system, user } = buildPickPrompt([{ i: 1, en: "rice white cooked", state: "cooked", grams: 150, candidates }]);
  assert.match(system, /cooked rice is not raw rice/);
  assert.match(system, /oyster sauce is not oil/);
  assert.match(user, /state: cooked/);
  assert.match(user, /150 g/);
  assert.match(user, /3\) /);
});

test("pick answer: reads good rows, ignores bad ones", () => {
  const m = parsePicks('{"picks":[{"i":1,"c":2},{"i":2,"c":0},{"i":3,"c":9},{"i":7,"c":1},{"i":"x"}]}', { 1: 6, 2: 6, 3: 4 });
  assert.deepEqual([...m], [[1, 2], [2, 0]]);
  assert.equal(parsePicks("not json", { 1: 3 }).size, 0);
  assert.equal(parsePicks('Sure! {"picks":[{"i":1,"c":1}]}', { 1: 3 }).get(1), 1);
});

test("sanity rule: more than 2.5x either way is rejected", () => {
  assert.ok(passesSanity(250, 100));
  assert.ok(!passesSanity(251, 100));
  assert.ok(passesSanity(40, 100));
  assert.ok(!passesSanity(39, 100));
  assert.ok(passesSanity(0, 5)); // both tiny (water, tea)
  assert.ok(!passesSanity(0, 80));
  assert.ok(!passesSanity(80, 0));
});

test("skip rules: label numbers, no weight, no name never go to the table", () => {
  assert.equal(skipReason(item({ fromLabel: true })), "label");
  assert.equal(skipReason(item({ grams: 0 })), "no-grams");
  assert.equal(skipReason(item({ grams: undefined })), "no-grams");
  assert.equal(skipReason(item({ en: " " })), "no-name");
  assert.equal(skipReason(item({})), null);
});

test("grounding: a matched item gets database numbers, prov and a USDA ref; 'none' keeps the vision estimate", async () => {
  const items = [
    item({ name: "ข้าวสวย", en: "rice white", state: "cooked", grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5 }),
    item({ name: "ผัดกะเพรา", en: "banana", state: "other", grams: 140, kcal: 260, protein: 22, carbs: 5, fat: 17 }),
  ];
  const cand = searchFoods("rice white", { state: "cooked", minCoverage: 0.7, limit: 6 });
  const want = cand[0];
  const { items: out, grounding } = await groundItems(items, { ...quiet, pick: picksOf(1, 0) });
  assert.equal(out[0].kcal, Math.round((want.per100.kcal * 150) / 100));
  assert.equal(out[0].prov?.source, want.src === "r" ? "reference" : "database");
  assert.equal(out[0].dbMatch?.id, want.id);
  if (want.src !== "r") assert.deepEqual(out[0].ref, { source: "usda", sourceId: want.id });
  assert.equal(out[1].kcal, 260, "none keeps the vision estimate");
  assert.equal(out[1].prov, undefined);
  assert.deepEqual([grounding.matched, grounding.estimated, grounding.pick], [1, 1, "ok"]);
  assert.equal(items[0].kcal, 195, "the input is not changed");
});

test("grounding: USDA matches are 'database', not 'verified'", async () => {
  const { items: out } = await groundItems([item({ en: "bananas raw", grams: 120, kcal: 107 })], { ...quiet, pick: picksOf(1) });
  assert.equal(out[0].prov?.verification, "unverified");
  assert.ok(out[0].kcal >= 90 && out[0].kcal <= 125);
});

test("grounding: a silly match (over 2.5x) keeps the vision estimate and says why", async () => {
  const logs: string[] = [];
  const { items: out, grounding } = await groundItems([item({ en: "bananas raw", grams: 120, kcal: 20 })], { pick: picksOf(1), log: (m) => logs.push(m) });
  assert.equal(out[0].kcal, 20);
  assert.equal(out[0].prov, undefined);
  assert.equal(grounding.reasons.sanity, 1);
  assert.match(logs.join(" "), /sanity/);
});

test("fallback: the pick call fails -> every item keeps its estimate", async () => {
  const items = [item({}), item({ en: "rice white", state: "cooked" })];
  const { items: out, grounding } = await groundItems(items, { ...quiet, pick: async () => { throw new Error("boom"); } });
  assert.deepEqual(out.map((i) => i.kcal), [100, 100]);
  assert.ok(out.every((i) => i.prov === undefined));
  assert.equal(grounding.pick, "failed");
  assert.equal(grounding.matched, 0);
});

test("fallback: a slow pick call (over the limit) is dropped, the meal is not blocked", async () => {
  const slow: PickFn = () => new Promise((r) => setTimeout(() => r('{"picks":[{"i":1,"c":1}]}'), 400));
  const t = Date.now();
  const { items: out, grounding } = await groundItems([item({})], { ...quiet, pick: slow, timeoutMs: 50 });
  assert.ok(Date.now() - t < 300);
  assert.equal(out[0].kcal, 100);
  assert.equal(grounding.pick, "failed");
});

test("fallback: garbage answer = estimates; label items and weightless items skip the call entirely", async () => {
  let calls = 0;
  const counting: PickFn = async () => { calls++; return "nonsense"; };
  const a = await groundItems([item({})], { ...quiet, pick: counting });
  assert.equal(a.items[0].kcal, 100);
  assert.equal(calls, 1);
  const b = await groundItems([item({ fromLabel: true }), item({ grams: 0 })], { ...quiet, pick: counting });
  assert.equal(calls, 1, "no call when nothing can be looked up");
  assert.equal(b.grounding.pick, "skipped");
});

test("grounding: a mixed Thai dish with only one shared word finds no candidates", async () => {
  let calls = 0;
  const { grounding } = await groundItems([item({ en: "stir-fried basil chicken", state: "other", grams: 140 })], { ...quiet, pick: async () => { calls++; return "{}"; } });
  assert.equal(calls, 0);
  assert.equal(grounding.reasons["no-candidates"], 1);
});
