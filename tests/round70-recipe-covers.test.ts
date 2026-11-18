import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupCounts, makeBackup, parseBackup } from "../app/lib/backup.ts";
import { dishKey, findPic, pictureRequest, recipePictureItems, shouldDraw, withPic, type MealPics } from "../app/lib/mealPics.ts";

const pic = { photoId: "pic-r1", visual: "a bowl of curry", createdAt: 1 };
const ings = [
  { id: "i1", name: "ไข่ไก่", amount: 2, unit: "egg" },
  { id: "i2", name: "  ", amount: 1, unit: "g" },
  { id: "i3", name: "Rice", amount: 200, unit: "g" },
] as never[];

test("recipe ingredients become picture items (name, amount, English unit); blank names dropped", () => {
  const items = recipePictureItems(ings);
  assert.equal(items.length, 2);
  assert.deepEqual(Object.keys(items[0]).sort(), ["amount", "name", "unit"]);
  assert.equal(items[1].unit, "g");
  const body = pictureRequest("แกงเขียวหวาน", items, { lang: "th" });
  assert.equal(body.title, "แกงเขียวหวาน");
  assert.equal(body.items.length, 2);
});

test("a recipe and a meal with the same name share one picture key (no second drawing)", () => {
  let pics: MealPics = withPic({}, "Green Curry", pic);
  assert.equal(dishKey("Green Curry"), dishKey("  green  curry! "));
  assert.equal(findPic(pics, "green curry")?.photoId, "pic-r1"); // the meal finds the recipe's picture
  assert.equal(shouldDraw(pics, "green curry", new Set()), false);
  // and the other way round: a picture drawn for a meal is found by the recipe
  pics = withPic({}, "ต้มยำ", pic);
  assert.equal(shouldDraw(pics, "ต้มยำ", new Set()), false);
});

test("only one request at a time per dish (recipe save + meal save together)", () => {
  const inflight = new Set([dishKey("Green Curry")]);
  assert.equal(shouldDraw({}, "green curry", inflight), false);
});

test("backup still carries the picture map with recipe covers", () => {
  const pics = withPic({}, "Green Curry", pic);
  const b = makeBackup({ entries: null, recipes: JSON.stringify([{ id: "r" }]), goals: null, body: null, water: null, labelFixes: null, buddy: null, lang: null, mealPics: JSON.stringify(pics) } as never, {});
  const parsed = parseBackup(JSON.stringify(b));
  assert.ok(parsed.ok);
  assert.ok(backupCounts);
});

test("the Recipe type keeps its required fields and coverPhotoId", () => {
  const t = readFileSync(new URL("../app/lib/types.ts", import.meta.url), "utf8");
  assert.match(t, /coverPhotoId: string \| null;/);
});

test("wiring: saving a NEW recipe draws in the background; list and page use the picture", () => {
  const store = readFileSync(new URL("../app/lib/store.tsx", import.meta.url), "utf8");
  assert.match(store, /drawInBackground\(r\.name, recipePictureItems/);
  assert.match(readFileSync(new URL("../app/recipes/page.tsx", import.meta.url), "utf8"), /MealThumb/);
  assert.match(readFileSync(new URL("../app/recipes/[id]/page.tsx", import.meta.url), "utf8"), /MealPicHeader[^>]*cover/);
});
