// Open Food Facts (OFF) barcode lookups.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
// - Reads need no key and no account, only our own User-Agent.
// - We use API v3 (the docs mark v2 as deprecated).
// - Limit: 15 product reads per minute per IP. We never search OFF live.
// - Data is ODbL: show "Data from Open Food Facts (ODbL)" wherever it appears,
//   and keep OFF products in their own store, unchanged.
// Runs on the server: browsers are not allowed to set a User-Agent.

import type { Food, FoodProvider } from "./provider.ts";

export const OFF_FIELDS = "code,product_name,brands,serving_size,nutriments,image_front_url";
export const OFF_READS_PER_MINUTE = 15;
export const OFF_ATTRIBUTION = "Data from Open Food Facts (ODbL)";

/** An OFF product exactly as OFF sent it. */
export type OffProduct = Record<string, unknown>;

export class OffError extends Error {
  code: "rate-limited" | "http" | "network" | "bad-response";
  status?: number;
  constructor(code: OffError["code"], message: string, status?: number) {
    super(message);
    this.name = "OffError";
    this.code = code;
    this.status = status;
  }
}

export type OffOptions = {
  baseUrl: string;
  /** "AppName/Version (contact)". Sent on every request. */
  userAgent: string;
  /** "user:password" for the staging server. Not used in production. */
  basicAuth?: string | null;
  fetch?: typeof fetch;
  /** Extra tries after a 429 / 503. */
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  readsPerMinute?: number;
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A number from OFF. Numbers or strings like "6.3", "6,3", "< 0.5". Anything else → null. */
export function parseNum(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const s = v.trim().replace(",", ".").replace(/^[<>~≈]\s*/, "");
    if (!/^\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return null;
    n = Number(s);
  } else return null;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Turn a raw OFF product into a `Food` (per 100 g). Never throws. */
export function normalizeOffProduct(code: string, product: OffProduct): Food {
  const n = (product.nutriments && typeof product.nutriments === "object" ? product.nutriments : {}) as Record<string, unknown>;
  let kcal = parseNum(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = parseNum(n["energy-kj_100g"]);
    if (kj != null) kcal = Math.round((kj / 4.184) * 10) / 10;
  }
  return {
    source: "off",
    sourceId: text(product.code) ?? code,
    name: text(product.product_name),
    brand: text(product.brands),
    servingSize: text(product.serving_size),
    kcal,
    protein: parseNum(n["proteins_100g"]),
    carbs: parseNum(n["carbohydrates_100g"]),
    fat: parseNum(n["fat_100g"]),
  };
}

export class OpenFoodFactsProvider implements FoodProvider {
  readonly source = "off" as const;
  private readonly o: Required<Omit<OffOptions, "basicAuth">> & { basicAuth: string | null };
  private recent: number[] = [];

  constructor(options: OffOptions) {
    if (!options.userAgent.trim()) throw new Error("Open Food Facts needs a User-Agent");
    this.o = {
      fetch: (...a) => fetch(...a),
      maxRetries: 2,
      sleep: realSleep,
      now: Date.now,
      readsPerMinute: OFF_READS_PER_MINUTE,
      basicAuth: null,
      ...options,
      baseUrl: options.baseUrl.replace(/\/+$/, ""),
    };
  }

  async getByBarcode(barcode: string): Promise<Food | null> {
    const raw = await this.fetchProduct(barcode);
    return raw ? normalizeOffProduct(raw.code, raw.product) : null;
  }

  /** In OFF the id IS the barcode. */
  getById(id: string): Promise<Food | null> {
    return this.getByBarcode(id);
  }

  /** The raw product, for OFF's own store. null = not in OFF. */
  async fetchProduct(barcode: string): Promise<{ code: string; product: OffProduct } | null> {
    const url = `${this.o.baseUrl}/api/v3/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
    const headers: Record<string, string> = { "User-Agent": this.o.userAgent, Accept: "application/json" };
    if (this.o.basicAuth) headers.Authorization = `Basic ${btoa(this.o.basicAuth)}`;

    for (let attempt = 0; ; attempt++) {
      await this.waitForTurn();
      let res: Response;
      try {
        res = await this.o.fetch(url, { headers });
      } catch (e) {
        throw new OffError("network", `Couldn't reach Open Food Facts: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (res.status === 429 || res.status === 503) {
        if (attempt >= this.o.maxRetries) {
          throw new OffError("rate-limited", "Open Food Facts is busy. Try again in a minute.", res.status);
        }
        await this.o.sleep(retryDelay(res.headers.get("retry-after"), attempt));
        continue;
      }

      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (isNotFound(res.status, body)) return null;
      if (!res.ok) throw new OffError("http", `Open Food Facts replied ${res.status}`, res.status);
      const product = body?.product;
      if (!product || typeof product !== "object") throw new OffError("bad-response", "Open Food Facts sent an answer we can't read");
      return { code: text(body?.code) ?? barcode, product: product as OffProduct };
    }
  }

  /** Writing products needs an OFF account. Not built (out of scope). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async saveProduct(_barcode: string, _fields: Record<string, string>): Promise<never> {
    throw new Error("Not implemented: writing to Open Food Facts needs an OFF account");
  }

  /** Keep under the per-minute limit by waiting, never by sending anyway. */
  private async waitForTurn() {
    const windowMs = 60_000;
    for (;;) {
      const now = this.o.now();
      this.recent = this.recent.filter((t) => now - t < windowMs);
      if (this.recent.length < this.o.readsPerMinute) {
        this.recent.push(now);
        return;
      }
      await this.o.sleep(this.recent[0] + windowMs - now);
    }
  }
}

/** Unknown barcode: v3 says status "failure" / "product_not_found" with HTTP 404; v2 said status 0. */
function isNotFound(status: number, body: Record<string, unknown> | null): boolean {
  if (body?.status === 0 || body?.status === "0") return true;
  const result = body?.result as { id?: unknown } | undefined;
  if (result?.id === "product_not_found") return true;
  return status === 404;
}

/** Wait time before the next try: Retry-After (seconds, max 30 s) or 1 s, 2 s, 4 s… */
export function retryDelay(retryAfter: string | null, attempt: number): number {
  const s = retryAfter == null ? NaN : Number(retryAfter);
  if (Number.isFinite(s) && s >= 0) return Math.min(s, 30) * 1000;
  return 1000 * 2 ** attempt;
}
