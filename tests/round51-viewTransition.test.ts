import { test } from "node:test";
import assert from "node:assert/strict";
import { addSheetPrefetchUrls, viewTransitionsSupported } from "../app/lib/viewTransition.ts";

test("supported only with startViewTransition AND transition types", () => {
  const css = (ok: boolean) => ({ supports: () => ok });
  assert.equal(viewTransitionsSupported({ startViewTransition: () => {} }, css(true)), true);
  assert.equal(viewTransitionsSupported({ startViewTransition: () => {} }, css(false)), false);
  assert.equal(viewTransitionsSupported({}, css(true)), false);
  assert.equal(viewTransitionsSupported(null, css(true)), false);
  assert.equal(viewTransitionsSupported({ startViewTransition: () => {} }, null), false);
});

test("a throwing CSS.supports never breaks the page", () => {
  const css = { supports: () => { throw new Error("nope"); } };
  assert.equal(viewTransitionsSupported({ startViewTransition: () => {} }, css), false);
});

test("prefetch list covers every Add food destination and keeps the date", () => {
  const today = addSheetPrefetchUrls("");
  assert.deepEqual(today, ["/add/text", "/add/search", "/add/photo", "/add/barcode", "/add/manual", "/recipes"]);
  const past = addSheetPrefetchUrls("?date=2026-11-10");
  assert.ok(past.every((u) => u.endsWith("?date=2026-11-10")));
  assert.equal(past.length, 6);
});
