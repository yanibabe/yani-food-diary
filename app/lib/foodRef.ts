// A small built-in table of common ingredients ("internal reference values").
// Used ONLY when there are no label values and no AI value saved for that name.
// Values are rough per-100 g typical values (Thai and USDA food composition tables),
// so the app always marks them as "reference" + "estimated". Label values always win.
//
// Round 39: matching is careful now. The old version picked any food whose word was
// INSIDE the name, so "น้ำมันหอย" (oyster sauce) became cooking oil, "ข้าวสาร" (raw rice)
// became cooked rice, "นมข้นหวาน" became plain milk, "ไข่ขาว" became a whole egg and
// "กุ้งแห้ง" became fresh shrimp. Now:
//   1. The longest matching name wins (so "น้ำมันหอย" beats "น้ำมัน").
//   2. A match counts only if nothing else is left in the name (apart from words that agree
//      with the food's state, like "สด" for a raw food). "อกไก่ทอด" is NOT plain raw chicken breast.
//   3. Unclear words ("ข้าว", "ไก่", "นม", "ไข่", "กุ้ง", "หมู") never pick a food by themselves:
//      the app shows the choices and she picks (or lets the AI look it up).
//   4. English words must be whole words ("egg" does not match "eggplant").
// Existing foods keep their old numbers, so saved recipes that used them don't change.

import type { L } from "./i18n.ts";
import type { FoodState } from "./types.ts";

export type RefFood = {
  key: string;
  /** Name shown when she has to choose. */
  label: L;
  /** Thai + English names that mean exactly this food. */
  names: string[];
  per100: { kcal: number; protein: number; carbs: number; fat: number };
  /** The state these values are for. Missing = not relevant (sauces, oil, sugar…). */
  state?: FoodState;
  /** Foods in the same group are offered together when the name is unclear. */
  group?: string;
  /** grams in 1 egg / 1 piece, if that makes sense for this food */
  unitG?: number;
  /** grams in 1 ml (density). Missing = unknown: the app asks instead of assuming 1. */
  gPerMl?: number;
};

export const FOOD_REF: RefFood[] = [
  // ---- eggs ----
  { key: "egg", group: "egg", state: "raw", label: { th: "ไข่ไก่ (ทั้งฟอง)", en: "egg" }, names: ["ไข่ไก่", "ไข่ไก่สด", "egg", "eggs", "chicken egg", "whole egg"], per100: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, unitG: 50 },
  { key: "egg-white", group: "egg", state: "raw", label: { th: "ไข่ขาว", en: "egg white" }, names: ["ไข่ขาว", "egg white", "egg whites"], per100: { kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2 }, unitG: 33 },
  { key: "egg-yolk", group: "egg", state: "raw", label: { th: "ไข่แดง", en: "egg yolk" }, names: ["ไข่แดง", "egg yolk", "egg yolks"], per100: { kcal: 322, protein: 15.9, carbs: 3.6, fat: 26.5 }, unitG: 17 },
  { key: "naem", label: { th: "แหนม", en: "naem (fermented pork)" }, names: ["แหนม", "naem"], per100: { kcal: 185, protein: 18.5, carbs: 4.5, fat: 10 } },

  // ---- fats, sauces, sugar ----
  { key: "oil", label: { th: "น้ำมันพืช", en: "vegetable oil" }, names: ["น้ำมันพืช", "น้ำมัน", "น้ำมันถั่วเหลือง", "น้ำมันปาล์ม", "น้ำมันรำข้าว", "น้ำมันมะกอก", "vegetable oil", "cooking oil", "oil", "olive oil", "soybean oil", "palm oil"], per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 }, gPerMl: 0.92 },
  { key: "butter", label: { th: "เนย", en: "butter" }, names: ["เนย", "เนยจืด", "เนยเค็ม", "butter"], per100: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 }, gPerMl: 0.91 },
  { key: "fish-sauce", label: { th: "น้ำปลา", en: "fish sauce" }, names: ["น้ำปลา", "fish sauce"], per100: { kcal: 35, protein: 5, carbs: 3.6, fat: 0 }, gPerMl: 1.2 },
  { key: "soy-sauce", label: { th: "ซีอิ๊วขาว", en: "light soy sauce" }, names: ["ซีอิ๊วขาว", "ซีอิ๊ว", "soy sauce", "light soy sauce"], per100: { kcal: 53, protein: 8, carbs: 5, fat: 0.6 }, gPerMl: 1.2 },
  { key: "oyster-sauce", label: { th: "ซอสหอยนางรม (น้ำมันหอย)", en: "oyster sauce" }, names: ["ซอสหอยนางรม", "น้ำมันหอย", "oyster sauce"], per100: { kcal: 51, protein: 1.4, carbs: 11, fat: 0.3 }, gPerMl: 1.2 },
  { key: "sugar", label: { th: "น้ำตาลทราย", en: "sugar" }, names: ["น้ำตาล", "น้ำตาลทราย", "น้ำตาลทรายขาว", "sugar", "white sugar", "granulated sugar"], per100: { kcal: 387, protein: 0, carbs: 100, fat: 0 }, gPerMl: 0.85 },

  // ---- rice ----
  { key: "rice", group: "rice", state: "cooked", label: { th: "ข้าวสวย (หุงสุกแล้ว)", en: "cooked white rice" }, names: ["ข้าวสวย", "ข้าวสุก", "ข้าวหุงสุก", "cooked rice", "steamed rice", "cooked white rice"], per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { key: "rice-raw", group: "rice", state: "raw", label: { th: "ข้าวสาร (ยังไม่หุง)", en: "uncooked white rice" }, names: ["ข้าวสาร", "ข้าวสารดิบ", "ข้าวดิบ", "uncooked rice", "raw rice", "dry rice", "uncooked white rice"], per100: { kcal: 360, protein: 6.6, carbs: 79, fat: 0.6 }, gPerMl: 0.85 },

  // ---- chicken (raw) ----
  { key: "chicken-breast", group: "chicken", state: "raw", label: { th: "อกไก่ ไม่ติดหนัง", en: "chicken breast, skinless" }, names: ["อกไก่", "อกไก่ไม่ติดหนัง", "อกไก่ไม่มีหนัง", "chicken breast", "skinless chicken breast", "chicken breast skinless"], per100: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 } },
  { key: "chicken-breast-skin", group: "chicken", state: "raw", label: { th: "อกไก่ ติดหนัง", en: "chicken breast with skin" }, names: ["อกไก่ติดหนัง", "chicken breast with skin"], per100: { kcal: 172, protein: 20.9, carbs: 0, fat: 9.3 } },
  { key: "chicken-thigh", group: "chicken", state: "raw", label: { th: "สะโพกไก่ ไม่ติดหนัง", en: "chicken thigh, skinless" }, names: ["สะโพกไก่ไม่ติดหนัง", "สะโพกไก่ไม่มีหนัง", "skinless chicken thigh", "chicken thigh skinless"], per100: { kcal: 121, protein: 19.7, carbs: 0, fat: 4.1 } },
  { key: "chicken-thigh-skin", group: "chicken", state: "raw", label: { th: "สะโพกไก่ ติดหนัง", en: "chicken thigh with skin" }, names: ["สะโพกไก่ติดหนัง", "chicken thigh with skin"], per100: { kcal: 221, protein: 15.5, carbs: 0, fat: 17 } },
  { key: "chicken-drumstick", group: "chicken", state: "raw", label: { th: "น่องไก่ (ติดหนัง)", en: "chicken drumstick (with skin)" }, names: ["น่องไก่", "chicken drumstick", "drumstick"], per100: { kcal: 161, protein: 18.1, carbs: 0, fat: 9.2 } },
  { key: "chicken-wing", group: "chicken", state: "raw", label: { th: "ปีกไก่ (ติดหนัง)", en: "chicken wing (with skin)" }, names: ["ปีกไก่", "chicken wing", "chicken wings"], per100: { kcal: 222, protein: 18.3, carbs: 0, fat: 16 } },

  // ---- pork (raw) ----
  { key: "pork-minced", group: "pork", state: "raw", label: { th: "หมูสับ", en: "minced pork" }, names: ["หมูสับ", "หมูบด", "minced pork", "ground pork"], per100: { kcal: 240, protein: 17, carbs: 0, fat: 19 } },
  { key: "pork-tenderloin", group: "pork", state: "raw", label: { th: "สันในหมู", en: "pork tenderloin" }, names: ["สันในหมู", "หมูสันใน", "pork tenderloin"], per100: { kcal: 120, protein: 21, carbs: 0, fat: 3.5 } },
  { key: "pork-belly", group: "pork", state: "raw", label: { th: "หมูสามชั้น", en: "pork belly" }, names: ["หมูสามชั้น", "pork belly"], per100: { kcal: 518, protein: 9.3, carbs: 0, fat: 53 } },

  // ---- shrimp ----
  { key: "shrimp", group: "shrimp", state: "raw", label: { th: "กุ้งสด", en: "fresh shrimp" }, names: ["กุ้งสด", "กุ้งขาว", "fresh shrimp", "raw shrimp", "prawn", "prawns"], per100: { kcal: 85, protein: 20, carbs: 0, fat: 0.5 } },
  { key: "dried-shrimp", group: "shrimp", state: "dried", label: { th: "กุ้งแห้ง", en: "dried shrimp" }, names: ["กุ้งแห้ง", "dried shrimp"], per100: { kcal: 280, protein: 60, carbs: 2, fat: 3 } },

  // ---- tofu, milks ----
  { key: "tofu", label: { th: "เต้าหู้", en: "tofu" }, names: ["เต้าหู้", "tofu"], per100: { kcal: 76, protein: 8, carbs: 1.9, fat: 4.8 } },
  { key: "milk", group: "milk", label: { th: "นมวัวรสจืด", en: "plain cow's milk" }, names: ["นมจืด", "นมวัว", "นมสด", "นมสดรสจืด", "fresh milk", "cow milk", "cow's milk", "whole milk"], per100: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }, gPerMl: 1.03 },
  { key: "soy-milk-unsweet", group: "milk", label: { th: "นมถั่วเหลือง ไม่หวาน", en: "soy milk, unsweetened" }, names: ["นมถั่วเหลืองไม่หวาน", "นมถั่วเหลืองสูตรไม่หวาน", "unsweetened soy milk", "soy milk unsweetened"], per100: { kcal: 33, protein: 2.9, carbs: 1.7, fat: 1.6 }, gPerMl: 1.03 },
  { key: "soy-milk-sweet", group: "milk", label: { th: "นมถั่วเหลือง หวาน", en: "soy milk, sweetened" }, names: ["นมถั่วเหลืองหวาน", "นมถั่วเหลืองสูตรหวาน", "sweetened soy milk"], per100: { kcal: 54, protein: 3.3, carbs: 6.3, fat: 1.8 }, gPerMl: 1.03 },
  { key: "condensed-milk", group: "milk", label: { th: "นมข้นหวาน", en: "sweetened condensed milk" }, names: ["นมข้นหวาน", "sweetened condensed milk", "condensed milk"], per100: { kcal: 321, protein: 7.9, carbs: 54.4, fat: 8.7 }, gPerMl: 1.3 },
  { key: "evaporated-milk", group: "milk", label: { th: "นมข้นจืด", en: "evaporated milk" }, names: ["นมข้นจืด", "นมระเหย", "evaporated milk"], per100: { kcal: 134, protein: 6.8, carbs: 10, fat: 7.6 }, gPerMl: 1.07 },
  { key: "coconut-milk", group: "milk", label: { th: "กะทิ", en: "coconut milk" }, names: ["กะทิ", "หัวกะทิ", "นมมะพร้าว", "coconut milk"], per100: { kcal: 230, protein: 2.3, carbs: 5.5, fat: 23.8 }, gPerMl: 0.98 },

  // ---- vegetables, bread, fruit ----
  { key: "onion", label: { th: "หอมใหญ่", en: "onion" }, names: ["หอมใหญ่", "onion"], per100: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } },
  { key: "spring-onion", label: { th: "ต้นหอม", en: "spring onion" }, names: ["ต้นหอม", "spring onion", "green onion", "scallion"], per100: { kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2 } },
  { key: "garlic", label: { th: "กระเทียม", en: "garlic" }, names: ["กระเทียม", "garlic"], per100: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5 } },
  { key: "vegetables", label: { th: "ผักรวม", en: "mixed vegetables" }, names: ["ผักรวม", "ผัก", "vegetables", "mixed vegetables"], per100: { kcal: 25, protein: 1.5, carbs: 5, fat: 0.2 } },
  { key: "bread", label: { th: "ขนมปัง", en: "bread" }, names: ["ขนมปัง", "bread"], per100: { kcal: 250, protein: 10, carbs: 43, fat: 3.5 }, unitG: 30 },
  { key: "banana", label: { th: "กล้วยหอม", en: "banana" }, names: ["กล้วยหอม", "กล้วย", "banana"], per100: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 }, unitG: 120 },
];

/**
 * Unclear words. On their own they never pick a food: she chooses.
 * `not`: if the name has one of these, the word means something else (no match from this group),
 * e.g. "ข้าวโพด" is corn and "ขนม" is a snack, not milk.
 */
const UNCLEAR: { names: string[]; options: string[]; not?: string[] }[] = [
  { names: ["ข้าว", "rice", "white rice"], options: ["rice", "rice-raw"], not: ["ข้าวโพด", "ข้าวโอ๊ต", "ข้าวเหนียว", "ข้าวกล้อง", "ข้าวไรซ์เบอร์รี่", "ข้าวเกรียบ", "ข้าวตัง", "ข้าวเม่า", "ข้าวผัด", "ข้าวมัน", "ข้าวต้ม", "ข้าวหมก", "แป้ง", "rice noodle", "rice noodles", "rice flour", "rice vinegar", "rice paper", "brown rice", "fried rice", "rice cracker", "sticky rice", "glutinous rice"] },
  { names: ["ไก่", "chicken"], options: ["chicken-breast", "chicken-breast-skin", "chicken-thigh", "chicken-thigh-skin", "chicken-drumstick", "chicken-wing"], not: ["ซุปไก่", "chicken stock", "chicken broth", "chicken soup"] },
  { names: ["สะโพกไก่", "chicken thigh", "chicken thighs"], options: ["chicken-thigh", "chicken-thigh-skin"] },
  { names: ["หมู", "pork"], options: ["pork-minced", "pork-tenderloin", "pork-belly"], not: ["หมูยอ", "หมูแผ่น", "หมูหยอง", "หมูแดดเดียว", "กุนเชียง", "pork floss", "pork sausage"] },
  { names: ["ไข่", "ไข่สด"], options: ["egg", "egg-white", "egg-yolk"], not: ["ไข่เค็ม", "ไข่เยี่ยวม้า", "ไข่นกกระทา", "ไข่เป็ด", "ไข่มุก"] },
  { names: ["กุ้ง", "shrimp"], options: ["shrimp", "dried-shrimp"], not: ["กะปิ", "shrimp paste"] },
  { names: ["นม", "milk"], options: ["milk", "soy-milk-unsweet", "soy-milk-sweet", "condensed-milk", "evaporated-milk", "coconut-milk"], not: ["ขนม", "นมเปรี้ยว", "นมผง", "นมอัลมอนด์", "นมโอ๊ต", "นมข้าวโพด", "ชานม", "นมชมพู", "almond milk", "oat milk", "milk powder", "milk tea", "buttermilk"] },
  { names: ["นมถั่วเหลือง", "น้ำเต้าหู้", "soy milk", "soymilk"], options: ["soy-milk-unsweet", "soy-milk-sweet"] },
];

export const STATE_LABEL: Record<FoodState, L> = {
  raw: { th: "ดิบ", en: "raw" },
  cooked: { th: "สุก", en: "cooked" },
  dried: { th: "แห้ง", en: "dried" },
  prepared: { th: "ปรุงแล้ว", en: "prepared" },
};

/** Words that say the state. Thai has no spaces, so these are found inside the name. */
const STATE_WORDS: Record<FoodState, string[]> = {
  raw: ["ดิบ", "สด", "raw", "fresh", "uncooked"],
  cooked: ["สุก", "ต้ม", "นึ่ง", "ทอด", "ย่าง", "ผัด", "อบ", "ลวก", "cooked", "boiled", "steamed", "fried", "grilled", "roasted", "baked"],
  dried: ["อบแห้ง", "แห้ง", "dried", "dry"],
  prepared: [],
};
/** Words that change nothing. */
const NEUTRAL = ["ทั่วไป", "plain"];

const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Lower case, punctuation → space, one space between words. */
export function normalizeName(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[,.;:()[\]{}/\\_\-–—"!?+*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Where `alias` sits in `n`, or -1. English words must be whole words ("egg" ≠ "eggplant"). */
function findAlias(n: string, alias: string): number {
  if (!alias) return -1;
  if (!isAscii(alias)) return n.indexOf(alias);
  const m = new RegExp(`(^|[^a-z'])${escape(alias)}(?=[^a-z']|$)`).exec(n);
  return m ? m.index + m[1].length : -1;
}

/** The state a name talks about, if any ("ข้าวสวย" says nothing; "อกไก่ทอด" says cooked). */
export function stateInName(name: string): FoodState | null {
  const n = normalizeName(name);
  for (const st of ["dried", "cooked", "raw"] as const) if (STATE_WORDS[st].some((w) => findAlias(n, w) >= 0)) return st;
  return null;
}

/** After the matched name is taken out, is anything meaningful left? */
function leftover(rest: string, food: RefFood): string {
  let r = rest;
  const okWords = [...NEUTRAL, ...(food.state ? STATE_WORDS[food.state] : [])].sort((a, b) => b.length - a.length);
  for (const w of okWords) {
    const at = findAlias(r, w);
    if (at >= 0) r = r.slice(0, at) + " " + r.slice(at + w.length);
  }
  return r.replace(/\s+/g, " ").trim();
}

export type RefMatch =
  | { kind: "exact"; food: RefFood }
  /** Unclear: show these choices (or let the AI look it up). Never picked by itself. */
  | { kind: "ask"; options: RefFood[] }
  | { kind: "none" };

export function refByKey(key: string): RefFood | null {
  return FOOD_REF.find((f) => f.key === key) ?? null;
}

/** Match an ingredient name to the reference table, carefully (see the notes at the top). */
export function matchRef(name: string): RefMatch {
  const n = normalizeName(name);
  if (!n) return { kind: "none" };

  // The longest matching name wins: a food's own name, or an unclear word.
  let best: { len: number; at: number; text: string; food?: RefFood; unclear?: (typeof UNCLEAR)[number] } | null = null;
  for (const f of FOOD_REF)
    for (const w of f.names) {
      const a = normalizeName(w);
      const at = findAlias(n, a);
      if (at >= 0 && (!best || a.length > best.len)) best = { len: a.length, at, text: a, food: f };
    }
  for (const u of UNCLEAR) {
    if (u.not?.some((x) => findAlias(n, normalizeName(x)) >= 0)) continue;
    for (const w of u.names) {
      const a = normalizeName(w);
      const at = findAlias(n, a);
      if (at >= 0 && (!best || a.length > best.len)) best = { len: a.length, at, text: a, unclear: u };
    }
  }
  if (!best) return { kind: "none" };

  if (best.unclear) {
    const options = best.unclear.options.map(refByKey).filter((f): f is RefFood => !!f);
    return { kind: "ask", options };
  }

  const food = best.food!;
  const rest = n.slice(0, best.at) + " " + n.slice(best.at + best.text.length);
  if (!leftover(rest, food)) return { kind: "exact", food };
  // Something else is in the name ("อกไก่ทอด", "ซีอิ๊วดำ", "เนยถั่ว"): offer it, never pick it.
  const options = food.group ? [food, ...FOOD_REF.filter((f) => f.group === food.group && f !== food)] : [food];
  return { kind: "ask", options };
}

/** Only a clear, exact match (older code used this). */
export function findRef(name: string): RefFood | null {
  const m = matchRef(name);
  return m.kind === "exact" ? m.food : null;
}
