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

/**
 * Grams in a serving text like "15 g", "30g (2 biscuits)" or, for drinks, "325 mL".
 * Drinks count 1 mL as about 1 g (close enough for water, soda, juice, milk).
 * null if no size is found.
 */
export function servingGrams(serving: string | null): number | null {
  if (!serving) return null;
  const m = serving.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(g|ml|cl|l)(?![a-z])/i);
  if (!m) return null;
  const perUnit: Record<string, number> = { g: 1, ml: 1, cl: 10, l: 1000 };
  const n = Number(m[1]) * perUnit[m[2].toLowerCase()];
  return n > 0 && n < 5000 ? Math.round(n * 10) / 10 : null;
}

/** True if the serving size is written as a drink amount (mL / cL / L). */
export function servingIsLiquid(serving: string | null): boolean {
  return /\d\s*(ml|cl|l)(?![a-z])/i.test(serving ?? "");
}

/**
 * Every shop barcode (EAN-8, UPC-A, EAN-13, GTIN-14) ends with a check digit.
 * True if the last digit matches the others, so a misread number is caught.
 */
export function barcodeCheckOk(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}
