// Batch 3: Back and the Add food sheet (pure rules + wiring checks).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { actionOnPop, isSheetStep, shouldPushSheetStep, shouldRemoveSheetStep, sheetStepState } from "../app/lib/addSheetHistory.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const S = { __NA: true, yfdAddSheet: 1 };

test("the sheet step keeps Next.js's own marker and adds ours", () => {
  const st = sheetStepState({ __NA: true, tree: 1 });
  assert.equal(st.__NA, true);
  assert.equal(st.tree, 1);
  assert.ok(isSheetStep(st));
  assert.ok(!isSheetStep({ __NA: true }));
  assert.ok(!isSheetStep(null));
  assert.deepEqual(Object.keys(sheetStepState(null)), ["yfdAddSheet"]);
});

test("opening twice (double tap) never pushes two steps; closing only removes our own top step", () => {
  assert.equal(shouldPushSheetStep(false), true);
  assert.equal(shouldPushSheetStep(true), false);
  assert.equal(shouldRemoveSheetStep(true, S), true);
  assert.equal(shouldRemoveSheetStep(true, { __NA: true }), false);
  assert.equal(shouldRemoveSheetStep(false, S), false);
});

const base = { layerOpen: false, stepActive: true, pending: false, reopen: false, state: { __NA: true } as unknown };

test("Back from the sheet closes it", () => {
  assert.equal(actionOnPop({ ...base }), "close-sheet");
});

test("a pop that lands on our own step changes nothing", () => {
  assert.equal(actionOnPop({ ...base, state: S }), "none");
});

test("Back from a layer returns to the sheet (search words stay in page state)", () => {
  assert.equal(actionOnPop({ ...base, layerOpen: true, reopen: true, state: S }), "reopen-sheet");
});

test("after Save (no reopen) the sheet step is dropped too, so Back never lands on a dead step", () => {
  assert.equal(actionOnPop({ ...base, layerOpen: true, reopen: false, state: S }), "drop-sheet-step");
  assert.equal(actionOnPop({ ...base, layerOpen: true, reopen: false, stepActive: false, state: S }), "none");
});

test("leaving by a link: the pending trip runs after our step is removed", () => {
  assert.equal(actionOnPop({ ...base, stepActive: false, pending: true }), "run-pending");
});

test("no sheet step, nothing to do", () => {
  assert.equal(actionOnPop({ ...base, stepActive: false }), "none");
});

test("page wiring: sheet closes through the shared helper, layers tell it when they open and save, links leave through it", () => {
  const page = read("../app/page.tsx");
  assert.match(page, /useAddSheetHistory\(/);
  assert.match(page, /sheetHistory\.pushStep\(\)/);
  assert.match(page, /onClose=\{sheetHistory\.closeSheet\}/);
  assert.match(page, /sheetHistory\.layerOpening\(\)/);
  assert.match(page, /sheetHistory\.layerSaved\(\)/);
  assert.match(page, /sheetHistory\.runAfterStep\(run\)/);
  // the one-tap repeat closes through the helper too (no dead step)
  assert.match(page, /sheetHistory\.closeSheet\(\);\s*\n\s*\};/);
});

test("hook: clears a stale marker after a reload and removes its step only when it is on top", () => {
  const hook = read("../app/lib/useAddSheetHistory.ts");
  assert.match(hook, /replaceState\(rest/);
  assert.match(hook, /shouldRemoveSheetStep\(stepActive\.current, window\.history\.state\)/);
  assert.match(hook, /setTimeout\(/); // fallback if the browser never answers
});
