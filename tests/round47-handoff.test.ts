// Round 47: sheet → review hand-over, links, "which AI row shows".
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAddUrlWith, buildReviewUrl, showWholeDishRow, visibleAiRow } from "../app/lib/addSheet.ts";
import { decodeHandoff, encodeHandoff, HANDOFF_KEY, HANDOFF_MAX_AGE_MS, putHandoff, takeHandoff } from "../app/lib/sheetHandoff.ts";
import { ingredientToItem } from "../app/lib/searchFood.ts";
import type { Ingredient } from "../app/lib/types.ts";

const egg: Ingredient = {
  id: "i1",
  name: "Egg",
  amount: 2,
  unit: "g",
  label: null,
  gramsPerUnit: null,
  photoId: null,
  aiRef: { name: "Egg", per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, unitG: 50, gPerMl: null },
};

function fakeStore() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

test("hand-over round trip keeps the ingredient", () => {
  const back = decodeHandoff(encodeHandoff(egg, 1000), 2000);
  assert.deepEqual(back, egg);
});

test("hand-over: missing, broken, wrong shape → null", () => {
  assert.equal(decodeHandoff(null, 1), null);
  assert.equal(decodeHandoff("", 1), null);
  assert.equal(decodeHandoff("{nope", 1), null);
  assert.equal(decodeHandoff("123", 1), null);
  assert.equal(decodeHandoff(JSON.stringify({ v: 2, at: 1, ing: egg }), 2), null);
  assert.equal(decodeHandoff(JSON.stringify({ v: 1, at: 1, ing: { ...egg, name: " " } }), 2), null);
  assert.equal(decodeHandoff(JSON.stringify({ v: 1, at: 1, ing: { ...egg, amount: 0 } }), 2), null);
  assert.equal(decodeHandoff(JSON.stringify({ v: 1, at: 1, ing: { ...egg, unit: "bogus" } }), 2), null);
});

test("hand-over goes stale after the limit, and a clock in the past is refused", () => {
  const raw = encodeHandoff(egg, 1000);
  assert.ok(decodeHandoff(raw, 1000 + HANDOFF_MAX_AGE_MS));
  assert.equal(decodeHandoff(raw, 1000 + HANDOFF_MAX_AGE_MS + 1), null);
  assert.equal(decodeHandoff(raw, 999), null);
});

test("take is single use", () => {
  const s = fakeStore();
  assert.equal(putHandoff(s, egg, 5), true);
  assert.ok(s.m.has(HANDOFF_KEY));
  assert.deepEqual(takeHandoff(s, 6), egg);
  assert.equal(s.m.has(HANDOFF_KEY), false);
  assert.equal(takeHandoff(s, 7), null);
});

test("take with no storage / throwing storage is safe", () => {
  assert.equal(takeHandoff(null, 1), null);
  assert.equal(putHandoff(null, egg, 1), false);
  const bad = {
    getItem: () => {
      throw new Error("no");
    },
    setItem: () => {
      throw new Error("no");
    },
    removeItem: () => {},
  };
  assert.equal(takeHandoff(bad, 1), null);
  assert.equal(putHandoff(bad, egg, 1), false);
});

test("a stale hand-over is removed and not used", () => {
  const s = fakeStore();
  putHandoff(s, egg, 0);
  assert.equal(takeHandoff(s, HANDOFF_MAX_AGE_MS + 5), null);
  assert.equal(s.m.has(HANDOFF_KEY), false);
});

test("handed-over food turns into a review item", () => {
  const got = takeHandoff((() => { const s = fakeStore(); putHandoff(s, egg, 1); return s; })(), 2)!;
  const item = ingredientToItem(got, "it_1", "en", 0);
  assert.ok(item);
  assert.equal(item!.name, "Egg");
  assert.equal(item!.kcal, 3); // 2 g of egg
});

test("review link", () => {
  assert.equal(buildReviewUrl(null), "/add/search?from=sheet");
  assert.equal(buildReviewUrl("2026-11-10"), "/add/search?from=sheet&date=2026-11-10");
});

test("text link: prefilled and auto-start; Thai and symbols survive", () => {
  const url = buildAddUrlWith("text", "2026-11-10", "ข้าวผัดกะเพราไก่ไข่ดาว", { auto: true });
  const sp = new URL(url, "http://x").searchParams;
  assert.equal(url.startsWith("/add/text?"), true);
  assert.equal(sp.get("q"), "ข้าวผัดกะเพราไก่ไข่ดาว");
  assert.equal(sp.get("auto"), "1");
  assert.equal(sp.get("date"), "2026-11-10");
  assert.equal(new URL(buildAddUrlWith("text", null, "a&b #1", { auto: true }), "http://x").searchParams.get("q"), "a&b #1");
});

test("no text → no auto / create switch", () => {
  assert.equal(buildAddUrlWith("text", null, "  ", { auto: true }), "/add/text");
  assert.equal(buildAddUrlWith("search", null, "", { create: true }), "/add/search");
  assert.equal(buildAddUrlWith("search", null, "x", { create: true }), "/add/search?q=x&create=1");
});

test("pinned AI row: from 2 characters, trimmed", () => {
  assert.equal(showWholeDishRow(""), false);
  assert.equal(showWholeDishRow("ไ"), false);
  assert.equal(showWholeDishRow("  ไ  "), false);
  assert.equal(showWholeDishRow("ไข่"), true);
  assert.equal(showWholeDishRow(null), false);
});

test("only one AI row at a time", () => {
  assert.equal(visibleAiRow({ inSheet: true, typed: "ข้าวผัด", estimateOffered: true }), "whole-dish");
  assert.equal(visibleAiRow({ inSheet: true, typed: "ข", estimateOffered: true }), null);
  assert.equal(visibleAiRow({ inSheet: false, typed: "ข้าวผัด", estimateOffered: true }), "estimate");
  assert.equal(visibleAiRow({ inSheet: false, typed: "ข้าวผัด", estimateOffered: false }), null);
});
