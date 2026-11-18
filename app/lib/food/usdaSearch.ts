// Round 41: the steps behind one USDA search, kept apart from the web route so tests can run it.
// Her name → English words (safe word list → her own typed words → AI translation) → USDA search →
// careful ranking. Nothing is picked here: the phone shows the list and she confirms one.

import { GENERIC_TYPES, type UsdaClient } from "./usda.ts";
import type { UsdaFood } from "./usdaNutrients.ts";
import { localUsdaSearch } from "./usdaLocal.ts";
import { englishQuery, isCloseMatch, rankFoods, type RankedFood } from "./usdaMatch.ts";

export type QueryFrom = "typed" | "english" | "alias" | "ai";

export type SearchOut = {
  query: string;
  queryFrom: QueryFrom;
  branded: boolean;
  results: (RankedFood & { close: boolean })[];
};

type Searcher = Pick<UsdaClient, "search">;

/** About this many rows are shown (generic foods). */
export const MAX_RESULTS = 14;

export async function searchUsda(
  client: Searcher,
  input: { name: string; query?: string | null; branded?: boolean; /** false = live USDA only (tests with a fake USDA, USDA_MOCK) */ local?: boolean },
  translate: ((name: string) => Promise<string | null>) | null,
): Promise<SearchOut> {
  const name = input.name.trim().slice(0, 120);
  let query = (input.query ?? "").trim().slice(0, 100);
  let queryFrom: QueryFrom = "typed";
  if (!query) {
    const fromList = englishQuery(name);
    if (fromList) {
      query = fromList;
      queryFrom = /^[\x00-\x7f]+$/.test(name) ? "english" : "alias";
    } else if (translate) {
      query = (await translate(name).catch(() => null)) ?? "";
      queryFrom = "ai";
    }
  }
  if (!query) return { query: "", queryFrom, branded: !!input.branded, results: [] };
  if (input.branded) {
    const foods = await client.search(query, ["branded"], 10);
    return { query, queryFrom, branded: true, results: rankFoods(foods, name, query).map((r) => ({ ...r, close: isCloseMatch(r, name, query) })) };
  }
  // Round 77: live USDA picks its 12 foods by its own relevance and can miss the plain food (no plain
  // potato for "potato"). The bundled table is searched with the same words and both lists are ranked
  // together. If live USDA fails, the local foods still answer; only "nothing at all" is an error.
  const local = input.local === false ? [] : localUsdaSearch(query);
  let live: UsdaFood[] = [];
  try {
    live = await client.search(query, GENERIC_TYPES, 12);
  } catch (e) {
    if (!local.length) throw e;
  }
  const seen = new Set<number>();
  const foods = [...live, ...local].filter((f) => (seen.has(f.fdcId) ? false : (seen.add(f.fdcId), true)));
  const ranked = rankFoods(foods, name, query).slice(0, MAX_RESULTS);
  return { query, queryFrom, branded: false, results: ranked.map((r) => ({ ...r, close: isCloseMatch(r, name, query) })) };
}
