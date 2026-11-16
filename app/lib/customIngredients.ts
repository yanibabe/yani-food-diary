// Round 42: what the phone remembers for ingredient search. Pure functions + two tiny storage helpers.
//   1. Her saved CUSTOM ingredients (name, per-100 numbers…). She can add, edit and delete them.
//   2. Her usual PICKS: "when I type X, I mean this food". She can change or forget them.
// Only ingredient names and numbers are stored — never photos or personal data.
// Both lists live in localStorage and are part of the backup file (see backup.ts).
// Bad / missing saved text → an empty list, never an error. Numbers she types are never "verified".

import type { AiRef, FoodState, IngredientUnit, MacroKey, UsdaPick } from "./types.ts";
import { UNITS } from "./types.ts";

export const CUSTOM_KEY = "yfd:v1:customIngredients";
export const PREFS_KEY = "yfd:v1:ingredientPrefs";

const STATES: FoodState[] = ["raw", "cooked", "dried", "prepared"];

// ---------------------------------------------------------------------------
// Custom ingredients
// ---------------------------------------------------------------------------

export type CustomIngredient = {
  id: string;
  name: string;
  /** raw / cooked / dried / prepared, when she says. */
  state: FoodState | null;
  /** per100 = numbers are per 100 g (or 100 ml). perUnit = numbers are for ONE unit (one serving / piece / pack). */
  basis: "per100" | "perUnit";
  /** per100 only: the numbers are per 100 g or per 100 ml. */
  per: "g" | "ml";
  kcal: number;
  /** null = she left it empty = unknown (never 0). */
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Only shown, never added to the diary totals. */
  extra?: { fiber?: number; sugar?: number; sodiumMg?: number; satFat?: number };
  /** Weight of one unit (egg, piece, serving…) in g. */
  gramsPerUnit: number | null;
  /** Grams in 1 ml, if she knows it. */
  gPerMl: number | null;
  /** The unit she usually uses for it (used to start the quantity box). */
  unit?: IngredientUnit | null;
  /** Other words that should find it. */
  aliases?: string[];
  createdAt: number;
  updatedAt: number;
};

/** What the "add custom ingredient" form gives us. */
export type CustomInput = {
  name: string;
  state?: FoodState | null;
  basis?: "per100" | "perUnit";
  per?: "g" | "ml";
  kcal: number | null | undefined;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  extra?: CustomIngredient["extra"];
  gramsPerUnit?: number | null;
  gPerMl?: number | null;
  unit?: IngredientUnit | null;
  aliases?: string[];
};

export type CustomError = "name" | "kcal" | "number";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const pos = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const round2 = (v: number) => Math.round(v * 100) / 100;
const cleanName = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 80);

/** Turn her input into a clean custom ingredient, or say what is wrong. Never throws. */
export function makeCustom(input: CustomInput, id: string, now: number, createdAt = now): { ok: true; item: CustomIngredient } | { ok: false; error: CustomError } {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "name" };
  const kcal = num(input.kcal);
  if (kcal == null) return { ok: false, error: "kcal" };
  // A number that was typed but is negative / not a number is an error; an EMPTY one is just "unknown".
  const given = (v: number | null | undefined) => v === null || v === undefined;
  for (const v of [input.protein, input.carbs, input.fat, input.gramsPerUnit, input.gPerMl]) if (!given(v) && num(v) == null) return { ok: false, error: "number" };
  const item: CustomIngredient = {
    id,
    name,
    state: input.state && STATES.includes(input.state) ? input.state : null,
    basis: input.basis === "perUnit" ? "perUnit" : "per100",
    per: input.per === "ml" ? "ml" : "g",
    kcal: round2(kcal),
    protein: num(input.protein) == null ? null : round2(input.protein as number),
    carbs: num(input.carbs) == null ? null : round2(input.carbs as number),
    fat: num(input.fat) == null ? null : round2(input.fat as number),
    gramsPerUnit: pos(input.gramsPerUnit),
    gPerMl: pos(input.gPerMl),
    createdAt,
    updatedAt: now,
  };
  if (input.extra) {
    const e: NonNullable<CustomIngredient["extra"]> = {};
    for (const k of ["fiber", "sugar", "sodiumMg", "satFat"] as const) {
      const v = num(input.extra[k]);
      if (v != null) e[k] = round2(v);
    }
    if (Object.keys(e).length) item.extra = e;
  }
  if (input.unit && input.unit in UNITS) item.unit = input.unit;
  const aliases = (input.aliases ?? []).map(cleanName).filter(Boolean).slice(0, 8);
  if (aliases.length) item.aliases = aliases;
  return { ok: true, item };
}

/** Which of protein / carbs / fat she left empty. */
export function customMissing(c: Pick<CustomIngredient, "protein" | "carbs" | "fat">): MacroKey[] {
  return (["protein", "carbs", "fat"] as const).filter((k) => c[k] == null);
}

/** Add one. Newest first. Same name + same state is allowed only once: it is an error ("duplicate") so she edits instead. */
export function addCustom(list: CustomIngredient[], input: CustomInput, now: number, id = `ci_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`): { ok: true; list: CustomIngredient[]; item: CustomIngredient } | { ok: false; error: CustomError | "duplicate" } {
  const made = makeCustom(input, id, now);
  if (!made.ok) return made;
  const key = (c: Pick<CustomIngredient, "name" | "state">) => `${c.name.toLowerCase()}|${c.state ?? ""}`;
  if (list.some((c) => key(c) === key(made.item))) return { ok: false, error: "duplicate" };
  return { ok: true, list: [made.item, ...list], item: made.item };
}

/** Change one (keeps its id and createdAt). */
export function editCustom(list: CustomIngredient[], id: string, input: CustomInput, now: number): { ok: true; list: CustomIngredient[]; item: CustomIngredient } | { ok: false; error: CustomError | "missing" | "duplicate" } {
  const old = list.find((c) => c.id === id);
  if (!old) return { ok: false, error: "missing" };
  const made = makeCustom(input, id, now, old.createdAt);
  if (!made.ok) return made;
  const key = (c: Pick<CustomIngredient, "name" | "state">) => `${c.name.toLowerCase()}|${c.state ?? ""}`;
  if (list.some((c) => c.id !== id && key(c) === key(made.item))) return { ok: false, error: "duplicate" };
  return { ok: true, list: list.map((c) => (c.id === id ? made.item : c)), item: made.item };
}

export function deleteCustom(list: CustomIngredient[], id: string): CustomIngredient[] {
  return list.filter((c) => c.id !== id);
}

/** Read the saved text. Bad JSON, wrong shape or bad rows → dropped. Never throws. */
export function parseCustom(raw: string | null | undefined): CustomIngredient[] {
  const arr = safeArray(raw);
  const out: CustomIngredient[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : null;
    if (!id || seen.has(id)) continue;
    const made = makeCustom(
      {
        name: o.name as string,
        state: o.state as FoodState | null,
        basis: o.basis as "per100" | "perUnit",
        per: o.per as "g" | "ml",
        kcal: o.kcal as number,
        protein: num(o.protein),
        carbs: num(o.carbs),
        fat: num(o.fat),
        extra: o.extra && typeof o.extra === "object" ? (o.extra as CustomIngredient["extra"]) : undefined,
        gramsPerUnit: num(o.gramsPerUnit),
        gPerMl: num(o.gPerMl),
        unit: o.unit as IngredientUnit | null,
        aliases: Array.isArray(o.aliases) ? (o.aliases.filter((a) => typeof a === "string") as string[]) : undefined,
      },
      id,
      num(o.updatedAt) ?? 0,
      num(o.createdAt) ?? 0,
    );
    if (made.ok) {
      seen.add(id);
      out.push(made.item);
    }
  }
  return out;
}

export const serializeCustom = (list: CustomIngredient[]) => JSON.stringify(list);

// ---------------------------------------------------------------------------
// Usual picks ("preferred matches")
// ---------------------------------------------------------------------------

/** A food she picked, frozen so it can be rebuilt later without asking anyone. */
export type PickRef =
  | { kind: "ref"; key: string; name: string }
  | { kind: "usda"; name: string; usda: Omit<UsdaPick, "name"> }
  | { kind: "ai"; name: string; ai: Omit<AiRef, "name"> }
  | { kind: "custom"; id: string; name: string };

export type IngredientPrefPick = {
  /** What she typed (normalised: lower case, one space between words). */
  queryKey: string;
  pick: PickRef;
  count: number;
  lastUsed: number;
};

/** Same food? (a reference key, a USDA id, a custom id, or an AI answer for that name) */
export function pickId(p: PickRef): string {
  switch (p.kind) {
    case "ref":
      return `ref:${p.key}`;
    case "usda":
      return `usda:${p.usda.fdcId}`;
    case "custom":
      return `custom:${p.id}`;
    case "ai":
      return `ai:${p.name.trim().toLowerCase()}`;
  }
}

/** The typed words as a key: lower case, no punctuation, one space. */
export function queryKeyOf(query: string): string {
  return String(query ?? "")
    .toLowerCase()
    .replace(/[,.;:()[\]{}/\\_\-–—"!?+*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_PICKS = 200;

function trim(list: IngredientPrefPick[]): IngredientPrefPick[] {
  if (list.length <= MAX_PICKS) return list;
  return [...list].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_PICKS);
}

/** She picked this food for these words: count it (a new pick starts at 1). */
export function recordPick(list: IngredientPrefPick[], query: string, pick: PickRef, now: number): IngredientPrefPick[] {
  const queryKey = queryKeyOf(query);
  if (!queryKey) return list;
  const id = pickId(pick);
  const at = list.findIndex((p) => p.queryKey === queryKey && pickId(p.pick) === id);
  if (at >= 0) return list.map((p, i) => (i === at ? { ...p, pick, count: p.count + 1, lastUsed: now } : p));
  return trim([...list, { queryKey, pick, count: 1, lastUsed: now }]);
}

/** "Forget this choice": remove one pick (or, with no pick, everything for those words). */
export function forgetPick(list: IngredientPrefPick[], query: string, pick?: PickRef): IngredientPrefPick[] {
  const queryKey = queryKeyOf(query);
  const id = pick ? pickId(pick) : null;
  return list.filter((p) => !(p.queryKey === queryKey && (id == null || pickId(p.pick) === id)));
}

/** Forget a food everywhere (e.g. its custom ingredient was deleted). */
export function forgetPickEverywhere(list: IngredientPrefPick[], pick: PickRef): IngredientPrefPick[] {
  const id = pickId(pick);
  return list.filter((p) => pickId(p.pick) !== id);
}

/** "Change my usual": this food becomes the one for these words, even if another was picked more often. */
export function setPreferred(list: IngredientPrefPick[], query: string, pick: PickRef, now: number): IngredientPrefPick[] {
  const queryKey = queryKeyOf(query);
  if (!queryKey) return list;
  const top = Math.max(0, ...list.filter((p) => p.queryKey === queryKey).map((p) => p.count));
  const id = pickId(pick);
  const had = list.some((p) => p.queryKey === queryKey && pickId(p.pick) === id);
  if (!had) return trim([...list, { queryKey, pick, count: top + 1, lastUsed: now }]);
  return list.map((p) => (p.queryKey === queryKey && pickId(p.pick) === id ? { ...p, pick, count: Math.max(p.count, top + 1), lastUsed: now } : p));
}

/** Most-used first, then most recent. */
export const byUsage = (a: IngredientPrefPick, b: IngredientPrefPick) => b.count - a.count || b.lastUsed - a.lastUsed;

/** Her usual food for exactly these words, or null. */
export function preferredFor(list: IngredientPrefPick[], query: string): IngredientPrefPick | null {
  const queryKey = queryKeyOf(query);
  if (!queryKey) return null;
  return [...list].filter((p) => p.queryKey === queryKey).sort(byUsage)[0] ?? null;
}

/** Read the saved text safely. */
export function parsePrefs(raw: string | null | undefined): IngredientPrefPick[] {
  const out: IngredientPrefPick[] = [];
  for (const v of safeArray(raw)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const queryKey = typeof o.queryKey === "string" ? queryKeyOf(o.queryKey) : "";
    const pick = readPick(o.pick);
    const count = typeof o.count === "number" && Number.isFinite(o.count) && o.count >= 1 ? Math.floor(o.count) : 1;
    const lastUsed = typeof o.lastUsed === "number" && Number.isFinite(o.lastUsed) ? o.lastUsed : 0;
    if (!queryKey || !pick) continue;
    if (out.some((p) => p.queryKey === queryKey && pickId(p.pick) === pickId(pick))) continue;
    out.push({ queryKey, pick, count, lastUsed });
  }
  return trim(out);
}

export const serializePrefs = (list: IngredientPrefPick[]) => JSON.stringify(list);

function readPick(v: unknown): PickRef | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  if (o.kind === "ref" && typeof o.key === "string" && o.key) return { kind: "ref", key: o.key, name };
  if (o.kind === "custom" && typeof o.id === "string" && o.id) return { kind: "custom", id: o.id, name };
  if (o.kind === "usda" && o.usda && typeof o.usda === "object") {
    const u = o.usda as Record<string, unknown>;
    const p = u.per100 as Record<string, unknown> | undefined;
    if (typeof u.fdcId === "number" && p && typeof p.kcal === "number" && (u.per === "g" || u.per === "ml")) return { kind: "usda", name, usda: u as unknown as Omit<UsdaPick, "name"> };
    return null;
  }
  if (o.kind === "ai" && o.ai && typeof o.ai === "object") {
    const a = o.ai as Record<string, unknown>;
    const p = a.per100 as Record<string, unknown> | undefined;
    if (p && typeof p.kcal === "number") return { kind: "ai", name, ai: a as unknown as Omit<AiRef, "name"> };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Storage (small; the phone passes localStorage, tests pass a fake)
// ---------------------------------------------------------------------------

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function safeArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function read(key: string, storage?: StorageLike | null): string | null {
  try {
    return (storage ?? defaultStorage())?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** false = could not save (private mode, full…). The app keeps working. */
function write(key: string, text: string, storage?: StorageLike | null): boolean {
  try {
    const s = storage ?? defaultStorage();
    if (!s) return false;
    s.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export const loadCustom = (storage?: StorageLike | null) => parseCustom(read(CUSTOM_KEY, storage));
export const saveCustom = (list: CustomIngredient[], storage?: StorageLike | null) => write(CUSTOM_KEY, serializeCustom(list), storage);
export const loadPrefs = (storage?: StorageLike | null) => parsePrefs(read(PREFS_KEY, storage));
export const savePrefs = (list: IngredientPrefPick[], storage?: StorageLike | null) => write(PREFS_KEY, serializePrefs(list), storage);
