// Home row: Water + Share report (the daily nutrition report is the primary share action; Day/Week is chosen once, in the preview).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const tiles = read("../app/components/HomeTiles.tsx");
const share = read("../app/components/ShareDayButton.tsx");
const page = read("../app/page.tsx");

test("Home row is two equal cards (water, share report)", () => {
  assert.match(tiles, /grid grid-cols-2 gap-2\.5" data-testid="home-tiles"/);
  assert.doesNotMatch(tiles, /grid-cols-3/);
  assert.match(tiles, /data-testid="home-tile-water"/);
  assert.match(tiles, /data-testid="home-tile-share"/);
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

test("Today no longer promotes the weekly average: the daily report is the primary share action, for the viewed date", () => {
  assert.doesNotMatch(tiles, /home-week-avg|calorieWeek|avg kcal a day|เฉลี่ย kcal\/วัน/);
  assert.match(tiles, /data-testid="home-share-kcal"/);
  assert.match(tiles, /sumMacros\(dayList\.flatMap/); // the day's kcal for the VIEWED date
  assert.match(tiles, /setShareRange\(dayHasMeals \? "day" : "week"\)/); // day first; week only if the viewed day is empty
  assert.match(tiles, /disabled=\{!share\}/); // nothing logged at all: the tile says so instead of offering an empty report
});

test("no redundant Today / This week controls: no week sheet and no Share day / Share week buttons on Today", () => {
  assert.doesNotMatch(tiles, /week-share-row|week-share-day|week-share-week|WeekKcalChart|panel === "week"/);
  const shareSrc = read("../app/components/ShareDayButton.tsx");
  assert.equal((shareSrc.match(/data-testid="share-range"/g) ?? []).length, 1, "ONE Day | Week switch, inside the preview");
  assert.match(shareSrc, /role="tablist"/);
});

test("the share dialog is one sheet opened from the tile (never nested)", () => {
  assert.match(tiles, /const openShare = \(\) => \{\s*if \(!share\) return;\s*setPanel\(null\);/);
  assert.match(tiles, /share\?\.\(\{ range: shareRange/);
});

test("ShareDayButton: daily + weekly reports for the VIEWED date, image export and native share kept", () => {
  assert.match(share, /layoutWeekReport\(buildWeekReport\(\{ entries, date, today, target/);
  assert.match(share, /layoutDayReport\(buildDayReport\(\{ entries, date, target/);
  assert.match(share, /reportFileName\("day", date\)/);
  assert.match(share, /reportFileName\("week", start\)/);
  assert.match(share, /navigator\.canShare\?\.\(\{ files: \[file\] \}\)/);
  assert.match(share, /navigator\.share\(\{ files: \[file\] \}\)/);
  assert.match(share, /download=\{fileName\}/);
  assert.match(share, /setRange\(asked === "day" && !dayHasMeals \? "week" : asked\)/);
  assert.doesNotMatch(share, /!controlled/); // no second, standalone entry point
});

test("page: still exactly one ShareDayButton, shown only when the day or the week has meals, opened from the tiles", () => {
  assert.equal(page.split("<ShareDayButton").length - 1, 1);
  assert.match(page, /dayEntries\.length > 0 \|\| weekHasMeals \? \(ctl\) => \(/);
  assert.match(page, /controlled=\{ctl\}/);
  assert.match(page, /today=\{today\}/);
});

test("no data or aggregation module was edited by this change", () => {
  for (const f of ["../app/lib/water.ts", "../app/lib/week.ts", "../app/lib/store.tsx"]) assert.ok(read(f).length > 100);
  assert.doesNotMatch(tiles, /localStorage/);
});
