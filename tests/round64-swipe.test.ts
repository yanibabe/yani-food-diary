import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSwipe, dragOffset, settleOffset, SWIPE_BUTTON_W as W } from "../app/lib/swipe.ts";

test("tiny moves stay undecided", () => {
  assert.equal(decideSwipe(3, 2), "pending");
  assert.equal(decideSwipe(-7, 5), "pending");
});

test("clear horizontal move is a swipe", () => {
  assert.equal(decideSwipe(-20, 4), "horizontal");
  assert.equal(decideSwipe(15, -3), "horizontal");
});

test("vertical or diagonal moves keep page scrolling", () => {
  assert.equal(decideSwipe(2, 30), "vertical");
  assert.equal(decideSwipe(-12, 12), "vertical");
  assert.equal(decideSwipe(-14, 12), "vertical");
});

test("drag offset is clamped: never right of 0, small rubber band on the left", () => {
  assert.equal(dragOffset(40, W, false), 0);
  assert.equal(dragOffset(-30, W, false), -30);
  assert.equal(dragOffset(-500, W, false), -W * 1.25);
  assert.equal(dragOffset(20, W, true), -W + 20);
});

test("closed row: far enough opens, short drag snaps back", () => {
  assert.equal(settleOffset(-60, W, false), -W);
  assert.equal(settleOffset(-20, W, false), 0);
  assert.equal(settleOffset(10, W, false), 0);
});

test("open row: staying keeps it open, swiping right closes", () => {
  assert.equal(settleOffset(0, W, true), -W);
  assert.equal(settleOffset(10, W, true), -W);
  assert.equal(settleOffset(40, W, true), 0);
});

test("settle only ever returns 0 or -width (a swipe can never delete)", () => {
  for (const wasOpen of [true, false]) for (let dx = -400; dx <= 400; dx += 7) {
    assert.ok([0, -W].includes(settleOffset(dx, W, wasOpen)));
  }
});
