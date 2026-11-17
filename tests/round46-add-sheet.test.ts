// Round 46: the search-first Add food sheet — link building and prefill reading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAddUrl, cleanPrefill, PREFILL_MAX } from "../app/lib/addSheet.ts";

test("search link: plain text, no date", () => {
  assert.equal(buildAddUrl("search", null, "egg"), "/add/search?q=egg");
});

test("search link keeps the day on screen and encodes Thai", () => {
  const url = buildAddUrl("search", "2026-11-10", "ไข่ ต้ม");
  assert.ok(url.startsWith("/add/search?date=2026-11-10&q="));
  const back = new URL(url, "http://x").searchParams;
  assert.equal(back.get("q"), "ไข่ ต้ม");
  assert.equal(back.get("date"), "2026-11-10");
});

test("special characters cannot break the link", () => {
  const url = buildAddUrl("text", null, "a&b=c#d?e");
  const sp = new URL(url, "http://x").searchParams;
  assert.equal(sp.get("q"), "a&b=c#d?e");
  assert.equal([...sp.keys()].length, 1);
});

test("empty text gives a link with no q", () => {
  assert.equal(buildAddUrl("search", null, "   "), "/add/search");
  assert.equal(buildAddUrl("text", "2026-11-10"), "/add/text?date=2026-11-10");
});

test("prefill parsing: trims, squeezes, strips control chars, caps length, tolerates null", () => {
  assert.equal(cleanPrefill("  ข้าว \n  ผัด\t"), "ข้าว ผัด");
  assert.equal(cleanPrefill(null), "");
  assert.equal(cleanPrefill(undefined), "");
  assert.equal(cleanPrefill("x".repeat(500)).length, PREFILL_MAX);
});
