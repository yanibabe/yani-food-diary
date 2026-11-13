// One shape for every outside food database (Open Food Facts now; USDA FoodData
// Central and FatSecret later). Each database gets its own provider class that
// turns its answers into a `Food`. The rest of the app only sees `Food`.

export type FoodSource = "off" | "usda" | "fatsecret";

/** A food from an outside database. Nutrients are per 100 g; null = the database didn't say. */
export type Food = {
  source: FoodSource;
  /** The id inside that database (for Open Food Facts this is the barcode). */
  sourceId: string;
  name: string | null;
  brand: string | null;
  /** As the database wrote it, e.g. "15 g" or "1 cup (240 ml)". */
  servingSize: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export interface FoodProvider {
  readonly source: FoodSource;
  /** null = no food with this barcode in this database. Throws only on real failures. */
  getByBarcode(barcode: string): Promise<Food | null>;
  /** null = no food with this id in this database. */
  getById(id: string): Promise<Food | null>;
}

/**
 * May a meal keep a copy of this source's numbers (a snapshot)?
 * Open Food Facts: yes (ODbL). USDA: yes (public domain).
 * FatSecret: no until its terms are checked when it is added.
 */
export const SNAPSHOT_ALLOWED: Record<FoodSource, boolean> = {
  off: true,
  usda: true,
  fatsecret: false,
};

/** Keep only the digits. Returns null unless it is 8–14 digits long (EAN-8 … GTIN-14). */
export function cleanBarcode(input: string): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/** Grams in a serving text like "15 g" or "30g (2 biscuits)". null if it isn't in grams. */
export function servingGrams(serving: string | null): number | null {
  if (!serving) return null;
  const m = serving.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 5000 ? n : null;
}
