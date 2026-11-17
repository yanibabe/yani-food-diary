import { test } from "node:test";
import assert from "node:assert/strict";
import { clampX, clampY, defaultFab, dragPos, fabAllowedOn, fabVisible, fabX, FAB_MARGIN, FAB_SIZE, isDrag, parseFab, placeFab, releaseFab, serializeFab, snapSide, yRange } from "../app/lib/chatFab.ts";

const ins = { top: 47, bottom: 83 };
const VW = 390;
const VH = 844;

test("y is kept clear of the status bar and the tab bar", () => {
  const { min, max } = yRange(VH, ins);
  assert.equal(min, 47 + FAB_MARGIN);
  assert.equal(max, VH - 83 - FAB_SIZE - FAB_MARGIN);
  assert.equal(clampY(-500, VH, ins), min);
  assert.equal(clampY(5000, VH, ins), max);
  assert.equal(clampY(300, VH, ins), 300);
  assert.equal(clampY(Number.NaN, VH, ins), max);
});

test("a tiny screen never gives an impossible range", () => {
  const { min, max } = yRange(100, { top: 60, bottom: 60 });
  assert.ok(max >= min);
});

test("x is clamped to the screen; the edge positions keep a small margin", () => {
  assert.equal(clampX(-30, VW), 0);
  assert.equal(clampX(999, VW), VW - FAB_SIZE);
  assert.equal(fabX("left", VW), FAB_MARGIN);
  assert.equal(fabX("right", VW), VW - FAB_SIZE - FAB_MARGIN);
});

test("it snaps to the nearer edge by its centre", () => {
  assert.equal(snapSide(100, VW), "left");
  assert.equal(snapSide(VW / 2 - FAB_SIZE / 2 - 1, VW), "left");
  assert.equal(snapSide(VW / 2 - FAB_SIZE / 2 + 1, VW), "right");
  assert.equal(snapSide(300, VW), "right");
});

test("dragging follows the finger and stays on screen", () => {
  const p = dragPos({ x: 330, y: 400 }, 200, -900, VW, VH, ins);
  assert.equal(p.x, VW - FAB_SIZE);
  assert.equal(p.y, 47 + FAB_MARGIN);
});

test("release snaps to an edge and remembers only side + y", () => {
  assert.deepEqual(releaseFab(40, 300, VW, VH, ins), { side: "left", y: 300 });
  assert.deepEqual(releaseFab(250, 9999, VW, VH, ins), { side: "right", y: yRange(VH, ins).max });
});

test("tap vs drag: under 6px is a tap", () => {
  assert.equal(isDrag(3, 3), false);
  assert.equal(isDrag(0, 5.9), false);
  assert.equal(isDrag(6, 0), true);
  assert.equal(isDrag(-4, 5), true);
});

test("default place: right edge, above the tab bar", () => {
  const d = defaultFab(VH, ins);
  assert.equal(d.side, "right");
  const p = placeFab(null, VW, VH, ins);
  assert.equal(p.x, fabX("right", VW));
  assert.ok(p.y + FAB_SIZE <= VH - ins.bottom);
});

test("a saved position is clamped to the new screen (rotation)", () => {
  const p = placeFab({ side: "right", y: 700 }, 844, 390, { top: 0, bottom: 83 });
  assert.equal(p.x, 844 - FAB_SIZE - FAB_MARGIN);
  assert.ok(p.y + FAB_SIZE <= 390 - 83);
});

test("storage: round trip, and broken text gives null", () => {
  const s = parseFab(serializeFab({ side: "left", y: 123.6 }));
  assert.deepEqual(s, { side: "left", y: 124 });
  for (const bad of [null, "", "nope", "[]", "null", '{"side":"top","y":1}', '{"side":"left"}', '{"side":"left","y":"1"}', '{"side":"left","y":null}']) {
    assert.equal(parseFab(bad), null, String(bad));
  }
});

test("where the button shows", () => {
  for (const p of ["/", "/recipes", "/profile"]) assert.equal(fabAllowedOn(p), true);
  for (const p of ["/welcome", "/add/photo", "/add/barcode", "/entry/x", "/recipes/abc", "/body", "/goals", null, undefined]) assert.equal(fabAllowedOn(p), false, String(p));
  assert.equal(fabVisible("/", false, false), true);
  assert.equal(fabVisible("/", true, false), false); // Add sheet / layer open
  assert.equal(fabVisible("/", false, true), false); // chat open
  assert.equal(fabVisible("/welcome", false, false), false);
});
