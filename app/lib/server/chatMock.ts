// TEST MODE ONLY (AI_MOCK=1): fixed chat answers, so the chat screen can be tried without an API key.
// Shows the Round 57 pattern: open question → status + style chips (no cards); a style → 3 options;
// "anything else" → NEW options that were not shown before.

import type { Lang } from "../i18n.ts";
import { pickReplyLang, type ChatReply, type ChatRequest, type Suggestion } from "../foodChat.ts";

type Dish = { th: string; en: string; thAmt: string; enAmt: string; kcal: number; p: number; c: number; f: number; thWhy: string; enWhy: string };
type Style = "soup" | "noodle" | "veg" | "protein" | "rice" | "snack" | "sweet" | "drink";

const DISHES: Record<Style, Dish[]> = {
  soup: [
    { th: "ต้มจืดเต้าหู้หมูสับ", en: "Clear tofu and pork soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 150, p: 14, c: 8, f: 7, thWhy: "เบา มีโปรตีน", enWhy: "light, has protein" },
    { th: "แกงจืดวุ้นเส้น", en: "Glass noodle soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 180, p: 10, c: 24, f: 5, thWhy: "อิ่มโดยแคลอรี่ไม่สูง", enWhy: "filling for few kcal" },
    { th: "ต้มยำปลา", en: "Hot and sour fish soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 170, p: 22, c: 8, f: 5, thWhy: "โปรตีนสูง ไขมันต่ำ", enWhy: "high protein, low fat" },
    { th: "ซุปไก่ผักรวม", en: "Chicken vegetable soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 190, p: 20, c: 14, f: 6, thWhy: "ได้ทั้งโปรตีนและผัก", enWhy: "protein plus vegetables" },
    { th: "ต้มข่าไก่", en: "Chicken in coconut soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 280, p: 20, c: 8, f: 20, thWhy: "หอม อร่อย แต่ไขมันสูงขึ้น", enWhy: "tasty but higher fat" },
    { th: "แกงเลียงกุ้ง", en: "Spicy vegetable and shrimp soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 120, p: 12, c: 12, f: 3, thWhy: "ผักเยอะ เบามาก", enWhy: "lots of vegetables, very light" },
  ],
  noodle: [
    { th: "ก๋วยเตี๋ยวไก่ต้มยำน้ำใส", en: "Clear chicken noodle soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 320, p: 24, c: 40, f: 7, thWhy: "โปรตีนดี น้ำซุปใส", enWhy: "good protein, clear broth" },
    { th: "เส้นหมี่ต้มจับฉ่าย", en: "Rice vermicelli with vegetable soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 300, p: 16, c: 44, f: 6, thWhy: "ผักเยอะ ไขมันต่ำ", enWhy: "vegetables, low fat" },
    { th: "ก๋วยเตี๋ยวปลา", en: "Fish ball noodle soup", thAmt: "1 ชาม", enAmt: "1 bowl", kcal: 340, p: 22, c: 46, f: 7, thWhy: "เบาและมีโปรตีน", enWhy: "light with protein" },
    { th: "ผัดซีอิ๊วหมู", en: "Stir-fried noodles with pork", thAmt: "1 จาน", enAmt: "1 plate", kcal: 560, p: 22, c: 70, f: 20, thWhy: "อิ่มแน่น แต่แคลอรี่สูงกว่า", enWhy: "filling but higher kcal" },
  ],
  veg: [
    { th: "สลัดอกไก่", en: "Chicken breast salad", thAmt: "1 จาน", enAmt: "1 plate", kcal: 260, p: 28, c: 12, f: 11, thWhy: "โปรตีนสูง ผักเยอะ", enWhy: "high protein, lots of veg" },
    { th: "ยำผักรวมไข่ต้ม", en: "Mixed vegetable salad with egg", thAmt: "1 จาน", enAmt: "1 plate", kcal: 200, p: 12, c: 14, f: 10, thWhy: "เบา ได้ไข่เป็นโปรตีน", enWhy: "light, egg for protein" },
    { th: "ผักลวกน้ำจิ้ม", en: "Boiled vegetables with dip", thAmt: "1 จาน", enAmt: "1 plate", kcal: 90, p: 4, c: 14, f: 2, thWhy: "เบามาก เสริมใยอาหาร", enWhy: "very light, adds fibre" },
    { th: "ผัดผักบุ้งไฟแดง", en: "Stir-fried morning glory", thAmt: "1 จาน", enAmt: "1 plate", kcal: 180, p: 5, c: 10, f: 13, thWhy: "ผักเยอะ แต่มีน้ำมันจากการผัด", enWhy: "veg, but some cooking oil" },
  ],
  protein: [
    { th: "อกไก่ย่าง", en: "Grilled chicken breast", thAmt: "1 ชิ้น (100 กรัม)", enAmt: "1 piece (100 g)", kcal: 165, p: 31, c: 0, f: 4, thWhy: "โปรตีนสูงสุด ไขมันต่ำ", enWhy: "top protein, low fat" },
    { th: "ปลาทูนึ่ง", en: "Steamed mackerel", thAmt: "2 ตัว", enAmt: "2 fish", kcal: 180, p: 24, c: 0, f: 9, thWhy: "โปรตีนดี เตรียมง่าย", enWhy: "good protein, easy" },
    { th: "ไข่ต้ม", en: "Boiled eggs", thAmt: "2 ฟอง", enAmt: "2 eggs", kcal: 150, p: 12, c: 1, f: 10, thWhy: "ง่ายและเบา", enWhy: "simple and light" },
    { th: "เต้าหู้ขาวนึ่ง", en: "Steamed tofu", thAmt: "1 ก้อน", enAmt: "1 block", kcal: 140, p: 14, c: 4, f: 8, thWhy: "โปรตีนจากพืช เบา", enWhy: "plant protein, light" },
    { th: "กุ้งลวก", en: "Boiled shrimp", thAmt: "8 ตัว", enAmt: "8 shrimp", kcal: 120, p: 24, c: 1, f: 2, thWhy: "โปรตีนสูง แคลอรี่ต่ำ", enWhy: "high protein, low kcal" },
  ],
  rice: [
    { th: "ข้าวผัดกะเพราไก่ไม่ไข่ดาว", en: "Basil chicken with rice (no fried egg)", thAmt: "1 จาน", enAmt: "1 plate", kcal: 520, p: 26, c: 60, f: 18, thWhy: "โปรตีนพอดี ตัดไข่ดาวลดไขมัน", enWhy: "good protein, no fried egg" },
    { th: "ข้าวมันไก่ต้ม", en: "Poached chicken rice", thAmt: "1 จาน", enAmt: "1 plate", kcal: 590, p: 28, c: 70, f: 20, thWhy: "เลือกอกไก่และลดข้าวได้", enWhy: "pick breast, less rice" },
    { th: "ข้าวสวยกับปลานึ่งมะนาว", en: "Rice with steamed lime fish", thAmt: "1 จาน", enAmt: "1 plate", kcal: 430, p: 32, c: 50, f: 9, thWhy: "ไขมันต่ำ โปรตีนสูง", enWhy: "low fat, high protein" },
    { th: "ข้าวหน้าเต้าหู้ไข่", en: "Rice with egg tofu", thAmt: "1 จาน", enAmt: "1 plate", kcal: 450, p: 18, c: 62, f: 14, thWhy: "เบากว่าจานผัด", enWhy: "lighter than stir-fry" },
  ],
  snack: [
    { th: "โยเกิร์ตกรีกไม่หวาน", en: "Plain Greek yogurt", thAmt: "1 ถ้วย", enAmt: "1 cup", kcal: 130, p: 15, c: 6, f: 5, thWhy: "โปรตีนสูง", enWhy: "high protein" },
    { th: "ถั่วต้ม", en: "Boiled peanuts", thAmt: "1 กำมือ", enAmt: "1 handful", kcal: 160, p: 7, c: 6, f: 12, thWhy: "อิ่มนาน", enWhy: "keeps you full" },
    { th: "กล้วยหอม", en: "Banana", thAmt: "1 ลูก", enAmt: "1 piece", kcal: 100, p: 1, c: 25, f: 0, thWhy: "เบาและหวานตามธรรมชาติ", enWhy: "light and naturally sweet" },
    { th: "ข้าวโพดต้ม", en: "Boiled corn", thAmt: "1 ฝัก", enAmt: "1 ear", kcal: 120, p: 4, c: 25, f: 2, thWhy: "ใยอาหารดี", enWhy: "good fibre" },
  ],
  sweet: [
    { th: "ผลไม้รวม", en: "Mixed fruit", thAmt: "1 ถ้วย", enAmt: "1 cup", kcal: 90, p: 1, c: 22, f: 0, thWhy: "หวานเบา ๆ", enWhy: "lightly sweet" },
    { th: "ข้าวเหนียวมะม่วง (ครึ่งจาน)", en: "Mango sticky rice (half)", thAmt: "1/2 จาน", enAmt: "1/2 plate", kcal: 300, p: 4, c: 55, f: 8, thWhy: "ของหวานคลาสสิก แบ่งครึ่งได้", enWhy: "classic, easy to halve" },
    { th: "บัวลอยน้ำขิง", en: "Rice balls in ginger syrup", thAmt: "1 ถ้วย", enAmt: "1 cup", kcal: 210, p: 3, c: 38, f: 5, thWhy: "ไม่หนักมาก", enWhy: "not too heavy" },
  ],
  drink: [
    { th: "ชาเขียวไม่หวาน", en: "Unsweetened green tea", thAmt: "1 แก้ว", enAmt: "1 glass", kcal: 5, p: 0, c: 1, f: 0, thWhy: "แทบไม่มีแคลอรี่", enWhy: "almost no kcal" },
    { th: "นมถั่วเหลืองไม่หวาน", en: "Unsweetened soy milk", thAmt: "1 แก้ว", enAmt: "1 glass", kcal: 80, p: 7, c: 4, f: 4, thWhy: "มีโปรตีนนิดหน่อย", enWhy: "a little protein" },
    { th: "น้ำมะพร้าว", en: "Coconut water", thAmt: "1 แก้ว", enAmt: "1 glass", kcal: 60, p: 0, c: 14, f: 0, thWhy: "สดชื่น เบา", enWhy: "fresh and light" },
  ],
};

const STYLE_RX: [Style, RegExp][] = [
  ["soup", /ซุป|ต้ม|แกงจืด|soup|broth/i],
  ["noodle", /ก๋วยเตี๋ยว|เส้น|noodle/i],
  ["veg", /ผัก|สลัด|salad|veg/i],
  ["protein", /โปรตีน|protein/i],
  ["rice", /ข้าวจานเดียว|ข้าวราด|ข้าว|rice|one.?plate/i],
  ["snack", /ของว่าง|snack/i],
  ["sweet", /ของหวาน|หวาน|dessert|sweet/i],
  ["drink", /เครื่องดื่ม|drink|beverage/i],
];

const CHIP_LABEL: Record<Style, { th: string; en: string }> = {
  soup: { th: "ซุป/ต้ม", en: "Soup" },
  noodle: { th: "ก๋วยเตี๋ยว/เส้น", en: "Noodles" },
  veg: { th: "ผัก/สลัด", en: "Veggies/salad" },
  protein: { th: "โปรตีนล้วน", en: "Pure protein" },
  rice: { th: "ข้าวจานเดียว", en: "One-plate rice" },
  snack: { th: "ของว่าง", en: "Snack" },
  sweet: { th: "ของหวาน", en: "Dessert" },
  drink: { th: "เครื่องดื่ม", en: "Drink" },
};

export function detectStyle(text: string): Style | null {
  for (const [s, rx] of STYLE_RX) if (rx.test(text)) return s;
  return null;
}

const MORE_RX = /อย่างอื่น|อีกไหม|ตัวเลือกอื่น|อันอื่น|^\s*อีก|anything else|something else|other options|more options|another/i;
const OPEN_RX = /กินอะไร|ควรกิน|เหลือ|ดี$|what should|what to eat|eat more|left today|how much.*left/i;

export function mockChat(input: ChatRequest): ChatReply {
  const users = input.messages.filter((m) => m.role === "user");
  const last = users[users.length - 1]?.text ?? "";
  const lang: Lang = pickReplyLang(last, input.context.lang);
  const en = lang === "en";
  const c = input.context;
  const left = c.remainingKcal;
  const shown = new Set((input.shownDishes ?? []).map((x) => x.toLowerCase()));

  if (/ข้าวหน้าเนื้อ|beef bowl|gyudon/i.test(last)) {
    const fits = left >= 700;
    return {
      reply: en
        ? `A beef rice bowl is about 700 kcal (an estimate). You have about ${left} kcal left today, so ${fits ? "it fits" : "it is a bit tight"}. A lighter idea: ask for less rice, and add an egg for protein. (Test answer)`
        : `ข้าวหน้าเนื้อ 1 ชามประมาณ 700 kcal ค่ะ (ค่าประมาณ) วันนี้เหลืออีกประมาณ ${left} kcal ${fits ? "กินได้เลย" : "ค่อนข้างเต็มแล้วนะ"} ถ้าอยากเบาลง ลดข้าวลงหน่อย แล้วเพิ่มไข่เพื่อโปรตีนก็ดีค่ะ (คำตอบทดสอบ)`,
      suggestions: [{ name: en ? "Beef rice bowl" : "ข้าวหน้าเนื้อ", amountText: en ? "1 bowl" : "1 ชาม", kcal: 700, protein: 28, carbs: 95, fat: 22 }],
      quickReplies: [],
    };
  }

  // A style (a tapped chip, or typed, e.g. "อยากกินซุป") → 3 different options. "Anything else" → a style from earlier, NEW dishes.
  const more = MORE_RX.test(last);
  let style = detectStyle(last);
  if (!style && more) {
    for (let i = users.length - 2; i >= 0 && !style; i--) style = detectStyle(users[i].text);
    style = style ?? "soup";
  }
  if (style) {
    const proteinShort = c.proteinTarget != null && c.protein < c.proteinTarget - 10;
    const fatOver = c.fatTarget != null && c.fat > c.fatTarget;
    const pool = DISHES[style]
      .filter((d) => !shown.has(d.th.toLowerCase()) && !shown.has(d.en.toLowerCase()))
      .sort((a, b) => (proteinShort ? b.p - a.p : 0) || (fatOver ? a.f - b.f : 0) || Math.abs(a.kcal - Math.max(left / 3, 100)) - Math.abs(b.kcal - Math.max(left / 3, 100)));
    const picks = pool.slice(0, 3);
    if (picks.length === 0) {
      return {
        reply: en ? "I have shown you all my ideas in that style. Pick another style and I will find new ones. (Test answer)" : "ไอเดียแนวนี้โชว์ครบแล้วค่ะ ลองเลือกแนวอื่น เดี๋ยวหาใหม่ให้ (คำตอบทดสอบ)",
        suggestions: [],
        quickReplies: otherChips(style, lang),
      };
    }
    const suggestions: Suggestion[] = picks.map((d) => ({ name: en ? d.en : d.th, amountText: en ? d.enAmt : d.thAmt, kcal: d.kcal, protein: d.p, carbs: d.c, fat: d.f }));
    const lines = picks.map((d) => `• ${en ? d.en : d.th}: ${en ? d.enWhy : d.thWhy}`).join("\n");
    return {
      reply: en
        ? `${more ? "Here are some new ones" : "Here are 3 ideas"} (about ${left} kcal left${proteinShort ? ", protein is still short" : ""}):\n${lines}\n(Test answer)`
        : `${more ? "ลองอันใหม่เหล่านี้ค่ะ" : "ลอง 3 อย่างนี้ค่ะ"} (เหลืออีกประมาณ ${left} kcal${proteinShort ? " โปรตีนยังขาดอยู่" : ""}):\n${lines}\n(คำตอบทดสอบ)`,
      suggestions,
      quickReplies: [en ? "Anything else?" : "มีอย่างอื่นไหม"],
    };
  }

  if (OPEN_RX.test(last) || /กินอะไรเพิ่ม/.test(last)) {
    const pT = c.proteinTarget;
    const proteinLine =
      pT != null
        ? c.protein >= pT
          ? en ? `Protein is reached (${c.protein}/${pT} g).` : `โปรตีนครบแล้ว (${c.protein}/${pT} กรัม)`
          : en ? `Protein is short: ${c.protein}/${pT} g.` : `โปรตีนยังขาด: กินแล้ว ${c.protein}/${pT} กรัม`
        : en ? `Protein so far: ${c.protein} g.` : `โปรตีนวันนี้ ${c.protein} กรัม`;
    const fatLine =
      c.fatTarget != null
        ? c.fat > c.fatTarget
          ? en ? `Fat is over its target (${c.fat}/${c.fatTarget} g).` : `ไขมันเกินเป้าแล้ว (${c.fat}/${c.fatTarget} กรัม)`
          : en ? `Fat is OK (${c.fat}/${c.fatTarget} g).` : `ไขมันยังอยู่ในเป้า (${c.fat}/${c.fatTarget} กรัม)`
        : null;
    const carbLine = c.carbsTarget != null ? (en ? `Carbs: ${c.carbs}/${c.carbsTarget} g.` : `คาร์บ ${c.carbs}/${c.carbsTarget} กรัม`) : null;
    const lines = [en ? `About ${left} kcal left today.` : `วันนี้เหลืออีกประมาณ ${left} kcal`, proteinLine, fatLine, carbLine].filter(Boolean).map((x) => `• ${x}`);
    const proteinShort = pT != null && c.protein < pT - 10;
    const order: Style[] = left < 250 ? ["snack", "drink", "veg"] : proteinShort ? ["protein", "soup", "veg", "noodle", "rice", "snack"] : ["soup", "noodle", "veg", "rice", "snack", "sweet"];
    return {
      reply: (en ? `Here is where your day stands:\n${lines.join("\n")}\nWhat do you feel like?` : `ดูวันนี้ของคุณตอนนี้นะคะ\n${lines.join("\n")}\nอยากกินแนวไหนคะ?`) + (en ? " (Test answer)" : " (คำตอบทดสอบ)"),
      suggestions: [],
      quickReplies: order.map((s) => CHIP_LABEL[s][lang]),
    };
  }

  return {
    reply: en
      ? `I can help with food and calories. Tell me what you would like to eat and I will give an estimate. (Test answer)`
      : `ถามเรื่องอาหารและแคลอรี่ได้เลยค่ะ บอกมาว่าอยากกินอะไร เดี๋ยวช่วยประมาณให้ (คำตอบทดสอบ)`,
    suggestions: [],
    quickReplies: [],
  };
}

function otherChips(not: Style, lang: Lang): string[] {
  return (Object.keys(CHIP_LABEL) as Style[]).filter((s) => s !== not).slice(0, 4).map((s) => CHIP_LABEL[s][lang]);
}
