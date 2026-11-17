import { test } from "node:test";
import assert from "node:assert/strict";
import { FAB_CAPTION_H, FAB_MARGIN, FAB_SIZE, FAB_TOTAL_H, clampY, placeFab, yRange } from "../app/lib/chatFab.ts";

const insets = { top: 47, bottom: 83 };

test("caption height counts in the clamp", () => {
  assert.equal(FAB_TOTAL_H, FAB_SIZE + FAB_CAPTION_H);
  const { max } = yRange(844, insets);
  assert.equal(max, 844 - 83 - FAB_TOTAL_H - FAB_MARGIN);
  assert.equal(clampY(9999, 844, insets), max);
});

test("button + caption never go under the tab bar", () => {
  const p = placeFab({ side: "right", y: 9999 }, 390, 844, insets);
  assert.ok(p.y + FAB_TOTAL_H + FAB_MARGIN <= 844 - 83);
  assert.ok(p.y >= 47 + FAB_MARGIN);
});

test("tiny screen still returns a sane y", () => {
  const p = placeFab(null, 320, 100, insets);
  assert.ok(Number.isFinite(p.y));
});
