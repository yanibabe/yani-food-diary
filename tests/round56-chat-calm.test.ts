import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_EXAMPLES, CHAT_PRIVACY, toggleInfo, MAX_TEXT } from "../app/lib/foodChat.ts";

test("exactly three short example questions, each with an icon and both languages", () => {
  assert.equal(CHAT_EXAMPLES.length, 3);
  assert.deepEqual(CHAT_EXAMPLES.map((x) => x.icon), ["flame", "leaf", "scales"]);
  for (const x of CHAT_EXAMPLES) {
    assert.ok(x.th.length > 0 && x.en.length > 0);
    assert.ok(x.th.length <= MAX_TEXT && x.en.length <= MAX_TEXT);
    assert.ok(x.en.length <= 45, "short enough for a 390px phone");
  }
});

test("privacy note keeps the exact meaning, both languages", () => {
  assert.match(CHAT_PRIVACY.en, /age, weight, height, targets and what you ate today/);
  assert.match(CHAT_PRIVACY.en, /not your name, photos or older history/);
  assert.match(CHAT_PRIVACY.th, /ไม่ส่งชื่อ รูป หรือประวัติเก่า/);
});

test("info button toggles open and closed", () => {
  assert.equal(toggleInfo(false), true);
  assert.equal(toggleInfo(true), false);
});
