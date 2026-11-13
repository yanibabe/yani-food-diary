import { test } from "node:test";
import assert from "node:assert/strict";
import { passcodeHeaderValue, passcodeMatches, readPasscodeHeader } from "../app/lib/passcode.ts";

test("passcode: right one passes, wrong / empty / missing fail, spaces ignored", () => {
  assert.equal(passcodeMatches("mango123", "mango123"), true);
  assert.equal(passcodeMatches("mango123", " mango123 "), true);
  assert.equal(passcodeMatches("mango123", "mango124"), false);
  assert.equal(passcodeMatches("mango123", "mango12"), false);
  assert.equal(passcodeMatches("mango123", ""), false);
  assert.equal(passcodeMatches("mango123", null), false);
  assert.equal(passcodeMatches("", ""), false);
});

test("passcode: Thai passcodes survive the trip in a header", () => {
  const v = passcodeHeaderValue("มะม่วง99");
  assert.match(v, /^[\x20-\x7e]+$/); // plain letters only, safe for a header
  assert.equal(passcodeMatches("มะม่วง99", readPasscodeHeader(v)), true);
});
