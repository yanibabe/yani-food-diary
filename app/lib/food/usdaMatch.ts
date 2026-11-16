// Round 41: careful matching between her food name (Thai or English) and USDA foods. Pure functions only.
//
// 1. Her name → an English USDA search, from a SAFE Thai→English word list (longest words first,
//    so "น้ำมันหอย" = oyster sauce, never oil). Words not in the list → the server may ask the AI to
//    translate the NAME only (never her profile or diary).
// 2. Each USDA result is checked against what her name says: raw vs cooked, how it was cooked
//    (boiled / fried / baked…), the meat cut, skin on vs skinless, and the main food words.
//    Anything that differs is listed as a "difference" and shown to her.
// 3. NOTHING is ever picked by itself. She always confirms one result (or picks another, or none).

import type { FoodState } from "../types.ts";
import type { UsdaFood } from "./usdaNutrients.ts";

/** Thai (or common English) words → USDA's English words. Longest match wins. */
export const USDA_ALIASES: [string, string][] = [
  // rice: raw (dry) and cooked are very different per 100 g
  ["ข้าวสวย", "rice white cooked"],
  ["ข้าวสุก", "rice white cooked"],
  ["ข้าวหุงสุก", "rice white cooked"],
  ["ข้าวสาร", "rice white raw"],
  ["ข้าวสารดิบ", "rice white raw"],
  ["ข้าวดิบ", "rice white raw"],
  ["ข้าวกล้อง", "rice brown"],
  ["ข้าวเหนียว", "rice glutinous"],
  ["ข้าวโอ๊ต", "oats"],
  ["ข้าวโพด", "corn sweet yellow"],
  ["ข้าว", "rice white"],
  // chicken: cut + skin matter
  ["อกไก่ไม่ติดหนัง", "chicken breast skinless"],
  ["อกไก่ไม่มีหนัง", "chicken breast skinless"],
  ["อกไก่ติดหนัง", "chicken breast meat and skin"],
  ["อกไก่", "chicken breast"],
  ["สะโพกไก่ไม่ติดหนัง", "chicken thigh skinless"],
  ["สะโพกไก่ติดหนัง", "chicken thigh meat and skin"],
  ["สะโพกไก่", "chicken thigh"],
  ["น่องไก่", "chicken drumstick"],
  ["ปีกไก่", "chicken wing"],
  ["ไก่", "chicken"],
  // pork, beef, fish, seafood
  ["หมูสับ", "pork ground"],
  ["หมูบด", "pork ground"],
  ["สันในหมู", "pork tenderloin"],
  ["หมูสันใน", "pork tenderloin"],
  ["สันนอกหมู", "pork loin"],
  ["หมูสามชั้น", "pork belly"],
  ["หมู", "pork"],
  ["เนื้อวัวบด", "beef ground"],
  ["เนื้อวัว", "beef"],
  ["เนื้อบด", "beef ground"],
  ["แซลมอน", "salmon atlantic"],
  ["ปลาทูน่า", "tuna"],
  ["ปลานิล", "tilapia"],
  ["ปลา", "fish"],
  ["กุ้งแห้ง", "shrimp dried"],
  ["กุ้ง", "shrimp"],
  ["ปลาหมึก", "squid"],
  // eggs, dairy, tofu
  ["ไข่ขาว", "egg white"],
  ["ไข่แดง", "egg yolk"],
  ["ไข่ไก่", "egg whole"],
  ["ไข่", "egg whole"],
  ["นมข้นหวาน", "milk condensed sweetened"],
  ["นมข้นจืด", "milk evaporated"],
  ["นมถั่วเหลือง", "soymilk"],
  ["น้ำเต้าหู้", "soymilk"],
  ["นมจืด", "milk whole"],
  ["นมสด", "milk whole"],
  ["นมวัว", "milk whole"],
  ["โยเกิร์ต", "yogurt plain"],
  ["ชีส", "cheese"],
  ["เต้าหู้", "tofu"],
  ["กะทิ", "coconut milk"],
  // fats and sauces (oyster sauce ≠ oil)
  ["น้ำมันหอย", "oyster sauce"],
  ["ซอสหอยนางรม", "oyster sauce"],
  ["น้ำมันมะกอก", "oil olive"],
  ["น้ำมันพืช", "oil vegetable"],
  ["น้ำมันถั่วเหลือง", "oil soybean"],
  ["น้ำมันปาล์ม", "oil palm"],
  ["น้ำมันรำข้าว", "oil rice bran"],
  ["น้ำมัน", "oil vegetable"],
  ["เนยถั่ว", "peanut butter"],
  ["เนย", "butter"],
  ["น้ำปลา", "fish sauce"],
  ["ซีอิ๊วขาว", "soy sauce"],
  ["ซีอิ๊วดำ", "soy sauce dark"],
  ["ซีอิ๊ว", "soy sauce"],
  ["น้ำตาลทราย", "sugar granulated"],
  ["น้ำตาล", "sugar granulated"],
  ["น้ำผึ้ง", "honey"],
  // water (0 kcal)
  ["น้ำเปล่า", "water tap"],
  ["น้ำดื่ม", "water bottled"],
  // vegetables, fruit, starches
  ["มันฝรั่ง", "potato"],
  ["มันเทศ", "sweet potato"],
  ["ฟักทอง", "pumpkin"],
  ["ฟักเขียว", "waxgourd"],
  ["มะระ", "balsam pear bitter gourd"],
  ["ถั่วฝักยาว", "yardlong bean"],
  ["บรอกโคลี", "broccoli"],
  ["บร็อคโคลี่", "broccoli"],
  ["แครอท", "carrot"],
  ["กะหล่ำปลี", "cabbage"],
  ["ผักบุ้ง", "water spinach"],
  ["คะน้า", "chinese broccoli"],
  ["มะเขือเทศ", "tomato red"],
  ["แตงกวา", "cucumber"],
  ["หอมใหญ่", "onion"],
  ["กระเทียม", "garlic"],
  ["ถั่วลิสง", "peanuts"],
  ["อัลมอนด์", "almonds"],
  ["อะโวคาโด", "avocado"],
  ["กล้วยหอม", "banana"],
  ["กล้วย", "banana"],
  ["มะม่วง", "mango"],
  ["สับปะรด", "pineapple"],
  ["แตงโม", "watermelon"],
  ["มะละกอ", "papaya"],
  ["แอปเปิ้ล", "apple"],
  ["ส้ม", "orange"],
  ["ขนมปังโฮลวีต", "bread whole wheat"],
  ["ขนมปัง", "bread white"],
  ["เส้นหมี่", "rice noodles"],
  ["เส้นใหญ่", "rice noodles"],
  ["วุ้นเส้น", "noodles cellophane"],
  ["บะหมี่", "egg noodles"],
  ["พาสต้า", "pasta"],
  ["สปาเกตตี", "spaghetti"],
];

/** How it was prepared. Each Thai word → the USDA words that mean it. */
const METHODS: { key: Method; th: string[]; en: string[]; label: { th: string; en: string } }[] = [
  { key: "fried", th: ["ทอด"], en: ["fried", "deep fried", "pan fried"], label: { th: "ทอด", en: "fried" } },
  { key: "boiled", th: ["ต้ม", "ลวก"], en: ["boiled", "simmered", "poached"], label: { th: "ต้ม", en: "boiled" } },
  { key: "steamed", th: ["นึ่ง"], en: ["steamed"], label: { th: "นึ่ง", en: "steamed" } },
  { key: "baked", th: ["อบ"], en: ["baked", "roasted"], label: { th: "อบ", en: "baked / roasted" } },
  { key: "grilled", th: ["ย่าง", "ปิ้ง"], en: ["grilled", "broiled"], label: { th: "ย่าง", en: "grilled" } },
  { key: "stirfried", th: ["ผัด"], en: ["stir fried", "stir-fried", "sauteed", "sautéed"], label: { th: "ผัด", en: "stir-fried" } },
  { key: "stewed", th: ["ตุ๋น", "เคี่ยว"], en: ["stewed", "braised"], label: { th: "ตุ๋น", en: "stewed" } },
  { key: "rotisserie", th: [], en: ["rotisserie"], label: { th: "อบแบบหมุน", en: "rotisserie" } },
];
export type Method = "fried" | "boiled" | "steamed" | "baked" | "grilled" | "stirfried" | "stewed" | "rotisserie";

const CUTS: { key: string; en: string[]; th: string }[] = [
  { key: "breast", en: ["breast"], th: "อก" },
  { key: "thigh", en: ["thigh"], th: "สะโพก" },
  { key: "drumstick", en: ["drumstick"], th: "น่อง" },
  { key: "wing", en: ["wing", "wings"], th: "ปีก" },
  { key: "leg", en: ["leg"], th: "ขา" },
  { key: "tenderloin", en: ["tenderloin"], th: "สันใน" },
  { key: "loin", en: ["loin"], th: "สันนอก" },
  { key: "belly", en: ["belly"], th: "สามชั้น" },
  { key: "ground", en: ["ground", "minced"], th: "บด/สับ" },
];

const STATE_TH: Record<FoodState, { th: string; en: string }> = {
  raw: { th: "ดิบ", en: "raw" },
  cooked: { th: "สุก", en: "cooked" },
  dried: { th: "แห้ง", en: "dried" },
  prepared: { th: "ปรุงแล้ว", en: "prepared" },
};

/** What a name says about the food (all optional). */
export type FoodAttrs = {
  state: FoodState | null;
  methods: Method[];
  cut: string | null;
  /** true = with skin, false = skinless, null = not said */
  skin: boolean | null;
};

const lower = (s: string) => String(s ?? "").toLowerCase().replace(/[,;:()[\]{}/\\_"!?+*]+/g, " ").replace(/\s+/g, " ").trim();
const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** English must be whole words; Thai (no spaces) is found inside the text. */
const has = (text: string, word: string) => (isAscii(word) ? new RegExp(`(^|[^a-z])${esc(word)}(?=[^a-z]|$)`).test(text) : text.includes(word));

/** Raw / cooked, cooking method, cut and skin from a name or a USDA description. */
export function attrsOf(text: string): FoodAttrs {
  // "from raw" in FNDDS only says how it started: "baked … from raw" is cooked.
  let t = lower(text).replace(/\bfrom (raw|fresh|frozen|dry|dried|canned)\b/g, " ");
  // Skin first (and remove those words, so "skin not eaten" is not read as "skin eaten").
  let skin: boolean | null = null;
  for (const w of ["ไม่ติดหนัง", "ไม่มีหนัง", "ไม่เอาหนัง", "skinless", "without skin", "skin not eaten", "meat only"])
    if (has(t, w)) {
      skin = false;
      t = t.split(w).join(" ");
    }
  if (skin == null) for (const w of ["ติดหนัง", "มีหนัง", "meat and skin", "with skin", "skin eaten"]) if (has(t, w)) skin = true;

  const methods = METHODS.filter((m) => m.th.some((w) => t.includes(w)) || m.en.some((w) => has(t, w))).map((m) => m.key);
  let state: FoodState | null = null;
  if (methods.length || ["สุก", "cooked"].some((w) => has(t, w))) state = "cooked";
  else if (["อบแห้ง", "แห้ง", "dried", "dehydrated"].some((w) => has(t, w))) state = "dried";
  else if (["ดิบ", "สด", "ข้าวสาร", "raw", "uncooked", "fresh", "dry"].some((w) => has(t, w))) state = "raw";
  // "อบแห้ง" contains "อบ" (baked) — dried wins.
  if (t.includes("อบแห้ง")) {
    state = "dried";
    const at = methods.indexOf("baked");
    if (at >= 0) methods.splice(at, 1);
  }
  // Thai cooked-rice words say "cooked" without a method word.
  if (["ข้าวสวย", "ข้าวสุก"].some((w) => t.includes(w))) state = "cooked";

  const thaiCut: Record<string, string> = { อกไก่: "breast", อกเป็ด: "breast", สะโพก: "thigh", น่อง: "drumstick", ปีกไก่: "wing", สันใน: "tenderloin", สันนอก: "loin", สามชั้น: "belly", หมูสับ: "ground", หมูบด: "ground", เนื้อบด: "ground", วัวบด: "ground" };
  let cut: string | null = null;
  for (const [w, k] of Object.entries(thaiCut)) if (t.includes(w)) cut = k;
  if (!cut) for (const c of CUTS) if (c.en.some((w) => has(t, w))) cut = c.key;
  return { state, methods, cut, skin };
}

/** Her name → the English words to search USDA with. null = no safe words found (Thai): ask the AI to translate. */
export function englishQuery(name: string): string | null {
  const n = lower(name);
  if (!n) return null;
  if (isAscii(n)) return n;
  // Longest alias inside the name.
  let best: [string, string] | null = null;
  for (const a of USDA_ALIASES) if (n.includes(a[0]) && (!best || a[0].length > best[0].length)) best = a;
  if (!best) return null;
  const words = new Set(best[1].split(" "));
  const a = attrsOf(n);
  // Add what her name says about state / method / skin (only what the alias doesn't already say).
  if (a.skin === false && !words.has("skinless")) words.add("skinless");
  if (a.skin === true && !best[1].includes("skin")) best = [best[0], best[1] + " meat and skin"];
  for (const m of a.methods) words.add(METHODS.find((x) => x.key === m)!.en[0]);
  if (!a.methods.length && a.state === "raw" && !words.has("raw")) words.add("raw");
  if (!a.methods.length && a.state === "cooked" && !words.has("cooked")) words.add("cooked");
  if (a.state === "dried" && !words.has("dried")) words.add("dried");
  const base = best[1].split(" ");
  return [...base, ...[...words].filter((w) => !base.includes(w))].join(" ").replace(/\s+/g, " ").trim();
}

/** Words that never decide which food it is. */
const STOP = new Set(["raw", "cooked", "boiled", "fried", "steamed", "baked", "roasted", "grilled", "broiled", "stir", "skinless", "meat", "and", "skin", "with", "without", "only", "fresh", "dried", "dry", "whole", "plain", "of", "the", "a"]);

/**
 * Words in a USDA description that make it a DIFFERENT food when her search doesn't say them
 * (sticky / brown / wild rice, lunch meat, battered, flour, juice…). Learned from real USDA answers.
 */
const VARIANTS = ["glutinous", "brown", "wild", "black", "red", "puffed", "flour", "noodles", "bran", "lunchmeat", "luncheon", "sliced", "deli", "coated", "breaded", "battered", "nuggets", "patty", "sausage", "canned", "smoked", "cured", "juice", "powder", "dehydrated", "sweetened", "syrup", "baby", "infant", "mushroom", "mushrooms", "soup", "salad", "sandwich", "pie", "cake"];

/** The words that say WHAT the food is ("oyster sauce" → oyster, sauce). */
export function coreWords(query: string): string[] {
  return lower(query).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
}

export type Difference = "state" | "method" | "cut" | "skin" | "food";

export type RankedFood = UsdaFood & {
  /** What differs from her name. Empty = everything she said matches. */
  differences: Difference[];
  /** Share of the main food words found in the description (1 = all). */
  coverage: number;
  /** The description's raw / cooked / cut / skin, for the Thai tags. */
  attrs: FoodAttrs;
};

/** Singular / plural tolerant word check ("egg" ~ "eggs"). */
function descHas(desc: string, w: string): boolean {
  return has(desc, w) || has(desc, w + "s") || has(desc, w + "es") || (w.endsWith("s") && has(desc, w.slice(0, -1)));
}

/** Compare one USDA food with her name + the English search. */
export function compare(food: UsdaFood, name: string, query: string): RankedFood {
  const want = attrsOf(`${name} ${query}`);
  const desc = lower(food.description);
  const got = attrsOf(desc);
  const differences: Difference[] = [];
  if (want.state && got.state && want.state !== got.state) differences.push("state");
  // She said cooked with a method; USDA says raw → already a state difference.
  if (want.methods.length && got.methods.length && !want.methods.some((m) => got.methods.includes(m))) differences.push("method");
  if (want.cut && got.cut && want.cut !== got.cut) differences.push("cut");
  if (want.cut && !got.cut && /chicken|pork|beef/.test(desc)) differences.push("cut");
  if (want.skin != null && got.skin != null && want.skin !== got.skin) differences.push("skin");
  const core = coreWords(query);
  const found = core.filter((w) => descHas(desc, w)).length;
  const coverage = core.length ? found / core.length : 0;
  // A mixed dish ("Beans and white rice", "Chicken with vegetables") is not the single food she named.
  const head = desc.split(" ").slice(0, 6).join(" ");
  const mixed = /\b(and|with)\b/.test(lower(food.description).split(",")[0] ?? "") && !/\b(and|with)\b/.test(lower(query)) && !/meat and skin/.test(head);
  const q = lower(query);
  const variant = VARIANTS.some((v) => has(desc, v) && !has(q, v) && !lower(name).includes(v));
  if (coverage < 1 || mixed || variant) differences.push("food");
  return { ...food, differences, coverage, attrs: got };
}

const TYPE_ORDER = { foundation: 0, sr: 1, fndds: 2, branded: 3 } as const;

/**
 * Best first: fewest differences, then most food words found, then Foundation > SR Legacy > FNDDS,
 * then USDA's own order. Foods with no kcal value go last (they can't be used).
 */
export function rankFoods(foods: UsdaFood[], name: string, query: string): RankedFood[] {
  return foods
    .map((f, i) => ({ r: compare(f, name, query), i }))
    .sort(
      (a, b) =>
        Number(a.r.nutrients.kcal == null) - Number(b.r.nutrients.kcal == null) ||
        a.r.differences.length - b.r.differences.length ||
        b.r.coverage - a.r.coverage ||
        TYPE_ORDER[a.r.dataType] - TYPE_ORDER[b.r.dataType] ||
        a.i - b.i,
    )
    .map((x) => x.r);
}

/**
 * Is this result a close match? Only a hint for the screen ("closest match") — she still confirms.
 * Never close when anything differs, or when the name said nothing about raw/cooked for a food
 * where it matters a lot (rice, pasta, meat, fish, beans) and USDA has both kinds.
 */
export function isCloseMatch(r: RankedFood, name: string, query: string): boolean {
  if (r.differences.length || r.nutrients.kcal == null) return false;
  const want = attrsOf(`${name} ${query}`);
  const matters = /\b(rice|pasta|spaghetti|noodles|oats|beans|lentils|chicken|pork|beef|fish|salmon|tuna|shrimp|egg)\b/.test(lower(query));
  if (matters && !want.state) return false;
  return true;
}

/** Short Thai / English words for what a USDA food is (shown next to the English description). */
export function attrTags(a: FoodAttrs): { th: string; en: string }[] {
  const tags: { th: string; en: string }[] = [];
  if (a.cut) {
    const c = CUTS.find((x) => x.key === a.cut);
    if (c) tags.push({ th: c.th, en: c.key });
  }
  if (a.skin === true) tags.push({ th: "ติดหนัง", en: "with skin" });
  if (a.skin === false) tags.push({ th: "ไม่ติดหนัง", en: "skinless" });
  for (const m of a.methods) tags.push(METHODS.find((x) => x.key === m)!.label);
  if (a.state && !(a.state === "cooked" && a.methods.length)) tags.push(STATE_TH[a.state]);
  return tags;
}

export const DIFFERENCE_LABEL: Record<Difference, { th: string; en: string }> = {
  state: { th: "ดิบ/สุก ไม่ตรง", en: "raw/cooked differs" },
  method: { th: "วิธีปรุงไม่ตรง", en: "cooking differs" },
  cut: { th: "ส่วนไม่ตรง", en: "cut differs" },
  skin: { th: "หนังไม่ตรง", en: "skin differs" },
  food: { th: "ชื่อไม่ตรงทั้งหมด", en: "name differs" },
};
