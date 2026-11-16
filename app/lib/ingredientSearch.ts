// Round 42: Search first. One search box for ingredients; every source sits behind it.
// Pure functions only (no React, no browser, no network) so the tests can run them.
//
//   type a name → localSuggestions() → (maybe USDA, see ingredientUsda.ts) → pick one
//   → quoteIngredient() shows the numbers → buildIngredient() makes the Ingredient.
//
// Order of the list: her custom ingredients → her usual pick for these words → foods she picked
// before → the app's reference foods → (USDA) → one row "let the AI estimate".
// Rules that never bend:
//  - Different foods are different rows. Egg white / yolk / whole, milk types, raw vs cooked rice,
//    oyster sauce vs oil are never merged, and an unclear word never picks anything by itself.
//  - A row whose state (raw / cooked) disagrees with the state in her words is marked `conflict`:
//    it is shown, never "close", never picked for her.
//  - Missing nutrients stay unknown (listed in `missing`), never a real 0.
//  - Numbers she typed are "typed by you" (unverified). Nothing here is ever "verified".
//  - buildIngredient fills the SAME fields the current USDA / reference / AI / label flows fill,
//    so recipe math, provenance, backup and the Smart Calorie Buffer behave exactly as before.

import { FOOD_REF, STATE_LABEL, matchRef, normalizeName, refByKey, stateInName, type RefFood } from "./foodRef.ts";
import type { L, Lang } from "./i18n.ts";
import { ingredientMacros, type IngredientResult } from "./recipe.ts";
import { newId } from "./nutrition.ts";
import { byUsage, customMissing, pickId, queryKeyOf, type CustomIngredient, type IngredientPrefPick, type PickRef } from "./customIngredients.ts";
import { toSnap, type UsdaFood } from "./food/usdaNutrients.ts";
import type { Difference } from "./food/usdaMatch.ts";
import { UNITS, type AiRef, type FoodState, type Ingredient, type IngredientUnit, type LabelInfo, type MacroKey, type Macros } from "./types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SuggestionKind = "custom" | "preferred" | "recent" | "ref" | "usda" | "ai";

export type Suggestion = {
  /** Same food = same id ("ref:egg", "usda:171477", "custom:ci_1", "ai:name"). */
  id: string;
  /** Which part of the list it sits in. */
  kind: SuggestionKind;
  /** What it really is underneath (custom / ref / usda / ai). */
  source: PickRef;
  /** The name that is saved on the ingredient. */
  name: string;
  /** Name to show, both languages. */
  label: L;
  /** raw / cooked / dried / prepared, when known. */
  state: FoodState | null;
  stateLabel: L | null;
  /** Numbers per 100 g / 100 ml (for custom with basis "perUnit": per ONE unit). Unknown nutrients are in `missing`. */
  per100: Macros | null;
  basis: "per100" | "perUnit";
  per: "g" | "ml";
  missing: MacroKey[];
  /** 0–100. How well it fits what she typed. */
  score: number;
  /** A good fit with nothing different. Only a hint for the screen — never picks by itself. */
  close: boolean;
  /** Her words say one state (raw / cooked), this food is the other. Shown, never "close". */
  conflict: boolean;
  /** How many times she picked it (recent / preferred rows). */
  uses?: number;
  /** USDA rows: extra words (brand, data type) and what differs from her name. */
  detail?: string | null;
  differences?: Difference[];
  /** Custom rows: the saved ingredient. */
  custom?: CustomIngredient;
};

export type SearchCtx = {
  lang: Lang;
  custom?: CustomIngredient[];
  prefs?: IngredientPrefPick[];
  /** Max rows (default 12; 8 when the box is empty). */
  limit?: number;
};

export type LocalResult = {
  items: Suggestion[];
  /** The words can mean several different foods ("ไข่", "นม", "ข้าว"): she must choose, nothing is picked. */
  ambiguous: boolean;
  /** Rows that are a good fit (used to decide whether to ask USDA). */
  closeCount: number;
  /** The state in her words, if any. */
  wantState: FoodState | null;
};

// ---------------------------------------------------------------------------
// Matching text
// ---------------------------------------------------------------------------

/** Other ways to spell the same word. Left → right. */
const SPELLING: [string, string][] = [
  ["ซีอิ้ว", "ซีอิ๊ว"],
  ["ซีอิ๋ว", "ซีอิ๊ว"],
  ["ซีอิว", "ซีอิ๊ว"],
  ["กระทิ", "กะทิ"],
  ["เต้าหู", "เต้าหู้"],
  ["ไข่ไก", "ไข่ไก่"],
  ["yoghurt", "yogurt"],
  ["omelet", "omelette"],
  ["tofoo", "tofu"],
  ["chilli", "chili"],
];

/** Extra names for the same food (never for a different one). Key = FOOD_REF key. */
export const REF_ALIASES: Record<string, string[]> = {
  egg: ["ไข่ไก่สด", "ไข่ทั้งฟอง", "ไข่ทั้งใบ", "ไข่ฟองเดียว", "hen egg", "ไข่ไก่ทั้งฟอง"],
  "egg-white": ["ไข่ขาวสด", "egg albumen", "albumen"],
  "egg-yolk": ["ไข่แดงสด"],
  rice: ["ข้าวขาวสวย", "ข้าวสวยร้อน", "ข้าวหอมมะลิสวย", "jasmine rice cooked", "boiled rice"],
  "rice-raw": ["ข้าวขาวดิบ", "ข้าวหอมมะลิดิบ", "jasmine rice raw", "dry white rice"],
  "soy-sauce": ["ซีอิ๊วขาว", "ซีอิ๊ว", "shoyu", "ซอสถั่วเหลือง"],
  "fish-sauce": ["น้ำปลาแท้", "nam pla"],
  "oyster-sauce": ["ซอสหอย", "ออยเตอร์ซอส"],
  oil: ["น้ำมันทำอาหาร", "น้ำมันผัด"],
  butter: ["เนยสด", "unsalted butter", "salted butter"],
  milk: ["นมโค", "นมวัวจืด", "นมพาสเจอร์ไรส์", "นมยูเอชที", "dairy milk", "plain milk", "full cream milk"],
  "pork-minced": ["หมูบดละเอียด", "หมูสับละเอียด"],
  tofu: ["เต้าหู้ขาว", "เต้าหู้แข็ง", "bean curd"],
  onion: ["หัวหอม", "หอมหัวใหญ่", "หัวหอมใหญ่", "yellow onion"],
  garlic: ["กระเทียมสด", "กระเทียมไทย"],
  banana: ["กล้วยสด"],
  "coconut-milk": ["กะทิสด", "กะทิกล่อง", "กะทิคั้นสด"],
  "chicken-breast": ["อกไก่สด", "อกไก่ดิบ", "อกไก่ไร้หนัง", "ไก่อก", "boneless chicken breast"],
  sugar: ["น้ำตาลขาว", "น้ำตาลซอง", "table sugar"],
  water: ["น้ำเปล่าสะอาด"],
};

const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

/** The typed words in every spelling we know ("eggs" also as "egg"). */
function queryForms(q: string): string[] {
  const forms = new Set([q]);
  for (const [from, to] of SPELLING) if (q.includes(from)) forms.add(q.replace(from, to));
  if (isAscii(q) && q.length > 3 && q.endsWith("s") && !q.endsWith("ss")) forms.add(q.slice(0, -1));
  return [...forms];
}

/** How well one typed form fits one name (0 = not at all). */
function scoreText(f: string, t: string): number {
  if (!f || !t) return 0;
  if (t === f) return 100;
  if (t.startsWith(f)) return 85;
  if (isAscii(f)) {
    const tw = t.split(" ");
    const fw = f.split(" ");
    if (fw.every((w) => tw.some((x) => x.startsWith(w)))) return 68;
  } else if ([...f].length >= 3 && t.includes(f)) return 55;
  // Her words are the food's name + a state word ("ไข่ไก่ต้ม", "chicken breast raw"). Anything else extra = another food.
  if (f.length > t.length && f.startsWith(t) && t.length >= 2 && (!isAscii(f) || f[t.length] === " ")) {
    const rest = f.slice(t.length).trim();
    if (rest && stateInName(rest)) return 72;
    return 0;
  }
  // A small typing slip in an English word.
  if (isAscii(f) && f.length >= 5) {
    if (editDistanceAtMost1(f, t)) return 32;
    if (t.split(" ").some((w) => w.length >= 5 && editDistanceAtMost1(f, w))) return 30;
  }
  return 0;
}

function scoreAny(forms: string[], texts: string[]): number {
  let best = 0;
  for (const t of texts) {
    const n = normalizeName(t);
    for (const f of forms) best = Math.max(best, scoreText(f, n));
  }
  return best;
}

const MIN_SCORE = 30;
const CLOSE_SCORE = 70;

// ---------------------------------------------------------------------------
// Suggestions from the sources we have on the phone
// ---------------------------------------------------------------------------

const stateOf = (s: FoodState | null | undefined): { state: FoodState | null; stateLabel: L | null } => ({ state: s ?? null, stateLabel: s ? STATE_LABEL[s] : null });

function refSuggestion(f: RefFood, lang: Lang, score: number, wantState: FoodState | null, kind: SuggestionKind = "ref"): Suggestion {
  const conflict = !!(wantState && f.state && wantState !== f.state);
  const sc = conflict ? Math.min(score, 55) : score;
  return {
    id: `ref:${f.key}`,
    kind,
    source: { kind: "ref", key: f.key, name: f.label[lang] },
    name: f.label[lang],
    label: f.label,
    ...stateOf(f.state),
    per100: { ...f.per100 },
    basis: "per100",
    per: "g",
    missing: [],
    score: sc,
    close: sc >= CLOSE_SCORE && !conflict,
    conflict,
  };
}

function customSuggestion(c: CustomIngredient, lang: Lang, score: number, wantState: FoodState | null, kind: SuggestionKind = "custom"): Suggestion {
  const conflict = !!(wantState && c.state && wantState !== c.state);
  const sc = conflict ? Math.min(score, 55) : score;
  return {
    id: `custom:${c.id}`,
    kind,
    source: { kind: "custom", id: c.id, name: c.name },
    name: c.name,
    label: { th: c.name, en: c.name },
    ...stateOf(c.state),
    per100: { kcal: c.kcal, protein: c.protein ?? 0, carbs: c.carbs ?? 0, fat: c.fat ?? 0 },
    basis: c.basis,
    per: c.per,
    missing: customMissing(c),
    score: sc,
    close: sc >= CLOSE_SCORE && !conflict,
    conflict,
    custom: c,
  };
}

/** A saved pick → a row again. null = it can't be rebuilt (e.g. its custom ingredient was deleted). */
export function suggestionFromPick(p: PickRef, lang: Lang, custom: CustomIngredient[] = [], kind: SuggestionKind = "recent"): Suggestion | null {
  if (p.kind === "ref") {
    const f = refByKey(p.key);
    return f ? refSuggestion(f, lang, 100, null, kind) : null;
  }
  if (p.kind === "custom") {
    const c = custom.find((x) => x.id === p.id);
    return c ? customSuggestion(c, lang, 100, null, kind) : null;
  }
  if (p.kind === "usda") {
    const u = p.usda;
    return {
      id: pickId(p),
      kind,
      source: p,
      name: p.name,
      label: { th: u.description, en: u.description },
      ...stateOf(u.state),
      per100: { ...u.per100 },
      basis: "per100",
      per: u.per,
      missing: [...(u.missing ?? [])],
      score: 100,
      close: true,
      conflict: false,
      detail: u.brand ?? null,
    };
  }
  return {
    id: pickId(p),
    kind,
    source: p,
    name: p.name,
    label: { th: p.name, en: p.name },
    ...stateOf(p.ai.state),
    per100: { ...p.ai.per100 },
    basis: "per100",
    per: "g",
    missing: [],
    score: 100,
    close: true,
    conflict: false,
  };
}

/** Texts a pick can be found by. */
function pickTexts(s: Suggestion): string[] {
  const t = [s.name, s.label.th, s.label.en];
  if (s.source.kind === "ref") t.push(...(refByKey(s.source.key)?.names ?? []), ...(REF_ALIASES[s.source.key] ?? []));
  if (s.custom?.aliases) t.push(...s.custom.aliases);
  return t;
}

const orderBy = (a: Suggestion, b: Suggestion) => Number(a.conflict) - Number(b.conflict) || b.score - a.score || (b.uses ?? 0) - (a.uses ?? 0);

/**
 * The local list for what she typed: custom → her usual → recent → reference foods.
 * Nothing here needs the internet. An empty box lists her custom ingredients and recent picks.
 */
export function searchLocal(query: string, ctx: SearchCtx): LocalResult {
  const lang = ctx.lang;
  const custom = ctx.custom ?? [];
  const prefs = ctx.prefs ?? [];
  const q = normalizeName(query);
  const limit = ctx.limit ?? (q ? 12 : 8);
  const seen = new Set<string>();
  const items: Suggestion[] = [];
  const add = (s: Suggestion | null, tier: SuggestionKind) => {
    if (!s || seen.has(s.id)) return;
    seen.add(s.id);
    items.push(tier === s.kind ? s : { ...s, kind: tier });
  };

  // Recent picks, grouped by food (same food picked for different words counts together).
  const groups = new Map<string, { pick: PickRef; count: number; lastUsed: number }>();
  for (const p of prefs) {
    const id = pickId(p.pick);
    const g = groups.get(id);
    if (g) {
      g.count += p.count;
      if (p.lastUsed >= g.lastUsed) {
        g.lastUsed = p.lastUsed;
        g.pick = p.pick;
      }
    } else groups.set(id, { pick: p.pick, count: p.count, lastUsed: p.lastUsed });
  }

  if (!q) {
    for (const c of [...custom].sort((a, b) => b.updatedAt - a.updatedAt)) add(customSuggestion(c, lang, 100, null), "custom");
    for (const g of [...groups.values()].sort((a, b) => b.lastUsed - a.lastUsed || b.count - a.count)) {
      const s = suggestionFromPick(g.pick, lang, custom, "recent");
      if (s) add({ ...s, uses: g.count }, "recent");
    }
    return { items: items.slice(0, limit), ambiguous: false, closeCount: 0, wantState: null };
  }

  const forms = queryForms(q);
  const wantState = stateInName(q);
  const m = matchRef(q);

  // 1. her custom ingredients
  const customRows: Suggestion[] = [];
  for (const c of custom) {
    const sc = scoreAny(forms, [c.name, ...(c.aliases ?? [])]);
    if (sc >= MIN_SCORE) customRows.push(customSuggestion(c, lang, sc, wantState));
  }
  customRows.sort(orderBy);
  for (const s of customRows) add(s, "custom");

  // 2. her usual pick for exactly these words (the most used; the others are "recent")
  const key = queryKeyOf(query);
  const same = prefs.filter((p) => p.queryKey === key).sort(byUsage);
  same.forEach((p, i) => {
    const s = suggestionFromPick(p.pick, lang, custom, i === 0 ? "preferred" : "recent");
    if (s) add({ ...s, uses: p.count }, i === 0 ? "preferred" : "recent");
  });

  // 3. other foods she picked before that fit these words
  const recentRows: Suggestion[] = [];
  for (const g of groups.values()) {
    const s = suggestionFromPick(g.pick, lang, custom, "recent");
    if (!s || seen.has(s.id)) continue;
    const sc = scoreAny(forms, pickTexts(s));
    if (sc >= MIN_SCORE) {
      const conflict = !!(wantState && s.state && wantState !== s.state);
      recentRows.push({ ...s, score: conflict ? Math.min(sc, 55) : sc, close: sc >= CLOSE_SCORE && !conflict, conflict, uses: g.count });
    }
  }
  recentRows.sort(orderBy);
  for (const s of recentRows) add(s, "recent");

  // 4. the app's reference foods
  const refRows: Suggestion[] = [];
  const askKeys = new Set(m.kind === "ask" && m.options.length > 1 ? m.options.map((o) => o.key) : []);
  const exactKey = m.kind === "exact" ? m.food.key : null;
  for (const f of FOOD_REF) {
    let sc = scoreAny(forms, [f.label.th, f.label.en, ...f.names, ...(REF_ALIASES[f.key] ?? [])]);
    if (exactKey === f.key) sc = Math.max(sc, 100);
    else if (askKeys.has(f.key)) sc = Math.max(sc, 60);
    // Her words name a state and this food has the same one: slightly better.
    if (sc >= MIN_SCORE && wantState && f.state === wantState) sc = Math.min(100, sc + 3);
    if (sc >= MIN_SCORE) refRows.push(refSuggestion(f, lang, sc, wantState));
  }
  refRows.sort(orderBy);
  for (const s of refRows) add(s, "ref");

  const out = items.slice(0, limit);
  const closeCount = out.filter((s) => s.close).length;
  // Ambiguous: the words are an "unclear word" (egg, milk, rice…), or several different close foods fit.
  const ambiguous = m.kind === "ask" ? m.options.length > 1 : out.filter((s) => s.close && s.score < 100).length > 1;
  return { items: out, ambiguous, closeCount, wantState };
}

/** Just the list. */
export function localSuggestions(query: string, ctx: SearchCtx): Suggestion[] {
  return searchLocal(query, ctx).items;
}

// ---------------------------------------------------------------------------
// USDA rows + when to ask USDA / AI
// ---------------------------------------------------------------------------

/** Short readable name from a USDA description ("Chicken, breast, boneless, skinless, raw" → same, max 60 chars). */
export function usdaDisplayName(description: string, brand?: string | null): string {
  const d = description.replace(/\s+/g, " ").trim();
  const base = d.length > 60 ? `${d.slice(0, 57).trimEnd()}…` : d;
  return brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} · ${brand}`.slice(0, 80) : base;
}

/** A ranked USDA result (what /api/food/usda sends) → a row. null = USDA gave no calories: it can't be used. */
export function usdaSuggestion(food: UsdaFood & { differences?: Difference[]; close?: boolean }, now = 0): Suggestion | null {
  const snap = toSnap(food, now);
  if (!snap) return null;
  const name = usdaDisplayName(food.description, food.brand);
  const differences = food.differences ?? [];
  const conflict = differences.includes("state");
  const close = !!food.close && !differences.length;
  const usda = { ...snap, portions: food.portions, gPerMl: food.gPerMl };
  return {
    id: `usda:${food.fdcId}`,
    kind: "usda",
    source: { kind: "usda", name, usda },
    name,
    label: { th: food.description, en: food.description },
    ...stateOf(food.state),
    per100: { ...snap.per100 },
    basis: "per100",
    per: snap.per,
    missing: [...(snap.missing ?? [])],
    score: close ? 75 : conflict ? 35 : 45,
    close,
    conflict,
    detail: food.brand ?? null,
    differences,
  };
}

/** USDA results → rows (unusable ones dropped). */
export function usdaSuggestions(results: (UsdaFood & { differences?: Difference[]; close?: boolean })[], now = 0): Suggestion[] {
  const out: Suggestion[] = [];
  for (const r of results) {
    const s = usdaSuggestion(r, now);
    if (s) out.push(s);
  }
  return out;
}

/** Local rows first, then USDA rows (never above her own foods). The same food appears once. */
export function mergeSuggestions(local: Suggestion[], usda: Suggestion[], limit = 16): Suggestion[] {
  const seen = new Set(local.map((s) => s.id));
  const extra = usda.filter((s) => !seen.has(s.id)).sort(orderBy);
  return [...local, ...extra].slice(0, limit);
}

export const MIN_USDA_CHARS = 2;
/** Ask USDA only when there are fewer close local rows than this. */
export const ENOUGH_LOCAL = 4;

export type UsdaGate = { run: true } | { run: false; reason: "too-short" | "enough-local" | "offline" | "no-passcode" };

/**
 * Should we ask USDA for this text? Only when it is 2+ characters, she isn't offline, the phone has the
 * passcode, and there are fewer than 4 close local rows (or none of them are her own / her usual foods).
 */
export function shouldAskUsda(query: string, local: LocalResult, env: { online: boolean; hasPasscode: boolean }): UsdaGate {
  const q = normalizeName(query);
  if ([...q].length < MIN_USDA_CHARS) return { run: false, reason: "too-short" };
  const known = local.items.some((s) => (s.kind === "custom" || s.kind === "preferred") && s.close && s.score >= 85);
  if (known || local.closeCount >= ENOUGH_LOCAL) return { run: false, reason: "enough-local" };
  if (!env.online) return { run: false, reason: "offline" };
  if (!env.hasPasscode) return { run: false, reason: "no-passcode" };
  return { run: true };
}

/** Show the single row "not found? let the AI estimate": only when nothing close was found anywhere. */
export function showAiRow(query: string, rows: Suggestion[]): boolean {
  return [...normalizeName(query)].length >= 2 && !rows.some((s) => s.close);
}

/** What /api/ingredient answers. */
export type AiAnswer = { kcal: number; protein: number; carbs: number; fat: number; unitG: number | null; gPerMl: number | null; unitFor?: IngredientUnit | null; state?: FoodState | null };

/** The AI's answer → a row. It is always an estimate. null = the AI answered with no usable calories. */
export function aiSuggestion(name: string, a: AiAnswer): Suggestion | null {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!n || !Number.isFinite(a.kcal) || a.kcal < 0) return null;
  const f = (v: number) => (Number.isFinite(v) && v >= 0 ? v : 0);
  const ai: Omit<AiRef, "name"> = {
    per100: { kcal: a.kcal, protein: f(a.protein), carbs: f(a.carbs), fat: f(a.fat) },
    unitG: a.unitG ?? null,
    gPerMl: a.gPerMl ?? null,
    unitFor: a.unitFor ?? null,
    state: a.state ?? null,
  };
  const pick: PickRef = { kind: "ai", name: n, ai };
  return {
    id: pickId(pick),
    kind: "ai",
    source: pick,
    name: n,
    label: { th: n, en: n },
    ...stateOf(a.state),
    per100: { ...ai.per100 },
    basis: "per100",
    per: "g",
    missing: [],
    score: 40,
    close: false,
    conflict: false,
  };
}

export type AiOutcome = { status: "ok"; suggestion: Suggestion } | { status: "unknown" | "offline" | "error" };

/** Ask the AI (client is injected; the phone passes a function that calls /api/ingredient). Never throws. */
export async function askAi(name: string, ask: (name: string) => Promise<AiAnswer | null>, online = true): Promise<AiOutcome> {
  if (!online) return { status: "offline" };
  try {
    const a = await ask(name);
    if (!a) return { status: "unknown" };
    const s = aiSuggestion(name, a);
    return s ? { status: "ok", suggestion: s } : { status: "unknown" };
  } catch {
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Making the Ingredient
// ---------------------------------------------------------------------------

export type BuildOpts = { id?: string; /** Name to save instead of the row's name (e.g. what she typed). */ name?: string };

const cleanAmount = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * A chosen row + quantity + unit → an Ingredient, using the EXISTING fields exactly like the current flows:
 *  ref    → refPick { name, key }
 *  usda   → usda { …snapshot, name, portions, gPerMl }
 *  ai     → aiRef { name, per100, unitG, gPerMl, unitFor, state }   (the Smart Calorie Buffer path is unchanged)
 *  custom → label { basis, kcal, protein, carbs, fat, via: "typed", per, missing }   → "typed by you", never verified
 * The saved name is the one all these are tied to (rename later → they stop applying, as before).
 */
export function buildIngredient(s: Suggestion, amount: number, unit: IngredientUnit, opts: BuildOpts = {}): Ingredient {
  const name = (opts.name ?? s.name).replace(/\s+/g, " ").trim();
  const ing: Ingredient = {
    id: opts.id ?? newId("ing"),
    name,
    amount: cleanAmount(amount),
    unit: unit in UNITS ? unit : "g",
    label: null,
    gramsPerUnit: null,
    photoId: null,
  };
  const p = s.source;
  if (p.kind === "ref") {
    ing.refPick = { name, key: p.key };
  } else if (p.kind === "usda") {
    ing.usda = { ...p.usda, name };
  } else if (p.kind === "ai") {
    ing.aiRef = { name, ...p.ai };
    ing.refPick = null;
  } else {
    const c = s.custom;
    if (c) {
      const missing = customMissing(c);
      const label: LabelInfo = {
        basis: c.basis,
        kcal: c.kcal,
        protein: c.protein ?? 0,
        carbs: c.carbs ?? 0,
        fat: c.fat ?? 0,
        via: "typed",
      };
      if (c.basis === "per100") label.per = c.per;
      if (missing.length) label.missing = missing;
      ing.label = label;
      if (c.gramsPerUnit) ing.gramsPerUnit = c.gramsPerUnit;
      if (c.gPerMl) ing.gPerMl = c.gPerMl;
    }
  }
  return ing;
}

/** The ingredient + its calories and nutrients right now (or the question the math has: weight of one piece, density…). */
export function quoteIngredient(s: Suggestion, amount: number, unit: IngredientUnit, lang: Lang = "th", opts: BuildOpts = {}): { ingredient: Ingredient; result: IngredientResult } {
  const ingredient = buildIngredient(s, amount, unit, opts);
  return { ingredient, result: ingredientMacros(ingredient, lang) };
}

/** The pick to remember after she added it. */
export const pickOf = (s: Suggestion): PickRef => s.source;

/**
 * Units that make sense for this food, best first (the first one starts the box).
 * Counted units appear only when the weight of one is known (eggs, pieces) — otherwise the math would have to ask.
 */
export function suggestedUnits(s: Suggestion): { default: IngredientUnit; units: IngredientUnit[] } {
  const p = s.source;
  const units: IngredientUnit[] = [];
  const liquid = (g?: number | null) => !!g && g > 0.2 && g < 3;
  let first: IngredientUnit = s.per === "ml" ? "ml" : "g";
  let gPerMl: number | null = null;
  if (p.kind === "ref") {
    const f = refByKey(p.key);
    gPerMl = f?.gPerMl ?? null;
    if (f?.unitG) {
      first = p.key.startsWith("egg") ? "egg" : "piece";
      units.push(first, "g");
    }
  } else if (p.kind === "custom") {
    const c = s.custom;
    gPerMl = c?.gPerMl ?? null;
    if (c?.unit) first = c.unit;
    else if (c?.basis === "perUnit") first = "piece";
    if (c?.gramsPerUnit || c?.basis === "perUnit") units.push(first);
  } else if (p.kind === "usda") {
    gPerMl = p.usda.gPerMl ?? null;
  } else {
    gPerMl = p.ai.gPerMl ?? null;
    if (p.ai.unitG) {
      const u = p.ai.unitFor ?? "piece";
      first = u;
      units.push(u);
    }
  }
  units.push(first, "g");
  if (s.per === "ml" || liquid(gPerMl)) units.push("ml", "tbsp", "tsp", "cup");
  const uniq = [...new Set(units)].filter((u) => u in UNITS);
  return { default: first, units: uniq };
}

/** Is a state word in her typing different from this food's state? (the question "raw or cooked?" really matters) */
export function stateQuestion(query: string, s: Suggestion): boolean {
  const w = stateInName(query);
  return !!(w && s.state && w !== s.state);
}
