// SERVER ONLY (Round 81). Asks the AI for meal names made only from the foods in each meal (Thai + English).

import { z } from "zod";
import type { Lang } from "../i18n.ts";
import { TITLE_SYSTEM, parseTitleReply, type TitleAsk, type TitleFix } from "../mealTitles.ts";
import { callAi } from "./ai.ts";

const ReplySchema = z.object({
  meals: z.array(z.object({ id: z.string().catch(""), title_th: z.string().catch(""), title_en: z.string().catch("") })).catch([]),
});

export async function checkMealTitles(meals: TitleAsk[], lang: Lang): Promise<TitleFix[]> {
  if (process.env.AI_MOCK === "1") return meals.map((m) => ({ id: m.id, th: m.foods.join("และ"), en: `${m.foods.join(" and ")} (en)` }));
  const text = `Meals (JSON): ${JSON.stringify(meals)}`;
  const read = await callAi(TITLE_SYSTEM, [{ type: "text", text }], ReplySchema, lang);
  return parseTitleReply(read, meals.map((m) => m.id));
}
