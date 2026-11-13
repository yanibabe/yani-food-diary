import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDDY, buddySvg, cleanBuddy, parseBuddy, SHAPES, HEADS } from "../app/lib/buddy/parts.ts";

test("nothing saved or broken text → null (app shows the default buddy)", () => {
  assert.equal(parseBuddy(null), null);
  assert.equal(parseBuddy(""), null);
  assert.equal(parseBuddy("{oops"), null);
  assert.equal(parseBuddy("[1,2]"), null);
});

test("a saved buddy comes back the same", () => {
  const b = { shape: "onigiri", color: "#F4C0D1", eyes: "wink", mouth: "cat", head: "strawberry", extras: ["blush", "coffee"] } as const;
  assert.deepEqual(parseBuddy(JSON.stringify(b)), { ...b, extras: ["blush", "coffee"] });
});

test("unknown parts fall back to the default, unknown extras are dropped", () => {
  const b = cleanBuddy({ shape: "dragon", color: "red", eyes: 5, mouth: "smile", head: "crown", extras: ["glasses", "laser", "glasses"] });
  assert.equal(b.shape, DEFAULT_BUDDY.shape);
  assert.equal(b.color, DEFAULT_BUDDY.color);
  assert.equal(b.eyes, DEFAULT_BUDDY.eyes);
  assert.equal(b.mouth, "smile");
  assert.equal(b.head, DEFAULT_BUDDY.head);
  assert.deepEqual(b.extras, ["glasses"]);
});

test("tricks in saved text never reach the drawing", () => {
  const svg = buddySvg(cleanBuddy({ color: '"/><script>alert(1)</script>', shape: "toString" }));
  assert.ok(!svg.includes("<script"));
  assert.ok(svg.includes(SHAPES.blob.d));
});

test("every shape and head add-on draws", () => {
  for (const shape of Object.keys(SHAPES)) {
    for (const head of Object.keys(HEADS)) {
      const svg = buddySvg(cleanBuddy({ shape, head, extras: ["blush", "nose", "glasses", "earrings", "coffee"] }));
      assert.ok(svg.length > 100 && !svg.includes("NaN") && !svg.includes("undefined"), `${shape}/${head}`);
    }
  }
  // White buddy gets a faint edge so it shows on white.
  assert.ok(buddySvg({ ...DEFAULT_BUDDY, color: "#ffffff" }).includes('stroke="#e2ddd5"'));
});
