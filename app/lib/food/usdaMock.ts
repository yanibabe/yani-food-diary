// Round 41: fake USDA answers for tests and `USDA_MOCK=1` (no key, no network).
// Shapes copy real USDA answers (search hits: nutrientId/unitName "KCAL"/value;
// details: nutrient.{id,unitName:"kcal"}/amount). Values are USDA's published ones, rounded.

type N = [id: number, unit: string, value: number];
const hit = (fdcId: number, dataType: string, description: string, n: N[], extra: Record<string, unknown> = {}) => ({
  fdcId,
  dataType,
  description,
  foodNutrients: n.map(([nutrientId, unitName, value]) => ({ nutrientId, unitName, value })),
  ...extra,
});

/** A small "USDA" to search in. */
export const MOCK_FOODS = [
  hit(2646170, "Foundation", "Chicken, breast, boneless, skinless, raw", [[2047, "KCAL", 106], [2048, "KCAL", 112], [1003, "G", 22.5], [1004, "G", 1.93], [1005, "G", 0]]),
  hit(2727569, "Foundation", "Chicken, breast, meat and skin, raw", [[2048, "KCAL", 155], [1003, "G", 21.2], [1004, "G", 7.8]]),
  hit(171477, "SR Legacy", "Chicken, broilers or fryers, breast, meat only, cooked, roasted", [[1008, "KCAL", 165], [1003, "G", 31], [1004, "G", 3.57], [1005, "G", 0]]),
  hit(171478, "SR Legacy", "Chicken, broilers or fryers, breast, meat only, cooked, fried", [[1008, "KCAL", 187], [1003, "G", 33.4], [1004, "G", 4.71], [1005, "G", 0.51]]),
  hit(2705955, "Survey (FNDDS)", "Chicken breast, baked, broiled, or roasted, skin eaten, from raw", [[1008, "KCAL", 196], [1003, "G", 29.6], [1004, "G", 7.72], [1005, "G", 0]]),
  hit(2705956, "Survey (FNDDS)", "Chicken breast, baked, broiled, or roasted, skin not eaten, from raw", [[1008, "KCAL", 157], [1003, "G", 32], [1004, "G", 3.1], [1005, "G", 0]]),
  hit(171140, "SR Legacy", "Chicken, broilers or fryers, thigh, meat only, raw", [[1008, "KCAL", 120], [1003, "G", 19.7], [1004, "G", 4.12], [1005, "G", 0]]),
  hit(169756, "SR Legacy", "Rice, white, long-grain, regular, raw, enriched", [[1008, "KCAL", 365], [1003, "G", 7.13], [1004, "G", 0.66], [1005, "G", 80]]),
  hit(169757, "SR Legacy", "Rice, white, long-grain, regular, enriched, cooked", [[1008, "KCAL", 130], [1003, "G", 2.69], [1004, "G", 0.28], [1005, "G", 28.2]]),
  hit(2708990, "Survey (FNDDS)", "Beans and white rice", [[1008, "KCAL", 164], [1003, "G", 6.5], [1004, "G", 4.21], [1005, "G", 25.19]]),
  hit(174531, "SR Legacy", "Sauce, oyster, ready-to-serve", [[1008, "KCAL", 51], [1003, "G", 1.35], [1004, "G", 0.25], [1005, "G", 10.9]]),
  hit(171413, "SR Legacy", "Oil, vegetable, soybean, refined", [[1008, "KCAL", 884], [1003, "G", 0], [1004, "G", 100], [1005, "G", 0]]),
  hit(171881, "SR Legacy", "Beverages, water, tap, drinking", [[1008, "KCAL", 0], [1003, "G", 0], [1004, "G", 0], [1005, "G", 0]]),
  // A food with no fat value given (missing ≠ 0).
  hit(999001, "SR Legacy", "Seaweed, laver, raw", [[1008, "KCAL", 35], [1003, "G", 5.81], [1005, "G", 5.11]]),
  hit(555001, "Branded", "GREEK YOGURT, PLAIN", [[1008, "KCAL", 59], [1003, "G", 10.3], [1004, "G", 0.4], [1005, "G", 3.6]], { brandName: "SAMPLE FARM", servingSizeUnit: "g" }),
];

/** Details (with household measures) for a few foods. Others answer from the search shape. */
const PORTIONS: Record<number, unknown[]> = {
  169757: [{ gramWeight: 158, amount: 1, measureUnit: { name: "cup" }, modifier: "" }],
  169756: [{ gramWeight: 185, amount: 1, measureUnit: { name: "cup" }, modifier: "" }],
  174531: [{ gramWeight: 18, amount: 1, measureUnit: { name: "tbsp" }, modifier: "" }],
  171413: [{ gramWeight: 13.6, amount: 1, measureUnit: { name: "tbsp" }, modifier: "" }],
  2646170: [{ gramWeight: 114, amount: 1, measureUnit: { name: "RACC" } }],
};

const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1);

/** A fake `fetch` that answers like USDA. `fail` makes it answer with that HTTP status (or "network"/"timeout"). */
export function mockUsdaFetch(opts: { fail?: number | "network" | "timeout"; calls?: string[] } = {}): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    opts.calls?.push(u);
    if (opts.fail === "network") throw new TypeError("fetch failed");
    if (opts.fail === "timeout") {
      await new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    }
    if (typeof opts.fail === "number") return new Response(JSON.stringify({ error: { code: "X" } }), { status: opts.fail });
    const detail = u.match(/\/v1\/food\/(\d+)/);
    if (detail) {
      const f = MOCK_FOODS.find((x) => x.fdcId === Number(detail[1]));
      if (!f) return new Response("{}", { status: 404 });
      return Response.json({
        fdcId: f.fdcId,
        dataType: f.dataType,
        description: f.description,
        foodNutrients: f.foodNutrients.map((n) => ({ nutrient: { id: n.nutrientId, unitName: n.unitName.toLowerCase() }, amount: n.value })),
        foodPortions: PORTIONS[f.fdcId] ?? [],
        ...(f.dataType === "Branded" ? { brandName: (f as Record<string, unknown>).brandName, servingSizeUnit: "g" } : {}),
      });
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string; dataType?: string[] };
    const q = words(body.query ?? "").filter((w) => !["raw", "cooked", "white", "skinless", "fried", "boiled", "meat", "and", "skin", "tap", "whole"].includes(w));
    const foods = MOCK_FOODS.filter((f) => (body.dataType ?? []).includes(f.dataType) && q.some((w) => words(f.description).some((d) => d.startsWith(w.replace(/s$/, "")))));
    return Response.json({ totalHits: foods.length, foods });
  }) as typeof fetch;
}
