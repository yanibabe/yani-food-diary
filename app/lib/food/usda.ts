// Round 41: USDA FoodData Central client. SERVER ONLY (the key must never reach the browser).
// Docs: https://fdc.nal.usda.gov/api-guide  ·  Data: public domain (CC0). USDA asks for credit:
// "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central."
//
// - The key comes from the server setting USDA_API_KEY and is sent in the X-Api-Key header
//   (never in the web address, so it never shows up in logs). Error messages never contain it.
// - DEMO_KEY (USDA's shared test key) is refused in production.
// - Limit: 1,000 requests per hour per key. A 429 answer = "busy, try later" (not retried for long).
// - Timeouts, network errors and bad answers become a UsdaError. The app then lets her carry on
//   with the AI / reference values / typing — USDA being down never blocks a meal.
// - Results are cached in memory for a while (search 1 day, details 7 days).
// - Only the food words are ever sent to USDA. Never her profile, weight or diary.

import { USDA_DATA_TYPE_NAME, normalizeUsdaFood, type UsdaFood } from "./usdaNutrients.ts";
import type { UsdaDataType } from "../types.ts";

export const USDA_BASE_URL = "https://api.nal.usda.gov/fdc";
export const USDA_ATTRIBUTION = "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.";
export const GENERIC_TYPES: UsdaDataType[] = ["foundation", "sr", "fndds"];

type Env = Record<string, string | undefined>;

export type UsdaConfig = { ok: true; apiKey: string; baseUrl: string } | { ok: false; reason: "no-key" | "demo-key-in-production" };

/** The key from the server settings. DEMO_KEY only outside production. */
export function usdaConfig(env: Env): UsdaConfig {
  const key = env.USDA_API_KEY?.trim();
  if (!key) return { ok: false, reason: "no-key" };
  if (key.toUpperCase() === "DEMO_KEY" && env.NODE_ENV === "production") return { ok: false, reason: "demo-key-in-production" };
  return { ok: true, apiKey: key, baseUrl: (env.USDA_BASE_URL?.trim() || USDA_BASE_URL).replace(/\/+$/, "") };
}

export class UsdaError extends Error {
  code: "not-configured" | "auth" | "rate-limited" | "timeout" | "network" | "http" | "bad-response";
  status?: number;
  constructor(code: UsdaError["code"], message: string, status?: number) {
    super(message);
    this.name = "UsdaError";
    this.code = code;
    this.status = status;
  }
}

/** A tiny time-limited memory. Oldest entries go first when it is full. */
export class TtlCache<V> {
  private m = new Map<string, { at: number; v: V }>();
  private ttlMs: number;
  private max: number;
  private now: () => number;
  constructor(ttlMs: number, max = 300, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.now = now;
  }
  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (this.now() - e.at > this.ttlMs) {
      this.m.delete(k);
      return undefined;
    }
    return e.v;
  }
  set(k: string, v: V) {
    this.m.delete(k);
    this.m.set(k, { at: this.now(), v });
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);
  }
  get size() {
    return this.m.size;
  }
}

export type UsdaOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** One more try after a 5xx / network error. 429 is never retried here. */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class UsdaClient {
  private o: Required<UsdaOptions>;
  readonly searchCache: TtlCache<UsdaFood[]>;
  readonly detailCache: TtlCache<UsdaFood | null>;

  constructor(options: UsdaOptions) {
    if (!options.apiKey?.trim()) throw new UsdaError("not-configured", "USDA_API_KEY is not set");
    this.o = { baseUrl: USDA_BASE_URL, fetch: (...a) => fetch(...a), timeoutMs: 8000, retries: 1, sleep: realSleep, now: Date.now, ...options };
    this.o.baseUrl = this.o.baseUrl.replace(/\/+$/, "");
    this.searchCache = new TtlCache(24 * 3600_000, 300, this.o.now);
    this.detailCache = new TtlCache(7 * 24 * 3600_000, 500, this.o.now);
  }

  /** Search USDA. Generic foods (Foundation, SR Legacy, FNDDS) and Branded foods are separate searches. */
  async search(query: string, types: UsdaDataType[] = GENERIC_TYPES, pageSize = 12): Promise<UsdaFood[]> {
    const q = query.trim().slice(0, 100);
    if (!q) return [];
    const key = `${types.join(",")}|${pageSize}|${q.toLowerCase()}`;
    const hit = this.searchCache.get(key);
    if (hit) return hit;
    const body = await this.request("/v1/foods/search", {
      method: "POST",
      body: JSON.stringify({ query: q, dataType: types.map((t) => USDA_DATA_TYPE_NAME[t]), pageSize, requireAllWords: false }),
    });
    const list = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).foods) ? ((body as Record<string, unknown>).foods as unknown[]) : null;
    if (!list) throw new UsdaError("bad-response", "USDA sent an answer we can't read");
    const foods = list.map(normalizeUsdaFood).filter((f): f is UsdaFood => !!f && types.includes(f.dataType));
    this.searchCache.set(key, foods);
    return foods;
  }

  /** One food's full details (all nutrients + household measures). null = no such food. */
  async food(fdcId: number): Promise<UsdaFood | null> {
    if (!Number.isInteger(fdcId) || fdcId <= 0) return null;
    const key = String(fdcId);
    const hit = this.detailCache.get(key);
    if (hit !== undefined) return hit;
    const body = await this.request(`/v1/food/${fdcId}?format=full`, { method: "GET" }, true);
    const food = body == null ? null : normalizeUsdaFood(body);
    this.detailCache.set(key, food);
    return food;
  }

  private async request(path: string, init: { method: string; body?: string }, notFoundIsNull = false): Promise<unknown> {
    const headers: Record<string, string> = { "X-Api-Key": this.o.apiKey, Accept: "application/json" };
    if (init.body) headers["Content-Type"] = "application/json";
    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs);
      let res: Response;
      try {
        res = await this.o.fetch(`${this.o.baseUrl}${path}`, { ...init, headers, signal: ctrl.signal });
      } catch (e) {
        clearTimeout(timer);
        const timedOut = ctrl.signal.aborted || (e instanceof Error && e.name === "AbortError");
        if (!timedOut && attempt < this.o.retries) {
          await this.o.sleep(400);
          continue;
        }
        throw timedOut ? new UsdaError("timeout", "USDA took too long to answer") : new UsdaError("network", "Couldn't reach USDA");
      }
      clearTimeout(timer);
      if (res.status === 429) throw new UsdaError("rate-limited", "USDA is busy (too many requests). Try again later.", 429);
      if (res.status === 401 || res.status === 403) throw new UsdaError("auth", "USDA did not accept the API key", res.status);
      if (res.status === 404 && notFoundIsNull) return null;
      if (res.status >= 500) {
        if (attempt < this.o.retries) {
          await this.o.sleep(400);
          continue;
        }
        throw new UsdaError("http", `USDA replied ${res.status}`, res.status);
      }
      if (!res.ok) throw new UsdaError("http", `USDA replied ${res.status}`, res.status);
      try {
        return await res.json();
      } catch {
        throw new UsdaError("bad-response", "USDA sent an answer we can't read");
      }
    }
  }
}

let shared: { key: string; client: UsdaClient } | null = null;
/** One client per server instance (so the cache is shared). Throws "not-configured" without a key. */
export function sharedUsdaClient(env: Env = process.env): UsdaClient {
  const c = usdaConfig(env);
  if (!c.ok) throw new UsdaError("not-configured", c.reason === "no-key" ? "USDA_API_KEY is not set" : "DEMO_KEY is not allowed in production");
  if (!shared || shared.key !== c.apiKey) shared = { key: c.apiKey, client: new UsdaClient({ apiKey: c.apiKey, baseUrl: c.baseUrl }) };
  return shared.client;
}
