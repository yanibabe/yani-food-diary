import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Round 61 (style 2): the home page shows the app NAME (not the character), the date sits under it, the character
// lives in the chat header and as a small picture on the profile.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("home page: name on the left, no character picture", () => {
  const src = read("../app/page.tsx");
  assert.ok(src.includes('data-testid="app-name"') && src.includes("SnapCal"));
  assert.equal(src.includes("CharacterPicture"), false);
  assert.ok(src.indexOf('data-testid="app-name"') < src.indexOf('data-testid="home-date"'), "name above the date");
});

test("home page: both day arrows are still there, grouped with the name row", () => {
  const src = read("../app/page.tsx");
  assert.ok(src.includes("Previous day") && src.includes("Next day"));
});

test("chat header shows the character", () => {
  const src = read("../app/components/FoodChat.tsx");
  assert.ok(src.includes("<CharacterPicture size={30}"));
});

test("profile picture is small (44 inside a round tile), not the old 124", () => {
  const src = read("../app/profile/page.tsx");
  assert.ok(src.includes("<CharacterPicture size={44}"));
  assert.equal(src.includes("size={124}"), false);
});
