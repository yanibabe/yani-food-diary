// Round 78: "send a recipe to someone". Pure helpers (no React, no network, no browser APIs)
// shared by the server routes, the share page and the recipe page — and by the tests.
//
// What travels: only what the receiver needs to own a copy (name, servings, cooked weight, category,
// ingredients with their nutrition data, steps). Local-only fields (ids, photo ids, dates) never leave the phone.

import { recipeTotals, type RecipeTotals } from "./recipe.ts";
import { UNITS, RECIPE_CATEGORIES, type AiRef, type Ingredient, type IngredientUnit, type LabelInfo, type Macros, type Recipe, type RecipeCategory, type UsdaPick } from "./types.ts";

// ---- limits ----
export const MAX_BODY_BYTES = 600_000;
export const MAX_COVER_BYTES = 400 * 1024;
export const MAX_INGREDIENTS = 60;
export const MAX_STEPS = 40;
export const MAX_NAME = 120;
export const MAX_STEP = 1000;
export const MAX_FROM = 40;
export const DEFAULT_FROM = "เพื่อน";

// ---- the shared shape ----
export type SharedIngredient = Omit<Ingredient, "id" | "photoId">;
export type SharedRecipe = {
  name: string;
  servings: number;
  cookedWeight: number | null;
  category?: RecipeCategory;
  ingredients: SharedIngredient[];
  steps: string[];
};
/** What is stored online as shared/<id>.json. */
export type StoredShare = { v: 1; from: string; hasCover: boolean; createdAt: number; recipe: SharedRecipe };

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const bad = <T,>(error: string): Checked<T> => ({ ok: false, error });

// ---- the unguessable id: 24 random bytes = 192 bits = 32 characters of base64url ----
export const SHARE_ID_BYTES = 24;
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64URL[a >> 2] + B64URL[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64URL[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64URL[c & 63];
  }
  return out;
}

/** A fresh share id from the system's secure random generator. */
export function newShareId(random: (n: number) => Uint8Array = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))): string {
  return bytesToBase64Url(random(SHARE_ID_BYTES));
}

export function isValidShareId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{32}$/.test(id);
}

// ---- small checkers ----
function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function num(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}
/** Text with control characters removed and spaces trimmed. null = not text / empty / too long. */
function text(v: unknown, max: number, allowEmpty = false): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (s.length > max) return null;
  if (!allowEmpty && s === "") return null;
  return s;
}

const MACRO_KEYS = ["protein", "carbs", "fat"] as const;
function macros(v: unknown): Macros | null {
  if (!isObj(v)) return null;
  const kcal = num(v.kcal, 0, 100000);
  const protein = num(v.protein, 0, 100000);
  const carbs = num(v.carbs, 0, 100000);
  const fat = num(v.fat, 0, 100000);
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  return { kcal, protein, carbs, fat };
}
function missingList(v: unknown): ("protein" | "carbs" | "fat")[] | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > 3) return null;
  const out: ("protein" | "carbs" | "fat")[] = [];
  for (const k of v) {
    if (!MACRO_KEYS.includes(k as never)) return null;
    if (!out.includes(k as never)) out.push(k as never);
  }
  return out;
}

const LABEL_VIA = ["typed", "photo", "off", "fix-typed", "fix-photo", "fix"] as const;
function label(v: unknown): LabelInfo | null | "bad" {
  if (v === null || v === undefined) return null;
  const m = macros(v);
  if (!m || !isObj(v)) return "bad";
  if (v.basis !== "per100" && v.basis !== "perUnit") return "bad";
  const out: LabelInfo = { ...m, basis: v.basis };
  if (v.via !== undefined && v.via !== null) {
    if (!LABEL_VIA.includes(v.via as never)) return "bad";
    out.via = v.via as LabelInfo["via"];
  }
  if (v.per !== undefined && v.per !== null) {
    if (v.per !== "g" && v.per !== "ml") return "bad";
    out.per = v.per;
  }
  const miss = missingList(v.missing);
  if (miss === null) return "bad";
  if (miss && miss.length) out.missing = miss;
  return out;
}

const STATES = ["raw", "cooked", "dried", "prepared"] as const;
const state = (v: unknown) => (STATES.includes(v as never) ? (v as (typeof STATES)[number]) : null);

function aiRef(v: unknown): AiRef | null | "bad" {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) return "bad";
  const name = text(v.name, MAX_NAME);
  const per100 = macros(v.per100);
  if (!name || !per100) return "bad";
  const unitG = v.unitG == null ? null : num(v.unitG, 0, 1e6);
  const gPerMl = v.gPerMl == null ? null : num(v.gPerMl, 0, 1e4);
  if ((v.unitG != null && unitG == null) || (v.gPerMl != null && gPerMl == null)) return "bad";
  const out: AiRef = { name, per100, unitG, gPerMl };
  if (v.unitFor != null) {
    if (typeof v.unitFor !== "string" || !(v.unitFor in UNITS)) return "bad";
    out.unitFor = v.unitFor as IngredientUnit;
  }
  if (v.state != null) {
    const s = state(v.state);
    if (!s) return "bad";
    out.state = s;
  }
  return out;
}

const USDA_TYPES = ["foundation", "sr", "fndds", "branded"] as const;
const USDA_ENERGY = ["1008", "2048", "2047", "kj"] as const;
function usda(v: unknown): UsdaPick | null | "bad" {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) return "bad";
  const fdcId = num(v.fdcId, 0, 1e12);
  const description = text(v.description, 300);
  const name = text(v.name, MAX_NAME);
  const per100 = macros(v.per100);
  const fetchedAt = num(v.fetchedAt, 0, 1e15);
  if (fdcId == null || !description || !name || !per100 || fetchedAt == null) return "bad";
  if (!USDA_TYPES.includes(v.dataType as never) || !USDA_ENERGY.includes(v.energy as never)) return "bad";
  if (v.per !== "g" && v.per !== "ml") return "bad";
  const out: UsdaPick = {
    fdcId,
    description,
    dataType: v.dataType as UsdaPick["dataType"],
    per100,
    per: v.per,
    energy: v.energy as UsdaPick["energy"],
    fetchedAt,
    name,
  };
  if (typeof v.brand === "string") out.brand = text(v.brand, 200, true) ?? undefined;
  const miss = missingList(v.missing);
  if (miss === null) return "bad";
  if (miss && miss.length) out.missing = miss;
  const st = state(v.state);
  if (st) out.state = st;
  if (isObj(v.extra)) {
    const e: NonNullable<UsdaPick["extra"]> = {};
    for (const k of ["fiber", "sugar", "sodiumMg", "satFat"] as const) {
      const n = num(v.extra[k], 0, 1e6);
      if (n != null) e[k] = n;
    }
    out.extra = e;
  }
  if (Array.isArray(v.portions)) {
    const ps: NonNullable<UsdaPick["portions"]> = [];
    for (const p of v.portions.slice(0, 40)) {
      if (!isObj(p)) continue;
      const lab = text(p.label, 120);
      const grams = num(p.grams, 0, 1e6);
      if (!lab || grams == null) continue;
      const ml = p.ml == null ? null : num(p.ml, 0, 1e6);
      ps.push({ label: lab, grams, ml });
    }
    if (ps.length) out.portions = ps;
  }
  if (v.gPerMl != null) {
    const g = num(v.gPerMl, 0, 1e4);
    if (g != null) out.gPerMl = g;
  }
  return out;
}

function ingredient(v: unknown, k: number): Checked<SharedIngredient> {
  const at = `ingredient ${k + 1}`;
  if (!isObj(v)) return bad(`${at}: not an object`);
  const name = text(v.name, MAX_NAME);
  if (!name) return bad(`${at}: name is missing or too long`);
  const amount = num(v.amount, 0, 1e7);
  if (amount == null) return bad(`${at}: amount is not a sensible number`);
  if (typeof v.unit !== "string" || !Object.prototype.hasOwnProperty.call(UNITS, v.unit)) return bad(`${at}: unknown unit`);
  const lab = label(v.label);
  if (lab === "bad") return bad(`${at}: nutrition label is not valid`);
  let gramsPerUnit: number | null = null;
  if (v.gramsPerUnit != null) {
    gramsPerUnit = num(v.gramsPerUnit, 0, 1e6);
    if (gramsPerUnit == null) return bad(`${at}: weight of one piece is not valid`);
  }
  const out: SharedIngredient = { name, amount, unit: v.unit as IngredientUnit, label: lab, gramsPerUnit };
  const ref = aiRef(v.aiRef);
  if (ref === "bad") return bad(`${at}: reference data is not valid`);
  if (ref) out.aiRef = ref;
  if (isObj(v.refPick)) {
    const rn = text(v.refPick.name, MAX_NAME);
    const rk = text(v.refPick.key, 80);
    if (rn && rk) out.refPick = { name: rn, key: rk };
  }
  if (v.gPerMl != null) {
    const g = num(v.gPerMl, 0, 1e4);
    if (g == null) return bad(`${at}: density is not valid`);
    out.gPerMl = g;
  }
  const u = usda(v.usda);
  if (u === "bad") return bad(`${at}: USDA data is not valid`);
  if (u) out.usda = u;
  return { ok: true, value: out };
}

/** Check a recipe that arrived from outside and keep ONLY what the receiver needs. Never trusts the shape. */
export function sanitizeSharedRecipe(input: unknown): Checked<SharedRecipe> {
  if (!isObj(input)) return bad("recipe: not an object");
  const name = text(input.name, MAX_NAME);
  if (!name) return bad("recipe: name is missing or too long");
  const servings = num(input.servings, 0.01, 1000);
  if (servings == null || servings <= 0) return bad("recipe: servings is not a sensible number");
  let cookedWeight: number | null = null;
  if (input.cookedWeight != null) {
    cookedWeight = num(input.cookedWeight, 0, 1e7);
    if (cookedWeight == null) return bad("recipe: cooked weight is not valid");
    if (cookedWeight === 0) cookedWeight = null;
  }
  if (!Array.isArray(input.ingredients)) return bad("recipe: ingredients is not a list");
  if (input.ingredients.length < 1) return bad("recipe: it has no ingredients");
  if (input.ingredients.length > MAX_INGREDIENTS) return bad(`recipe: more than ${MAX_INGREDIENTS} ingredients`);
  const ingredients: SharedIngredient[] = [];
  for (let k = 0; k < input.ingredients.length; k++) {
    const r = ingredient(input.ingredients[k], k);
    if (!r.ok) return r;
    ingredients.push(r.value);
  }
  const rawSteps = input.steps === undefined || input.steps === null ? [] : input.steps;
  if (!Array.isArray(rawSteps)) return bad("recipe: steps is not a list");
  if (rawSteps.length > MAX_STEPS) return bad(`recipe: more than ${MAX_STEPS} steps`);
  const steps: string[] = [];
  for (const s of rawSteps) {
    const t = text(s, MAX_STEP, true);
    if (t === null) return bad("recipe: a step is not text or is too long");
    if (t) steps.push(t);
  }
  const out: SharedRecipe = { name, servings, cookedWeight, ingredients, steps };
  if (typeof input.category === "string" && RECIPE_CATEGORIES.some((c) => c.key === input.category)) out.category = input.category as RecipeCategory;
  return { ok: true, value: out };
}

/** The sender's name as shown to the receiver. Empty / too long / not text → "เพื่อน". */
export function cleanFrom(v: unknown): string {
  return text(v, MAX_FROM) ?? DEFAULT_FROM;
}

// ---- the cover picture ----
export type CoverFile = { mime: "image/jpeg" | "image/webp"; bytes: Uint8Array };

/** A "data:image/jpeg;base64,…" text → the real picture bytes, or an error. Checks type, size and the file's own header. */
export function parseCoverDataUrl(v: unknown): Checked<CoverFile> {
  if (typeof v !== "string") return bad("cover: not text");
  const m = /^data:(image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!m) return bad("cover: must be a jpeg or webp picture");
  const b64 = m[2];
  if (b64.length % 4 !== 0) return bad("cover: picture data is broken");
  const size = (b64.length / 4) * 3 - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (size > MAX_COVER_BYTES) return bad("cover: picture is bigger than 400 KB");
  if (size < 12) return bad("cover: picture is empty");
  const bytes = base64ToBytes(b64);
  const mime = m[1] as CoverFile["mime"];
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (mime === "image/jpeg" ? !jpeg : !webp) return bad("cover: the file is not really that kind of picture");
  return { ok: true, value: { mime, bytes } };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    acc = (acc << 6) | "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return out;
}

/** What the sender's phone uploads: the recipe without local-only or bulky parts (photo ids, raw USDA lists). The server checks it again. */
export function toSharePayload(r: Recipe): unknown {
  return {
    name: r.name,
    servings: r.servings,
    cookedWeight: r.cookedWeight,
    category: r.category,
    steps: r.steps,
    ingredients: r.ingredients.map((i) => {
      const rest: Record<string, unknown> = { ...i };
      delete rest.id;
      delete rest.photoId;
      if (i.usda) {
        const u: Record<string, unknown> = { ...i.usda };
        delete u.raw;
        rest.usda = u;
      }
      return rest;
    }),
  };
}

// ---- the whole request body ----
export type ShareRequest = { recipe: SharedRecipe; from: string; cover: CoverFile | null };

/** Check the text of a POST body: size first, then JSON, then every part. */
export function parseShareRequest(raw: string): Checked<ShareRequest> {
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return bad("body: too big (max about 600 KB)");
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return bad("body: not valid JSON");
  }
  if (!isObj(v)) return bad("body: not an object");
  const recipe = sanitizeSharedRecipe(v.recipe);
  if (!recipe.ok) return recipe;
  let cover: CoverFile | null = null;
  if (v.cover !== undefined && v.cover !== null && v.cover !== "") {
    const c = parseCoverDataUrl(v.cover);
    if (!c.ok) return c;
    cover = c.value;
  }
  return { ok: true, value: { recipe: recipe.value, from: cleanFrom(v.from), cover } };
}

/** The text stored online. */
export function toStoredShare(req: ShareRequest, now = Date.now()): StoredShare {
  return { v: 1, from: req.from, hasCover: req.cover !== null, createdAt: now, recipe: req.recipe };
}

/** Read stored text back (the server trusts its own storage less than memory: it re-checks the shape). */
export function parseStoredShare(raw: string): StoredShare | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || v.v !== 1) return null;
  const recipe = sanitizeSharedRecipe(v.recipe);
  if (!recipe.ok) return null;
  return { v: 1, from: cleanFrom(v.from), hasCover: v.hasCover === true, createdAt: num(v.createdAt, 0, 1e15) ?? 0, recipe: recipe.value };
}

// ---- receiving ----
/** The receiver's own copy: new ids, dates now, with the "from" tag and the share id (so saving twice is noticed). */
export function recipeFromShare(
  s: StoredShare,
  shareId: string,
  coverPhotoId: string | null,
  now: number,
  newId: (prefix: string) => string,
): Recipe {
  return {
    id: newId("rc"),
    name: s.recipe.name,
    servings: s.recipe.servings,
    cookedWeight: s.recipe.cookedWeight,
    ingredients: s.recipe.ingredients.map((i) => ({ ...i, id: newId("ig"), photoId: null })),
    steps: [...s.recipe.steps],
    coverPhotoId,
    ...(s.recipe.category ? { category: s.recipe.category } : {}),
    sharedFrom: s.from,
    sharedId: shareId,
    createdAt: now,
    updatedAt: now,
  };
}

/** The recipe this share was already saved as on this phone, if any. */
export function findSavedShare(recipes: Pick<Recipe, "id" | "sharedId">[], shareId: string): string | null {
  return recipes.find((r) => r.sharedId === shareId)?.id ?? null;
}

/** Per-serving numbers for a shared recipe (same maths as the recipe page). */
export function sharedTotals(r: SharedRecipe): RecipeTotals {
  return recipeTotals(r.ingredients.map((i, k) => ({ ...i, id: `s${k}`, photoId: null })), r.servings, r.cookedWeight);
}

// ---- words for the link preview ----
export function roundKcal(n: number): number {
  return Math.round(n);
}

export function ogTitle(name: string): string {
  return name;
}

export function ogDescription(kcalPerServing: number, from: string): string {
  return `${roundKcal(kcalPerServing)} kcal ต่อเสิร์ฟ · ${from} แชร์จาก SnapCal`;
}

/** What the sender's phone hands to the share sheet. */
export function shareText(name: string): string {
  return `ลองทำ ${name} ดู 😋`;
}
