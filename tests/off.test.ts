// Open Food Facts barcode lookups. All HTTP is faked here: no real calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OffError, OpenFoodFactsProvider, normalizeOffProduct, parseNum, retryDelay } from "../app/lib/food/openFoodFacts.ts";
import { OFF_STAGING_AUTH, OFF_STAGING_URL, offConfig } from "../app/lib/food/config.ts";
import { cleanBarcode, servingGrams } from "../app/lib/food/provider.ts";
import { foodToItem } from "../app/lib/food/toItem.ts";

const UA = "SnapCal/0.1.0 (test@example.com)";

type Call = { url: string; headers: Record<string, string> };
function fakeFetch(replies: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status, headers: r.headers });
  }) as typeof fetch;
  return { fn, calls };
}

function provider(f: typeof fetch, extra: Partial<ConstructorParameters<typeof OpenFoodFactsProvider>[0]> = {}) {
  const slept: number[] = [];
  const p = new OpenFoodFactsProvider({
    baseUrl: OFF_STAGING_URL,
    basicAuth: OFF_STAGING_AUTH,
    userAgent: UA,
    fetch: f,
    sleep: async (ms) => void slept.push(ms),
    ...extra,
  });
  return { p, slept };
}

const NUTELLA = {
  code: "3017624010701",
  status: "success",
  result: { id: "product_found" },
  product: {
    code: "3017624010701",
    product_name: "Nutella",
    brands: "Ferrero",
    serving_size: "15 g",
    nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
  },
};

test("found product → normalized Food, per 100 g", async () => {
  const { fn, calls } = fakeFetch([{ status: 200, body: NUTELLA }]);
  const { p } = provider(fn);
  const food = await p.getByBarcode("3017624010701");
  assert.deepEqual(food, {
    source: "off",
    sourceId: "3017624010701",
    name: "Nutella",
    brand: "Ferrero",
    servingSize: "15 g",
    kcal: 539,
    protein: 6.3,
    carbs: 57.5,
    fat: 30.9,
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://world.openfoodfacts.net/api/v3/product/3017624010701.json?fields=code,product_name,brands,serving_size,nutriments,image_front_url",
  );
  assert.deepEqual(await p.getById("3017624010701"), food);
});

test("unknown barcode → null, not an error (v3 404 failure, and v2 status: 0)", async () => {
  const v3 = fakeFetch([{ status: 404, body: { code: "00000017", status: "failure", result: { id: "product_not_found" } } }]);
  assert.equal(await provider(v3.fn).p.getByBarcode("0000000000017"), null);
  const v2 = fakeFetch([{ status: 200, body: { code: "00000017", status: 0, status_verbose: "no code or invalid code" } }]);
  assert.equal(await provider(v2.fn).p.getByBarcode("0000000000017"), null);
});

test("missing and string nutrient fields are read safely", () => {
  const f = normalizeOffProduct("123", {
    product_name: "  ",
    brands: 42,
    nutriments: { "energy-kcal_100g": "250", proteins_100g: "6,5", carbohydrates_100g: "< 0.5", fat_100g: "n/a" },
  });
  assert.equal(f.sourceId, "123");
  assert.equal(f.name, null);
  assert.equal(f.brand, null);
  assert.equal(f.servingSize, null);
  assert.equal(f.kcal, 250);
  assert.equal(f.protein, 6.5);
  assert.equal(f.carbs, 0.5);
  assert.equal(f.fat, null);

  const empty = normalizeOffProduct("456", {});
  assert.deepEqual([empty.kcal, empty.protein, empty.carbs, empty.fat], [null, null, null, null]);

  // Only kJ given → converted to kcal
  assert.equal(normalizeOffProduct("789", { nutriments: { "energy-kj_100g": 418.4 } }).kcal, 100);

  for (const bad of [null, undefined, -1, NaN, Infinity, "", "abc", {}, [], true]) assert.equal(parseNum(bad), null, String(bad));
});

test("429: waits (Retry-After) and tries again, then succeeds", async () => {
  const { fn, calls } = fakeFetch([
    { status: 429, headers: { "Retry-After": "3" } },
    { status: 429 },
    { status: 200, body: NUTELLA },
  ]);
  const { p, slept } = provider(fn);
  const food = await p.getByBarcode("3017624010701");
  assert.equal(food?.name, "Nutella");
  assert.equal(calls.length, 3);
  assert.deepEqual(slept, [3000, 2000]); // Retry-After 3 s, then backoff 2 s
});

test("429 that never stops: gives up after 2 retries with a rate-limited error", async () => {
  const { fn, calls } = fakeFetch([{ status: 429 }]);
  const { p } = provider(fn);
  await assert.rejects(p.getByBarcode("3017624010701"), (e: unknown) => e instanceof OffError && e.code === "rate-limited" && e.status === 429);
  assert.equal(calls.length, 3);
});

test("other failures are errors, not 'not found'", async () => {
  await assert.rejects(provider(fakeFetch([{ status: 500, body: {} }]).fn).p.getByBarcode("3017624010701"), (e: unknown) => e instanceof OffError && e.code === "http");
  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(provider(down).p.getByBarcode("3017624010701"), (e: unknown) => e instanceof OffError && e.code === "network");
});

test("User-Agent is sent on every request, retries included, plus staging login", async () => {
  const { fn, calls } = fakeFetch([{ status: 429 }, { status: 200, body: NUTELLA }]);
  await provider(fn).p.getByBarcode("3017624010701");
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.headers["User-Agent"], UA);
    assert.equal(c.headers.Authorization, `Basic ${btoa("off:off")}`);
  }
  assert.throws(() => new OpenFoodFactsProvider({ baseUrl: OFF_STAGING_URL, userAgent: " " }));
});

test("stays under 15 reads a minute by waiting", async () => {
  let clock = 0;
  const { fn, calls } = fakeFetch([{ status: 200, body: NUTELLA }]);
  const slept: number[] = [];
  const p = new OpenFoodFactsProvider({
    baseUrl: OFF_STAGING_URL,
    userAgent: UA,
    fetch: fn,
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
  });
  for (let i = 0; i < 16; i++) await p.getByBarcode("3017624010701");
  assert.equal(calls.length, 16);
  assert.deepEqual(slept, [60_000]);
});

test("config: staging in development, production only from config, no contact → off", () => {
  const dev = offConfig({ NODE_ENV: "development", OFF_CONTACT_EMAIL: "a@b.c", OFF_BASE_URL: "https://world.openfoodfacts.org" }, "1.2.3");
  assert.deepEqual(dev, { ok: true, baseUrl: OFF_STAGING_URL, basicAuth: "off:off", userAgent: "SnapCal/1.2.3 (a@b.c)" });
  assert.equal(offConfig({ NODE_ENV: "test", OFF_CONTACT_EMAIL: "a@b.c" }, "1").ok, true);
  assert.deepEqual(offConfig({ NODE_ENV: "production", OFF_CONTACT_EMAIL: "a@b.c" }, "1"), { ok: false, reason: "no-base-url" });
  const prod = offConfig({ NODE_ENV: "production", OFF_CONTACT_EMAIL: "a@b.c", OFF_BASE_URL: "https://world.openfoodfacts.org" }, "1");
  assert.ok(prod.ok && prod.baseUrl === "https://world.openfoodfacts.org" && prod.basicAuth === null);
  assert.deepEqual(offConfig({ NODE_ENV: "development" }, "1"), { ok: false, reason: "no-contact" });
});

test("helpers: barcode cleaning, serving grams, retry delay", () => {
  assert.equal(cleanBarcode(" 3017-6240 10701 "), "3017624010701");
  assert.equal(cleanBarcode("1234567"), null);
  assert.equal(cleanBarcode("123456789012345"), null);
  assert.equal(servingGrams("15 g"), 15);
  assert.equal(servingGrams("30g (2 biscuits)"), 30);
  assert.equal(servingGrams("1 cup (240 ml)"), null);
  assert.equal(servingGrams(null), null);
  assert.equal(retryDelay("120", 0), 30_000);
  assert.equal(retryDelay(null, 2), 4000);
});

test("a meal item from an OFF food: grams eaten, no margin, source kept, missing → estimated", () => {
  const food = normalizeOffProduct(NUTELLA.code, NUTELLA.product);
  const it = foodToItem(food, 15, "it1", "Product");
  assert.equal(it.kcal, 81); // 539 × 0.15 = 80.85
  assert.equal(it.fat, 4.6);
  assert.equal(it.amount, 15);
  assert.equal(it.unit, "g");
  assert.equal(it.margin, false);
  assert.equal(it.estimated, false);
  assert.deepEqual(it.ref, { source: "off", sourceId: "3017624010701" });
  const partial = foodToItem({ ...food, name: null, fat: null }, 100, "it2", "Product");
  assert.equal(partial.name, "Product");
  assert.equal(partial.fat, 0);
  assert.equal(partial.estimated, true);
});
