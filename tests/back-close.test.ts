import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSheetOnTop, sheetHistoryState, shouldBackOnClose, shouldCloseOnPop, shouldPush } from "../app/lib/useBackClose.ts";

test("push only once per open", () => {
  assert.equal(shouldPush(true, false), true);
  assert.equal(shouldPush(true, true), false); // strict-mode double effect
  assert.equal(shouldPush(false, false), false);
});

test("sheetHistoryState keeps existing state", () => {
  assert.deepEqual(sheetHistoryState({ a: 1 }), { a: 1, yfdSheet: 1 });
  assert.deepEqual(sheetHistoryState(null), { yfdSheet: 1 });
});

test("close from a button goes back only when our step is on top", () => {
  assert.equal(shouldBackOnClose(false, true, { yfdSheet: 1 }), true);
  assert.equal(shouldBackOnClose(false, true, null), false);
  assert.equal(shouldBackOnClose(false, true, { yfdSheet: 1, yfdChat: 1 }), false);
  assert.equal(shouldBackOnClose(false, true, { yfdSheet: 1, yfdAddLayer: 1 }), false);
  assert.equal(shouldBackOnClose(false, false, { yfdSheet: 1 }), false);
  assert.equal(shouldBackOnClose(true, true, { yfdSheet: 1 }), false);
});

test("popstate closes the sheet only when our step is gone", () => {
  assert.equal(shouldCloseOnPop(true, null), true);
  assert.equal(shouldCloseOnPop(true, { yfdSheet: 1 }), false);
  assert.equal(shouldCloseOnPop(false, null), false);
  assert.equal(isSheetOnTop({ yfdSheet: 1 }), true);
});

test("HomeTiles uses the hook for its sheets", () => {
  const src = readFileSync(new URL("../app/components/HomeTiles.tsx", import.meta.url), "utf8");
  assert.match(src, /import \{ useBackClose \} from "\.\.\/lib\/useBackClose"/);
  assert.match(src, /useBackClose\(panel !== null \|\| shareRange !== null/);
});
