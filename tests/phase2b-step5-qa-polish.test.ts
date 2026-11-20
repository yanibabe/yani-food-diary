// Phase 2B, step 5 (QA polish): only presentation fixes that were verified by measuring the running app.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const entryRow = page.slice(page.indexOf("function EntryRow"), page.indexOf("export default function TodayPage"));

test("sections on Home are 16 px apart (the same as the side margin), so Add food clears the bottom nav", () => {
  assert.match(page, /<main className="page space-y-4">/);
  assert.doesNotMatch(page, /<main className="page space-y-5">/);
});

test("the P / C / F line of a meal wraps instead of being cut off, and each group stays whole", () => {
  const macros = entryRow.slice(entryRow.indexOf("text-[14px] leading-snug text-muted"), entryRow.indexOf("</div>", entryRow.indexOf("text-[14px] leading-snug text-muted")));
  assert.doesNotMatch(macros, /truncate/);
  assert.equal((macros.match(/whitespace-nowrap/g) ?? []).length, 3); // "P x", "C x", "F x g"
  // the same numbers, in the same format, with the same unknown ("?") marker
  assert.match(macros, /P \{Math\.round\(m\.protein\)\}\{q\("protein"\)\}/);
  assert.match(macros, /C \{Math\.round\(m\.carbs\)\}\{q\("carbs"\)\}/);
  assert.match(macros, /F \{Math\.round\(m\.fat\)\}\{q\("fat"\)\} g/);
});

test("meal names and kcal are unchanged by this polish", () => {
  assert.match(entryRow, /break-words font-medium leading-snug/);
  assert.match(entryRow, /fmtKcal\(m\.kcal\)/);
  assert.match(entryRow, /data-approx=\{approx \? "yes" : "no"\}/); // "~" for estimates, as before
});

test("the floating Ask-AI button, the sheets' history handling and the shared Sheet were NOT changed in this step", () => {
  const fab = readFileSync(new URL("../app/components/ChatFab.tsx", import.meta.url), "utf8");
  assert.match(fab, /const HISTORY_KEY = "yfdChat"/);
  const lib = readFileSync(new URL("../app/lib/chatFab.ts", import.meta.url), "utf8");
  assert.match(lib, /return \{ side: "right", y: clampY\(max - 56, vh, insets\) \}/); // default resting place as before
  const ui = readFileSync(new URL("../app/components/ui.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /pushState|popstate/); // Sheet still has no history logic
});
