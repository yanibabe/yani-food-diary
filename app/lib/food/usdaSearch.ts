// Round 41: the steps behind one USDA search, kept apart from the web route so tests can run it.
// Her name → English words (safe word list → her own typed words → AI translation) → USDA search →
// careful ranking. Nothing is picked here: the phone shows the list and she confirms one.

import { GENERIC_TYPES, type UsdaClient } from "./usda.ts";
import { englishQuery, isCloseMatch, rankFoods, type RankedFood } from "./usdaMatch.ts";

export type QueryFrom = "typed" | "english" | "alias" | "ai";

export type SearchOut = {
  query: string;
  queryFrom: QueryFrom;
  branded: boolean;
  results: (RankedFood & { close: boolean })[];
};

type Searcher = Pick<UsdaClient, "search">;

export async function searchUsda(
  client: Searcher,
  input: { name: string; query?: string | null; branded?: boolean },
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
  const foods = await client.search(query, input.branded ? ["branded"] : GENERIC_TYPES, input.branded ? 10 : 12);
  const ranked = rankFoods(foods, name, query);
  return { query, queryFrom, branded: !!input.branded, results: ranked.map((r) => ({ ...r, close: isCloseMatch(r, name, query) })) };
}
