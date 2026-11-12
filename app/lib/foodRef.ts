// A small built-in table of common ingredients, used ONLY when the user
// has not typed values from a label. Values are rough per-100 g averages
// (Thai and USDA food composition tables), so the app always marks them as
// "estimate". Label values always win.

export type RefFood = {
  key: string;
  names: string[]; // Thai + English words to match
  per100: { kcal: number; protein: number; carbs: number; fat: number };
  /** grams in 1 egg / 1 piece, if that makes sense for this food */
  unitG?: number;
  /** grams in 1 ml (density). Default 1. */
  gPerMl?: number;
};

export const FOOD_REF: RefFood[] = [
  { key: "egg", names: ["ไข่ไก่", "ไข่", "egg"], per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, unitG: 50 },
  { key: "naem", names: ["แหนม", "naem"], per100: { kcal: 185, protein: 18.5, carbs: 4.5, fat: 10 } },
  { key: "oil", names: ["น้ำมันพืช", "น้ำมัน", "oil"], per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 }, gPerMl: 0.92 },
  { key: "butter", names: ["เนย", "butter"], per100: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 } },
  { key: "rice", names: ["ข้าวสวย", "ข้าว", "rice"], per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { key: "chicken-breast", names: ["อกไก่", "ไก่", "chicken"], per100: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 } },
  { key: "pork-minced", names: ["หมูสับ", "หมู", "pork"], per100: { kcal: 240, protein: 17, carbs: 0, fat: 19 } },
  { key: "shrimp", names: ["กุ้ง", "shrimp"], per100: { kcal: 85, protein: 20, carbs: 0, fat: 0.5 } },
  { key: "tofu", names: ["เต้าหู้", "tofu"], per100: { kcal: 76, protein: 8, carbs: 1.9, fat: 4.8 } },
  { key: "milk", names: ["นมจืด", "นม", "milk"], per100: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }, gPerMl: 1.03 },
  { key: "fish-sauce", names: ["น้ำปลา", "fish sauce"], per100: { kcal: 35, protein: 5, carbs: 3.6, fat: 0 }, gPerMl: 1.2 },
  { key: "soy-sauce", names: ["ซีอิ๊วขาว", "ซีอิ๊ว", "soy sauce"], per100: { kcal: 53, protein: 8, carbs: 5, fat: 0.6 }, gPerMl: 1.2 },
  { key: "oyster-sauce", names: ["ซอสหอยนางรม", "oyster sauce"], per100: { kcal: 51, protein: 1.4, carbs: 11, fat: 0.3 }, gPerMl: 1.2 },
  { key: "sugar", names: ["น้ำตาล", "sugar"], per100: { kcal: 387, protein: 0, carbs: 100, fat: 0 } },
  { key: "onion", names: ["หอมใหญ่", "onion"], per100: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } },
  { key: "spring-onion", names: ["ต้นหอม", "spring onion"], per100: { kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2 } },
  { key: "garlic", names: ["กระเทียม", "garlic"], per100: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5 } },
  { key: "vegetables", names: ["ผักรวม", "ผัก", "vegetables"], per100: { kcal: 25, protein: 1.5, carbs: 5, fat: 0.2 } },
  { key: "bread", names: ["ขนมปัง", "bread"], per100: { kcal: 250, protein: 10, carbs: 43, fat: 3.5 }, unitG: 30 },
  { key: "banana", names: ["กล้วยหอม", "กล้วย", "banana"], per100: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 }, unitG: 120 },
];

/** Find the best match for an ingredient name (longest matching word wins). */
export function findRef(name: string): RefFood | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  let best: RefFood | null = null;
  let bestLen = 0;
  for (const f of FOOD_REF) {
    for (const w of f.names) {
      const wl = w.toLowerCase();
      if (n.includes(wl) && wl.length > bestLen) {
        best = f;
        bestLen = wl.length;
      }
    }
  }
  return best;
}
