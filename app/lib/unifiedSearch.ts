// Phase 2C-2: one search box, three kinds of results (meals she logged, her recipes, ingredients).
// Pure helpers only: they only FIND and ORDER things. They never change a number, a meal or a recipe.
// The three kinds stay three different kinds (we never merge them into one list).

import type { Entry, Recipe } from "./types.ts";

/** How many rows each group shows before "show more". */
export const GROUP_PREVIEW = 3;

/** 0 = the whole name is exactly what she typed, 1 = starts with it, 2 = contains it,
 *  3 = only a food INSIDE it matches, Infinity = no match. Lower is better. */
export type MatchRank = 0 | 1 | 2 | 3 | typeof Infinity;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function queryWords(query: string): string[] {
  return norm(query).split(" ").filter(Boolean);
}

function rankText(text: string, query: string, words: string[]): MatchRank {
  const t = norm(text);
  if (!t) return Infinity;
  if (t === query) return 0;
  if (t.startsWith(query)) return 1;
  if (t.includes(query)) return 2;
  // several typed words: all of them are somewhere in the name ("ข้าว ไก่")
  if (words.length > 1 && words.every((w) => t.includes(w))) return 2;
  return Infinity;
}

function bestRank(names: (string | undefined)[], inner: (string | undefined)[], query: string, words: string[]): MatchRank {
  let best: MatchRank = Infinity;
  for (const n of names) if (n) best = Math.min(best, rankText(n, query, words)) as MatchRank;
  if (best !== Infinity) return best;
  // Foods inside the meal / recipe: also found, but listed after name matches.
  const innerText = inner.filter(Boolean).join(" ");
  if (innerText && rankText(innerText, query, words) !== Infinity) return 3;
  return Infinity;
}

export function mealRank(e: Entry, query: string): MatchRank {
  const q = norm(query);
  if (!q) return Infinity;
  const w = queryWords(query);
  return bestRank([e.title, e.alt?.th, e.alt?.en], e.items.flatMap((i) => [i.name, i.alt?.th, i.alt?.en]), q, w);
}

export function recipeRank(r: Recipe, query: string): MatchRank {
  const q = norm(query);
  if (!q) return Infinity;
  const w = queryWords(query);
  return bestRank([r.name, r.alt?.th, r.alt?.en], r.ingredients.map((i) => i.name), q, w);
}

/** Stable sort by rank, keeping the incoming order (newest first / saved order) inside one rank. */
function ranked<T>(list: T[], rank: (x: T) => MatchRank): T[] {
  return list
    .map((x, i) => ({ x, i, r: rank(x) }))
    .filter((o) => o.r !== Infinity)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((o) => o.x);
}

/** Her earlier meals (already de-duplicated and newest first, i.e. `recentMeals(...)`) that match the words. */
export function searchLoggedMeals(recent: Entry[], query: string): Entry[] {
  return ranked(recent, (e) => mealRank(e, query));
}

/** Her saved recipes that match the words. Name matches first, then recipes that only contain the food. */
export function searchMyRecipes(recipes: Recipe[], query: string): Recipe[] {
  const newest = [...recipes].sort((a, b) => b.updatedAt - a.updatedAt);
  return ranked(newest, (r) => recipeRank(r, query));
}

/** Rows to show now: a few, or all after "show more". */
export function visibleRows<T>(rows: T[], expanded: boolean, preview = GROUP_PREVIEW): { shown: T[]; hidden: number } {
  if (expanded || rows.length <= preview) return { shown: rows, hidden: 0 };
  return { shown: rows.slice(0, preview), hidden: rows.length - preview };
}

/** Which of the two "yours" groups comes first. Her recipes go first only when their best match is clearly better
 *  (e.g. an exact recipe name while the meals only contain the words). Otherwise meals first. Ingredients always come last. */
export function topGroupFirst(loggedBest: MatchRank | null, recipeBest: MatchRank | null): "logged" | "recipes" {
  if (loggedBest === null) return "recipes";
  if (recipeBest === null) return "logged";
  return recipeBest < loggedBest ? "recipes" : "logged";
}
