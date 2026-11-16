// The AI's answer for ONE recipe ingredient (per 100 g), and how it is checked.
// Kept apart from server/ai.ts so tests can load it (no network, no server code).

import { z } from "zod";
import { UNITS, type IngredientUnit } from "./types.ts";

const num = z.coerce.number().catch(0);

export const IngredientRefSchema = z.object({
  known: z.boolean().catch(true).describe("false if this is not a food/ingredient you recognise"),
  // Round 39 fix: no answer → null (unknown). A real 0 (water, salt, diet soda) is a valid answer.
  kcal: z.preprocess((v) => (v == null || v === "" ? null : v), z.coerce.number().nullable()).catch(null).describe("kcal per 100 g (0 is a valid answer, e.g. water)"),
  protein: num.describe("grams per 100 g"),
  carbs: num.describe("grams per 100 g"),
  fat: num.describe("grams per 100 g"),
  unitG: z.coerce.number().nullable().catch(null).describe("Typical weight in grams of ONE piece / egg / fruit, if people count it in pieces; else null"),
  gPerMl: z.coerce.number().nullable().catch(null).describe("Grams per ml if it is a liquid or sauce (e.g. oil 0.92, milk 1.03), or if the user measures it with spoons/cups (e.g. sugar 0.85, flour 0.53); else null"),
  state: z.enum(["raw", "cooked", "dried", "prepared"]).nullable().catch(null).describe("The state these values are for: raw, cooked, dried, or prepared (sauces, drinks, ready-made foods)"),
});
export type IngredientRef = z.infer<typeof IngredientRefSchema>;

const clamp = (n: number, max: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Check + tidy the AI's answer. Only "not a food" or NO calorie number is rejected.
 * Before this fix any 0-kcal answer was thrown away, so plain water, ice, salt or
 * diet drinks showed "no nutrition data". Zero is a real value, not missing data.
 */
export function cleanIngredientRef(r: IngredientRef, unit: IngredientUnit | null): (IngredientRef & { kcal: number; unitFor: IngredientUnit | null }) | null {
  const kind = unit ? UNITS[unit].kind : null;
  if (!r.known || r.kcal == null || !Number.isFinite(r.kcal) || r.kcal < 0) return null;
  return {
    known: true,
    kcal: Math.round(clamp(r.kcal, 900)),
    protein: round1(clamp(r.protein, 100)),
    carbs: round1(clamp(r.carbs, 100)),
    fat: round1(clamp(r.fat, 100)),
    unitG: r.unitG != null && r.unitG > 0 && r.unitG < 5000 ? (r.unitG < 10 ? Math.max(0.1, round1(r.unitG)) : Math.round(r.unitG)) : null,
    gPerMl: r.gPerMl != null && r.gPerMl > 0.3 && r.gPerMl < 3 ? Math.round(r.gPerMl * 100) / 100 : null,
    // unitG is only for counted units; a volume unit's answer is in gPerMl.
    unitFor: kind === "count" ? unit : null,
    state: r.state ?? null,
  };
}
