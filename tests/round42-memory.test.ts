// Round 42: saved custom ingredients, usual picks, safe reading, and the backup file.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_KEY, PREFS_KEY, addCustom, editCustom, deleteCustom, parseCustom, serializeCustom, loadCustom, saveCustom, loadPrefs, savePrefs,
  recordPick, forgetPick, forgetPickEverywhere, setPreferred, preferredFor, parsePrefs, serializePrefs, queryKeyOf, pickId, MAX_PICKS,
  type PickRef, type IngredientPrefPick,
} from "../app/lib/customIngredients.ts";
import { localSuggestions, buildIngredient, suggestionFromPick } from "../app/lib/ingredientSearch.ts";
import { BACKUP_KEYS, makeBackup, parseBackup, backupCounts } from "../app/lib/backup.ts";

const egg: PickRef = { kind: "ref", key: "egg", name: "ไข่ไก่" };
const white: PickRef = { kind: "ref", key: "egg-white", name: "ไข่ขาว" };
const fake = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

// ---------------- custom ingredients ----------------

test("add, edit and delete a custom ingredient", () => {
  const a = addCustom([], { name: "  แกงเขียวหวาน  แม่ ", kcal: 180.456, protein: 9, carbs: null, fat: 13 }, 100, "c1");
  assert.ok(a.ok);
  assert.equal(a.item.name, "แกงเขียวหวาน แม่");
  assert.equal(a.item.kcal, 180.46);
  assert.equal(a.item.carbs, null, "left empty = unknown, not 0");
  assert.equal(a.item.createdAt, 100);
  const e = editCustom(a.list, "c1", { name: "แกงเขียวหวานแม่", kcal: 200, protein: 10, carbs: 7, fat: 14 }, 500);
  assert.ok(e.ok);
  assert.equal(e.item.id, "c1");
  assert.equal(e.item.createdAt, 100);
  assert.equal(e.item.updatedAt, 500);
  assert.equal(e.item.carbs, 7);
  assert.equal(e.list.length, 1);
  assert.deepEqual(deleteCustom(e.list, "c1"), []);
  assert.deepEqual(deleteCustom(e.list, "nope"), e.list);
});

test("bad input is refused, not saved: no name, no calories, negative numbers, duplicates", () => {
  assert.deepEqual(addCustom([], { name: "  ", kcal: 10 }, 1), { ok: false, error: "name" });
  assert.deepEqual(addCustom([], { name: "x", kcal: null }, 1), { ok: false, error: "kcal" });
  assert.deepEqual(addCustom([], { name: "x", kcal: -5 }, 1), { ok: false, error: "kcal" });
  assert.deepEqual(addCustom([], { name: "x", kcal: Number.NaN }, 1), { ok: false, error: "kcal" });
  assert.deepEqual(addCustom([], { name: "x", kcal: 10, protein: -1 }, 1), { ok: false, error: "number" });
  const a = addCustom([], { name: "Curry", kcal: 10 }, 1, "c1");
  assert.ok(a.ok);
  assert.deepEqual(addCustom(a.list, { name: "curry", kcal: 20 }, 2), { ok: false, error: "duplicate" });
  // same name, other state = a different food
  assert.ok(addCustom(a.list, { name: "curry", kcal: 20, state: "raw" }, 2).ok);
  assert.deepEqual(editCustom(a.list, "zzz", { name: "a", kcal: 1 }, 1), { ok: false, error: "missing" });
});

test("a zero-calorie custom food is allowed (0 is a real answer when she types it)", () => {
  const a = addCustom([], { name: "ชาไม่หวาน", kcal: 0, protein: 0, carbs: 0, fat: 0, per: "ml", gPerMl: 1 }, 1, "t");
  assert.ok(a.ok);
  assert.equal(a.item.kcal, 0);
  assert.equal(a.item.protein, 0);
  assert.deepEqual(suggestionFromPick({ kind: "custom", id: "t", name: "ชาไม่หวาน" }, "th", a.list)!.missing, []);
});

test("extra nutrients are kept only when they are real numbers", () => {
  const a = addCustom([], { name: "x", kcal: 10, extra: { fiber: 2, sugar: -1, sodiumMg: 300 } }, 1, "x");
  assert.ok(a.ok);
  assert.deepEqual(a.item.extra, { fiber: 2, sodiumMg: 300 });
});

test("saved text survives a round trip; bad text → empty list, never an error", () => {
  const a = addCustom([], { name: "Curry", kcal: 10, protein: 1, per: "ml", gPerMl: 1.1, aliases: ["แกง"], unit: "bowl" }, 7, "c1");
  assert.ok(a.ok);
  assert.deepEqual(parseCustom(serializeCustom(a.list)), a.list);
  for (const bad of [null, undefined, "", "not json", "{}", "123", '"x"', "[null, 5, {}, {\"id\":\"a\"}]", '[{"id":"a","name":"x","kcal":"ten"}]']) assert.deepEqual(parseCustom(bad as string), [], String(bad));
  // one bad row doesn't take the good ones down
  const mixed = JSON.stringify([...a.list, { id: "bad", name: "", kcal: 1 }, 5]);
  assert.deepEqual(parseCustom(mixed), a.list);
});

test("storage helpers: private mode / missing storage never throws", () => {
  const s = fake();
  const a = addCustom([], { name: "Curry", kcal: 10 }, 1, "c1");
  assert.ok(a.ok);
  assert.equal(saveCustom(a.list, s), true);
  assert.equal(s.m.get(CUSTOM_KEY), serializeCustom(a.list));
  assert.deepEqual(loadCustom(s), a.list);
  const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } };
  assert.deepEqual(loadCustom(broken), []);
  assert.deepEqual(loadPrefs(broken), []);
  assert.equal(saveCustom(a.list, broken), false);
  assert.equal(savePrefs([], broken), false);
  s.m.set(PREFS_KEY, "{{{");
  assert.deepEqual(loadPrefs(s), []);
});

// ---------------- usual picks ----------------

test("repeat picks: the food she picks most for those words comes first next time", () => {
  let p: IngredientPrefPick[] = [];
  p = recordPick(p, "ไข่", egg, 1);
  p = recordPick(p, "ไข่", white, 2);
  p = recordPick(p, " ไข่ ", white, 3);
  assert.equal(p.length, 2);
  assert.equal(preferredFor(p, "ไข่")!.pick.kind === "ref" && (preferredFor(p, "ไข่")!.pick as { key: string }).key, "egg-white");
  assert.equal(preferredFor(p, "ไข่")!.count, 2);
  const list = localSuggestions("ไข่", { lang: "th", prefs: p });
  assert.equal(list[0].id, "ref:egg-white");
  assert.equal(list[0].kind, "preferred");
  assert.equal(list[1].id, "ref:egg");
  assert.equal(list[1].kind, "recent");
  // other words are not affected
  assert.equal(preferredFor(p, "egg"), null);
});

test("ties go to the most recent; capital letters and spaces don't matter", () => {
  let p: IngredientPrefPick[] = [];
  p = recordPick(p, "Egg", egg, 1);
  p = recordPick(p, "egg  ", white, 5);
  assert.equal(queryKeyOf("  EGG  "), "egg");
  assert.equal(pickId(preferredFor(p, "EGG")!.pick), "ref:egg-white");
});

test("change my usual: one tap makes another food the first one, even if the old one was used more", () => {
  let p: IngredientPrefPick[] = [];
  for (let i = 0; i < 5; i++) p = recordPick(p, "ไข่", egg, i);
  p = setPreferred(p, "ไข่", white, 10);
  assert.equal(pickId(preferredFor(p, "ไข่")!.pick), "ref:egg-white");
  // setting an already-known one works too
  p = setPreferred(p, "ไข่", egg, 20);
  assert.equal(pickId(preferredFor(p, "ไข่")!.pick), "ref:egg");
});

test("forget this choice (one pick, all picks for those words, or a food everywhere)", () => {
  let p: IngredientPrefPick[] = [];
  p = recordPick(p, "ไข่", egg, 1);
  p = recordPick(p, "ไข่", white, 2);
  p = recordPick(p, "egg", white, 3);
  assert.equal(forgetPick(p, "ไข่", white).length, 2);
  assert.equal(forgetPick(p, "ไข่").length, 1);
  assert.equal(forgetPickEverywhere(p, white).length, 1);
  assert.equal(preferredFor(forgetPick(p, "ไข่", white), "ไข่")!.pick.kind, "ref");
  assert.equal(localSuggestions("ไข่", { lang: "th", prefs: forgetPick(p, "ไข่") })[0].kind !== "preferred", true);
});

test("a deleted custom ingredient quietly disappears from the list even if it was her usual", () => {
  const a = addCustom([], { name: "ไข่ต้มบ้าน", kcal: 150 }, 1, "c1");
  assert.ok(a.ok);
  const pick: PickRef = { kind: "custom", id: "c1", name: "ไข่ต้มบ้าน" };
  const p = recordPick([], "ไข่ต้ม", pick, 1);
  assert.equal(localSuggestions("ไข่ต้ม", { lang: "th", custom: a.list, prefs: p })[0].id, "custom:c1");
  const after = localSuggestions("ไข่ต้ม", { lang: "th", custom: deleteCustom(a.list, "c1"), prefs: p });
  assert.ok(after.every((s) => s.id !== "custom:c1"));
});

test("a USDA pick and an AI pick are kept with their numbers and rebuilt without any network", () => {
  const usda: PickRef = {
    kind: "usda", name: "Chicken, breast, raw",
    usda: { fdcId: 1, description: "Chicken, breast, raw", dataType: "foundation", per100: { kcal: 106, protein: 22.5, carbs: 0, fat: 1.9 }, per: "g", energy: "1008", fetchedAt: 5 },
  };
  const ai: PickRef = { kind: "ai", name: "ข้าวเหนียวมะม่วง", ai: { per100: { kcal: 210, protein: 3, carbs: 40, fat: 5 }, unitG: null, gPerMl: null, unitFor: null, state: "prepared" } };
  let p: IngredientPrefPick[] = [];
  p = recordPick(p, "อกไก่", usda, 1);
  p = recordPick(p, "ข้าวเหนียวมะม่วง", ai, 2);
  const back = parsePrefs(serializePrefs(p));
  assert.deepEqual(back, p);
  const u = localSuggestions("อกไก่", { lang: "th", prefs: back })[0];
  assert.equal(u.id, "usda:1");
  assert.equal(u.kind, "preferred");
  const ing = buildIngredient(u, 150, "g", { id: "i" });
  assert.equal(ing.usda!.fdcId, 1);
  assert.equal(ing.usda!.name, "Chicken, breast, raw");
  const a = localSuggestions("ข้าวเหนียวมะม่วง", { lang: "th", prefs: back })[0];
  const ing2 = buildIngredient(a, 1, "g", { id: "j" });
  assert.equal(ing2.aiRef!.name, "ข้าวเหนียวมะม่วง");
  assert.equal(ing2.aiRef!.state, "prepared");
});

test("saved picks: bad rows are dropped, duplicates merged, list is capped", () => {
  for (const bad of [null, "", "nope", "{}", "[1,2]", '[{"queryKey":"","pick":{}}]', '[{"queryKey":"x","pick":{"kind":"ref"}}]', '[{"queryKey":"x","pick":{"kind":"usda","name":"a","usda":{}}}]']) assert.deepEqual(parsePrefs(bad as string), [], String(bad));
  let p: IngredientPrefPick[] = [];
  for (let i = 0; i < MAX_PICKS + 20; i++) p = recordPick(p, `q${i}`, { kind: "ref", key: "egg", name: "x" }, i);
  assert.equal(p.length, MAX_PICKS);
  assert.ok(p.some((x) => x.queryKey === `q${MAX_PICKS + 19}`), "newest kept");
  assert.ok(!p.some((x) => x.queryKey === "q0"), "oldest dropped");
});

test("stored picks hold only names and numbers", () => {
  const p = recordPick([], "ไข่", egg, 1);
  assert.deepEqual(Object.keys(p[0]).sort(), ["count", "lastUsed", "pick", "queryKey"]);
  assert.deepEqual(Object.keys(p[0].pick).sort(), ["key", "kind", "name"]);
});

// ---------------- backup ----------------

const oldData = {
  entries: "[]", recipes: JSON.stringify([{ id: "r" }]), goals: "{}", body: "[]", water: "[]", labelFixes: "[]", buddy: "{}", lang: "th",
};

test("both new keys are in the backup, with the names the app uses", () => {
  assert.equal(BACKUP_KEYS.customIngredients, "yfd:v1:customIngredients");
  assert.equal(BACKUP_KEYS.ingredientPrefs, "yfd:v1:ingredientPrefs");
  assert.equal(CUSTOM_KEY, BACKUP_KEYS.customIngredients);
  assert.equal(PREFS_KEY, BACKUP_KEYS.ingredientPrefs);
});

test("a new backup carries custom ingredients and usual picks through a file and back", () => {
  const a = addCustom([], { name: "Curry", kcal: 10 }, 1, "c1");
  assert.ok(a.ok);
  const p = recordPick([], "ไข่", egg, 1);
  const b = makeBackup({ ...oldData, customIngredients: serializeCustom(a.list), ingredientPrefs: serializePrefs(p) }, {}, 9);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.deepEqual(parseCustom(res.backup.data.customIngredients), a.list);
  assert.deepEqual(parsePrefs(res.backup.data.ingredientPrefs), p);
  assert.deepEqual(backupCounts(res.backup), { meals: 0, recipes: 1, days: 0, photos: 0 });
});

test("an OLD backup file (made before Round 42) still restores: the new parts read as empty", () => {
  const old = { app: "snapcal", version: 1, savedAt: 5, data: oldData, photos: {} };
  const res = parseBackup(JSON.stringify(old));
  assert.ok(res.ok);
  assert.equal(res.backup.data.customIngredients, null);
  assert.equal(res.backup.data.ingredientPrefs, null);
  assert.equal(res.backup.data.recipes, oldData.recipes);
  assert.deepEqual(parseCustom(res.backup.data.customIngredients), []);
  assert.deepEqual(parsePrefs(res.backup.data.ingredientPrefs), []);
  // and makeBackup without the new parts gives the same thing
  assert.deepEqual(res.backup, makeBackup(oldData, {}, 5));
});

test("a damaged new part makes the whole file refused (so a bad file never half-restores)", () => {
  const bad = { app: "snapcal", version: 1, savedAt: 5, data: { ...oldData, customIngredients: "{oops" }, photos: {} };
  assert.equal(parseBackup(JSON.stringify(bad)).ok, false);
  const bad2 = { app: "snapcal", version: 1, savedAt: 5, data: { ...oldData, ingredientPrefs: "{}" }, photos: {} };
  assert.equal(parseBackup(JSON.stringify(bad2)).ok, false);
});
