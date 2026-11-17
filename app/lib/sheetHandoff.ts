// Round 47: the Add food sheet hands the chosen food to the review page ONCE, at the end.
// The food travels in sessionStorage (not in the link), is read once, and goes stale after a few minutes.
// Pure encode/decode here (no React) so the tests can run them.

import { UNITS, type Ingredient } from "./types.ts";

export const HANDOFF_KEY = "yfd:v1:addHandoff";
/** A hand-over older than this is ignored (she must have wandered off). */
export const HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;

type Envelope = { v: 1; at: number; ing: Ingredient };

export type StoreLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function encodeHandoff(ing: Ingredient, now: number): string {
  const env: Envelope = { v: 1, at: now, ing };
  return JSON.stringify(env);
}

/** Text → a usable ingredient, or null (missing, broken, wrong shape, too old, or from the future). */
export function decodeHandoff(raw: string | null | undefined, now: number): Ingredient | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const e = v as Partial<Envelope>;
  if (e.v !== 1 || typeof e.at !== "number" || !Number.isFinite(e.at)) return null;
  const age = now - e.at;
  if (age < 0 || age > HANDOFF_MAX_AGE_MS) return null;
  const i = e.ing as Partial<Ingredient> | undefined;
  if (!i || typeof i !== "object") return null;
  if (typeof i.name !== "string" || !i.name.trim()) return null;
  if (typeof i.amount !== "number" || !Number.isFinite(i.amount) || i.amount <= 0) return null;
  if (typeof i.unit !== "string" || !(i.unit in UNITS)) return null;
  return i as Ingredient;
}

/** Put the chosen food down. false = the phone would not store it (private mode…): the caller keeps the sheet open. */
export function putHandoff(store: StoreLike | null, ing: Ingredient, now: number): boolean {
  if (!store) return false;
  try {
    store.setItem(HANDOFF_KEY, encodeHandoff(ing, now));
    return true;
  } catch {
    return false;
  }
}

/** Pick the food up. It is removed first, so a refresh or a second visit can never use it twice. */
export function takeHandoff(store: StoreLike | null, now: number): Ingredient | null {
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(HANDOFF_KEY);
    store.removeItem(HANDOFF_KEY);
  } catch {
    return null;
  }
  return decodeHandoff(raw, now);
}
