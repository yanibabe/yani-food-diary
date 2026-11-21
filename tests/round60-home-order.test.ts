import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Round 60: the home page order is Add food → one slim row of tiles → the four meals. Nothing tall sits between them,
// and "Share day" is no longer last. (Source-order check: it fails if someone moves the big cards back.)
const src = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const at = (s: string) => src.indexOf(s);

test("tiles sit right under Add food, before the meals", () => {
  const add = at("openAdd}>");
  const tiles = at("<HomeTiles");
  const meals = at("{SLOTS.map(");
  assert.ok(add > 0 && tiles > add && meals > tiles, `order add=${add} tiles=${tiles} meals=${meals}`);
});

test("the big water card and the week chart are not on the page body any more", () => {
  assert.equal(src.includes("<WaterCard"), false);
  assert.equal(src.includes("<WeekKcalChart"), false);
});

test("the share dialog is drawn from the tile row (opened from the Share report tile; still one ShareDayButton, before the meals)", () => {
  assert.equal(src.split("<ShareDayButton").length - 1, 1);
  assert.ok(at("<ShareDayButton") < at("{SLOTS.map("));
  assert.ok(at("<ShareDayButton") > at("<HomeTiles"));
});

test("the tile row opens the full water card and the share report", () => {
  const tiles = readFileSync(new URL("../app/components/HomeTiles.tsx", import.meta.url), "utf8");
  assert.ok(tiles.includes("<WaterCard") && tiles.includes("home-tile-share"));
  assert.ok(tiles.includes("home-water-plus"), "quick +1 glass on the water tile");
});
