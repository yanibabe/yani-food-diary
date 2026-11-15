// "What can I eat with what's left": the AI suggests foods, and this file
// checks its numbers before she sees them. Ideas that don't fit the kcal left
// are dropped. Ideas from her own recipes use the recipe's real numbers.

import { markMargin, round } from "./nutrition.ts";
import type { Macros } from "./types.ts";

export type Place = "7-eleven" | "delivery" | "home" | "recipe";
export const PLACES: Place[] = ["7-eleven", "delivery", "home", "recipe"];

/** What the AI sends back for one idea (plain numbers, before the safety margin). */
export type RawIdea = Macros & {
  name: string;
  amount: number;
  unit: string;
  place: Place;
  why: string;
  recipeId?: string | null;
};

/** What the app shows. margin = true if the +15% safety margin was added. */
export type Idea = RawIdea & { margin: boolean };

/** One serving of her recipe, sent to the AI so it can pick from them. */
export type RecipeOption = Macros & { id: string; name: string };

/** Below this many kcal left, the app switches to "light" ideas. */
export const LIGHT_BELOW = 100;
/** In light mode, each idea is at most this many kcal. */
export const LIGHT_MAX = 100;
export const MAX_IDEAS = 4;

/** How many kcal one idea may have. Light mode when almost nothing (or less) is left. */
export function kcalRoom(left: number): { room: number; light: boolean } {
  return left >= LIGHT_BELOW ? { room: Math.floor(left), light: false } : { room: LIGHT_MAX, light: true };
}

/**
 * Make the AI's ideas safe to show:
 * - recipe ideas must be one of her recipes, and get that recipe's real numbers (no margin);
 * - other ideas get the +15% safety margin, like every AI guess in the app;
 * - ideas with no kcal, or more kcal than the room, are dropped;
 * - the same food twice is shown once;
 * - most protein first (she asked for high-protein ideas), at most 4.
 */
export function fitIdeas(raw: RawIdea[], left: number, recipes: RecipeOption[], max = MAX_IDEAS): Idea[] {
  const { room } = kcalRoom(left);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: Idea[] = [];
  for (const r of raw) {
    let idea: Idea;
    if (r.place === "recipe") {
      const rec = r.recipeId ? byId.get(r.recipeId) : undefined;
      if (!rec) continue;
      idea = {
        ...r,
        name: rec.name,
        amount: 1,
        recipeId: rec.id,
        kcal: rec.kcal,
        protein: rec.protein,
        carbs: rec.carbs,
        fat: rec.fat,
        margin: false,
      };
    } else {
      idea = markMargin({ ...r, recipeId: null });
    }
    const key = idea.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    if (!(idea.kcal > 0) || idea.kcal > room) continue;
    seen.add(key);
    out.push({ ...idea, kcal: round(idea.kcal), protein: round(idea.protein, 1), carbs: round(idea.carbs, 1), fat: round(idea.fat, 1) });
  }
  return out.sort((a, b) => b.protein - a.protein).slice(0, max);
}
