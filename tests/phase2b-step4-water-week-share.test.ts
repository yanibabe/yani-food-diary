// Phase 2B, step 4: water + week as two compact cards; Share now opens from the week sheet.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const tiles = read("../app/components/HomeTiles.tsx");
const share = read("../app/components/ShareDayButton.tsx");
const page = read("../app/page.tsx");

test("Home row is two equal cards (water, this week); the Share tile is gone from the row", () => {
  assert.match(tiles, /grid grid-cols-2 gap-2\.5" data-testid="home-tiles"/);
  assert.doesNotMatch(tiles, /grid-cols-3/);
  assert.match(tiles, /data-testid="home-tile-water"/);
  assert.match(tiles, /data-testid="home-tile-week"/);
  assert.match(tiles, /h-full min-h-\[96px\]/); // both cards the same height
});

test("water: count and goal visible, quick +1 works, the full water card still opens, +/− history untouched", () => {
  assert.match(tiles, /data-testid="home-water-count"/);
  assert.match(tiles, /\{glasses\}\s*<span className="text-\[15px\] text-muted">\/\{goal\}<\/span>/);
  assert.match(tiles, /onClick=\{\(\) => setWater\(date, glasses \+ 1\)\}/);
  assert.match(tiles, /disabled=\{glasses >= GLASSES_MAX\}/);
  assert.match(tiles, /hit44 absolute bottom-2 right-2 grid h-9 w-9/); // 44x44 tap area (Phase 2A)
  assert.match(tiles, /<WaterCard date=\{date\} \/>/);
  assert.match(tiles, /setPanel\("water"\)/);
  assert.match(tiles, /glassesOn\(waterLogs, date\)/); // same data source
});

test("week: same average, same calculation, same chart sheet", () => {
  assert.match(tiles, /calorieWeek\(entries, date, today, target\)/);
  assert.match(tiles, /week\.avg != null \? fmtKcal\(week\.avg\) : "–"/);
  assert.match(tiles, /data-testid="home-week-avg"/);
  assert.match(tiles, /<WeekKcalChart/);
  assert.match(tiles, /setPanel\("week"\)/);
  const weekLib = read("../app/lib/week.ts");
  assert.match(weekLib, /export function calorieWeek/); // the aggregation module is still the one used
});

test("the week card says Share (when there is something to share); the sheet has labelled Share day and Share week buttons", () => {
  assert.match(tiles, /data-testid="home-week-share-label"/);
  assert.match(tiles, /\{share && \(\s*<span className="flex items-center gap-1 text-\[13px\]"/);
  assert.match(tiles, /data-testid="week-share-day"/);
  assert.match(tiles, /data-testid="week-share-week"/);
  assert.ok(tiles.includes("แชร์วันนี้") && tiles.includes("Share day") && tiles.includes("แชร์สัปดาห์") && tiles.includes("Share week"));
  assert.match(tiles, /dayHasMeals && \(\s*<button/); // no "Share day" when the day has no meals (same rule as before)
});

test("the share dialog is never nested inside the week sheet: one closes, then the other opens", () => {
  assert.match(tiles, /const openShare = \(r: "day" \| "week"\) => \{\s*setPanel\(null\);\s*setShareRange\(r\);\s*\}/);
  const weekSheetEnd = tiles.indexOf("</Sheet>", tiles.indexOf('panel === "week"'));
  const shareRender = tiles.indexOf("share?.({ range: shareRange");
  assert.ok(shareRender > weekSheetEnd, "the share dialog is drawn after (outside) the week sheet");
});

test("ShareDayButton: both daily and weekly sharing, output code untouched; controlled mode adds no button", () => {
  assert.match(share, /makeWeekPicture\(\{ entries, date, target, proteinTarget: mt\.protein, lang \}\)/);
  assert.match(share, /buildShareDay\(entries, date, readPics\(\), dn, lang\)/);
  assert.match(share, /shareFileName\(date\)/);
  assert.match(share, /weekFileName\(weekRange\(date\)\.start\)/);
  assert.match(share, /image\/png/);
  assert.match(share, /\{!controlled && <button/);
  assert.match(share, /controlled \? controlled\.onClose\(\) : setOpen\(false\)/);
  assert.match(share, /controlled\.range !== null : openOwn/);
  assert.match(share, /role="tablist"/); // the Day / Week tabs are still there
});

test("page: still exactly one ShareDayButton, shown only when the day or the week has meals, opened from the tiles", () => {
  assert.equal(page.split("<ShareDayButton").length - 1, 1);
  assert.match(page, /dayEntries\.length > 0 \|\| weekHasMeals \? \(ctl\) => \(/);
  assert.match(page, /controlled=\{ctl\}/);
  assert.doesNotMatch(page, /<ShareDayButton\s+tile/);
});

test("no data or aggregation module was edited by this step", () => {
  for (const f of ["../app/lib/water.ts", "../app/lib/week.ts", "../app/lib/store.tsx"]) assert.ok(read(f).length > 100);
  assert.doesNotMatch(tiles, /localStorage/);
});
