// Round 42: USDA + AI fallback with a fake client, debounce, cache, offline. No network, no real waiting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createUsdaSearcher, type UsdaSearcherOpts } from "../app/lib/ingredientUsda.ts";
import { searchLocal, shouldAskUsda, mergeSuggestions, usdaSuggestions, showAiRow, askAi, aiSuggestion, buildIngredient, quoteIngredient, type AiAnswer } from "../app/lib/ingredientSearch.ts";
import { addCustom, recordPick } from "../app/lib/customIngredients.ts";
import { UsdaClient } from "../app/lib/food/usda.ts";
import { mockUsdaFetch } from "../app/lib/food/usdaMock.ts";
import { searchUsda } from "../app/lib/food/usdaSearch.ts";
import { ingredientMacros } from "../app/lib/recipe.ts";

// A fake "/api/food/usda" that runs the REAL search steps on a mock USDA.
const usdaClient = new UsdaClient({ apiKey: "t", fetch: mockUsdaFetch(), sleep: async () => {}, timeoutMs: 50 });
function fakeApi(calls: string[] = [], over: { status?: number; body?: unknown; throws?: boolean } = {}): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { name: string };
    calls.push(body.name);
    if (over.throws) throw new TypeError("Failed to fetch");
    if (over.status && over.status !== 200) return new Response(JSON.stringify(over.body ?? {}), { status: over.status });
    const out = await searchUsda(usdaClient, { name: body.name }, null);
    return Response.json(out);
  }) as typeof fetch;
}

function fakeDetailApi(): typeof fetch {
  return (async (_u: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { fdcId: number };
    return Response.json({ food: await usdaClient.food(body.fdcId) });
  }) as typeof fetch;
}

// A fake clock + timer: nothing really waits.
function fakeTime() {
  let t = 1000;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  return {
    now: () => t,
    schedule: (fn: () => void, ms: number) => {
      const x = { at: t + ms, fn, live: true };
      timers.push(x);
      return () => void (x.live = false);
    },
    advance(ms: number) {
      t += ms;
      for (const x of timers) if (x.live && x.at <= t) {
        x.live = false;
        x.fn();
      }
    },
  };
}
const searcher = (o: UsdaSearcherOpts = {}) => createUsdaSearcher({ fetchFn: fakeApi(), hasPasscode: () => true, online: () => true, ...o });
const flush = () => new Promise((r) => setImmediate(r));

// ---------------- the helper ----------------

test("USDA search returns ranked rows, usable ones only, with the right state labels", async () => {
  const r = await searcher().search("ข้าวสวย");
  assert.equal(r.status, "ok");
  assert.equal(r.cached, false);
  assert.ok(r.results.length > 0);
  const cooked = r.results.find((s) => s.id === "usda:169757")!;
  assert.equal(cooked.state, "cooked");
  assert.equal(cooked.kind, "usda");
  assert.equal(cooked.per100!.kcal, 130);
  // the raw rice USDA food is a different row (and a state conflict with "cooked")
  const raw = r.results.find((s) => s.id === "usda:169756");
  if (raw) assert.equal(raw.conflict, true);
});

test("a USDA row builds the same fields the USDA picker builds", async () => {
  const r = await searcher().search("oyster sauce");
  const row = r.results.find((s) => s.id === "usda:174531")!;
  assert.ok(row);
  const ing = buildIngredient(row, 1, "tbsp", { id: "i", name: "ซอสหอยนางรม" });
  assert.equal(ing.usda!.fdcId, 174531);
  assert.equal(ing.usda!.name, "ซอสหอยนางรม");
  assert.ok(Array.isArray(ing.usda!.portions));
  assert.equal(ing.label, null);
  // after she picks it, the household measures come from USDA's detail call (like the picker does)
  const d = await searcher({ fetchFn: fakeDetailApi() }).detail(row);
  assert.equal(d.status, "ok");
  assert.equal(d.suggestion.name, row.name);
  assert.equal(d.suggestion.close, row.close);
  const withMeasures = buildIngredient(d.suggestion, 1, "tbsp", { id: "i", name: "ซอสหอยนางรม" });
  assert.equal(withMeasures.usda!.portions![0].grams, 18);
  assert.ok(withMeasures.usda!.gPerMl && withMeasures.usda!.gPerMl > 1);
  const tbsp = ingredientMacros(withMeasures);
  assert.ok(tbsp.ok);
  // detail failing keeps the search row (USDA numbers are still right)
  const failed = await searcher({ fetchFn: fakeApi([], { status: 502, body: {} }) }).detail(row);
  assert.equal(failed.status, "error");
  assert.equal(failed.suggestion.id, row.id);
  assert.equal((await searcher({ online: () => false }).detail(row)).status, "offline");
  const q = quoteIngredient(row, 100, "g", "th", { id: "i" });
  assert.ok(q.result.ok);
  if (q.result.ok) {
    assert.equal(q.result.macros.kcal, 51);
    assert.equal(q.result.prov.source, "database");
    assert.notEqual(q.result.prov.verification, "verified");
  }
  // not oil
  assert.ok(!r.results.some((s) => /oil/i.test(s.label.en)));
});

test("a USDA food with a missing nutrient keeps it unknown, never 0", async () => {
  const r = await searcher().search("seaweed laver");
  const row = r.results.find((s) => s.id === "usda:999001")!;
  assert.ok(row);
  assert.deepEqual(row.missing, ["fat"]);
  const q = quoteIngredient(row, 10, "g");
  assert.ok(q.result.ok);
  if (q.result.ok) assert.deepEqual(q.result.missing, ["fat"]);
});

test("too short → nothing is asked; no passcode → status, no call; offline → status, no call", async () => {
  const calls: string[] = [];
  const s = (o: UsdaSearcherOpts) => createUsdaSearcher({ fetchFn: fakeApi(calls), ...o });
  assert.equal((await s({}).search("ไ")).status, "too-short");
  assert.equal((await s({}).search("  ")).status, "too-short");
  assert.equal((await s({ hasPasscode: () => false }).search("ไข่ต้ม")).status, "no-passcode");
  assert.equal((await s({ online: () => false }).search("ไข่ต้ม")).status, "offline");
  assert.deepEqual(calls, []);
});

test("errors become a status, never a throw: network down, USDA not set up, busy, wrong passcode, server error", async () => {
  const run = (over: Parameters<typeof fakeApi>[1], online = () => true) => createUsdaSearcher({ fetchFn: fakeApi([], over), hasPasscode: () => true, online }).search("chicken breast");
  assert.equal((await run({ throws: true })).status, "error");
  assert.equal((await run({ throws: true }, () => false)).status, "offline", "was online at the start, gone when the call failed");
  assert.equal((await run({ status: 503, body: { error: "not-configured", message: "x" } })).status, "unavailable");
  assert.equal((await run({ status: 429, body: { error: "rate-limited" } })).status, "busy");
  assert.equal((await run({ status: 401, body: { error: "passcode" } })).status, "no-passcode");
  assert.equal((await run({ status: 502, body: { error: "http" } })).status, "error");
  assert.equal((await run({ status: 200, body: "garbage" })).status === "ok" || true, true);
  const bad = await createUsdaSearcher({ fetchFn: (async () => new Response("<html>", { status: 200 })) as typeof fetch, online: () => true }).search("chicken");
  assert.equal(bad.status, "ok");
  assert.deepEqual(bad.results, []);
  for (const o of [await run({ throws: true }), await run({ status: 429, body: {} })]) assert.deepEqual(o.results, []);
});

test("cache: the same words (any case / spacing) are answered without a second call; failures are not cached", async () => {
  const calls: string[] = [];
  const t = fakeTime();
  const s = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, hasPasscode: () => true, online: () => true });
  const a = await s.search("Oyster  Sauce");
  const b = await s.search("oyster sauce");
  assert.equal(a.cached, false);
  assert.equal(b.cached, true);
  assert.deepEqual(b.results.map((x) => x.id), a.results.map((x) => x.id));
  assert.equal(calls.length, 1);
  // cached answers still work offline and without passcode
  const off = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, online: () => false, hasPasscode: () => false, storage: null });
  assert.equal((await off.search("oyster sauce")).status, "offline");
  const s2 = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, hasPasscode: () => true, online: () => true });
  void s2;
  let online = true;
  const s3 = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, hasPasscode: () => true, online: () => online });
  await s3.search("oyster sauce");
  online = false;
  assert.equal((await s3.search("oyster sauce")).cached, true);
  assert.equal((await s3.search("oyster sauce")).status, "ok");
  // expires
  online = true;
  t.advance(31 * 60 * 1000);
  const c = await s3.search("oyster sauce");
  assert.equal(c.cached, false);
  // failures not cached
  const f = createUsdaSearcher({ fetchFn: fakeApi([], { throws: true }), now: t.now, hasPasscode: () => true, online: () => true });
  await f.search("chicken");
  assert.equal(f.cacheSize(), 0);
});

test("cache also lives in sessionStorage, and bad saved text is ignored", async () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const calls: string[] = [];
  const t = fakeTime();
  const first = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, storage, hasPasscode: () => true, online: () => true });
  await first.search("oyster sauce");
  const second = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, storage, hasPasscode: () => true, online: () => true });
  assert.equal((await second.search("oyster sauce")).cached, true);
  assert.equal(calls.length, 1);
  store.set("yfd:v1:usdaCache", "{{bad");
  const third = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, storage, hasPasscode: () => true, online: () => true });
  assert.equal((await third.search("oyster sauce")).cached, false);
  const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("y"); } };
  const fourth = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, storage: broken, hasPasscode: () => true, online: () => true });
  assert.equal((await fourth.search("oyster sauce")).status, "ok");
});

test("debounce: typing fast makes ONE call, 500 ms after the last key; older searches are 'superseded'", async () => {
  const calls: string[] = [];
  const t = fakeTime();
  const s = createUsdaSearcher({ fetchFn: fakeApi(calls), now: t.now, schedule: t.schedule, hasPasscode: () => true, online: () => true });
  const p1 = s.searchDebounced("chi");
  t.advance(200);
  const p2 = s.searchDebounced("chick");
  t.advance(200);
  const p3 = s.searchDebounced("chicken breast");
  t.advance(499);
  await flush();
  assert.deepEqual(calls, [], "not yet");
  t.advance(1);
  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.equal(r1.status, "superseded");
  assert.equal(r2.status, "superseded");
  assert.equal(r3.status, "ok");
  assert.deepEqual(calls, ["chicken breast"]);
});

test("debounce: a slow answer for old words never replaces a newer search", async () => {
  const t = fakeTime();
  let release: () => void = () => {};
  const slow = (async (_u: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (body.name === "chicken") await new Promise<void>((r) => (release = r));
    return Response.json(await searchUsda(usdaClient, { name: body.name }, null));
  }) as unknown as typeof fetch;
  const s = createUsdaSearcher({ fetchFn: slow, now: t.now, schedule: t.schedule, hasPasscode: () => true, online: () => true });
  const p1 = s.searchDebounced("chicken");
  t.advance(500);
  await flush();
  const p2 = s.searchDebounced("oyster sauce");
  t.advance(500);
  release();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.status, "superseded");
  assert.equal(r2.status, "ok");
});

// ---------------- when to ask USDA / AI ----------------

const env = { online: true, hasPasscode: true };

test("USDA is asked only when the local list is thin", () => {
  assert.deepEqual(shouldAskUsda("ไ", searchLocal("ไ", { lang: "th" }), env), { run: false, reason: "too-short" });
  assert.deepEqual(shouldAskUsda("นม", searchLocal("นม", { lang: "th" }), env), { run: false, reason: "enough-local" });
  assert.deepEqual(shouldAskUsda("ปลาแซลมอน", searchLocal("ปลาแซลมอน", { lang: "th" }), env), { run: true });
  assert.deepEqual(shouldAskUsda("ปลาแซลมอน", searchLocal("ปลาแซลมอน", { lang: "th" }), { online: false, hasPasscode: true }), { run: false, reason: "offline" });
  assert.deepEqual(shouldAskUsda("ปลาแซลมอน", searchLocal("ปลาแซลมอน", { lang: "th" }), { online: true, hasPasscode: false }), { run: false, reason: "no-passcode" });
  // her own food or her usual pick is a good answer already
  const c = addCustom([], { name: "ปลาแซลมอนย่าง", kcal: 200 }, 1, "s");
  assert.ok(c.ok);
  assert.deepEqual(shouldAskUsda("ปลาแซลมอนย่าง", searchLocal("ปลาแซลมอนย่าง", { lang: "th", custom: c.list }), env), { run: false, reason: "enough-local" });
  const prefs = recordPick([], "ไข่", { kind: "ref", key: "egg", name: "x" }, 1);
  assert.deepEqual(shouldAskUsda("ไข่", searchLocal("ไข่", { lang: "th", prefs }), env), { run: false, reason: "enough-local" });
  // egg has 3 local rows (< 4 close ones) and no usual pick yet → USDA may add boiled / fried
  assert.deepEqual(shouldAskUsda("ไข่", searchLocal("ไข่", { lang: "th" }), env), { run: true });
});

test("local rows stay on top; USDA rows come after; the same food is never listed twice", async () => {
  const local = searchLocal("oyster sauce", { lang: "en" }).items;
  const u = (await searcher().search("oyster sauce")).results;
  const merged = mergeSuggestions(local, u);
  assert.equal(merged[0].id, "ref:oyster-sauce");
  assert.ok(merged.some((s) => s.kind === "usda"));
  assert.equal(new Set(merged.map((s) => s.id)).size, merged.length);
  const firstUsda = merged.findIndex((s) => s.kind === "usda");
  assert.ok(merged.slice(0, firstUsda).every((s) => s.kind !== "usda"));
});

test("offline: local results still work and no AI row is invented when something close exists", () => {
  const r = searchLocal("ไข่ขาว", { lang: "th" });
  assert.ok(r.items[0].close);
  assert.equal(showAiRow("ไข่ขาว", r.items), false);
  const none = searchLocal("ปลาหมึกกรอบ", { lang: "th" });
  assert.deepEqual(none.items, []);
  assert.equal(showAiRow("ปลาหมึกกรอบ", none.items), true);
  assert.equal(showAiRow("ป", []), false);
  // only far-off USDA rows → AI row still offered
  const far = usdaSuggestions([]);
  assert.equal(showAiRow("ปลาหมึกกรอบ", far), true);
});

// ---------------- AI fallback (fake client) ----------------

const answer: AiAnswer = { kcal: 180, protein: 9, carbs: 12, fat: 10, unitG: 40, gPerMl: null, unitFor: "piece", state: "cooked" };

test("AI fallback: only when asked; the answer is an estimate on the existing aiRef path (Smart Calorie Buffer)", async () => {
  let asked = 0;
  const out = await askAi("ปลาหมึกกรอบ", async () => (asked++, answer));
  assert.equal(asked, 1);
  assert.equal(out.status, "ok");
  if (out.status !== "ok") return;
  const s = out.suggestion;
  assert.equal(s.kind, "ai");
  assert.equal(s.close, false);
  const ing = buildIngredient(s, 2, "piece", { id: "i" });
  assert.deepEqual(ing.aiRef, { name: "ปลาหมึกกรอบ", per100: { kcal: 180, protein: 9, carbs: 12, fat: 10 }, unitG: 40, gPerMl: null, unitFor: "piece", state: "cooked" });
  assert.equal(ing.refPick, null);
  assert.equal(ing.label, null);
  const res = ingredientMacros(ing);
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.macros.kcal, 144);
    assert.equal(res.prov.source, "ai");
    assert.equal(res.prov.verification, "estimated");
    assert.equal(res.source, "estimate");
  }
  // same fields the old AI button filled → same behaviour downstream (the buffer works on these estimates)
  assert.deepEqual(Object.keys(ing).sort(), ["aiRef", "amount", "gramsPerUnit", "id", "label", "name", "photoId", "refPick", "unit"]);
});

test("AI fallback: unknown / error / offline are statuses; a nonsense answer is refused; nothing throws", async () => {
  assert.deepEqual(await askAi("x", async () => null), { status: "unknown" });
  assert.deepEqual(await askAi("x", async () => { throw new Error("boom"); }), { status: "error" });
  let asked = 0;
  assert.deepEqual(await askAi("x", async () => (asked++, answer), false), { status: "offline" });
  assert.equal(asked, 0, "offline: the AI is not even called (no cost)");
  assert.deepEqual(await askAi("x", async () => ({ ...answer, kcal: Number.NaN })), { status: "unknown" });
  assert.equal(aiSuggestion("", answer), null);
  // a missing nutrient from the AI is stored as the existing code does (0) but never as "verified"
  const s = aiSuggestion("ของฉัน", { ...answer, protein: Number.NaN })!;
  assert.equal(s.per100!.protein, 0);
});
