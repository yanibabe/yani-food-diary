// Round 81: keep every meal NAME true to the foods in it, Thai first.
// Her report (4 times): a meal still said "ไก่ย่างเสียบไม้และไก่ทอด" / "…Fried Chicken" after the fried chicken
// turned out to be แหนมกระดูกอ่อนทอด. Fixes that relied on the meal's saved history kept missing, so this
// check does not depend on history at all: for recent meals, the AI gets the Thai names of the foods
// (the list she has checked) and the current meal name, and returns a Thai name made ONLY from those foods,
// plus its exact English translation. The Thai name becomes the meal's real name; English is its alt.
// A meal name she typed herself (alt.manual) is never touched. Each meal is checked once per
// (name + foods) — when a food changes, it is checked again.

import { cleanAltText, nameLang, sameProtein, validAlt, type NameAlt } from "./names.ts";
import type { StorageLike } from "./nameTr.ts";

export const TITLE_CHECKED_KEY = "yfd:v1:titleChecked";
export const TITLE_RUNS_KEY = "yfd:v1:titleRuns";
export const MAX_MEALS_PER_CALL = 20;
export const MAX_TITLE_CALLS_PER_DAY = 6;
export const TITLE_FAIL_PAUSE_MS = 60 * 60 * 1000;
export const RECENT_DAYS = 45;
const MAX_CHECKED = 2000;

type ItemLike = { name: string; alt?: NameAlt };
export type MealLike = { id: string; date: string; title: string; alt?: NameAlt; items: ItemLike[] };

/** The Thai text of a name: the name itself when it is Thai, else its Thai alt, else the name. */
export function thaiText(name: string, alt: NameAlt | undefined): string {
  if (nameLang(name) === "th") return name;
  return cleanAltText(validAlt(name, alt)?.th) ?? name;
}

/** What the check depends on: the meal name and the foods. Changes → checked again. */
export function titleSignature(m: MealLike): string {
  return `${m.title}|${m.items.map((i) => thaiText(i.name, i.alt)).join("·")}`;
}

/** Recent meals (newest first) whose name was not typed by her and not checked for these foods yet. */
export function mealsToCheck(meals: MealLike[], checked: Record<string, string>, today: string, max = MAX_MEALS_PER_CALL): MealLike[] {
  const from = shiftDay(today, -RECENT_DAYS);
  return meals
    .filter((m) => m.date >= from && m.date <= today && m.items.length > 0 && m.alt?.manual !== true && m.title.trim())
    .filter((m) => checked[m.id] !== titleSignature(m))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max);
}

function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type TitleAsk = { id: string; title: string; foods: string[] };
export type TitleFix = { id: string; th: string; en: string };

/** What is sent to the AI for one meal: its name and the Thai food names. */
export function toAsk(m: MealLike): TitleAsk {
  return { id: m.id, title: m.title.slice(0, 120), foods: m.items.slice(0, 15).map((i) => thaiText(i.name, i.alt).slice(0, 120)) };
}

/** Server-side check of a request. */
export function parseTitleRequest(body: unknown): { ok: true; meals: TitleAsk[] } | { ok: false; error: string } {
  const list = body && typeof body === "object" ? (body as { meals?: unknown }).meals : undefined;
  if (!Array.isArray(list)) return { ok: false, error: "meals must be a list" };
  if (list.length > MAX_MEALS_PER_CALL) return { ok: false, error: `at most ${MAX_MEALS_PER_CALL} meals at a time` };
  const meals: TitleAsk[] = [];
  for (const v of list) {
    if (!v || typeof v !== "object") return { ok: false, error: "bad meal" };
    const o = v as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.slice(0, 80) : "";
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
    const foods = Array.isArray(o.foods) ? o.foods.filter((f): f is string => typeof f === "string" && !!f.trim()).map((f) => f.trim().slice(0, 120)).slice(0, 15) : [];
    if (!id || !foods.length) continue;
    meals.push({ id, title, foods });
  }
  if (!meals.length) return { ok: false, error: "no meals to check" };
  return { ok: true, meals };
}

/** Read the AI's answer: one Thai + English name per asked meal. */
export function parseTitleReply(raw: unknown, asked: string[]): TitleFix[] {
  const rows = raw && typeof raw === "object" ? (raw as { meals?: unknown }).meals : undefined;
  if (!Array.isArray(rows)) return [];
  const out: TitleFix[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const th = cleanAltText(o.title_th);
    const en = cleanAltText(o.title_en);
    if (!id || !asked.includes(id) || seen.has(id) || !th || !en) continue;
    if (nameLang(th) !== "th" || nameLang(en) !== "en" || !sameProtein(th, en)) continue;
    seen.add(id);
    out.push({ id, th, en });
  }
  return out;
}

export const TITLE_SYSTEM = `You keep meal names in a Thai food diary true to what was eaten.
For each meal you get its current name and the Thai names of the foods in it. The FOOD LIST IS CORRECT; the current name may be out of date (it can name a food that was later corrected, and it can be in English).
For each meal return:
- title_th: a short, natural Thai meal name made ONLY from foods in the list. Never name a food that is not in the list. If the current name is Thai and names no food outside the list, return it EXACTLY as it is, letter for letter (do not shorten, reword or add). If it is English and fits the list, give the same name in Thai. A plate with many foods may use the main ones (e.g. "ข้าวกะเพราไก่ไข่ดาว").
- title_en: the exact English translation of title_th, the way a menu would say it. Same foods, same meat, nothing added.
Keep brand names. No explanations.
Return ONLY JSON: {"meals":[{"id":"…","title_th":"…","title_en":"…"}]}`;

/**
 * Apply one answer: the Thai name becomes the meal's real name and English its alt (Thai first, like all
 * her menus). Returns the same object when nothing changes.
 */
export function applyTitleFix<M extends MealLike>(m: M, fix: TitleFix): M {
  if (m.alt?.manual === true) return m;
  const alt: NameAlt = { en: fix.en, src: fix.th };
  const sameTitle = m.title === fix.th;
  const sameAlt = m.alt?.en === fix.en && m.alt?.src === fix.th && !m.alt?.th;
  if (sameTitle && sameAlt) return m;
  return { ...m, title: fix.th, alt };
}

// --- remembering what was checked + a small daily budget -------------------------------------------

export function loadChecked(storage: StorageLike | null): Record<string, string> {
  try {
    const v = JSON.parse(storage?.getItem(TITLE_CHECKED_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveChecked(checked: Record<string, string>, storage: StorageLike | null) {
  try {
    const keys = Object.keys(checked);
    const trimmed = keys.length > MAX_CHECKED ? Object.fromEntries(keys.slice(-MAX_CHECKED).map((k) => [k, checked[k]])) : checked;
    storage?.setItem(TITLE_CHECKED_KEY, JSON.stringify(trimmed));
  } catch {
    /* full / private mode: checked again next time */
  }
}

export type TitleRuns = { day: string; calls: number; failedAt: number };

export function loadTitleRuns(today: string, storage: StorageLike | null): TitleRuns {
  try {
    const v = JSON.parse(storage?.getItem(TITLE_RUNS_KEY) ?? "null");
    if (v && typeof v === "object") {
      const failedAt = Number.isFinite(v.failedAt) ? Math.max(0, v.failedAt) : 0;
      const calls = v.day === today && Number.isFinite(v.calls) ? Math.max(0, v.calls) : 0;
      return { day: today, calls, failedAt };
    }
  } catch {
    /* new */
  }
  return { day: today, calls: 0, failedAt: 0 };
}

export function saveTitleRuns(r: TitleRuns, storage: StorageLike | null) {
  try {
    storage?.setItem(TITLE_RUNS_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

/** One background pass. Returns the fixes to apply (the caller saves them). */
export async function runTitleCheck(io: {
  meals: MealLike[];
  ask: (meals: TitleAsk[]) => Promise<TitleFix[]>;
  storage: StorageLike | null;
  today: string;
  now?: number;
  online: boolean;
}): Promise<{ fixes: TitleFix[]; checkedIds: string[]; stoppedBy: "none" | "offline" | "budget" | "paused" | "failed" | "done" }> {
  const now = io.now ?? Date.now();
  const checked = loadChecked(io.storage);
  const todo = mealsToCheck(io.meals, checked, io.today);
  if (!todo.length) return { fixes: [], checkedIds: [], stoppedBy: "done" };
  if (!io.online) return { fixes: [], checkedIds: [], stoppedBy: "offline" };
  const runs = loadTitleRuns(io.today, io.storage);
  if (runs.failedAt && now - runs.failedAt < TITLE_FAIL_PAUSE_MS) return { fixes: [], checkedIds: [], stoppedBy: "paused" };
  if (runs.calls >= MAX_TITLE_CALLS_PER_DAY) return { fixes: [], checkedIds: [], stoppedBy: "budget" };
  saveTitleRuns({ ...runs, calls: runs.calls + 1 }, io.storage);
  let fixes: TitleFix[];
  try {
    fixes = await io.ask(todo.map(toAsk));
  } catch {
    saveTitleRuns({ ...runs, calls: runs.calls + 1, failedAt: now }, io.storage);
    return { fixes: [], checkedIds: [], stoppedBy: "failed" };
  }
  saveTitleRuns({ ...runs, calls: runs.calls + 1, failedAt: 0 }, io.storage);
  // Remember each answered meal with the signature it WILL have after the fix, so it is not asked again.
  const byId = new Map(todo.map((m) => [m.id, m]));
  for (const f of fixes) {
    const m = byId.get(f.id);
    if (m) checked[f.id] = titleSignature(applyTitleFix(m, f));
  }
  saveChecked(checked, io.storage);
  return { fixes, checkedIds: fixes.map((f) => f.id), stoppedBy: "none" };
}
