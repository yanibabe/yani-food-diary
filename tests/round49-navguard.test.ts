import { test } from "node:test";
import assert from "node:assert/strict";
import { beginNav, endNav, IDLE_NAV, isPending } from "../app/lib/navGuard.ts";

test("first tap starts the trip", () => {
  const r = beginNav(IDLE_NAV, "ai");
  assert.equal(r.go, true);
  assert.equal(r.state.pending, "ai");
  assert.equal(isPending(r.state, "ai"), true);
  assert.equal(isPending(r.state, "photo"), false);
});

test("a second tap while travelling is ignored, even on another row", () => {
  const a = beginNav(IDLE_NAV, "ai");
  const b = beginNav(a.state, "photo");
  assert.equal(b.go, false);
  assert.equal(b.state.pending, "ai");
});

test("after the trip ends, taps work again", () => {
  const a = beginNav(IDLE_NAV, "ai");
  const s = endNav();
  assert.deepEqual(s, IDLE_NAV);
  assert.equal(beginNav(s, "ai").go, true);
  assert.equal(a.state.pending, "ai");
});
