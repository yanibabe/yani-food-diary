// Round 42: a small, polite USDA search for the search box.
//  - waits 500 ms after the last key press (debounce),
//  - remembers answers by the normalised words (in memory, and in sessionStorage if given),
//  - never throws: offline / no passcode / USDA down → a `status` the screen can show as one quiet line.
// `fetch`, the clock and the timer are injected, so tests need no network and no waiting.
// Only the typed food words are sent — never her profile, weight or diary.

import { normalizeName } from "./foodRef.ts";
import type { Lang } from "./i18n.ts";
import { MIN_USDA_CHARS, usdaSuggestion, usdaSuggestions, type Suggestion } from "./ingredientSearch.ts";
import type { Difference } from "./food/usdaMatch.ts";
import type { UsdaFood } from "./food/usdaNutrients.ts";

export type UsdaStatus =
  | "ok"
  /** fewer than 2 characters: nothing was asked */
  | "too-short"
  /** this phone has no passcode yet */
  | "no-passcode"
  | "offline"
  /** USDA isn't set up on the server */
  | "unavailable"
  /** USDA is busy (rate limit) */
  | "busy"
  | "error"
  /** a newer search replaced this one: ignore it */
  | "superseded";

export type UsdaSearchOut = {
  status: UsdaStatus;
  /** USDA rows, best first (empty unless status is "ok"). */
  results: Suggestion[];
  /** answered from the cache: no call was made */
  cached: boolean;
  /** the English words USDA was searched with */
  query?: string;
  message?: string;
};

type Raw = (UsdaFood & { differences?: Difference[]; close?: boolean })[];
type CacheValue = { t: number; query: string; raw: Raw };

export type UsdaSearcherOpts = {
  fetchFn?: typeof fetch;
  url?: string;
  /** e.g. the passcode header. Called for every request. */
  getHeaders?: () => Record<string, string>;
  hasPasscode?: () => boolean;
  online?: () => boolean;
  now?: () => number;
  /** Returns a cancel function. Default: setTimeout / clearTimeout. */
  schedule?: (fn: () => void, ms: number) => () => void;
  debounceMs?: number;
  ttlMs?: number;
  maxEntries?: number;
  /** sessionStorage (or a fake). Optional. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  storageKey?: string;
};

export const USDA_DEBOUNCE_MS = 500;
export const USDA_CACHE_TTL_MS = 30 * 60 * 1000;
export const USDA_CACHE_KEY = "yfd:v1:usdaCache";

const defaultSchedule = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function createUsdaSearcher(o: UsdaSearcherOpts = {}) {
  const fetchFn = o.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const url = o.url ?? "/api/food/usda";
  const now = o.now ?? Date.now;
  const schedule = o.schedule ?? defaultSchedule;
  const debounceMs = o.debounceMs ?? USDA_DEBOUNCE_MS;
  const ttl = o.ttlMs ?? USDA_CACHE_TTL_MS;
  const maxEntries = o.maxEntries ?? 40;
  const storageKey = o.storageKey ?? USDA_CACHE_KEY;
  const online = o.online ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const hasPasscode = o.hasPasscode ?? (() => true);

  const memory = new Map<string, CacheValue>();
  const inflight = new Map<string, Promise<UsdaSearchOut>>();
  let loaded = false;
  let seq = 0;
  let pending: { cancel: () => void; settle: (r: UsdaSearchOut) => void } | null = null;

  const done = (status: UsdaStatus, extra: Partial<UsdaSearchOut> = {}): UsdaSearchOut => ({ status, results: [], cached: false, ...extra });

  function loadStorage() {
    if (loaded) return;
    loaded = true;
    try {
      const v = JSON.parse(o.storage?.getItem(storageKey) ?? "{}") as Record<string, CacheValue>;
      if (v && typeof v === "object" && !Array.isArray(v))
        for (const [k, c] of Object.entries(v)) if (c && typeof c.t === "number" && Array.isArray(c.raw) && typeof c.query === "string") memory.set(k, c);
    } catch {
      /* bad saved text → start empty */
    }
  }
  function saveStorage() {
    try {
      o.storage?.setItem(storageKey, JSON.stringify(Object.fromEntries(memory)));
    } catch {
      /* private mode / full: the memory cache still works */
    }
  }
  function remember(key: string, v: CacheValue) {
    memory.set(key, v);
    if (memory.size > maxEntries) {
      const oldest = [...memory.entries()].sort((a, b) => a[1].t - b[1].t)[0];
      if (oldest) memory.delete(oldest[0]);
    }
    saveStorage();
  }

  function fromCache(key: string): UsdaSearchOut | null {
    loadStorage();
    const c = memory.get(key);
    if (!c) return null;
    if (now() - c.t > ttl) {
      memory.delete(key);
      return null;
    }
    return { status: "ok", results: usdaSuggestions(c.raw, c.t), cached: true, query: c.query };
  }

  /** Ask now (no waiting). Cached answers need no network, passcode or connection. */
  async function search(name: string, lang: Lang = "th"): Promise<UsdaSearchOut> {
    const key = normalizeName(name);
    if ([...key].length < MIN_USDA_CHARS) return done("too-short");
    const hit = fromCache(key);
    if (hit) return hit;
    if (!online()) return done("offline");
    if (!hasPasscode()) return done("no-passcode");
    const running = inflight.get(key);
    if (running) return running;
    const run = (async (): Promise<UsdaSearchOut> => {
      try {
        const res = await fetchFn(url, {
          method: "POST",
          headers: { "content-type": "application/json", ...(o.getHeaders?.() ?? {}) },
          body: JSON.stringify({ action: "search", name: name.trim().slice(0, 120), lang }),
        });
        const data = (await res.json().catch(() => null)) as { results?: unknown; query?: string; error?: string; message?: string } | null;
        if (!res.ok) {
          const message = typeof data?.message === "string" ? data.message : undefined;
          if (res.status === 401 || data?.error === "passcode") return done("no-passcode", { message });
          if (data?.error === "not-configured") return done("unavailable", { message });
          if (res.status === 429) return done("busy", { message });
          return done("error", { message });
        }
        const raw = (Array.isArray(data?.results) ? data!.results : []) as Raw;
        const query = typeof data?.query === "string" ? data.query : "";
        remember(key, { t: now(), query, raw });
        return { status: "ok", results: usdaSuggestions(raw, now()), cached: false, query };
      } catch {
        // fetch itself failed: no connection (or the server is unreachable)
        return online() ? done("error") : done("offline");
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, run);
    return run;
  }

  /** Same as search, but waits `debounceMs` after the LAST call. Older calls resolve as "superseded". */
  function searchDebounced(name: string, lang: Lang = "th"): Promise<UsdaSearchOut> {
    const mine = ++seq;
    pending?.cancel();
    pending?.settle(done("superseded"));
    return new Promise<UsdaSearchOut>((resolve) => {
      let settled = false;
      const settle = (r: UsdaSearchOut) => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      const cancel = schedule(() => {
        if (pending && pending.settle === settle) pending = null;
        void search(name, lang).then((r) => settle(mine === seq ? r : done("superseded")));
      }, debounceMs);
      pending = { cancel, settle };
    });
  }

  /**
   * After she picks a USDA row: fetch its household measures (cup, spoon…). If that fails, the row from the
   * search is still USDA's own numbers — only the measures are missing — so we hand back `fallback` unchanged.
   */
  async function detail(row: Suggestion): Promise<{ status: UsdaStatus; suggestion: Suggestion }> {
    if (row.source.kind !== "usda") return { status: "ok", suggestion: row };
    if (!online()) return { status: "offline", suggestion: row };
    if (!hasPasscode()) return { status: "no-passcode", suggestion: row };
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(o.getHeaders?.() ?? {}) },
        body: JSON.stringify({ action: "detail", fdcId: row.source.usda.fdcId }),
      });
      const data = (await res.json().catch(() => null)) as { food?: unknown } | null;
      if (!res.ok || !data?.food) return { status: "error", suggestion: row };
      const full = usdaSuggestion(data.food as UsdaFood, now());
      if (!full) return { status: "error", suggestion: row };
      // keep the name she saw, take USDA's full numbers + measures
      const name = row.name;
      return { status: "ok", suggestion: { ...full, name, source: { ...full.source, name } as typeof full.source, kind: row.kind, differences: row.differences, close: row.close, conflict: row.conflict } };
    } catch {
      return { status: online() ? "error" : "offline", suggestion: row };
    }
  }

  function clear() {
    memory.clear();
    saveStorage();
  }

  return { search, searchDebounced, detail, clear, cacheSize: () => memory.size };
}

export type UsdaSearcher = ReturnType<typeof createUsdaSearcher>;
