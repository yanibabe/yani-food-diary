// Round 78: share a recipe — checking what arrives, the unguessable id, the cover picture, the receiver's copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BODY_BYTES, MAX_COVER_BYTES, bytesToBase64Url, cleanFrom, findSavedShare, isValidShareId, newShareId, ogDescription,
  parseCoverDataUrl, parseShareRequest, parseStoredShare, recipeFromShare, sanitizeSharedRecipe, sharedTotals, toSharePayload, toStoredShare,
} from "../app/lib/shareRecipe.ts";
import type { Recipe } from "../app/lib/types.ts";

const ing = (name: string, amount = 100, extra: Record<string, unknown> = {}) => ({
  id: `local-${name}`, name, amount, unit: "g", photoId: "ph_secret", gramsPerUnit: null,
  label: { kcal: 130, protein: 3, carbs: 28, fat: 0.3, basis: "per100", via: "typed" },
  ...extra,
});
const recipe = (over: Record<string, unknown> = {}) => ({
  id: "rc_local", name: "ข้าวกะเพราไก่", servings: 2, cookedWeight: 600, category: "onedish", coverPhotoId: "ph_cover", createdAt: 1, updatedAt: 2,
  steps: ["ผัดกระเทียม", "ใส่ไก่"], ingredients: [ing("ข้าวสวย", 180), ing("ไก่สับ", 120)], ...over,
});

// a tiny real-looking JPEG header + padding, as a data URL
const jpegBytes = (n: number) => { const b = new Uint8Array(n); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0; return b; };
const dataUrl = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

test("ids: 192 random bits, base64url, 32 chars, all different", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newShareId()));
  assert.equal(ids.size, 200);
  for (const id of ids) {
    assert.match(id, /^[A-Za-z0-9_-]{32}$/);
    assert.ok(isValidShareId(id));
  }
});

test("ids: base64url matches Node's own encoding", () => {
  for (const n of [1, 2, 3, 24, 25]) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
    assert.equal(bytesToBase64Url(b), Buffer.from(b).toString("base64url"));
  }
});

test("ids: bad shapes are refused", () => {
  for (const bad of ["", "short", "../etc/passwd", "a".repeat(31), "a".repeat(33), "a".repeat(31) + "/", "a".repeat(31) + ".", null, undefined, 5, "a".repeat(31) + "\n"]) {
    assert.equal(isValidShareId(bad), false, String(bad));
  }
});

test("sanitize: keeps what the receiver needs, drops local-only fields", () => {
  const r = sanitizeSharedRecipe(recipe());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.name, "ข้าวกะเพราไก่");
  assert.equal(r.value.servings, 2);
  assert.equal(r.value.cookedWeight, 600);
  assert.equal(r.value.category, "onedish");
  assert.deepEqual(r.value.steps, ["ผัดกระเทียม", "ใส่ไก่"]);
  assert.equal(r.value.ingredients.length, 2);
  const json = JSON.stringify(r.value);
  for (const secret of ["rc_local", "ph_secret", "ph_cover", "local-", "createdAt", "updatedAt", "coverPhotoId", "photoId"]) assert.ok(!json.includes(secret), secret);
  assert.deepEqual(r.value.ingredients[0].label, { kcal: 130, protein: 3, carbs: 28, fat: 0.3, basis: "per100", via: "typed" });
});

test("sanitize: unknown extra fields never get through", () => {
  const r = sanitizeSharedRecipe(recipe({ evil: "x", ingredients: [ing("a", 1, { __proto__: { z: 1 }, hack: 1 })] }));
  assert.ok(r.ok);
  if (r.ok) assert.ok(!JSON.stringify(r.value).includes("evil") && !JSON.stringify(r.value).includes("hack"));
});

test("sanitize: nutrition extras (aiRef, usda, refPick, density) survive when valid; USDA raw list is dropped", () => {
  const withExtras = ing("ไข่", 2, {
    unit: "egg", gramsPerUnit: 50, label: null, gPerMl: 1.03,
    aiRef: { name: "ไข่", per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, unitG: 50, gPerMl: null, state: "raw", unitFor: "egg" },
    refPick: { name: "ไข่", key: "egg" },
    usda: { fdcId: 171287, description: "Egg, whole, raw", dataType: "sr", per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, per: "g", energy: "1008", fetchedAt: 1, name: "ไข่", raw: [{ id: 1008, unit: "kcal", value: 143 }], extra: { fiber: 0 }, portions: [{ label: "1 large", grams: 50, ml: null }] },
  });
  const r = sanitizeSharedRecipe(recipe({ ingredients: [withExtras] }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const i = r.value.ingredients[0];
  assert.equal(i.aiRef?.per100.kcal, 143);
  assert.equal(i.usda?.fdcId, 171287);
  assert.ok(!("raw" in (i.usda ?? {})));
  assert.equal(i.refPick?.key, "egg");
  assert.equal(i.gPerMl, 1.03);
});

test("sanitize: refuses wrong shapes", () => {
  const cases: [string, unknown][] = [
    ["not an object", "hi"],
    ["no name", recipe({ name: "  " })],
    ["name too long", recipe({ name: "x".repeat(121) })],
    ["servings 0", recipe({ servings: 0 })],
    ["servings NaN", recipe({ servings: Number.NaN })],
    ["servings text", recipe({ servings: "2" })],
    ["cooked weight negative", recipe({ cookedWeight: -5 })],
    ["no ingredients", recipe({ ingredients: [] })],
    ["ingredients not a list", recipe({ ingredients: { a: 1 } })],
    ["bad unit", recipe({ ingredients: [ing("a", 1, { unit: "toString" })] })],
    ["negative amount", recipe({ ingredients: [ing("a", -1)] })],
    ["infinite amount", recipe({ ingredients: [ing("a", Infinity)] })],
    ["label wrong", recipe({ ingredients: [ing("a", 1, { label: { kcal: "x" } })] })],
    ["label bad basis", recipe({ ingredients: [ing("a", 1, { label: { kcal: 1, protein: 1, carbs: 1, fat: 1, basis: "per7" } })] })],
    ["step not text", recipe({ steps: [5] })],
    ["steps not a list", recipe({ steps: "a" })],
    ["step too long", recipe({ steps: ["x".repeat(1001)] })],
    ["ingredient not an object", recipe({ ingredients: [null] })],
  ];
  for (const [label, v] of cases) assert.equal(sanitizeSharedRecipe(v).ok, false, label);
});

test("sanitize: limits are exactly 60 ingredients and 40 steps", () => {
  const many = (n: number) => Array.from({ length: n }, (_, k) => ing(`i${k}`));
  assert.equal(sanitizeSharedRecipe(recipe({ ingredients: many(60) })).ok, true);
  assert.equal(sanitizeSharedRecipe(recipe({ ingredients: many(61) })).ok, false);
  assert.equal(sanitizeSharedRecipe(recipe({ steps: Array.from({ length: 40 }, () => "s") })).ok, true);
  assert.equal(sanitizeSharedRecipe(recipe({ steps: Array.from({ length: 41 }, () => "s") })).ok, false);
});

test("sanitize: text is cleaned, an unknown category is dropped, empty steps vanish", () => {
  const r = sanitizeSharedRecipe(recipe({ name: " แกง\u0000เขียว\u0007 ", category: "nonsense", steps: ["  ", "ต้ม"] }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.name, "แกงเขียว");
  assert.equal(r.value.category, undefined);
  assert.deepEqual(r.value.steps, ["ต้ม"]);
});

test("sender name: cleaned, or the friendly default", () => {
  assert.equal(cleanFrom("  Yani "), "Yani");
  assert.equal(cleanFrom(""), "เพื่อน");
  assert.equal(cleanFrom(undefined), "เพื่อน");
  assert.equal(cleanFrom(42), "เพื่อน");
  assert.equal(cleanFrom("x".repeat(41)), "เพื่อน");
});

test("cover: jpeg and webp accepted, size and kind checked", () => {
  const ok = parseCoverDataUrl(dataUrl("image/jpeg", jpegBytes(5000)));
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.value.bytes.length, 5000);
  const webp = new Uint8Array(100);
  webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(parseCoverDataUrl(dataUrl("image/webp", webp)).ok, true);
  assert.equal(parseCoverDataUrl(dataUrl("image/jpeg", jpegBytes(MAX_COVER_BYTES))).ok, true);
  assert.equal(parseCoverDataUrl(dataUrl("image/jpeg", jpegBytes(MAX_COVER_BYTES + 1))).ok, false);
  assert.equal(parseCoverDataUrl(dataUrl("image/png", jpegBytes(500))).ok, false);
  assert.equal(parseCoverDataUrl(dataUrl("image/svg+xml", jpegBytes(500))).ok, false);
  assert.equal(parseCoverDataUrl(dataUrl("image/jpeg", webp)).ok, false); // says jpeg, is not
  assert.equal(parseCoverDataUrl("data:image/jpeg;base64,@@@@").ok, false);
  assert.equal(parseCoverDataUrl("https://evil.example/x.jpg").ok, false);
  assert.equal(parseCoverDataUrl(12).ok, false);
});

test("request: a good body passes; cover is optional", () => {
  const body = JSON.stringify({ recipe: recipe(), from: "Yani", cover: dataUrl("image/jpeg", jpegBytes(2000)) });
  const r = parseShareRequest(body);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.from, "Yani");
  assert.equal(r.value.cover?.mime, "image/jpeg");
  const none = parseShareRequest(JSON.stringify({ recipe: recipe() }));
  assert.ok(none.ok);
  if (none.ok) {
    assert.equal(none.value.cover, null);
    assert.equal(none.value.from, "เพื่อน");
  }
});

test("request: too big, broken JSON, bad parts are all refused", () => {
  assert.equal(parseShareRequest("x".repeat(MAX_BODY_BYTES + 1)).ok, false);
  assert.equal(parseShareRequest("{nope").ok, false);
  assert.equal(parseShareRequest("[]").ok, false);
  assert.equal(parseShareRequest(JSON.stringify({ from: "a" })).ok, false);
  assert.equal(parseShareRequest(JSON.stringify({ recipe: recipe(), cover: "data:image/png;base64,AAAA" })).ok, false);
});

test("stored text round-trips and is re-checked when read back", () => {
  const req = parseShareRequest(JSON.stringify({ recipe: recipe(), from: "Yani" }));
  assert.ok(req.ok);
  if (!req.ok) return;
  const stored = toStoredShare(req.value, 123);
  assert.equal(stored.hasCover, false);
  const back = parseStoredShare(JSON.stringify(stored));
  assert.deepEqual(back, stored);
  assert.equal(parseStoredShare("nope"), null);
  assert.equal(parseStoredShare(JSON.stringify({ v: 2 })), null);
  assert.equal(parseStoredShare(JSON.stringify({ v: 1, recipe: { name: "" } })), null);
});

test("the sender's payload drops photo ids and the bulky USDA list, and still passes the server check", () => {
  const withUsda = ing("ไข่", 2, { unit: "egg", label: null, usda: { fdcId: 1, description: "Egg", dataType: "sr", per100: { kcal: 143, protein: 12, carbs: 1, fat: 9 }, per: "g", energy: "1008", fetchedAt: 1, name: "ไข่", raw: [{ id: 1, unit: "kcal", value: 1 }] } });
  const r = recipe({ ingredients: [withUsda] }) as unknown as Recipe;
  const payload = toSharePayload(r);
  const text = JSON.stringify(payload);
  assert.ok(!text.includes("ph_secret") && !text.includes("raw") && !text.includes("local-"));
  assert.ok(sanitizeSharedRecipe(payload).ok);
});

test("numbers per serving use the same maths as the recipe page", () => {
  const r = sanitizeSharedRecipe(recipe());
  assert.ok(r.ok);
  if (!r.ok) return;
  const t = sharedTotals(r.value);
  assert.equal(t.complete, true);
  // 300 g of a 130 kcal / 100 g food over 2 servings = 195 kcal
  assert.equal(Math.round(t.perServing.kcal), 195);
  assert.equal(ogDescription(t.perServing.kcal, "Yani"), "195 kcal ต่อเสิร์ฟ · Yani แชร์จาก SnapCal");
});

test("receiving: a new own copy with new ids, now dates, the from tag and the share id", () => {
  const req = parseShareRequest(JSON.stringify({ recipe: recipe(), from: "Yani" }));
  assert.ok(req.ok);
  if (!req.ok) return;
  const stored = toStoredShare(req.value);
  let n = 0;
  const newId = (p: string) => `${p}_${++n}`;
  const mine = recipeFromShare(stored, "S".repeat(32), "ph_mine", 999, newId);
  assert.equal(mine.sharedFrom, "Yani");
  assert.equal(mine.sharedId, "S".repeat(32));
  assert.equal(mine.createdAt, 999);
  assert.equal(mine.updatedAt, 999);
  assert.equal(mine.coverPhotoId, "ph_mine");
  assert.equal(mine.ingredients.every((i) => i.photoId === null), true);
  assert.equal(new Set([mine.id, ...mine.ingredients.map((i) => i.id)]).size, 3);
  assert.equal(mine.name, "ข้าวกะเพราไก่");
  // an edit of the copy cannot touch the stored share
  mine.ingredients[0].amount = 1;
  assert.equal(stored.recipe.ingredients[0].amount, 180);
});

test("saving the same link twice: the first copy is found, so no duplicate", () => {
  const id = "A".repeat(32);
  assert.equal(findSavedShare([{ id: "r1", sharedId: undefined }, { id: "r2", sharedId: id }], id), "r2");
  assert.equal(findSavedShare([{ id: "r1" }], id), null);
  assert.equal(findSavedShare([], id), null);
});
