// "Fix to match the label": her own numbers for one barcode, typed from the pack.
// Open Food Facts is filled in by volunteers and can be wrong or from another pack size.
// Her fix is saved on the phone and used every time she scans that barcode again.
// No React and no browser storage here, so the tests can use it.

import type { Food } from "./provider.ts";

export type LabelFix = {
  code: string;
  /** Size of one pack / serving as printed, in g (or mL for drinks). */
  servingG: number;
  liquid: boolean;
  /** Per ONE pack / serving, as printed. null = not filled in (keep the database number). */
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  updatedAt: number;
  /** Round 39: how she gave these numbers. Missing on fixes saved before Round 39. */
  via?: "photo" | "typed";
};

const per100 = (v: number, servingG: number) => Math.round((v / servingG) * 1000) / 10;

/** The food with her label numbers in place (still stored per 100 g, like every Food). */
export function applyLabelFix(food: Food, fix: LabelFix): Food {
  const s = fix.servingG;
  return {
    ...food,
    servingSize: `${s} ${fix.liquid ? "mL" : "g"}`,
    kcal: per100(fix.kcal, s),
    protein: fix.protein == null ? food.protein : per100(fix.protein, s),
    carbs: fix.carbs == null ? food.carbs : per100(fix.carbs, s),
    fat: fix.fat == null ? food.fat : per100(fix.fat, s),
    fixedBy: fix.via ?? "unknown",
  };
}

/** A fix is usable only with a real pack size and calories. */
export function fixIsValid(f: Pick<LabelFix, "servingG" | "kcal">): boolean {
  return Number.isFinite(f.servingG) && f.servingG > 0 && f.servingG < 5000 && Number.isFinite(f.kcal) && f.kcal >= 0 && f.kcal < 10000;
}

export function findFix(list: LabelFix[], code: string): LabelFix | null {
  return list.find((f) => f.code === code) ?? null;
}

export function upsertFix(list: LabelFix[], fix: LabelFix): LabelFix[] {
  return [...list.filter((f) => f.code !== fix.code), fix];
}

export function removeFix(list: LabelFix[], code: string): LabelFix[] {
  return list.filter((f) => f.code !== code);
}
