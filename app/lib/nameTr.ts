// Round 79: the phone's memory of names it already translated ("a name is translated once, ever").
//   yfd:v1:nameTr      = { "<original name>": { th, en } }
//   yfd:v1:nameTrRuns  = { day, calls, failedAt }   how many AI calls today (so the cost stays tiny); failedAt = when the last call failed (ms, 0 = none)
// Reading bad / missing text gives an empty memory, never an error.

import { cleanAltText, sameProtein } from "./names.ts";
import type { NamePair } from "./translateNames.ts";

export const NAME_TR_KEY = "yfd:v1:nameTr";
export const NAME_TR_RUNS_KEY = "yfd:v1:nameTrRuns";
/** Oldest names are forgotten after this many (a name is simply asked again, if it is still used). */
export const MAX_CACHED = 3000;

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type NameTrCache = Record<string, { th: string; en: string }>;
/** A failed call pauses the AI part for this long (not the whole day). */
export const FAIL_PAUSE_MS = 60 * 60 * 1000;
export type Runs = { day: string; calls: number; failedAt: number };

const browserStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function parseNameTr(raw: string | null | undefined): NameTrCache {
  const out: NameTrCache = {};
  if (!raw) return out;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return out;
    for (const [src, p] of Object.entries(v as Record<string, unknown>)) {
      if (!p || typeof p !== "object") continue;
      const th = cleanAltText((p as { th?: unknown }).th);
      const en = cleanAltText((p as { en?: unknown }).en);
      // A saved pair whose meats disagree is forgotten, so the name is translated again (no endless loop).
      if (th && en && sameProtein(th, en)) out[src] = { th, en };
    }
  } catch {
    /* empty memory */
  }
  return out;
}

let mem: NameTrCache | null = null;

export function loadNameTr(storage: StorageLike | null = browserStorage()): NameTrCache {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(NAME_TR_KEY) ?? null;
  } catch {
    /* blocked */
  }
  const c = parseNameTr(raw);
  if (storage === browserStorage()) mem = c;
  return c;
}

/** Add pairs (newest last), keep at most MAX_CACHED. Returns the new memory; saving never throws. */
export function addPairs(cache: NameTrCache, pairs: NamePair[], storage: StorageLike | null = browserStorage()): NameTrCache {
  const next: NameTrCache = { ...cache };
  for (const p of pairs) {
    delete next[p.src]; // re-insert → newest
    next[p.src] = { th: p.th, en: p.en };
  }
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) delete next[k];
  try {
    storage?.setItem(NAME_TR_KEY, JSON.stringify(next));
  } catch {
    /* full or blocked: the names are just asked again later */
  }
  if (storage === browserStorage()) mem = next;
  return next;
}

/** A name translated before, for screens that have no saved alt for it (e.g. her usual picks). */
export function cachedPair(name: string): { th: string; en: string } | null {
  if (!mem) mem = loadNameTr();
  return mem[name] ?? null;
}

export function parseRuns(raw: string | null | undefined, today: string): Runs {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (v) {
      // The pause after a failure survives midnight; the call count does not.
      const failedAt = Number.isFinite(v.failedAt) && v.failedAt > 0 ? Math.floor(v.failedAt) : 0;
      const calls = v.day === today && Number.isFinite(v.calls) ? Math.max(0, Math.floor(v.calls)) : 0;
      return { day: today, calls, failedAt };
    }
  } catch {
    /* new day */
  }
  return { day: today, calls: 0, failedAt: 0 };
}

export function loadRuns(today: string, storage: StorageLike | null = browserStorage()): Runs {
  try {
    return parseRuns(storage?.getItem(NAME_TR_RUNS_KEY), today);
  } catch {
    return parseRuns(null, today);
  }
}

export function saveRuns(r: Runs, storage: StorageLike | null = browserStorage()) {
  try {
    storage?.setItem(NAME_TR_RUNS_KEY, JSON.stringify(r));
  } catch {
    /* fine */
  }
}
