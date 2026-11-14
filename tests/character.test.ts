import { test } from "node:test";
import assert from "node:assert/strict";
import { DECOS, DEFAULT_LOOK, cleanLook, overlaySvg, parseLook } from "../app/lib/character.ts";

test("nothing saved or broken text → her original look", () => {
  assert.deepEqual(parseLook(null), DEFAULT_LOOK);
  assert.deepEqual(parseLook("{oops"), DEFAULT_LOOK);
  assert.deepEqual(parseLook("[1]"), DEFAULT_LOOK);
  assert.equal(DEFAULT_LOOK.color, "#ffffff");
  assert.equal(overlaySvg(DEFAULT_LOOK), "");
});

test("a saved look comes back the same, any hex color works", () => {
  const l = { color: "#a1b2c3", deco: "cherry", blush: true } as const;
  assert.deepEqual(parseLook(JSON.stringify(l)), l);
  assert.equal(cleanLook({ color: "#F4C0D1" }).color, "#f4c0d1");
});

test("old Round 20 buddy data still opens (color + cheeks kept, the rest dropped)", () => {
  const old = { shape: "bun", color: "#FAC775", eyes: "squint", mouth: "tongue", head: "bow", extras: ["nose", "blush"] };
  assert.deepEqual(cleanLook(old), { color: "#fac775", deco: "none", blush: true });
});

test("tricks in saved text never reach the drawing", () => {
  const l = cleanLook({ color: 'red"/><script>', deco: "toString", blush: "yes" });
  assert.deepEqual(l, DEFAULT_LOOK);
  for (const d of Object.keys(DECOS)) {
    const s = overlaySvg({ color: "#ffffff", deco: d as keyof typeof DECOS, blush: true });
    assert.ok(!s.includes("NaN") && !s.includes("undefined") && !s.includes("<script"), d);
  }
});
