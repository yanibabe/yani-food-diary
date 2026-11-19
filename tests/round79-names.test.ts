// Round 79: food names follow the app language (display only; the original name stays the key).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  altFor, applyLookup, displayName, manualAltText, mapEntries, missingNames, needsAlt, nameLang, refPair, renameAlt, resolveAlt, sanitizeAlt, setManualAlt, validAlt,
  type NameAlt,
} from "../app/lib/names.ts";
import { MAX_NAMES, parseTranslateReply, parseTranslateRequest, type NamePair } from "../app/lib/translateNames.ts";
import { MAX_CALLS_PER_DAY, batches, runBackfill } from "../app/lib/nameBackfill.ts";
import { NAME_TR_KEY, NAME_TR_RUNS_KEY, MAX_CACHED, addPairs, parseNameTr, type StorageLike } from "../app/lib/nameTr.ts";
import { AnalysisSchema } from "../app/lib/server/ai.ts";
import { translateNames } from "../app/lib/server/translateNames.ts";
import { parseCustom, makeCustom } from "../app/lib/customIngredients.ts";
import { filterByName } from "../app/components/recipeFilter.ts";
import { searchMeals, copyMeal } from "../app/lib/repeat.ts";
import { parseStoredShare, recipeFromShare, sanitizeSharedRecipe, toSharePayload, toStoredShare, parseShareRequest } from "../app/lib/shareRecipe.ts";
import { makeBackup, restoreAction } from "../app/lib/backup.ts";
import type { Entry, Recipe } from "../app/lib/types.ts";

const MACROS = { kcal: 100, protein: 1, carbs: 1, fat: 1 };
const item = (name: string, alt?: NameAlt) => ({ id: `i-${name}`, name, ...(alt ? { alt } : {}), amount: 1, unit: "จาน", ...MACROS, estimated: false, kind: "food" as const, note: null, box: null });
const entry = (title: string, items: ReturnType<typeof item>[], alt?: NameAlt): Entry => ({ id: `e-${title}`, date: "2026-11-19", slot: "lunch", title, ...(alt ? { alt } : {}), items, source: "text", photoId: null, recipe: null, createdAt: 1, updatedAt: 1 });
const ing = (name: string, alt?: NameAlt) => ({ id: `g-${name}`, name, ...(alt ? { alt } : {}), amount: 100, unit: "g" as const, label: { ...MACROS, basis: "per100" as const, via: "typed" as const }, gramsPerUnit: null, photoId: null });
const recipe = (name: string, ings: ReturnType<typeof ing>[], alt?: NameAlt): Recipe => ({ id: `r-${name}`, name, ...(alt ? { alt } : {}), servings: 1, cookedWeight: null, ingredients: ings, steps: [], coverPhotoId: null, createdAt: 1, updatedAt: 1 });

// ---------------------------------------------------------------- displayName
test("displayName: the app language equals the script of the original → the original", () => {
  const alt = { en: "Rice with mackerel", src: "ข้าวหน้าปลาทู" };
  assert.equal(displayName("ข้าวหน้าปลาทู", alt, "th"), "ข้าวหน้าปลาทู");
  assert.equal(displayName("Green salad", { th: "สลัดผัก", src: "Green salad" }, "en"), "Green salad");
});

test("displayName: other language → the saved alt, else the original (never empty)", () => {
  assert.equal(displayName("ข้าวหน้าปลาทู", { en: "Rice with mackerel", src: "ข้าวหน้าปลาทู" }, "en"), "Rice with mackerel");
  assert.equal(displayName("Green salad", { th: "สลัดผัก", src: "Green salad" }, "th"), "สลัดผัก");
  assert.equal(displayName("ข้าวหน้าปลาทู", undefined, "en"), "ข้าวหน้าปลาทู");
  assert.equal(displayName("ข้าวหน้าปลาทู", { en: "  ", src: "ข้าวหน้าปลาทู" }, "en"), "ข้าวหน้าปลาทู");
  assert.equal(displayName("ข้าวหน้าปลาทู", { th: "x", src: "ข้าวหน้าปลาทู" }, "en"), "ข้าวหน้าปลาทู"); // only the wrong side saved
});

test("displayName: mixed Thai + English counts as Thai; switching back and forth gives the same text (no drift)", () => {
  assert.equal(nameLang("ไก่ KFC"), "th");
  assert.equal(nameLang("Oatly 1 กล่อง"), "th");
  assert.equal(nameLang("Oat milk"), "en");
  const alt = altFor("ข้าวหน้าปลาทู", { th: "ignored", en: "Rice with mackerel" });
  for (let k = 0; k < 4; k++) {
    assert.equal(displayName("ข้าวหน้าปลาทู", alt, "en"), "Rice with mackerel");
    assert.equal(displayName("ข้าวหน้าปลาทู", alt, "th"), "ข้าวหน้าปลาทู");
  }
});

test("displayName: an alt made for an OLD name is ignored; one she typed is kept", () => {
  const auto = { en: "Rice with mackerel", src: "ข้าวหน้าปลาทู" };
  assert.equal(displayName("ข้าวหน้าปลาแซลมอน", auto, "en"), "ข้าวหน้าปลาแซลมอน");
  assert.equal(validAlt("ข้าวหน้าปลาแซลมอน", auto), undefined);
  const mine = { en: "My mackerel bowl", src: "ข้าวหน้าปลาทู", manual: true };
  assert.equal(displayName("ข้าวหน้าปลาแซลมอน", mine, "en"), "My mackerel bowl");
});

// ---------------------------------------------------------------- edit rules
test("editing a name clears the automatic alt but keeps a manual one", () => {
  const auto: NameAlt = { en: "Rice with mackerel", src: "ข้าวหน้าปลาทู" };
  assert.equal(renameAlt(auto, "ข้าวหน้าปลาทู", "ข้าวหน้าปลาทู"), auto); // same name: nothing changes
  assert.equal(renameAlt(auto, "ข้าวหน้าปลาทู", "ข้าวหน้าปลาทูทอด"), undefined);
  const mine: NameAlt = { en: "Mackerel bowl", src: "ข้าวหน้าปลาทู", manual: true };
  assert.equal(renameAlt(mine, "ข้าวหน้าปลาทู", "ข้าวหน้าปลาทูทอด"), mine);
  assert.equal(renameAlt(undefined, "a", "b"), undefined);
});

test("typing the other-language box: kept as hers (manual), trimmed, empty clears it", () => {
  const a = setManualAlt("ข้าวหน้าปลาทู", undefined, "  Mackerel   rice bowl ");
  assert.deepEqual(a, { en: "Mackerel rice bowl", src: "ข้าวหน้าปลาทู", manual: true });
  assert.equal(manualAltText("ข้าวหน้าปลาทู", a), "Mackerel rice bowl");
  assert.equal(setManualAlt("ข้าวหน้าปลาทู", a, "   "), undefined);
  // An English name gets a THAI box
  assert.deepEqual(setManualAlt("Green salad", undefined, "สลัดผัก"), { th: "สลัดผัก", src: "Green salad", manual: true });
  // Her own text is never replaced by a later automatic fill
  const filled = resolveAlt("ข้าวหน้าปลาทู", a, () => ({ en: "Machine translation" }));
  assert.equal(filled, a);
});

// ---------------------------------------------------------------- FOOD_REF path (no AI)
test("FOOD_REF gives the other-language name of an EXACT food name only", () => {
  assert.deepEqual(refPair("ไข่ไก่"), { th: "ไข่ไก่", en: "Egg" });
  assert.equal(refPair("egg")?.th, "ไข่ไก่");
  assert.equal(refPair("น้ำปลา")?.en, "Fish sauce");
  assert.equal(refPair("ไข่ไก่ทอด"), null); // a different food
  assert.equal(refPair("ข้าวหน้าปลาทู"), null);
  const r = resolveAlt("น้ำปลา", undefined, () => null);
  assert.equal(displayName("น้ำปลา", r, "en"), "Fish sauce");
});

// ---------------------------------------------------------------- scan parser
test("scan parser: name_th / name_en / title_th / title_en are read, and optional", () => {
  const withBoth = AnalysisSchema.parse({
    title: "ข้าวหน้าปลาทู", title_th: "ข้าวหน้าปลาทู", title_en: "Rice with mackerel",
    items: [{ name: "ปลาทู", name_th: "ปลาทู", name_en: "Mackerel", amount: 1, unit: "ตัว", kcal: 150, protein: 20, carbs: 0, fat: 8 }],
  });
  assert.equal(withBoth.items[0].name_en, "Mackerel");
  assert.equal(withBoth.title_en, "Rice with mackerel");
  assert.deepEqual(altFor(withBoth.items[0].name, { th: withBoth.items[0].name_th, en: withBoth.items[0].name_en }), { en: "Mackerel", src: "ปลาทู" });
  assert.deepEqual(altFor(withBoth.title, { th: withBoth.title_th, en: withBoth.title_en }), { en: "Rice with mackerel", src: "ข้าวหน้าปลาทู" });
  // English name written by the model in English mode → the alt is the THAI one
  assert.deepEqual(altFor("Mackerel", { th: "ปลาทู", en: "Mackerel" }), { th: "ปลาทู", src: "Mackerel" });
});

test("scan parser: an older / lazy answer without the new fields still works", () => {
  const old = AnalysisSchema.parse({ title: "ข้าวผัด", items: [{ name: "ข้าวผัด", amount: 1, unit: "จาน", kcal: 500, protein: 10, carbs: 70, fat: 15 }] });
  assert.equal(old.items[0].name_en, undefined);
  assert.equal(altFor(old.items[0].name, { th: old.items[0].name_th, en: old.items[0].name_en }), undefined);
  const odd = AnalysisSchema.parse({ title: "x", title_en: 5, items: [{ name: "ข้าวผัด", name_en: null, amount: 1, unit: "จาน", kcal: 1, protein: 1, carbs: 1, fat: 1 }] });
  assert.equal(altFor("ข้าวผัด", { en: odd.items[0].name_en }), undefined);
});

// ---------------------------------------------------------------- translate route: request + reply
test("translate request: ≤ 60 names, each ≤ 120 letters, blanks and repeats dropped", () => {
  assert.deepEqual(parseTranslateRequest({ names: [" ข้าวผัด ", "", "ข้าวผัด", "Salad"] }), { ok: true, names: ["ข้าวผัด", "Salad"] });
  assert.equal(parseTranslateRequest({}).ok, false);
  assert.equal(parseTranslateRequest({ names: "x" }).ok, false);
  assert.equal(parseTranslateRequest({ names: [] }).ok, false);
  assert.equal(parseTranslateRequest({ names: ["a", 5] }).ok, false);
  assert.equal(parseTranslateRequest({ names: ["x".repeat(121)] }).ok, false);
  assert.equal(parseTranslateRequest({ names: ["x".repeat(120)] }).ok, true);
  const sixty = Array.from({ length: MAX_NAMES }, (_, i) => `n${i}`);
  assert.equal(parseTranslateRequest({ names: sixty }).ok, true);
  assert.equal(parseTranslateRequest({ names: [...sixty, "one more"] }).ok, false);
  assert.equal(parseTranslateRequest(null).ok, false);
});

test("translate reply: only asked names, once each, with the missing side filled from the name itself", () => {
  const asked = ["ข้าวหน้าปลาทู", "Green salad", "KFC"];
  const out = parseTranslateReply(
    { names: [
      { src: "ข้าวหน้าปลาทู", th: "whatever", en: " Rice   with mackerel " },
      { src: "Green salad", th: "สลัดผัก", en: "" },
      { src: "not asked", th: "x", en: "y" },
      { src: "ข้าวหน้าปลาทู", th: "dup", en: "dup" },
      { src: "KFC", th: "", en: "KFC" }, // nothing useful for Thai → skipped
      "junk",
    ] },
    asked,
  );
  assert.deepEqual(out, [
    { src: "ข้าวหน้าปลาทู", th: "ข้าวหน้าปลาทู", en: "Rice with mackerel" },
    { src: "Green salad", th: "สลัดผัก", en: "Green salad" },
  ]);
  assert.deepEqual(parseTranslateReply(null, asked), []);
  assert.deepEqual(parseTranslateReply({ names: "no" }, asked), []);
});

test("translate server call with a fake fetch: sends the names, reads the JSON, no key = a clear error", async () => {
  const realFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  const oldMock = process.env.AI_MOCK;
  delete process.env.AI_MOCK;
  let sent: { url: string; body: { model: string; messages: { role: string; content: unknown }[] } } | null = null;
  try {
    delete process.env.OPENROUTER_API_KEY;
    await assert.rejects(() => translateNames(["ข้าวผัด"], "th"), /OpenRouter/);

    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    globalThis.fetch = (async (url: string, init: { body: string }) => {
      sent = { url: String(url), body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n" + JSON.stringify({ names: [{ src: "ข้าวหน้าปลาทู", th: "ข้าวหน้าปลาทู", en: "Rice with mackerel" }, { src: "invented", th: "x", en: "y" }] }) + "\n```" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const pairs = await translateNames(["ข้าวหน้าปลาทู"], "en");
    assert.deepEqual(pairs, [{ src: "ข้าวหน้าปลาทู", th: "ข้าวหน้าปลาทู", en: "Rice with mackerel" }]);
    assert.ok(sent);
    const s = sent as { url: string; body: { model: string; messages: { role: string; content: unknown }[] } };
    assert.match(s.url, /openrouter\.ai/);
    assert.match(s.body.model, /^google\/gemini/);
    assert.match(JSON.stringify(s.body.messages), /ข้าวหน้าปลาทู/);

    globalThis.fetch = (async () => new Response("{}", { status: 402 })) as unknown as typeof fetch;
    await assert.rejects(() => translateNames(["x"], "th"), /credit|เครดิต/i);
  } finally {
    globalThis.fetch = realFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
    if (oldMock !== undefined) process.env.AI_MOCK = oldMock;
  }
});

// ---------------------------------------------------------------- backfill
function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function world() {
  const entries = [
    entry("ข้าวหน้าปลาทู", [item("ปลาทู"), item("ไข่ไก่"), item("มีอยู่แล้ว", { en: "Already there", src: "มีอยู่แล้ว" })], undefined),
    entry("Green salad", [item("Green salad")]),
  ];
  const recipes = [recipe("แกงเขียวหวาน", [ing("น้ำปลา"), ing("มะเขือพวง")])];
  const custom = [{ ...makeCustom({ name: "น้ำพริกแม่บ้าน", kcal: 100 }, "c1", 1) } as { ok: true; item: { name: string; alt?: NameAlt } }].map((x) => x.item);
  return { entries, recipes, custom };
}

test("missingNames: only names with no other-language name, once each, FOOD_REF and the memory count as found", () => {
  const w = world();
  const none = () => null;
  const miss = missingNames(w, none);
  // "ไข่ไก่" and "น้ำปลา" come from the food table; "มีอยู่แล้ว" already has its alt
  assert.deepEqual(miss.sort(), ["Green salad", "ข้าวหน้าปลาทู", "น้ำพริกแม่บ้าน", "ปลาทู", "มะเขือพวง", "แกงเขียวหวาน"].sort());
  const withMemory = missingNames(w, (n) => (n === "ปลาทู" ? { en: "Mackerel" } : null));
  assert.ok(!withMemory.includes("ปลาทู"));
  // numbers / symbols are not names
  assert.equal(needsAlt("123", undefined), false);
  assert.equal(needsAlt("x".repeat(121), undefined), false);
});

test("applyLookup: fills alt everywhere, never touches updatedAt, same objects back when nothing changes", () => {
  const w = world();
  const lookup = (n: string) => ({ en: `EN:${n}`, th: `TH:${n}` });
  const r = applyLookup(w, lookup);
  assert.equal(r.entries[0].alt?.en, "EN:ข้าวหน้าปลาทู");
  assert.equal(r.entries[0].items[0].alt?.en, "EN:ปลาทู");
  assert.equal(r.entries[0].items[1].alt?.en, "Egg"); // food table first, not the lookup
  assert.equal(r.entries[0].items[2].alt?.en, "Already there"); // untouched
  assert.equal(r.entries[1].alt?.th, "TH:Green salad");
  assert.equal(r.recipes[0].ingredients[0].alt?.en, "Fish sauce");
  assert.equal(r.recipes[0].alt?.en, "EN:แกงเขียวหวาน");
  assert.equal(r.custom[0].alt?.en, "EN:น้ำพริกแม่บ้าน");
  assert.equal(r.entries[0].updatedAt, 1);
  assert.equal(r.recipes[0].updatedAt, 1);
  assert.equal(w.entries[0].alt, undefined, "the input is not changed");
  const again = applyLookup(r, lookup);
  assert.equal(again.entries, r.entries);
  assert.equal(again.recipes, r.recipes);
  assert.equal(again.custom, r.custom);
});

test("backfill: asks only for missing names, in batches of at most 60, and writes the answers back", async () => {
  const entries = Array.from({ length: 130 }, (_, i) => entry(`เมนู${i}`, [item(`เมนู${i}`)]));
  let data = { entries, recipes: [] as Recipe[], custom: [] as { name: string; alt?: NameAlt }[] };
  const calls: string[][] = [];
  const storage = memStorage();
  const res = await runBackfill({
    read: () => data,
    apply: (lookup) => { data = applyLookup(data, lookup); },
    translate: async (names) => { calls.push(names); return names.map((src) => ({ src, th: src, en: `EN ${src}` })); },
    cache: {},
    storage,
    today: "2026-11-19",
  });
  assert.deepEqual(calls.map((c) => c.length), [60, 60, 10]);
  assert.equal(res.calls, 3);
  assert.equal(res.stoppedBy, "done");
  assert.ok(calls.every((c) => c.length <= MAX_NAMES));
  assert.equal(new Set(calls.flat()).size, 130, "each name asked once");
  assert.equal(data.entries[129].alt?.en, "EN เมนู129");
  assert.equal(data.entries[0].items[0].alt?.en, "EN เมนู0");
  // memory saved, calls counted
  assert.equal(Object.keys(parseNameTr(storage.map.get(NAME_TR_KEY))).length, 130);
  assert.equal(JSON.parse(storage.map.get(NAME_TR_RUNS_KEY)!).calls, 3);
  // a second run the same day has nothing missing → no call
  const again = await runBackfill({ read: () => data, apply: (l) => { data = applyLookup(data, l); }, translate: async () => { throw new Error("must not be called"); }, cache: parseNameTr(storage.map.get(NAME_TR_KEY)), storage, today: "2026-11-19" });
  assert.equal(again.calls, 0);
  assert.equal(again.stoppedBy, "done");
});

test("backfill: a name translated before comes from the memory, not the AI", async () => {
  let data = { entries: [entry("ปลาทู", [item("ปลาทู")])], recipes: [] as Recipe[], custom: [] as { name: string; alt?: NameAlt }[] };
  const res = await runBackfill({
    read: () => data, apply: (l) => { data = applyLookup(data, l); },
    translate: async () => { throw new Error("must not be called"); },
    cache: { ปลาทู: { th: "ปลาทู", en: "Mackerel" } }, storage: memStorage(), today: "2026-11-19",
  });
  assert.equal(res.calls, 0);
  assert.equal(data.entries[0].alt?.en, "Mackerel");
});

test("backfill: a failure stops the AI until tomorrow; offline makes no call; the daily budget is respected", async () => {
  const fresh = () => ({ entries: [entry("ปลาทู", [item("ปลาทู")])], recipes: [] as Recipe[], custom: [] as { name: string; alt?: NameAlt }[] });
  const storage = memStorage();
  let data = fresh();
  let n = 0;
  const io = (today: string, translate: (names: string[]) => Promise<NamePair[]>, online = true) => ({ read: () => data, apply: (l: Parameters<typeof applyLookup>[1]) => { data = applyLookup(data, l); }, translate, cache: {}, storage, today, online });

  const off = await runBackfill(io("2026-11-19", async () => { n++; return []; }, false));
  assert.equal(off.stoppedBy, "offline");
  assert.equal(n, 0);

  const failed = await runBackfill(io("2026-11-19", async () => { n++; throw new Error("503"); }));
  assert.equal(failed.stoppedBy, "failed");
  assert.equal(n, 1);
  assert.equal(data.entries[0].alt, undefined, "data unchanged after a failure");

  const sameDay = await runBackfill(io("2026-11-19", async () => { n++; return []; }));
  assert.equal(sameDay.stoppedBy, "failed");
  assert.equal(n, 1, "no retry the same day");

  const nextDay = await runBackfill(io("2026-11-20", async (names) => { n++; return names.map((src) => ({ src, th: src, en: "Mackerel" })); }));
  assert.equal(nextDay.stoppedBy, "done");
  assert.equal(n, 2);
  assert.equal(data.entries[0].alt?.en, "Mackerel");

  // budget: a model that never returns anything is asked at most MAX_CALLS_PER_DAY times a day
  data = fresh();
  let asked = 0;
  for (let i = 0; i < 10; i++) await runBackfill(io("2026-11-21", async () => { asked++; return []; }));
  assert.equal(asked, MAX_CALLS_PER_DAY);
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("name memory: bad text is an empty memory; it keeps at most MAX_CACHED names (oldest go first)", () => {
  assert.deepEqual(parseNameTr("not json"), {});
  assert.deepEqual(parseNameTr('{"a":{"th":"ก","en":""},"b":5,"c":{"th":"ข","en":"B"}}'), { c: { th: "ข", en: "B" } });
  const storage = memStorage();
  const many: NamePair[] = Array.from({ length: MAX_CACHED + 5 }, (_, i) => ({ src: `n${i}`, th: "ก", en: "A" }));
  const c = addPairs({}, many, storage);
  assert.equal(Object.keys(c).length, MAX_CACHED);
  assert.ok(!("n0" in c));
  assert.ok(`n${MAX_CACHED + 4}` in c);
});

// ---------------------------------------------------------------- places that carry / use alt
test("meals: copy keeps alt; search finds a Thai meal by its English name", () => {
  const e = entry("ข้าวหน้าปลาทู", [item("ปลาทู", { en: "Mackerel", src: "ปลาทู" })], { en: "Rice with mackerel", src: "ข้าวหน้าปลาทู" });
  assert.equal(copyMeal(e, "2026-11-20", "dinner").alt?.en, "Rice with mackerel");
  assert.equal(searchMeals([e], "mackerel").length, 1);
  assert.equal(searchMeals([e], "ปลาทู").length, 1);
  assert.equal(searchMeals([e], "pizza").length, 0);
});

test("recipes: filter by either name; mapEntries leaves untouched lists alone", () => {
  const rs = [recipe("แกงเขียวหวาน", [], { en: "Green curry", src: "แกงเขียวหวาน" })];
  assert.equal(filterByName(rs, "green").length, 1);
  assert.equal(filterByName(rs, "แกง").length, 1);
  assert.equal(filterByName(rs, "pizza").length, 0);
  const es = [entry("x", [item("y")])];
  assert.equal(mapEntries(es, (_n, a) => a), es);
});

test("my ingredients: alt survives save/load and is cleaned; a stale or odd alt is dropped", () => {
  const made = makeCustom({ name: "น้ำพริกแม่บ้าน", kcal: 100, alt: { en: "  Home chili dip ", src: "น้ำพริกแม่บ้าน" } }, "c1", 1);
  assert.ok(made.ok);
  if (!made.ok) return;
  assert.equal(made.item.alt?.en, "Home chili dip");
  const back = parseCustom(JSON.stringify([made.item]));
  assert.deepEqual(back[0].alt, { en: "Home chili dip", src: "น้ำพริกแม่บ้าน" });
  const odd = makeCustom({ name: "x", kcal: 1, alt: { en: "y".repeat(200), src: "x" } }, "c2", 1);
  assert.ok(odd.ok && odd.item.alt === undefined);
  assert.equal(sanitizeAlt({ en: "ok" }), undefined, "no src and not manual → can never be used");
  assert.equal(sanitizeAlt("string"), undefined);
});

test("recipe sharing: alt travels (checked, ≤ 120), rides into the receiver's copy", () => {
  const r = recipe("แกงเขียวหวาน", [ing("มะเขือพวง", { en: "Pea eggplant", src: "มะเขือพวง" })], { en: "Green curry", src: "แกงเขียวหวาน" });
  const payload = toSharePayload(r);
  const checked = sanitizeSharedRecipe(payload);
  assert.ok(checked.ok);
  if (!checked.ok) return;
  assert.deepEqual(checked.value.alt, { en: "Green curry", src: "แกงเขียวหวาน" });
  assert.equal(checked.value.ingredients[0].alt?.en, "Pea eggplant");
  const stored = parseStoredShare(JSON.stringify(toStoredShare({ recipe: checked.value, from: "Yani", cover: null }, 5)));
  assert.ok(stored);
  const mine = recipeFromShare(stored!, "x".repeat(32), null, 9, (p) => `${p}_1`);
  assert.equal(mine.alt?.en, "Green curry");
  assert.equal(mine.ingredients[0].alt?.en, "Pea eggplant");
  assert.equal(displayName(mine.name, mine.alt, "en"), "Green curry");
  // too-long / junk alt is dropped, the recipe itself is still accepted
  const bad = sanitizeSharedRecipe({ ...(payload as object), alt: { en: "z".repeat(121), src: "แกงเขียวหวาน" } });
  assert.ok(bad.ok && bad.value.alt === undefined);
  const bad2 = parseShareRequest(JSON.stringify({ recipe: { ...(payload as object), alt: { en: 5, th: { x: 1 }, src: 7 } }, from: "a" }));
  assert.ok(bad2.ok && bad2.value.recipe.alt === undefined);
});

test("backup: the name memory is an optional part (old backups do not wipe it)", () => {
  const b = makeBackup({ entries: null, recipes: null, goals: null, body: null, water: null, labelFixes: null, buddy: null, lang: null }, {});
  assert.equal(b.data.nameTr, null);
  assert.equal(restoreAction("nameTr", null), "keep");
  assert.equal(restoreAction("nameTr", "{}"), "set");
});

test("backfill asks for the newest meals first", () => {
  const e = (date: string, title: string) => ({ date, title, items: [], recipe: null });
  const names = missingNames({ entries: [e("2026-01-01", "ข้าวผัดเก่า"), e("2026-11-19", "ข้าวหน้าปลาทู"), e("2026-06-01", "ส้มตำ")], recipes: [], custom: [] }, () => undefined);
  assert.deepEqual(names.slice(0, 3), ["ข้าวหน้าปลาทู", "ส้มตำ", "ข้าวผัดเก่า"]);
});
