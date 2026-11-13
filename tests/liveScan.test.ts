import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraErrorKind, makeConfirmer, scanArea } from "../app/lib/liveScan.ts";

test("scanArea: middle band, shrunk when the video is big", () => {
  const a = scanArea(1280, 720);
  assert.deepEqual({ x: a.x, y: a.y, w: a.w, h: a.h }, { x: 128, y: 216, w: 1024, h: 288 });
  assert.equal(a.outW, 960);
  assert.equal(a.outH, 270);
  const b = scanArea(640, 480);
  assert.equal(b.outW, b.w);
});

test("makeConfirmer: needs the same code twice in a row", () => {
  const c = makeConfirmer();
  assert.equal(c("8851959132074"), null);
  assert.equal(c(null), null); // blurry frame doesn't reset
  assert.equal(c("8851959132074"), "8851959132074");
  const d = makeConfirmer();
  assert.equal(d("111"), null);
  assert.equal(d("222"), null);
  assert.equal(d("222"), "222");
});

test("cameraErrorKind", () => {
  assert.equal(cameraErrorKind({ name: "NotAllowedError" }), "denied");
  assert.equal(cameraErrorKind({ name: "NotFoundError" }), "none");
  assert.equal(cameraErrorKind(new Error("x")), "other");
  assert.equal(cameraErrorKind(undefined), "other");
});
