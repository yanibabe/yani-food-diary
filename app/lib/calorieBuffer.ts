// Round 40: the optional Smart Calorie Buffer.
// Pure functions only — no React, no browser storage — so the tests can check them.
//
// Rules (approved by her, 2026-11-16):
// - The AI gives its best guess. By default NOTHING is added (0%).
// - She may choose 5 / 10 / 15 / 20%. It is added to KCAL ONLY — never protein, carbs or fat.
// - Only for AI estimates where the AI had to guess the amount. Never for printed labels, database
//   values (Open Food Facts), numbers she typed, recipes / reference values, or old saved items.
// - The AI's own number is kept in `aiKcal`. `kcal` is the number the diary counts (tracking kcal).
//   A new buffer is always worked out from `aiKcal`, never from an already-buffered number.
// - Items saved before Round 40 have no `aiKcal`, so nothing here ever changes them.
//   (Some old items have `margin: true`: the old +15% is already inside ALL their numbers.)

import type { L } from "./i18n.ts";
import type { FoodItem, Macros } from "./types.ts";

export const BUFFER_CHOICES = [0, 5, 10, 15, 20] as const;
export type BufferPct = (typeof BUFFER_CHOICES)[number];
export const DEFAULT_BUFFER: BufferPct = 0;

/** The old automatic margin (before Round 40). Only used to explain old saved items. */
export const LEGACY_MARGIN_PCT = 15;

/** A saved setting → a safe choice. Anything unknown → 0% (the default). */
export function cleanBufferPct(v: unknown): BufferPct {
  const n = typeof v === "number" ? v : Number(v);
  return (BUFFER_CHOICES as readonly number[]).includes(n) ? (n as BufferPct) : DEFAULT_BUFFER;
}

/** kcal the diary counts for an AI estimate with a buffer. 500 at 15% → 575. */
export function bufferedKcal(aiKcal: number, pct: number): number {
  const p = cleanBufferPct(pct);
  const k = Number.isFinite(aiKcal) && aiKcal > 0 ? aiKcal : 0;
  return (k * (100 + p)) / 100;
}

/** An old item that already has the pre-Round-40 +15% inside all its numbers. */
export function hasLegacyMargin(item: Pick<FoodItem, "margin" | "aiKcal">): boolean {
  return item.margin === true && item.aiKcal == null;
}

/**
 * May a NEW item get a buffer? Only a fresh AI guess:
 * the source is the AI, the amount was guessed (not exact), not a printed label, not an old item.
 */
export function canBuffer(item: FoodItem): boolean {
  const p = item.prov;
  if (!p || p.source !== "ai" || p.verification !== "estimated") return false;
  if (p.via === "exact-amount") return false;
  if (item.fromLabel) return false;
  if (hasLegacyMargin(item)) return false;
  return true;
}

/**
 * A fresh AI item → keep the AI's own kcal and add her buffer (kcal only).
 * Not allowed (label, exact amount, her own numbers…) → returned unchanged.
 */
export function startBuffer(item: FoodItem, pct: number): FoodItem {
  if (!canBuffer(item)) return item;
  const aiKcal = item.aiKcal ?? item.kcal;
  const p = cleanBufferPct(pct);
  return { ...item, aiKcal, bufferPct: p, kcal: bufferedKcal(aiKcal, p) };
}

/**
 * Change the buffer on an item that already keeps the AI's own kcal.
 * Always from `aiKcal` (so no double buffer). Items without `aiKcal` are never touched.
 */
export function setBuffer(item: FoodItem, pct: number): FoodItem {
  if (item.aiKcal == null) return item;
  const p = cleanBufferPct(pct);
  return { ...item, bufferPct: p, kcal: bufferedKcal(item.aiKcal, p) };
}

/** Drop the buffer info (she typed her own kcal, so the number is hers now). */
export function dropBuffer(item: FoodItem): FoodItem {
  const { aiKcal: _a, bufferPct: _b, ...rest } = item;
  void _a;
  void _b;
  return rest;
}

/** The AI's own kcal for this item (no buffer). Items without a buffer: just kcal. */
export function originalKcal(item: Pick<FoodItem, "kcal" | "aiKcal">): number {
  return item.aiKcal ?? item.kcal;
}

/** kcal added by the buffer for this item (0 when none). */
export function bufferExtra(item: Pick<FoodItem, "kcal" | "aiKcal">): number {
  return item.aiKcal == null ? 0 : Math.max(0, item.kcal - item.aiKcal);
}

/** Has a buffer above 0% on it. */
export function isBuffered(item: Pick<FoodItem, "aiKcal" | "bufferPct">): boolean {
  return item.aiKcal != null && (item.bufferPct ?? 0) > 0;
}

/** Totals for a list: what the AI estimated vs what the diary counts. */
export function bufferSummary(items: FoodItem[]): { aiKcal: number; trackingKcal: number; extra: number; pcts: number[] } {
  let ai = 0;
  let tracking = 0;
  const pcts = new Set<number>();
  for (const i of items) {
    tracking += i.kcal;
    ai += originalKcal(i);
    if (isBuffered(i)) pcts.add(i.bufferPct ?? 0);
  }
  return { aiKcal: ai, trackingKcal: tracking, extra: Math.max(0, tracking - ai), pcts: [...pcts].sort((a, b) => a - b) };
}

/**
 * Numbers for the 4/4/9 check: the AI's own kcal, so a buffer she chose never shows up as
 * "the numbers don't add up". Old +15% items are fine as they are (all their numbers were scaled).
 */
export function forEnergyCheck(item: FoodItem): Macros {
  return { kcal: originalKcal(item), protein: item.protein, carbs: item.carbs, fat: item.fat };
}

// ---- words on screen (Thai + English) ----

export const BUFFER_TEXT = {
  title: { th: "เผื่อแคลอรี่ (Smart Calorie Buffer)", en: "Smart Calorie Buffer" },
  explain: {
    th: "AI กะแคลอรี่จากรูปหรือข้อความได้แค่ประมาณ ถ้าอยากเผื่อไว้ เลือก % ที่จะบวกเพิ่ม · บวกเฉพาะแคลอรี่ของอาหารที่ AI กะปริมาณเอง · ไม่บวกกับฉลาก ฐานข้อมูล ค่าที่พิมพ์เอง หรือสูตรของคุณ · โปรตีน คาร์บ ไขมัน ไม่เปลี่ยน · ใช้กับมื้อที่บันทึกใหม่ มื้อเก่าเหมือนเดิม",
    en: "The AI can only estimate calories from a photo or text. To be on the safe side, pick a % to add · Added only to calories of food where the AI guessed the amount · Never to labels, database values, numbers you typed, or your recipes · Protein, carbs and fat don't change · Applies to newly saved meals; old meals stay the same",
  },
  none: { th: "ไม่เผื่อ", en: "None" },
  aiSaid: { th: "AI ประมาณ", en: "AI estimate" },
  counted: { th: "นับในไดอารี", en: "Counted in diary" },
  legacy: { th: "เดิม +15%", en: "Old +15%" },
  legacyNote: {
    th: "ป้าย \"เดิม +15%\" = บันทึกก่อนมีตัวเลือกนี้ ตัวเลขบวก 15% ไว้แล้วตามกฎเก่า (ไม่บวกซ้ำ)",
    en: "\"Old +15%\" = saved before this option existed; its numbers already include the old 15% (never added again)",
  },
} satisfies Record<string, L>;

/** "+15%" style short label. */
export function pctLabel(pct: number): string {
  return `+${cleanBufferPct(pct)}%`;
}
