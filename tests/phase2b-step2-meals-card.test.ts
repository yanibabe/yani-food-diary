// Phase 2B, step 2: the four meals live in one glass card. Same order, names, totals, tap-to-open, swipe-to-delete.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SLOTS } from "../app/lib/types.ts";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const meals = page.slice(page.indexOf('data-testid="meals-card"') - 200, page.indexOf("</section>", page.indexOf('data-testid="meals-card"')) + 10);
const entryRow = page.slice(page.indexOf("function EntryRow"), page.indexOf("export default function TodayPage"));

test("the four meals keep their categories and order", () => {
  assert.deepEqual(SLOTS, ["breakfast", "lunch", "dinner", "snack"]);
  assert.match(meals, /SLOTS\.map\(\(slot, i\) =>/);
});

test("one glass card holds all four, each still found by its own test id", () => {
  assert.equal((page.match(/data-testid="meals-card"/g) ?? []).length, 1);
  assert.match(meals, /<section className="card [^"]*overflow-hidden" data-testid="meals-card">/);
  assert.match(meals, /data-testid=\{`slot-\$\{slot\}`\}/);
  assert.match(meals, /border-t border-line/); // a hairline between meals, from the existing line colour
  assert.match(meals, /SLOT_COLORS\[i % SLOT_COLORS\.length\]/); // the same four meal dots
});

test("each meal name stays visible; a meal with entries shows its total kcal", () => {
  assert.match(meals, /SLOT_LABEL\[slot\]\[lang\]/);
  assert.match(meals, /fmtKcal\(kcal\)\} kcal/);
  assert.match(meals, /sumMacros\(list\.flatMap\(\(e\) => e\.items\.map\(pickMacros\)\)\)/); // same totals maths
});

test("an empty meal is one slim, labelled row that does nothing when tapped", () => {
  assert.match(meals, /list\.length === 0 \? "min-h-\[52px\]"/);
  assert.ok(meals.includes("ยังไม่มีรายการ") && meals.includes("Nothing yet"));
  const emptyPart = meals.slice(meals.indexOf("list.length === 0 ? ("), meals.indexOf(") : ("));
  assert.doesNotMatch(emptyPart, /onClick|<Link|<button|href=/);
});

test("entries keep tap-to-open and swipe-to-delete; names wrap instead of being cut off", () => {
  assert.match(entryRow, /<SwipeRow onDelete=\{onDelete\}/);
  assert.match(entryRow, /href=\{`\/entry\/\$\{e\.id\}`\}/);
  assert.match(entryRow, /break-words font-medium/);
  assert.doesNotMatch(entryRow.slice(entryRow.indexOf("dn(e.title, e.alt)") - 120, entryRow.indexOf("dn(e.title, e.alt)")), /truncate/);
  assert.match(entryRow, /P \{Math\.round\(m\.protein\)\}/); // macros per entry still shown
  assert.match(entryRow, /fmtKcal\(m\.kcal\)/); // and each entry's kcal
  assert.match(page, /onDelete=\{\(\) => removeEntry\(e\)\}/); // the same delete + undo path
});

test("room under the card so the floating Ask-AI button never covers a kcal number", () => {
  assert.match(page, /className="card mb-24 overflow-hidden" data-testid="meals-card"/);
});

test("nothing else on Home was touched by this step: the Add food button and undo toast are as before", () => {
  assert.match(page, /onClick=\{openAdd\}/);
  assert.match(page, /data-testid="removed-toast"/);
  assert.match(page, /data-testid="removed-undo"/);
});
