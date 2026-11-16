// "What can I eat with what's left": ideas in 3 groups.
//  1. My recipes — straight from her saved recipes, real numbers, no AI.
//  2. 7-Eleven   — AI ideas (her optional calorie buffer on kcal only, Round 40).
//  3. Menu ideas — AI menu names she can cook (or search), each with a short
//                  recipe: ingredients + steps.
// This file checks every idea before she sees it: ideas bigger than the kcal
// left are dropped, duplicates are dropped, most protein first.

import { bufferedKcal, cleanBufferPct } from "./calorieBuffer.ts";
import { round } from "./nutrition.ts";
import type { Macros } from "./types.ts";

export type Place = "recipe" | "7-eleven" | "menu";
/** The places the AI is asked about (recipes come from her own list). */
export const AI_PLACES = ["7-eleven", "menu"] as const;
export type AiPlace = (typeof AI_PLACES)[number];

/** What the AI sends back for one idea (plain numbers, its best guess). */
export type RawIdea = Macros & {
  name: string;
  amount: number;
  unit: string;
  place: AiPlace;
  /** Menu only: what to buy, e.g. "อกไก่ 150 g". */
  ingredients?: string[] | null;
  /** Menu only: short cooking steps. */
  steps?: string[] | null;
  why: string;
};

/** What the app shows. kcal = what the diary would count (with her buffer); aiKcal = the AI's own kcal. */
export type Idea = Macros & {
  name: string;
  amount: number;
  unit: string;
  place: Place;
  why: string;
  /** Menu ideas only (empty for the others). */
  ingredients: string[];
  steps: string[];
  recipeId: string | null;
  /** Round 40: the AI's own kcal (null for her recipes). */
  aiKcal: number | null;
  /** Round 40: the buffer % in kcal (0 for her recipes). */
  bufferPct: number;
};

/** One serving of her recipe. */
export type RecipeOption = Macros & { id: string; name: string };

export type AiGroups = { seven: Idea[]; menu: Idea[] };

/** Below this many kcal left, the app switches to "light" ideas. */
export const LIGHT_BELOW = 100;
/** In light mode, each idea is at most this many kcal. */
export const LIGHT_MAX = 100;
/** At most this many ideas in each group. */
export const PER_GROUP = 3;

/** How many kcal one idea may have. Light mode when almost nothing (or less) is left. */
export function kcalRoom(left: number): { room: number; light: boolean } {
  return left >= LIGHT_BELOW ? { room: Math.floor(left), light: false } : { room: LIGHT_MAX, light: true };
}

const roundIdea = (i: Idea): Idea => ({
  ...i,
  kcal: round(i.kcal),
  aiKcal: i.aiKcal == null ? null : round(i.aiKcal),
  protein: round(i.protein, 1),
  carbs: round(i.carbs, 1),
  fat: round(i.fat, 1),
});

/** Keep ideas that fit the room, once each, most protein first, at most `max`. */
function keepBest(ideas: Idea[], room: number, max: number): Idea[] {
  const seen = new Set<string>();
  const out: Idea[] = [];
  for (const i of ideas) {
    const key = i.name.trim().toLowerCase();
    if (!i.name.trim() || seen.has(key)) continue;
    if (!(i.kcal > 0) || i.kcal > room) continue;
    seen.add(key);
    out.push(roundIdea(i));
  }
  return out.sort((a, b) => b.protein - a.protein).slice(0, max);
}

/** Group 1: her own recipes (one serving each) that fit what's left. Real numbers, never a buffer. */
export function recipeIdeas(recipes: RecipeOption[], left: number, max = PER_GROUP): Idea[] {
  const { room } = kcalRoom(left);
  return keepBest(
    recipes.map((r) => ({
      name: r.name,
      amount: 1,
      unit: "",
      place: "recipe" as const,
      why: "",
      ingredients: [],
      steps: [],
      recipeId: r.id,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      aiKcal: null,
      bufferPct: 0,
    })),
    room,
    max,
  );
}

const cleanList = (v: string[] | null | undefined, max: number) =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

/**
 * Groups 2 and 3: make the AI's ideas safe to show.
 * - every AI idea gets her calorie buffer (kcal only; 0% by default), like every AI guess in the app;
 * - menu ideas must come with ingredients and steps (otherwise she can't cook them);
 * - ideas with no kcal, or more kcal than the room, are dropped; duplicates too.
 */
export function fitAiIdeas(raw: RawIdea[], left: number, max = PER_GROUP, bufferPct = 0): AiGroups {
  const { room } = kcalRoom(left);
  const pct = cleanBufferPct(bufferPct);
  const all = raw.map((r): Idea => {
    const isMenu = r.place === "menu";
    const { ingredients, steps, ...rest } = r;
    return {
      ...rest,
      kcal: bufferedKcal(rest.kcal, pct),
      aiKcal: rest.kcal,
      bufferPct: pct,
      ingredients: isMenu ? cleanList(ingredients, 12) : [],
      steps: isMenu ? cleanList(steps, 8) : [],
      recipeId: null,
    };
  });
  return {
    seven: keepBest(all.filter((i) => i.place === "7-eleven"), room, max),
    menu: keepBest(all.filter((i) => i.place === "menu" && i.ingredients.length && i.steps.length), room, max),
  };
}

/** The room to tell the AI, so an idea still fits after her buffer is added. */
export function aiRoom(room: number, bufferPct: number): number {
  return Math.floor((room * 100) / (100 + cleanBufferPct(bufferPct)));
}
