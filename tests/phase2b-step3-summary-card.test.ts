// Phase 2B, step 3: the calorie summary is tighter, but every number, target, range, percentage, tip and action stays.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/components/ui.tsx", import.meta.url), "utf8");
const card = page.slice(page.indexOf('data-testid="summary-card"') - 60, page.indexOf("</section>", page.indexOf('data-testid="summary-card"')) + 10);

test("the summary shows eaten, remaining (or over) and the target, with the same test ids as before", () => {
  assert.match(card, /data-testid="eaten-kcal"/);
  assert.match(card, /data-testid="target-kcal"/);
  assert.match(card, /fmtKcal\(total\.kcal\)/); // eaten
  assert.match(card, /fmtKcal\(Math\.abs\(left\)\)/); // remaining or over
  assert.match(card, /fmtKcal\(target\)/); // target
  assert.ok(card.includes("กินแล้ว") && card.includes("Eaten"));
  assert.ok(card.includes("เหลืออีก") && card.includes("Left"));
  assert.ok(card.includes("เกินเป้า") && card.includes("Over target"));
  assert.ok(card.includes("เป้า") && card.includes("Target"));
});

test("the maths is untouched: same totals, same remaining, same targets", () => {
  assert.match(page, /const total = useMemo\(\(\) => sumMacros\(dayEntries\.flatMap\(\(e\) => e\.items\.map\(pickMacros\)\)\), \[dayEntries\]\)/);
  assert.match(page, /const left = target - total\.kcal;/);
  assert.match(page, /const mTargets = macroTargets\(target, proteinTargetG\(goals\.profile, target\)\);/);
  assert.match(page, /const over = eaten > target;/);
});

test("over target is still marked by the warn colour and the ring's over colour", () => {
  assert.match(card, /left < 0 \? "text-warn-ink"/);
  assert.match(page, /over \? "var\(--over\)" : "var\(--ink\)"/);
});

test("macros: values, targets, ranges AND the percentage share are all still shown on Home", () => {
  assert.match(card, /<MacroCards compact m=\{total\} targets=\{mTargets\} showSplit ranges=\{\{/);
  assert.match(ui, /data-testid=\{`split-\$\{c\.key\}`\}/); // the % under each macro
  assert.match(ui, /\{showSplit && \(/);
  assert.match(ui, /rng\(c\.key\)!\[0\]\}–\$\{rng\(c\.key\)!\[1\]\} g/); // ranges
  assert.match(ui, /tr\("จาก", "of"\)/); // target wording
});

test("the compact option is opt-in: other screens (meal review, recipe page) keep the old tiles", () => {
  assert.match(ui, /compact \? "gap-2" : "gap-2\.5"/);
  assert.match(ui, /compact \? "px-2 py-2\.5" : "px-3 py-3"/);
  const uses = (s: string) => (s.match(/<MacroCards/g) ?? []).length;
  assert.equal(uses(readFileSync(new URL("../app/components/MealReview.tsx", import.meta.url), "utf8")), 1);
  assert.doesNotMatch(readFileSync(new URL("../app/components/MealReview.tsx", import.meta.url), "utf8"), /MacroCards compact/);
  assert.doesNotMatch(readFileSync(new URL("../app/recipes/[id]/page.tsx", import.meta.url), "utf8"), /MacroCards compact/);
});

test("the nutrition tip keeps its component and its conditions", () => {
  assert.match(card, /<MacroTipLine m=\{total\} targets=\{mTargets\} kcalTarget=\{target\} \/>/);
  assert.match(card, /\{ready && \(\s*<div className="mt-2\.5 w-full">/);
});

test("'what can I eat' stays one clear secondary action: today only, 44 px, bordered pill, same page", () => {
  assert.match(card, /\{ready && date === today && \(/);
  assert.match(card, /href="\/add\/suggest"/);
  assert.match(card, /data-testid="suggest-button"/);
  assert.match(card, /min-h-\[44px\]/);
  assert.match(card, /rounded-full border border-white\/90 bg-white\/60/);
  assert.equal((card.match(/<Link/g) ?? []).length, 1); // still one action in the card
});

test("same look: the glass card class, the ring and the existing tokens only (no new colours, no new chart)", () => {
  assert.match(card, /<section className="card /);
  assert.doesNotMatch(card, /#[0-9a-fA-F]{3,6}\b/);
  assert.doesNotMatch(card, /<canvas|recharts|<Chart/);
  assert.equal((card.match(/<Ring /g) ?? []).length, 1);
});

test("the ring keeps its old default size and line, so nothing else that uses it changes", () => {
  assert.match(page, /function Ring\(\{ eaten, target, size = 210, stroke = 5 \}/);
});

test("Add food and everything after the card were not touched by this step", () => {
  assert.match(page, /onClick=\{openAdd\}/);
  assert.match(page, /<HomeTiles/);
  assert.match(page, /data-testid="meals-card"/);
});
