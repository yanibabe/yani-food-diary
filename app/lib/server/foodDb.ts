// SERVER ONLY (Round 69). A small local food table, so the AI never has to invent nutrition numbers.
//
// Data: app/data/food-db.json, built by scripts/build-food-db.mjs from USDA FoodData Central
// (Foundation Foods + SR Legacy + FNDDS; public domain, CC0) plus the app's own Thai reference
// entries (FOOD_REF). It is loaded once per server process and never sent to the phone.
// Search is local and takes a few milliseconds.

import db from "../../data/food-db.json" with { type: "json" };
import { FOOD_REF } from "../foodRef.ts";

/** "f" Foundation, "s" SR Legacy, "n" FNDDS (USDA); "r" = the app's own reference table. */
export type DbSource = "f" | "s" | "n" | "r";

export type DbFood = {
  /** USDA fdcId as text ("171688"), or "ref:<key>" for the app's reference table. */
  id: string;
  src: DbSource;
  name: string;
  /** Per 100 g. null = the source did not give it (never a real 0). */
  per100: { kcal: number; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; sugar: number | null; sodiumMg: number | null };
  /** Household portions, e.g. ["1 cup", 158]. */
  portions: [string, number][];
};

/** `coverage` = how much of the searched name (by word weight) the food's name contains, 0..1. */
export type Candidate = DbFood & { score: number; coverage: number };

type Row = [number, string, string, number, number | null, number | null, number | null, number | null, number | null, number | null, [string, number][]];

const STOP = new Set(["and", "with", "of", "the", "in", "a", "an", "or", "for", "to", "nfs", "ns"]);

/** Lower-case words; a trailing plural "s" is dropped so "eggs" = "egg" (same rule on both sides). */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of String(text ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    let w = raw;
    if (w.length > 3 && w.endsWith("oes")) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    out.push(w);
  }
  return out;
}

type Entry = { food: DbFood; tokens: Set<string>; first: string; len: number };
type Index = { entries: Entry[]; postings: Map<string, number[]>; idf: Map<string, number> };

let cache: Index | null = null;

function buildIndex(): Index {
  const entries: Entry[] = [];
  for (const r of (db as { foods: unknown[] }).foods as Row[]) {
    const food: DbFood = {
      id: String(r[0]),
      src: r[1] as DbSource,
      name: r[2],
      per100: { kcal: r[3], protein: r[4], carbs: r[5], fat: r[6], fiber: r[7], sugar: r[8], sodiumMg: r[9] },
      portions: r[10],
    };
    const toks = tokenize(food.name);
    entries.push({ food, tokens: new Set(toks), first: toks[0] ?? "", len: toks.length });
  }
  // The app's own reference foods (rough typical values, always shown as estimates).
  for (const f of FOOD_REF) {
    const english = [f.label.en, ...f.names.filter((n) => /^[\x00-\x7f]+$/.test(n))].join(" ");
    const toks = tokenize(`${english} ${f.state ?? ""}`);
    const food: DbFood = {
      id: `ref:${f.key}`,
      src: "r",
      name: f.state ? `${f.label.en} (${f.state})` : f.label.en,
      per100: { kcal: f.per100.kcal, protein: f.per100.protein, carbs: f.per100.carbs, fat: f.per100.fat, fiber: null, sugar: null, sodiumMg: null },
      portions: f.unitG ? [["1 piece", f.unitG]] : [],
    };
    entries.push({ food, tokens: new Set(toks), first: tokenize(f.label.en)[0] ?? "", len: new Set(toks).size });
  }
  const postings = new Map<string, number[]>();
  entries.forEach((e, i) => {
    for (const t of e.tokens) {
      const list = postings.get(t);
      if (list) list.push(i);
      else postings.set(t, [i]);
    }
  });
  const idf = new Map<string, number>();
  for (const [t, list] of postings) idf.set(t, Math.log(1 + entries.length / list.length));
  return { entries, postings, idf };
}

/** Loaded once, then reused for every request. */
export function foodIndex(): Index {
  return (cache ??= buildIndex());
}

export function foodCount(): number {
  return foodIndex().entries.length;
}

/** The words a cooking state stands for in USDA names. */
const STATE_WORDS: Record<string, string[]> = {
  raw: ["raw", "fresh"],
  cooked: ["cooked", "boiled", "steamed", "stewed"],
  boiled: ["boiled", "cooked"],
  steamed: ["steamed", "cooked"],
  fried: ["fried", "pan-fried", "cooked"],
  grilled: ["grilled", "broiled", "roasted", "cooked"],
  baked: ["baked", "roasted", "cooked"],
  dried: ["dried", "dehydrated"],
};
const COOKED_WORDS = new Set(["cooked", "boiled", "steamed", "fried", "grilled", "broiled", "roasted", "baked", "stewed", "braised"]);

/**
 * Find the foods that fit an English name best. `state` (raw / cooked / fried …) is a soft hint:
 * a matching state ranks higher, the opposite state (raw vs cooked) ranks lower.
 * Every word of the name counts, rare words more than common ones. Returns up to `limit` foods.
 */
export function searchFoods(query: string, opts: { state?: string | null; limit?: number; minCoverage?: number; /** false = keep look-alikes with the same numbers (default true) */ dedupe?: boolean } = {}): Candidate[] {
  const limit = opts.limit ?? 6;
  const ix = foodIndex();
  const qt = [...new Set(tokenize(query))].filter((t) => ix.idf.has(t));
  if (!qt.length) return [];
  const total = qt.reduce((s, t) => s + (ix.idf.get(t) ?? 0), 0);
  const hit = new Map<number, number>();
  for (const t of qt) {
    const w = ix.idf.get(t) ?? 0;
    for (const i of ix.postings.get(t)!) hit.set(i, (hit.get(i) ?? 0) + w);
  }
  const wantState = opts.state ? STATE_WORDS[opts.state] : undefined;
  const out: Candidate[] = [];
  for (const [i, matched] of hit) {
    const coverage = matched / total;
    if (coverage < (opts.minCoverage ?? 0.5)) continue;
    const e = ix.entries[i];
    let score = coverage * 10 - 0.35 * Math.log2(e.len + 1);
    if (qt.includes(e.first)) score += 1.5; // USDA names start with the main food ("Rice, white, cooked")
    if (e.food.src === "n") score -= 0.2; // survey dishes have long, specific names
    if (e.food.src === "r") score -= 0.3; // rough typical values: USDA wins a tie
    if (wantState) {
      if (wantState.some((w) => e.tokens.has(w))) score += 1.2;
      else if (opts.state === "raw" && [...e.tokens].some((t) => COOKED_WORDS.has(t))) score -= 1.5;
      else if (opts.state !== "raw" && opts.state !== "dried" && e.tokens.has("raw")) score -= 1.5;
    }
    out.push({ ...e.food, score, coverage });
  }
  out.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  // USDA lists many look-alikes (rice: short / medium / long grain …). Foods with the same numbers count once.
  const seen = new Set<string>();
  const top: Candidate[] = [];
  for (const c of out) {
    const key = `${c.per100.kcal}|${c.per100.protein}|${c.per100.carbs}|${c.per100.fat}`;
    if (opts.dedupe !== false && seen.has(key)) continue;
    seen.add(key);
    top.push(c);
    if (top.length >= limit) break;
  }
  return top;
}

/** One food by id (a USDA id as text, or "ref:<key>"). */
export function foodById(id: string): DbFood | null {
  return foodIndex().entries.find((e) => e.food.id === id)?.food ?? null;
}

/** Nutrients for `grams` of a food: per100 × grams / 100. A nutrient the source lacks stays null. */
export function nutrientsFor(food: DbFood, grams: number) {
  const k = grams / 100;
  const scale = (v: number | null, digits: number) => (v == null ? null : Math.round(v * k * 10 ** digits) / 10 ** digits);
  return {
    kcal: Math.round(food.per100.kcal * k),
    protein: scale(food.per100.protein, 1),
    carbs: scale(food.per100.carbs, 1),
    fat: scale(food.per100.fat, 1),
    fiber: scale(food.per100.fiber, 1),
    sugar: scale(food.per100.sugar, 1),
    sodiumMg: scale(food.per100.sodiumMg, 0),
  };
}

export const FOOD_DB_CREDIT = (db as { credit: string }).credit;
