// "What can I eat with what's left": ideas in 3 groups.
//  1. My recipes — straight from her saved recipes, real numbers, no AI.
//  2. 7-Eleven   — AI ideas (with the +15% safety margin).
//  3. Delivery   — AI ideas from well-known chain shops that list kcal on their
//                  menu, so she can check the shop's own number.
// This file checks every idea before she sees it: ideas bigger than the kcal
// left are dropped, duplicates are dropped, most protein first.

import { markMargin, round } from "./nutrition.ts";
import type { Macros } from "./types.ts";

export type Place = "recipe" | "7-eleven" | "delivery";
/** The places the AI is asked about (recipes come from her own list). */
export const AI_PLACES = ["7-eleven", "delivery"] as const;
export type AiPlace = (typeof AI_PLACES)[number];

/** What the AI sends back for one idea (plain numbers, before the safety margin). */
export type RawIdea = Macros & {
  name: string;
  amount: number;
  unit: string;
  place: AiPlace;
  /** Delivery only: the chain shop's name (e.g. Subway). */
  shop?: string | null;
  why: string;
};

/** What the app shows. margin = true if the +15% safety margin was added. */
export type Idea = Macros & {
  name: string;
  amount: number;
  unit: string;
  place: Place;
  shop: string | null;
  why: string;
  recipeId: string | null;
  margin: boolean;
};

/** One serving of her recipe. */
export type RecipeOption = Macros & { id: string; name: string };

export type AiGroups = { seven: Idea[]; delivery: Idea[] };

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
  protein: round(i.protein, 1),
  carbs: round(i.carbs, 1),
  fat: round(i.fat, 1),
});

/** Keep ideas that fit the room, once each, most protein first, at most `max`. */
function keepBest(ideas: Idea[], room: number, max: number): Idea[] {
  const seen = new Set<string>();
  const out: Idea[] = [];
  for (const i of ideas) {
    const key = `${i.shop ?? ""}|${i.name}`.trim().toLowerCase();
    if (!i.name.trim() || seen.has(key)) continue;
    if (!(i.kcal > 0) || i.kcal > room) continue;
    seen.add(key);
    out.push(roundIdea(i));
  }
  return out.sort((a, b) => b.protein - a.protein).slice(0, max);
}

/** Group 1: her own recipes (one serving each) that fit what's left. Real numbers, no margin. */
export function recipeIdeas(recipes: RecipeOption[], left: number, max = PER_GROUP): Idea[] {
  const { room } = kcalRoom(left);
  return keepBest(
    recipes.map((r) => ({
      name: r.name,
      amount: 1,
      unit: "",
      place: "recipe" as const,
      shop: null,
      why: "",
      recipeId: r.id,
      kcal: r.kcal,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      margin: false,
    })),
    room,
    max,
  );
}

/**
 * Groups 2 and 3: make the AI's ideas safe to show.
 * - every AI idea gets the +15% safety margin, like every AI guess in the app;
 * - delivery ideas must name a shop;
 * - ideas with no kcal, or more kcal than the room, are dropped; duplicates too.
 */
export function fitAiIdeas(raw: RawIdea[], left: number, max = PER_GROUP): AiGroups {
  const { room } = kcalRoom(left);
  const all = raw.map((r): Idea => {
    const shop = r.place === "delivery" ? (r.shop ?? "").trim() || null : null;
    return { ...markMargin({ ...r }), shop, recipeId: null };
  });
  return {
    seven: keepBest(all.filter((i) => i.place === "7-eleven"), room, max),
    delivery: keepBest(all.filter((i) => i.place === "delivery" && i.shop), room, max),
  };
}
