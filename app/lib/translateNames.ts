// Round 79: the request / answer of POST /api/translate-names. No React, no network here, so the
// server route, the phone and the tests all use the same rules.

import { MAX_NAME_LEN, cleanAltText, nameLang } from "./names.ts";

export const MAX_NAMES = 60;

/** One translated name. `src` is exactly the text that was sent. */
export type NamePair = { src: string; th: string; en: string };

export type NamesCheck = { ok: true; names: string[] } | { ok: false; error: string };

/** Check what the phone sent: a list of up to 60 texts, each up to 120 letters. Blank ones and repeats are dropped. */
export function parseTranslateRequest(body: unknown): NamesCheck {
  const list = body && typeof body === "object" ? (body as { names?: unknown }).names : undefined;
  if (!Array.isArray(list)) return { ok: false, error: "names must be a list of texts" };
  if (list.length > MAX_NAMES) return { ok: false, error: `at most ${MAX_NAMES} names at a time` };
  const names: string[] = [];
  for (const v of list) {
    if (typeof v !== "string") return { ok: false, error: "every name must be text" };
    const s = v.trim();
    if (!s) continue;
    if (s.length > MAX_NAME_LEN) return { ok: false, error: `a name is longer than ${MAX_NAME_LEN} letters` };
    if (!names.includes(s)) names.push(s);
  }
  if (!names.length) return { ok: false, error: "no names to translate" };
  return { ok: true, names };
}

/**
 * Read the model's answer. Keeps only names we really asked for, once each.
 * A pair needs the language the name is NOT written in; the other side falls back to the name itself.
 */
export function parseTranslateReply(raw: unknown, asked: string[]): NamePair[] {
  const rows = raw && typeof raw === "object" ? (raw as { names?: unknown }).names : undefined;
  if (!Array.isArray(rows)) return [];
  const out: NamePair[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const src = typeof o.src === "string" ? o.src.trim() : "";
    if (!src || !asked.includes(src) || seen.has(src)) continue;
    let th = cleanAltText(o.th);
    let en = cleanAltText(o.en);
    if (nameLang(src) === "th") {
      th = src;
      if (!en) continue;
    } else {
      en = src;
      if (!th) continue;
    }
    seen.add(src);
    out.push({ src, th, en });
  }
  return out;
}

/** Instructions for the model. Exported so a test can look at it. */
export const TRANSLATE_SYSTEM = `You translate short food names for a Thai food diary app.
You get a JSON list of names. Each may be Thai or English (or mixed).
For EVERY name give both versions:
- "th": the name in common, natural Thai, the way people say it. Thai dishes keep their usual Thai name.
- "en": the name in English the way a restaurant menu or a food label would say it (e.g. "ข้าวหน้าปลาทู" → "Rice with mackerel", "ผัดกะเพราหมู" → "Stir-fried basil pork").
Rules:
- Keep them short, like a dish name. No sentences, no explanations.
- Keep brand names as they are (e.g. "KFC", "Oatly").
- Keep numbers and sizes.
- "src" must be copied EXACTLY from the input.
- If a name is already in one language, copy it to that side and translate it to the other.
Return ONLY JSON: {"names":[{"src":"...","th":"...","en":"..."}]}`;
