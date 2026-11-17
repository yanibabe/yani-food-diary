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
export type ChatMsg = { id: string; role: "user" | "assistant"; text: string; suggestion?: Suggestion };

/** Keep the newest `max` messages. */
export function capMessages<T>(list: T[], max = MAX_STORED): T[] {
  return list.length > max ? list.slice(list.length - max) : list;
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
    const s = o.role === "assistant" ? cleanSuggestion(o.suggestion) : undefined;
    if (s) msg.suggestion = s;
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
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

const r0 = (v: number) => Math.round(Number.isFinite(v) ? v : 0);

export type ChatInputs = {
  lang: Lang;
  targetKcal: number;
  proteinTarget?: number | null;
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
  return {
    messages: messages.slice(-MAX_SENT).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_TEXT) })),
    context,
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

export const ChatReplySchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  // A broken suggestion never kills the reply: it is just dropped.
  suggestion: SuggestionSchema.nullish().catch(null),
});
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
