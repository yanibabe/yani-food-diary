// Round 39: where a nutrition number came from (source) and how sure we are (verification).
// Pure functions only — no React, no browser storage — so the tests can check them.
//
// Rules:
// - Her own typing is "user" + "unverified". It is never "verified" by itself.
// - Label numbers (printed on the pack) are "label" + "unverified": an AI read them from a photo,
//   or she typed them, and nobody has checked them against the pack.
// - Open Food Facts is "database" + "unverified" (volunteers fill it in).
// - The app's reference table and the AI are "estimated".
// - Older records that can't be told for sure are "unknown" — never shown as verified.
// - Nothing here changes any number. It only describes them.

import type { L } from "./i18n.ts";
import type { Entry, FoodItem, Ingredient, LabelInfo, MacroKey, NutrientSource, Provenance } from "./types.ts";

export const MACRO_KEYS: MacroKey[] = ["protein", "carbs", "fat"];

export const UNKNOWN: Provenance = { source: "unknown", verification: "unknown" };

export const SOURCE_LABEL: Record<NutrientSource, L> = {
  label: { th: "ตามฉลาก", en: "From label" },
  user: { th: "พิมพ์เอง", en: "Typed by you" },
  database: { th: "ฐานข้อมูล", en: "Database" },
  reference: { th: "ค่าอ้างอิง", en: "Reference value" },
  ai: { th: "AI ประมาณ", en: "AI estimate" },
  recipe: { th: "จากสูตร", en: "From recipe" },
  unknown: { th: "ไม่ทราบที่มา", en: "Source unknown" },
};

/** A short name for the badge. Open Food Facts gets its own name. */
export function sourceLabel(p: Provenance): L {
  if (p.source === "database" && p.via === "off") return { th: "Open Food Facts", en: "Open Food Facts" };
  return SOURCE_LABEL[p.source];
}

/** What the AI said about one item → where its numbers came from. */
export function provFromAi(a: { fromLabel?: boolean; userAmount?: boolean }): Provenance {
  if (a.fromLabel) return { source: "label", verification: "unverified", via: "ai-read" };
  return { source: "ai", verification: "estimated", via: a.userAmount ? "exact-amount" : "guess" };
}

/** She typed or changed the numbers herself. */
export const USER_TYPED: Provenance = { source: "user", verification: "unverified", via: "typed" };

/**
 * Where an item's numbers came from. New items carry `prov`. Older items are worked out from
 * what was saved, ONLY where that is certain; otherwise "unknown".
 */
export function itemProvenance(item: FoodItem, entry?: Pick<Entry, "source"> | null): Provenance {
  if (item.prov) return item.prov;
  // Older barcode items: the numbers may be Open Food Facts OR her label fix — can't tell which.
  if (item.ref?.source === "off") return { source: "unknown", verification: "unknown", via: "off-or-label-fix" };
  if (item.fromLabel) return { source: "label", verification: "unverified", via: "ai-read" };
  // margin is only ever set on AI answers (true = guessed amount, false = exact amount).
  if (item.margin === true) return { source: "ai", verification: "estimated", via: "guess" };
  if (item.margin === false) return { source: "ai", verification: "estimated", via: "exact-amount" };
  if (entry?.source === "recipe") return { source: "recipe", verification: item.estimated ? "estimated" : "unknown" };
  if (entry?.source === "manual") return { source: "user", verification: "unverified", via: "typed" };
  return UNKNOWN;
}

/** Show it as an estimate? (her own "estimate" tick, or the source is an estimate) */
export function isEstimated(item: FoodItem, entry?: Pick<Entry, "source"> | null): boolean {
  return item.estimated || itemProvenance(item, entry).verification === "estimated";
}

/** Where a label's numbers came from. Labels saved before Round 39 → unknown. */
export function labelProvenance(label: LabelInfo): Provenance {
  switch (label.via) {
    case "typed":
    case "fix-typed":
      return { source: "user", verification: "unverified", via: label.via };
    case "photo":
    case "fix-photo":
      return { source: "label", verification: "unverified", via: label.via };
    case "off":
      return { source: "database", verification: "unverified", via: "off" };
    default:
      return { source: "unknown", verification: "unknown", via: label.via ?? null };
  }
}

/** Where a recipe ingredient's numbers came from (same order as the recipe math). */
export function ingredientProvenance(ing: Ingredient, used: "label" | "pick" | "ai" | "ref"): Provenance {
  if (used === "label" && ing.label) return labelProvenance(ing.label);
  if (used === "ai") return { source: "ai", verification: "estimated" };
  if (used === "pick") return { source: "reference", verification: "estimated", via: "picked" };
  return { source: "reference", verification: "estimated" };
}

/** A recipe's numbers: as sure as its least sure ingredient. */
export function recipeProvenance(parts: Provenance[]): Provenance {
  const rank = { verified: 0, unverified: 1, unknown: 2, estimated: 3 } as const;
  let worst: Provenance["verification"] = "verified";
  for (const p of parts) if (rank[p.verification] > rank[worst]) worst = p.verification;
  return { source: "recipe", verification: parts.length ? worst : "unknown" };
}

/** Join lists of missing nutrients, once each, in a fixed order. */
export function joinMissing(...lists: (MacroKey[] | undefined | null)[]): MacroKey[] {
  const all = new Set(lists.flatMap((l) => l ?? []));
  return MACRO_KEYS.filter((k) => all.has(k));
}

/** Which nutrients a source left empty (null / undefined). */
export function missingFrom(v: Partial<Record<MacroKey, number | null | undefined>>): MacroKey[] {
  return MACRO_KEYS.filter((k) => v[k] == null);
}
