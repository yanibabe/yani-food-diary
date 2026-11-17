// Round 54: "ask before eating" chat. Pure logic (no React, no browser storage), so the tests can run it.
// Nothing here is saved to her diary. A suggestion only becomes a meal when she taps "Add to my day" and saves in review.

import { z } from "zod";
import type { Lang } from "./i18n.ts";
import type { FoodItem, Macros, MacroKey } from "./types.ts";
import { cleanBufferPct, startBuffer } from "./calorieBuffer.ts";
import { provFromAi } from "./provenance.ts";

export const CHAT_KEY = "yfd:v1:chat";
/** Messages kept on the phone (the current conversation only). */
export const MAX_STORED = 30;
/** Messages sent to the AI. */
export const MAX_SENT = 10;
export const MAX_TEXT = 1000;

// ---------- messages on the phone ----------

export type Suggestion = { name: string; amountText: string; kcal: number; protein?: number | null; carbs?: number | null; fat?: number | null };
export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Round 57: up to 4 food cards under one answer. */
  suggestions?: Suggestion[];
  /** Round 57: short tap-to-send replies (shown under the LAST answer only). */
  quickReplies?: string[];
  /** Before Round 57 an answer had one card. Old saved chats are read into `suggestions`; nothing writes this any more. */
  suggestion?: Suggestion;
};

/** Keep the newest `max` messages. */
export function capMessages<T>(list: T[], max = MAX_STORED): T[] {
  return list.length > max ? list.slice(list.length - max) : list;
}

export const MAX_SUGGESTIONS = 4;
export const MAX_CHIPS = 6;
export const MAX_CHIP_LEN = 24;

/** Keep the good cards, drop the broken ones, drop repeats of the same dish name. Max 4. */
export function cleanSuggestions(v: unknown): Suggestion[] {
  if (!Array.isArray(v)) return [];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const s = cleanSuggestion(x);
    if (!s) continue;
    const k = s.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/** Tap-to-send chips: short plain strings only, trimmed, no repeats, nothing that looks like contact details. Max 6. */
export function cleanQuickReplies(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x.replace(/\s+/g, " ").trim();
    if (!t || t.length > MAX_CHIP_LEN) continue;
    if (/@|https?:|www\.|\d{7,}/i.test(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= MAX_CHIPS) break;
  }
  return out;
}

/** Dish names already suggested in this chat (so the AI never repeats one). Food names only. */
export function shownDishes(messages: Pick<ChatMsg, "suggestions" | "suggestion">[], max = 30): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    for (const s of [...(m.suggestions ?? []), ...(m.suggestion ? [m.suggestion] : [])]) {
      const k = s.name.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(s.name.trim().slice(0, 80));
    }
  }
  return out.slice(-max);
}

const THAI = /[\u0E00-\u0E7F]/g;
const LATIN = /[A-Za-z]/g;

/** Reply in the language of her LATEST message. Thai letters → Thai, English letters → English, unclear → the app language. */
export function pickReplyLang(latest: string | null | undefined, appLang: Lang): Lang {
  const t = latest ?? "";
  const th = (t.match(THAI) ?? []).length;
  const en = (t.match(LATIN) ?? []).length;
  if (th === 0 && en < 2) return appLang === "en" ? "en" : "th";
  if (th > en) return "th";
  if (en > th) return "en";
  return appLang === "en" ? "en" : "th";
}

export function cleanSuggestion(v: unknown): Suggestion | undefined {
  const r = SuggestionSchema.safeParse(v);
  return r.success ? r.data : undefined;
}

/** Saved text → safe messages. Anything broken is dropped; nothing throws. */
export function parseChat(raw: string | null): ChatMsg[] {
  if (!raw) return [];
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const out: ChatMsg[] = [];
  for (const m of v) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    if (o.role !== "user" && o.role !== "assistant") continue;
    if (typeof o.text !== "string" || !o.text.trim()) continue;
    const msg: ChatMsg = { id: typeof o.id === "string" && o.id ? o.id : `m${out.length}`, role: o.role, text: o.text.slice(0, 4000) };
    if (o.role === "assistant") {
      const list = cleanSuggestions([...(Array.isArray(o.suggestions) ? o.suggestions : []), ...(o.suggestion != null ? [o.suggestion] : [])]);
      if (list.length) msg.suggestions = list;
      const chips = cleanQuickReplies(o.quickReplies);
      if (chips.length) msg.quickReplies = chips;
    }
    out.push(msg);
  }
  return capMessages(out);
}

export function serializeChat(list: ChatMsg[]): string {
  return JSON.stringify(capMessages(list));
}

// ---------- the request (numbers only) ----------

const n = z.number().finite();

const pos = n.positive();
const MAX_MEALS = 20;

export const ChatContextSchema = z.object({
  lang: z.enum(["th", "en"]).catch("th"),
  // Her body and goal (each one is simply left out when it is not recorded; never guessed, never 0).
  age: pos.max(120).optional().catch(undefined),
  sex: z.enum(["female", "male"]).optional().catch(undefined),
  heightCm: pos.max(260).optional().catch(undefined),
  weightKg: pos.max(500).optional().catch(undefined),
  goal: z.enum(["lose", "muscle", "gain", "maintain"]).optional().catch(undefined),
  avoidDairy: z.literal(true).optional().catch(undefined),
  kcalTarget: n,
  proteinTarget: n.nullish(),
  // Round 57: the carbs and fat targets (the same ones the Today tiles use). Left out when not known.
  carbsTarget: pos.optional().catch(undefined),
  fatTarget: pos.optional().catch(undefined),
  // Today so far.
  eatenKcal: n,
  protein: n,
  carbs: n,
  fat: n,
  remainingKcal: n,
  // Food names with their kcal, today only (so it can say what to add or skip). No photos, notes, titles of older days.
  todayMeals: z
    .array(z.object({ name: z.string().trim().min(1).max(60), kcal: n }))
    .max(MAX_MEALS)
    .optional()
    .catch(undefined),
});
export type ChatContext = z.infer<typeof ChatContextSchema>;

export const ChatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(MAX_TEXT) }))
    .min(1)
    .transform((l) => l.slice(-MAX_SENT)),
  context: ChatContextSchema,
  // Round 57: dish names already suggested in this chat (food names only).
  shownDishes: z.array(z.string().trim().min(1).max(80)).max(30).optional().catch(undefined),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

const r0 = (v: number) => Math.round(Number.isFinite(v) ? v : 0);

export type ChatInputs = {
  lang: Lang;
  targetKcal: number;
  proteinTarget?: number | null;
  carbsTarget?: number | null;
  fatTarget?: number | null;
  eaten: Macros;
  age?: number | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goal?: string | null;
  avoidDairy?: boolean;
  /** Food names of TODAY's meals with their kcal. */
  todayFoods?: { name: string; kcal: number }[];
};

const okNum = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max;

/** Her numbers, her goal, and today's food names with kcal. Never her name, email, photos, notes or older days. Missing = left out. */
export function buildChatContext(o: ChatInputs): ChatContext {
  const ctx: ChatContext = {
    lang: o.lang === "en" ? "en" : "th",
    kcalTarget: r0(o.targetKcal),
    eatenKcal: r0(o.eaten.kcal),
    protein: r0(o.eaten.protein),
    carbs: r0(o.eaten.carbs),
    fat: r0(o.eaten.fat),
    remainingKcal: r0(o.targetKcal - o.eaten.kcal),
  };
  if (o.proteinTarget != null && Number.isFinite(o.proteinTarget)) ctx.proteinTarget = r0(o.proteinTarget);
  if (okNum(o.carbsTarget, 2000)) ctx.carbsTarget = r0(o.carbsTarget);
  if (okNum(o.fatTarget, 1000)) ctx.fatTarget = r0(o.fatTarget);
  if (okNum(o.age, 120)) ctx.age = Math.round(o.age);
  if (o.sex === "female" || o.sex === "male") ctx.sex = o.sex;
  if (okNum(o.heightCm, 260)) ctx.heightCm = Math.round(o.heightCm);
  if (okNum(o.weightKg, 500)) ctx.weightKg = Math.round(o.weightKg * 10) / 10;
  if (o.goal === "lose" || o.goal === "muscle" || o.goal === "gain" || o.goal === "maintain") ctx.goal = o.goal;
  if (o.avoidDairy === true) ctx.avoidDairy = true;
  const meals = (o.todayFoods ?? [])
    .map((f) => ({ name: String(f.name ?? "").trim().slice(0, 60), kcal: r0(f.kcal) }))
    .filter((f) => f.name)
    .slice(0, MAX_MEALS);
  if (meals.length) ctx.todayMeals = meals;
  return ctx;
}

/** What goes over the network: the last few messages (role + text only) and the numbers. */
export function buildChatRequest(messages: ChatMsg[], context: ChatContext): ChatRequest {
  const dishes = shownDishes(messages);
  return {
    messages: messages.slice(-MAX_SENT).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_TEXT) })),
    context,
    ...(dishes.length ? { shownDishes: dishes } : {}),
  };
}

// ---------- the answer ----------

export const SuggestionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amountText: z.string().trim().max(60).catch(""),
  kcal: z.coerce.number().finite().gt(0).max(5000),
  protein: z.coerce.number().finite().min(0).max(500).nullish().catch(null),
  carbs: z.coerce.number().finite().min(0).max(1000).nullish().catch(null),
  fat: z.coerce.number().finite().min(0).max(500).nullish().catch(null),
});

/** The shape the AI is asked for (written into the prompt). */
export const ChatReplyShape = z.object({
  reply: z.string().describe("The answer text"),
  suggestions: z.array(SuggestionSchema).max(MAX_SUGGESTIONS).optional().describe("0-4 food cards"),
  quickReplies: z.array(z.string().max(MAX_CHIP_LEN)).max(MAX_CHIPS).optional().describe("0-6 short tap-to-send replies"),
});

/** What we accept back. Lenient: a broken card or chip is dropped, never the whole reply. The old single `suggestion` still reads. */
export const ChatReplySchema = z
  .object({
    reply: z.string().trim().min(1).max(4000),
    suggestions: z.unknown().optional(),
    suggestion: z.unknown().optional(),
    quickReplies: z.unknown().optional(),
  })
  .transform((r) => ({
    reply: r.reply,
    suggestions: cleanSuggestions([...(Array.isArray(r.suggestions) ? r.suggestions : []), ...(r.suggestion != null ? [r.suggestion] : [])]),
    quickReplies: cleanQuickReplies(r.quickReplies),
  }));
export type ChatReply = z.infer<typeof ChatReplySchema>;

// ---------- suggestion → one meal item (an AI ESTIMATE) ----------

/** "1 ชาม" → { amount: 1, unit: "ชาม" }. No leading number → one serving, the words kept in the note. */
export function splitAmount(text: string, lang: Lang): { amount: number; unit: string; note: string | null } {
  const t = (text ?? "").trim();
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (m) {
    const amount = Number(m[1].replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) return { amount, unit: m[2].trim() || (lang === "en" ? "serving" : "ที่"), note: null };
  }
  return { amount: 1, unit: lang === "en" ? "serving" : "ที่", note: t || null };
}

/**
 * Her review step gets ONE item: provenance AI + estimated (the AI guessed the amount), so her Smart Calorie Buffer
 * applies (kcal only). Numbers the AI did not give stay unknown (listed in `missing`), never a real 0.
 */
export function suggestionToItem(s: Suggestion, id: string, lang: Lang = "th", bufferPct = 0): FoodItem {
  const { amount, unit, note } = splitAmount(s.amountText, lang);
  const missing: MacroKey[] = [];
  const val = (k: MacroKey): number => {
    const v = s[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    missing.push(k);
    return 0;
  };
  const protein = val("protein");
  const carbs = val("carbs");
  const fat = val("fat");
  const item: FoodItem = {
    id,
    name: s.name.trim(),
    amount,
    unit,
    kcal: Math.round(s.kcal),
    protein,
    carbs,
    fat,
    estimated: true,
    kind: "food",
    note,
    box: null,
    prov: provFromAi({ estimated: true }),
  };
  if (missing.length) item.missing = missing;
  return startBuffer(item, cleanBufferPct(bufferPct));
}

// Round 56: the calmer empty state. Three short example questions (tap = send) and the one-line privacy note
// that now lives behind the (i) button instead of being always on screen.
export const CHAT_EXAMPLES: { icon: "flame" | "leaf" | "scales"; th: string; en: string }[] = [
  { icon: "flame", th: "ข้าวหน้าเนื้อกี่แคล", en: "How many calories in a beef rice bowl?" },
  { icon: "leaf", th: "วันนี้ควรกินอะไรเพิ่ม", en: "What should I eat more of today?" },
  { icon: "scales", th: "วันนี้เหลืออีกเท่าไหร่", en: "How much do I have left today?" },
];

export const CHAT_PRIVACY = {
  th: "AI เห็น: อายุ น้ำหนัก ส่วนสูง เป้า และสิ่งที่กินวันนี้ (ไม่ส่งชื่อ รูป หรือประวัติเก่า)",
  en: "AI sees: age, weight, height, targets and what you ate today (not your name, photos or older history)",
};

/** The (i) button: tap opens the privacy card, tap again closes it. */
export function toggleInfo(open: boolean): boolean {
  return !open;
}
