// Round 80: units follow the app language (display only).
// The saved unit text never changes ("1 skewer" stays "skewer" on the phone). Screens call displayUnit(),
// which shows the same unit in the app language when we know it, and the text as it is when we do not.
// No React and no storage here, so the tests can use it.

import type { Lang } from "./i18n.ts";

type Group = { th: string; en: string; thAlt?: string[]; enAlt?: string[] };

// First group wins when two groups share a word. Words are matched ignoring case and spaces at the ends.
const GROUPS: Group[] = [
  { th: "ไม้", en: "skewer", thAlt: ["ไม้เสียบ"] },
  { th: "ที่", en: "portion", thAlt: ["ส่วน"] },
  { th: "เสิร์ฟ", en: "serving" },
  { th: "ชิ้น", en: "piece", thAlt: ["ลูก", "อัน"], enAlt: ["pc", "pcs"] },
  { th: "จาน", en: "plate", enAlt: ["dish"] },
  { th: "ชาม", en: "bowl" },
  { th: "ถ้วย", en: "cup" },
  { th: "แก้ว", en: "glass" },
  { th: "ทัพพี", en: "ladle", enAlt: ["scoop"] },
  { th: "ฟอง", en: "egg" },
  { th: "ช้อนโต๊ะ", en: "tablespoon", enAlt: ["tbsp", "tbs"] },
  { th: "ช้อนชา", en: "teaspoon", enAlt: ["tsp"] },
  { th: "ช้อน", en: "spoon" },
  { th: "กรัม", en: "g", thAlt: ["ก.", "ก"], enAlt: ["gram"] },
  { th: "มล.", en: "ml", thAlt: ["มล", "มิลลิลิตร"], enAlt: ["milliliter", "millilitre"] },
  { th: "ห่อ", en: "pack", enAlt: ["package"] },
  { th: "ซอง", en: "sachet", enAlt: ["packet"] },
  { th: "กล่อง", en: "box" },
  { th: "ขวด", en: "bottle" },
  { th: "กระป๋อง", en: "can", enAlt: ["tin"] },
  { th: "แผ่น", en: "slice", enAlt: ["sheet"] },
  { th: "ถุง", en: "bag" },
];

const BY_TH = new Map<string, Group>();
const BY_EN = new Map<string, Group>();
for (const g of GROUPS) {
  for (const w of [g.th, ...(g.thAlt ?? [])]) if (!BY_TH.has(w)) BY_TH.set(w, g);
  for (const w of [g.en, ...(g.enAlt ?? [])]) if (!BY_EN.has(w)) BY_EN.set(w, g);
}

const THAI = /[฀-๿]/;
/** Units that never get an "s" ("2 g", "3 ml"). */
const NO_PLURAL = new Set(["g", "ml"]);

function findEn(word: string): Group | undefined {
  const w = word.toLowerCase();
  const direct = BY_EN.get(w);
  if (direct) return direct;
  // Plurals: skewers → skewer, boxes → box, glasses → glass, pieces → piece.
  if (w.endsWith("es")) {
    const g = BY_EN.get(w.slice(0, -2));
    if (g) return g;
  }
  if (w.endsWith("s")) return BY_EN.get(w.slice(0, -1));
  return undefined;
}

function pluralEn(word: string): string {
  if (NO_PLURAL.has(word)) return word;
  return /(s|x|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}

/**
 * The unit in the app language.
 *  - the unit is already in the app language, or we do not know it → the text as it is;
 *  - otherwise the same unit in the app language (English plural when `amount` is given and is not 1).
 */
export function displayUnit(unit: string, lang: Lang, amount?: number): string {
  const text = String(unit ?? "").trim();
  if (!text) return text;
  if (THAI.test(text)) {
    if (lang === "th") return text;
    const g = BY_TH.get(text);
    if (!g) return text;
    return amount != null && amount !== 1 ? pluralEn(g.en) : g.en;
  }
  if (lang === "en") return text;
  const g = findEn(text);
  return g ? g.th : text;
}
