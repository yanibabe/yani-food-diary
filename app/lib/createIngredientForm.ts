// Round 64: the "+ Add my ingredient" form on the My ingredients screen — pure logic (no screen code).
// Her numbers are HER OWN: nothing here ever marks them "verified". Blank protein/carbs/fat = unknown (null, never 0).

import { addCustom, type CustomError, type CustomIngredient, type CustomInput } from "./customIngredients.ts";
import type { FoodState } from "./types.ts";

export type CreateDraft = {
  name: string;
  state: FoodState | "";
  basis: "g" | "ml" | "unit";
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  gpu: number | null;
};

export const emptyDraft = (): CreateDraft => ({ name: "", state: "", basis: "g", kcal: null, protein: null, carbs: null, fat: null, gpu: null });

/** Form values -> CustomInput. Blank stays null (unknown). */
export function draftToInput(d: CreateDraft): CustomInput {
  return {
    name: d.name,
    state: d.state || null,
    basis: d.basis === "unit" ? "perUnit" : "per100",
    per: d.basis === "ml" ? "ml" : "g",
    kcal: d.kcal,
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
    gramsPerUnit: d.gpu,
  };
}

/** Add to the list (newest first). Duplicate name+state is refused and the list is untouched. */
export function createFromDraft(list: CustomIngredient[], d: CreateDraft, now: number): { ok: true; list: CustomIngredient[]; item: CustomIngredient } | { ok: false; error: CustomError | "duplicate" } {
  return addCustom(list, draftToInput(d), now);
}

export function createErrorText(e: CustomError | "duplicate", tr: (th: string, en: string) => string): string {
  switch (e) {
    case "name":
      return tr("ใส่ชื่อก่อนนะ", "Please enter a name");
    case "kcal":
      return tr("ใส่แคลอรี่ (kcal) ก่อนนะ", "Please enter the calories (kcal)");
    case "duplicate":
      return tr("มีวัตถุดิบชื่อและสถานะนี้อยู่แล้ว — กด “แก้” ที่รายการเดิมได้เลย", "You already have this name and state — tap “Edit” on the existing one");
    default:
      return tr("ตัวเลขบางช่องไม่ถูกต้อง", "One of the numbers isn't valid");
  }
}
