import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Round 62: the home name and title wear the app's thin "calm" weight (300, not 500), and the profile top is one card:
// avatar + name + goal pill, then a row with age / height / weight.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("home name and title are light (300), not medium", () => {
  const src = read("../app/page.tsx");
  assert.ok(/data-testid="app-name"/.test(src));
  const name = src.slice(src.lastIndexOf("<span", src.indexOf('data-testid="app-name"')), src.indexOf('data-testid="app-name"'));
  assert.ok(name.includes("font-light") && !name.includes("font-medium"), name);
  const h1 = src.slice(src.indexOf('data-testid="home-date"'), src.indexOf("</h1>", src.indexOf('data-testid="home-date"')));
  assert.ok(h1.includes("font-light") && !h1.includes("font-medium"), h1);
});

test("profile top is a glass card with avatar, goal pill and a facts row", () => {
  const src = read("../app/profile/page.tsx");
  for (const id of ["profile-head", "profile-avatar", "profile-goal", "profile-facts"]) assert.ok(src.includes(`data-testid="${id}"`), id);
  assert.ok(src.includes('className="glass px-4 py-4" data-testid="profile-head"'));
});

test("the facts row only lists values she has (age, height, weight)", () => {
  const src = read("../app/profile/page.tsx");
  assert.ok(src.includes("p.age ?") && src.includes("p.heightCm ?") && src.includes("p.weightKg ?"));
});
