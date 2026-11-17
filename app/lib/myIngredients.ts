// Round 47: the "My ingredients" list on the recipes page. Pure helpers (no React).

import { STATE_LABEL } from "./foodRef.ts";
import type { CustomIngredient } from "./customIngredients.ts";

/** A-Z / ก-ฮ by name (then state), so she finds things in a steady place. Does not change the saved order. */
export function sortMine(list: CustomIngredient[]): CustomIngredient[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "th") || (a.state ?? "").localeCompare(b.state ?? ""));
}

/** Filter by a few typed letters (name, state word, aliases). Empty text = everything. */
export function filterMine(list: CustomIngredient[], query: string): CustomIngredient[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => {
    const hay = [c.name, c.state ? STATE_LABEL[c.state].th : "", c.state ? STATE_LABEL[c.state].en : "", ...(c.aliases ?? [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

/** "per 100 g" / "per 100 ml" / "per 1 unit". */
export function basisLabel(c: Pick<CustomIngredient, "basis" | "per">, lang: "th" | "en"): string {
  if (c.basis === "perUnit") return lang === "th" ? "ต่อ 1 หน่วย" : "per 1 unit";
  const u = c.per === "ml" ? (lang === "th" ? "มล." : "ml") : lang === "th" ? "ก." : "g";
  return lang === "th" ? `ต่อ 100 ${u}` : `per 100 ${u}`;
}

/** Protein / carbs / fat shown as numbers, an unknown one as "?" (never 0). */
export function macroText(c: Pick<CustomIngredient, "protein" | "carbs" | "fat">): string {
  const f = (v: number | null) => (v == null ? "?" : String(Math.round(v * 10) / 10));
  return `P ${f(c.protein)} · C ${f(c.carbs)} · F ${f(c.fat)}`;
}
