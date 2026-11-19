// SERVER ONLY (Round 79). Turns short food names into Thai + English with the same AI helper the other routes use.

import { z } from "zod";
import type { Lang } from "../i18n.ts";
import { TRANSLATE_SYSTEM, parseTranslateReply, type NamePair } from "../translateNames.ts";
import { callAi } from "./ai.ts";

const ReplySchema = z.object({
  names: z.array(z.object({ src: z.string().catch(""), th: z.string().catch(""), en: z.string().catch("") })).catch([]),
});

/** A tiny fake for AI_MOCK=1 (local tests with no key): known dishes, otherwise a visible placeholder. */
const MOCK: Record<string, { th: string; en: string }> = {
  ข้าวหน้าปลาทู: { th: "ข้าวหน้าปลาทู", en: "Rice with mackerel" },
  ผัดกะเพราหมู: { th: "ผัดกะเพราหมู", en: "Stir-fried basil pork" },
  ต้มยำกุ้ง: { th: "ต้มยำกุ้ง", en: "Tom yum shrimp soup" },
  "Green salad": { th: "สลัดผัก", en: "Green salad" },
};

export async function translateNames(names: string[], lang: Lang): Promise<NamePair[]> {
  if (process.env.AI_MOCK === "1") {
    return names.map((src) => {
      const known = MOCK[src];
      if (known) return { src, ...known };
      return /[฀-๿]/.test(src) ? { src, th: src, en: `${src} (en)` } : { src, th: `${src} (th)`, en: src };
    });
  }
  const text = `Names (JSON): ${JSON.stringify(names)}`;
  const read = await callAi(TRANSLATE_SYSTEM, [{ type: "text", text }], ReplySchema, lang);
  return parseTranslateReply(read, names);
}
