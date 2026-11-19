// SERVER ONLY. Talks to the AI through OpenRouter (playground rule).
// The key is read from the server's environment (OPENROUTER_API_KEY) and
// never reaches the phone.

import { z } from "zod";
import { trFor, type Lang } from "../i18n.ts";
import { LEGACY_MARGIN_PCT, cleanBufferPct } from "../calorieBuffer.ts";
import { MAX_MEAL_PHOTOS } from "../mealPhotos.ts";
import { UNITS, type IngredientUnit } from "../types.ts";
import { IngredientRefSchema, cleanIngredientRef, type IngredientRef } from "../ingredientRef.ts";
export { IngredientRefSchema, cleanIngredientRef, type IngredientRef };
import { FAST_VISION_OPTS } from "../aiSpeed.ts";
import { groundItems, type GroundedFields, type Grounding } from "./foodDbPick.ts";
import { usdaConfig } from "../food/usda.ts";
import { ChatReplySchema, ChatReplyShape, pickReplyLang, type ChatReply, type ChatRequest } from "../foodChat.ts";
import { mockChat } from "./chatMock.ts";
import { AI_PLACES, aiRoom, fitAiIdeas, kcalRoom, type AiGroups, type RawIdea } from "../suggest.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const MODEL = "google/gemini-3.8-flash";
const TIMEOUT_MS = 50_000;

const num = z.coerce.number().catch(0);

const BoxSchema = z.object({
  x: num.describe("left edge, 0..1 of image width"),
  y: num.describe("top edge, 0..1 of image height"),
  w: num.describe("width, 0..1"),
  h: num.describe("height, 0..1"),
});

const ItemSchema = z.object({
  name: z.string().describe("Food name"),
  amount: num.describe("How much was EATEN, as a number"),
  unit: z.string().catch("").describe("Unit word, e.g. จาน ชิ้น ถ้วย ช้อนโต๊ะ กรัม (Thai) or plate piece cup tbsp g (English)"),
  grams: num.optional().describe("Your estimate of the weight EATEN in grams. Work this out BEFORE kcal."),
  kcal: num.describe("kcal for the amount eaten, including the oil/fat/sugar it was cooked with"),
  protein: num.describe("grams"),
  carbs: num.describe("grams"),
  fat: num.describe("grams"),
  estimated: z.boolean().catch(false).describe("true if amount or recipe is uncertain"),
  kind: z.enum(["food", "extra"]).catch("food").describe("extra = oil, sauce, dressing, sugar or add-on"),
  note: z.string().nullish().describe("Short note, e.g. why it is an estimate; or null"),
  dairy: z.boolean().optional().catch(false).describe("true if this item likely contains milk or any milk product: milk, cream, cheese, yogurt, butter, ghee, condensed or evaporated milk, milk powder, whey, ice cream, creamer. Coconut milk, soy milk, almond/oat milk and peanut butter are NOT dairy."),
  dairySource: z.string().nullish().describe("If dairy is true: the likely milk product in a few words (e.g. sweetened condensed milk); else null"),
  box: BoxSchema.nullish().describe("Where this food is in the photo (fractions 0..1); null if not locatable or no photo"),
  userAmount: z.boolean().optional().catch(false).describe("true ONLY if the user told you this item's exact weight or volume (e.g. 120 g, 250 ml, 1 kg) or an exact count of a fixed-size thing (e.g. 2 eggs, 1 can), so you did not guess the amount; else false"),
  fromLabel: z.boolean().optional().catch(false).describe("true ONLY if this item's kcal (and macros) come from numbers PRINTED on its own package, nutrition facts table (ข้อมูลโภชนาการ) or energy label (e.g. 'พลังงาน 150 กิโลแคลอรี'), clearly readable in the photo, or typed by the user as the numbers on the pack; else false"),
});

// Round 69: for the photo / text read the model ALSO names each item for the local food table, and gives its weight and state.
// The server then looks the numbers up (see foodDbPick.ts); the model's own kcal/macros are only the fallback.
const AnalyzeItemSchema = ItemSchema.extend({
  name_th: z.string().optional().catch("").describe("The SAME food name in common Thai, short, e.g. \"ข้าวหน้าปลาทู\". Brand names stay as they are."),
  name_en: z.string().optional().catch("").describe("The SAME food name in English the way a menu would say it, short, e.g. \"Rice with mackerel\". Brand names stay as they are."),
  en: z.string().optional().catch("").describe("ENGLISH name to search a food database, 1-4 plain words, the way USDA names foods, e.g. \"rice white cooked\", \"egg whole boiled\", \"banana\", \"oyster sauce\", \"vegetable oil\", \"chicken breast grilled\". For a mixed Thai dish give the closest plain English name, e.g. \"stir-fried basil chicken\", \"papaya salad\". Always English, whatever language the other fields use."),
  grams: num.optional().describe("Weight EATEN in grams (a number, never 0 for a real food). Work this out BEFORE kcal."),
  state: z.enum(["raw", "cooked", "boiled", "steamed", "fried", "grilled", "baked", "dried", "other"]).optional().catch("other").describe("How the food was eaten: raw (fresh fruit, raw veg), cooked (plain cooked, e.g. rice), boiled, steamed, fried, grilled, baked, dried; other for sauces, drinks, mixed dishes"),
});

export const AnalysisSchema = z.object({
  title: z.string().catch("").describe("Short name for the whole meal"),
  title_th: z.string().optional().catch("").describe("The same meal name in common Thai"),
  title_en: z.string().optional().catch("").describe("The same meal name in English, as a menu would say it"),
  items: z.array(AnalyzeItemSchema),
  question: z.string().nullish().describe("ONE short, easy question ONLY if a missing detail (portion size, cooking oil, sauce/dressing, sugar, fried vs steamed…) would change the meal's kcal a lot; else null"),
  visual: z.string().nullish().describe("ONE short ENGLISH sentence saying how the whole meal looks (used to draw a picture of it), e.g. \"Thai pad kra pao (ผัดกะเพรา): stir-fried basil pork with a fried egg over rice on a white plate\". Only the food and its plate/bowl/glass (no scale, table, packaging, hands or other props). Only foods really in the items list. Else null"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

const EditSchema = z.object({
  id: z.string().describe("id of an existing item"),
  action: z.enum(["update", "remove"]),
  item: ItemSchema.nullish().describe("Full new values for update; null for remove"),
});

export const RefineSchema = z.object({
  reply: z.string().catch("").describe("One or two short sentences saying what changed"),
  question: z.string().nullish(),
  edits: z.array(EditSchema).catch([]).describe("ONLY items the user's message is about"),
  adds: z.array(ItemSchema).catch([]).describe("New items the user mentioned (e.g. oil, sauce)"),
  title: z.string().nullish().catch(null).describe("A NEW meal title only when the change makes the current title wrong (e.g. it names a food that turned out to be something else); otherwise null"),
  title_th: z.string().nullish().catch(null).describe("The new title in Thai (same meaning), when title is given"),
  title_en: z.string().nullish().catch(null).describe("The new title in English (same meaning), when title is given"),
});
export type Refine = z.infer<typeof RefineSchema>;

/** The JSON shape, written into the prompt so the model knows exactly what to return. */
function shapeOf(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }));
}

/** The app can be in Thai or English; the AI writes in the same language. */
function languageRule(lang: Lang): string {
  return lang === "en"
    ? "Write every name, unit, note, dairySource, reply and question in simple English (Thai dish names may be given in English, e.g. \"Pad kra pao (stir-fried basil pork)\")."
    : "Write every name, unit, note, dairySource, reply and question in Thai.";
}

const ANALYZE_SYSTEM = (lang: Lang) => `You are a careful nutrition assistant inside a Thai food diary app.
Estimate what the user ate from a photo and/or their description.
Rules:
- ${languageRule(lang)} The one exception is "en" (and "visual"): always English.
- List each separate food on the plate as its own item. Numbers are for the amount actually EATEN, using the user's note (e.g. "ate half the chicken" → half portion).
- If the user mentions oil, sauce, dressing, sugar or other add-ons, list each as its own item with kind "extra".
- How to estimate each food, step by step:
  1) Judge its size against the plate, bowl, spoon or hand in the photo. Standard Thai plates are about 23–26 cm wide; a plate of rice is often 150–250 g of cooked rice.
  2) Write the eaten weight in grams.
  3) Work out kcal from grams using values for the dish AS COOKED in Thai shops and homes (cooked rice ≈ 130 kcal/100 g), not for plain raw ingredients.
- Thai dishes are often cooked with oil, coconut milk, sugar and fatty meat. Count this hidden energy REALISTICALLY, the way the dish is usually made: stir-fried, deep-fried and fried-egg dishes soak up oil (often 1–2 tbsp = 120–240 kcal per plate); curries with coconut milk, sweet sauces and pork belly add a lot too. Do not leave it out, and do not inflate it. Include it in the dish's kcal, or list cooking oil as its own "extra" item (estimated=true, say so in note) — never both.
- Give your single BEST estimate: not deliberately high, not deliberately low. Portions in photos can look smaller than they are, so judge the size carefully against the plate. NEVER add a safety margin yourself — the app adds an optional calorie buffer only if the user chose one.
- Check your numbers: kcal should be close to protein×4 + carbs×4 + fat×9.
- Set estimated=true whenever portion size or recipe is a guess.
- PRINTED LABELS: if the photo clearly shows a nutrition facts table (ข้อมูลโภชนาการ / Nutrition Facts) or printed energy (พลังงาน ... กิโลแคลอรี / kcal) for an item, or the user types the numbers printed on the pack, use THOSE numbers exactly — do not enlarge them, add no oil — and set fromLabel=true. Labels are usually per serving (หนึ่งหน่วยบริโภค): multiply by the servings actually eaten (if they ate the whole pack, use servings per pack, จำนวนหน่วยบริโภคต่อ...). If a macro is not printed, estimate only that one and say so in note. If the numbers are blurry or cut off, do NOT guess them: set fromLabel=false and estimate normally. Food with no label in the photo always has fromLabel=false.
- When the user gives an item's exact weight or volume, use it EXACTLY (do not enlarge it) and set userAmount=true for THAT item only. Use food-table values for that food in the state it was eaten (cooked, raw, dried). The weight covers only that item: still count cooking oil, sauce, sugar or coconut milk the dish was made with, unless the user said there was none. Any oil, sauce or other add-on whose amount you had to guess goes in its OWN "extra" item with userAmount=false and estimated=true — never hide a guessed add-on inside the weighed item. Set estimated=false on the weighed item only if its recipe is also clear; if part of its recipe is still a guess, set estimated=true. If they say how it was cooked (e.g. grilled with no oil, air-fried, steamed), follow that: do not add oil they said they did not use.
- dairy: think about how the dish is usually made in Thailand (e.g. Thai iced tea, coffee drinks, bakery, creamy soups, some curries and desserts use milk, butter or condensed milk). Set dairy=true when it likely contains ANY milk product, and name it in dairySource.
- box: when there is a photo and you can locate the food, give its bounding box as fractions (0..1) of the image. Otherwise null.
- question: if an important detail is missing and you cannot see or reasonably infer it — portion size, how much cooking oil, a sauce or dressing, sugar or milk in a drink, fried vs steamed/boiled — and the answer would change the meal's kcal a lot (roughly 100 kcal or 20% or more), ask ONE short, easy question about the biggest one (e.g. "Was it stir-fried with a lot of oil or a little?"). Still give your best estimate now and set estimated=true on that item. Do NOT ask about small things (garnish, herbs, a pinch of salt, a splash of sauce). If nothing important is unclear, null.
- visual: always write it in English (whatever language the other fields use), keep a Thai dish name next to the English one, and mention only foods you listed in items. Describe ONLY the food or drink itself and the plate, bowl or glass it is in. NEVER mention scales, tables, packaging, hands, utensils in the background, phones, receipts or anything else around it.
- name_th / name_en (and title_th / title_en for the whole meal): give the SAME name in BOTH languages, every time, whatever the app language is: Thai in common natural Thai, English the way a menu would say it (e.g. "ข้าวหน้าปลาทู" and "Rice with mackerel"). Short, no explanations, keep brand names. "name" and "title" keep following the language rule above. name_th/name_en are a TRANSLATION of "name" (and title_th/title_en of "title"), never a new guess: if the user named the dish or an item (e.g. "แหนมเอ็นหมู"), use their words and translate exactly those ("Fermented pork tendon"), even if the photo looks like something else.
- en, grams and state are used to look the real nutrition numbers up in a food database, so make them exact: en is always English; state says raw / cooked / boiled / steamed / fried / grilled / baked / dried (use "cooked" for plain cooked rice and noodles, "other" for sauces and mixed dishes). Do not put oil, sauce or other items inside a plain item's en.
- Use typical Thai portion sizes and Thai food composition values (e.g. INMU Thai Food Composition Table). Be realistic: do not shrink portions or leave out cooking fat.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(AnalysisSchema)}`;

const REFINE_SYSTEM = (lang: Lang) => `You are a careful nutrition assistant inside a Thai food diary app.
The user already has a list of food items for one plate. They are now explaining more about what they actually ate.
Rules:
- Change ONLY the items their message is about. Do not touch other items.
- For an update, return the full new values for that item: amount eaten and nutrients scaled to what was actually eaten. Keep its box unchanged.
- "Ate it all" / "finished it" means no change for that item.
- NEVER add any safety margin yourself. The numbers you see are the AI's own best estimates, except items with margin=true: those were saved by an older version of the app and already include an old +${LEGACY_MARGIN_PCT}% on all numbers. When you update an item by scaling (e.g. "ate half"), scale from its current numbers and set userAmount=false. If you must re-estimate an item from scratch without an exact amount, give your plain best estimate (userAmount=false).
- If the user now gives an item's exact weight or volume (e.g. "salmon was 120 g"), recalculate that item with food-table values for exactly that amount, in the state it was eaten, and set userAmount=true. The weight covers only that item: cooking oil, sauce or add-ons whose amount you guess go in their own "extra" item with userAmount=false and estimated=true. Same for new items in adds: userAmount=true only if they gave the exact amount.
- If the user now gives the numbers printed on an item's pack or nutrition label (e.g. "the label says 180 kcal, protein 10 g"), use those numbers exactly for the amount eaten and set fromLabel=true. Same for adds.
- If they answer an earlier question (e.g. how much oil, which sauce, how it was cooked), update only the item(s) it is about.
- If they mention oil, sauce or add-ons that are not in the list, add them in adds (kind "extra"); if the amount is unclear, give a typical amount, set estimated=true, and say so in note.
- For every item you return, set dairy=true (and dairySource) when it likely contains ANY milk product.
- If a change is ambiguous, make no edit for it and ask one short question.
- If the user says an item is actually a DIFFERENT food (e.g. "this is not fried chicken, it is แหนมเอ็นหมูทอด"), update that item: new name in their words, nutrients for the new food. WHENEVER you rename an item and the meal title mentions the old food — in ANY language, Thai or English, even as one part of a longer title (e.g. the title "Grilled Chicken Skewers and Fried Chicken" while the item "Fried chicken" turns out to be fried fermented pork rib cartilage) — you MUST also return a new title. Write that title in the SAME language the current title is written in (English title → English, Thai title → Thai), keep the foods in it that did not change, replace the old food with the new one, and keep it short (about 6 words at most). Always give title_th and title_en too. e.g. "ข้าวไก่ทอด" → "ข้าวแหนมเอ็นหมูทอด". Never leave the old food's name in the title.
- Every item you return has name_th and name_en: the SAME name as "name" in Thai and in English (a translation of "name", never a new guess).
- ${languageRule(lang)}
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(RefineSchema)}`;

export class AiError extends Error {
  // (plain fields, not constructor parameter properties, so the tests can load this file directly)
  code: "not-configured" | "auth" | "rate-limit" | "credits" | "timeout" | "network" | "bad-output" | "api";
  status: number;
  constructor(code: AiError["code"], message: string, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function aiStatus() {
  return {
    configured: Boolean(process.env.OPENROUTER_API_KEY),
    mock: process.env.AI_MOCK === "1",
    model: MODEL,
    passcode: Boolean(process.env.APP_PASSCODE?.trim()),
    // Round 41: only says whether USDA is set up — never the key itself.
    usda: usdaConfig(process.env).ok || process.env.USDA_MOCK === "1",
  };
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Pull the JSON object out of the reply, even if it is wrapped in a code fence. */
function extractJson(content: string, lang: Lang): unknown {
  const unreadable = trFor(lang)("อ่านผลจาก AI ไม่ได้ ลองอีกครั้ง", "Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new AiError("bad-output", unreadable, 502);
    try {
      return JSON.parse(m[0]);
    } catch {
      throw new AiError("bad-output", unreadable, 502);
    }
  }
}

/** Round 68: extra OpenRouter settings for the slow photo read (never used by the text-only routes). */
type CallOpts = { reasoning?: { effort: string }; max_tokens?: number; provider?: { sort: string } };

export async function callAi<T>(system: string, content: Part[], schema: z.ZodType<T>, lang: Lang, opts: CallOpts = {}): Promise<T> {
  const t = trFor(lang);
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiError("not-configured", t("ยังไม่ได้ตั้งค่า OpenRouter API key บนเซิร์ฟเวอร์", "The OpenRouter API key is not set up on the server"), 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        ...opts,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw aborted
      ? new AiError("timeout", t("AI ตอบช้าเกินไป ลองอีกครั้ง", "The AI took too long. Please try again."), 504)
      : new AiError("network", t("เชื่อมต่อ OpenRouter ไม่ได้ (เครือข่าย)", "Couldn't reach OpenRouter (network)"), 503);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let msg = detail;
    try {
      msg = JSON.parse(detail)?.error?.message ?? detail;
    } catch {
      /* keep raw text */
    }
    msg = String(msg).slice(0, 200);
    if (res.status === 401) throw new AiError("auth", `${t("API key ไม่ถูกต้อง", "The API key is wrong")} (401): ${msg}`, 502);
    if (res.status === 402) throw new AiError("credits", `${t("เครดิต OpenRouter ไม่พอ", "Not enough OpenRouter credit")} (402): ${msg}`, 502);
    if (res.status === 429) throw new AiError("rate-limit", t("เรียก AI ถี่เกินไป ลองใหม่อีกครั้ง (429)", "Too many AI requests. Please try again (429)"), 503);
    throw new AiError("api", `${t("OpenRouter ตอบกลับข้อผิดพลาด", "OpenRouter returned an error")} ${res.status}: ${msg}`, 502);
  }

  const data = await res.json().catch(() => null);
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) {
    const err = data?.error?.message;
    throw new AiError(
      "bad-output",
      err ? `${t("AI ไม่ได้ตอบกลับ", "The AI didn't answer")}: ${err}` : t("AI ไม่ได้ตอบกลับ ลองอีกครั้ง", "The AI didn't answer. Please try again."),
      502,
    );
  }
  const parsed = schema.safeParse(extractJson(text, lang));
  if (!parsed.success) {
    console.error("[ai] schema mismatch", parsed.error.issues.slice(0, 3));
    throw new AiError("bad-output", t("ผลจาก AI ไม่ครบรูปแบบ ลองอีกครั้ง", "The AI's answer was incomplete. Please try again."), 502);
  }
  return parsed.data;
}

// Round 40: the AI's plain best estimates go to the phone. No margin is added here any more;
// the phone adds her optional calorie buffer (kcal only) — see app/lib/calorieBuffer.ts.
export type AnalysisOut = Omit<Analysis, "items"> & { items: (Analysis["items"][number] & Partial<GroundedFields>)[]; grounding?: Grounding };
export type RefineOut = Refine;

export async function analyzeMeal(input: { images: string[]; text: string; lang: Lang }): Promise<AnalysisOut> {
  if (process.env.AI_MOCK === "1") return mockAnalyze(input);
  const content: Part[] = [
    {
      type: "text",
      text: input.images.length
        ? `${input.images.length > 1 ? `${input.images.length} photos of ONE meal (different angles or parts of the same meal; do not count the same food twice). ` : "Photo of my meal. "}My extra notes: ${input.text || "(none)"}`
        : `No photo. What I ate: ${input.text}`,
    },
  ];
  if (input.images.length > MAX_MEAL_PHOTOS || input.images.some((i) => !/^data:image\/(jpeg|png|webp);base64,/.test(i)))
    throw new AiError("bad-output", trFor(input.lang)("รูปแบบรูปไม่รองรับ", "This picture format is not supported"), 400);
  for (const url of input.images) content.push({ type: "image_url", image_url: { url } });
  const read = await callAi(ANALYZE_SYSTEM(input.lang), content, AnalysisSchema, input.lang, FAST_VISION_OPTS);
  // Round 69: the numbers come from the local food table when it has the food; the model's estimate is the fallback.
  try {
    const { items, grounding } = await groundItems(read.items);
    return { ...read, items, grounding };
  } catch (e) {
    console.error("[analyze] grounding failed, keeping estimates:", e instanceof Error ? e.message : String(e));
    return read;
  }
}

export type RefineInput = {
  title: string;
  items: { id: string; name: string; amount: number; unit: string; kcal: number; protein: number; carbs: number; fat: number; kind: string; estimated: boolean; margin: boolean }[];
  history: { role: "user" | "assistant"; text: string }[];
  message: string;
  lang: Lang;
};

export async function refineMeal(input: RefineInput): Promise<RefineOut> {
  if (process.env.AI_MOCK === "1") return mockRefine(input);
  const text = [
    `Meal: ${input.title}`,
    `Current items (JSON): ${JSON.stringify(input.items)}`,
    input.history.length
      ? `Earlier messages:\n${input.history.map((h) => `${h.role}: ${h.text}`).join("\n")}`
      : "",
    `New message from me: ${input.message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return callAi(REFINE_SYSTEM(input.lang), [{ type: "text", text }], RefineSchema, input.lang);
}


// ---------------------------------------------------------------------------
// Round 54/57: the "Ask AI" chat. Numbers and food names about today only; nothing is saved by the server.
// ---------------------------------------------------------------------------

const CHAT_SYSTEM = (lang: Lang) => `You are a warm personal food and eating helper inside a Thai food diary app. The user chats with you, often BEFORE eating. Nothing she says here is saved to her diary.
You are told her recorded data: age, sex, height, weight, goal (lose / muscle / gain / maintain), targets for kcal, protein, carbs and fat, what she has eaten TODAY (food names with kcal, and totals of kcal, protein, carbs, fat), the kcal left, and a list of dishes you already suggested in this chat. Some data may be missing: then do not guess it.
LANGUAGE: reply in the language of her LATEST message (Thai text → Thai, English text → English). This time that is ${lang === "en" ? "English: write simple, plain English" : "Thai: write simple, plain Thai (Thai dish names are fine)"}.
STYLE: warm, short, plain words, a few sentences unless she asks for detail. Never shame, scare or lecture. Mark every estimate "ประมาณ" / "about"; never claim data is exact or verified.
HOW TO ANSWER:
A) OPEN QUESTIONS ("what should I eat", "what to eat more", "what is left", "what do I need"): FIRST give a short status from HER numbers, 2-3 short sentences or a tiny bullet list: kcal left; is protein reached (eaten vs target, in g); is fat over its target; where carbs stand (eaten vs target). No lecture. THEN ask what style of food she feels like and give "quickReplies" (3-6 short chips, each at most 24 characters, in her language) that fit her remaining kcal and gaps, for example soup/boiled, noodles, veggies/salad, pure protein, one-plate rice, snack, dessert, drink. If kcal left is small, offer only light styles. In this first turn do NOT give "suggestions" (no food cards).
B) A STYLE is named (she tapped a chip, or already said e.g. "I want soup"): give 3 DIFFERENT options in "suggestions": each a distinct dish with a realistic portion in amountText, kcal and protein/carbs/fat grams. Choose and order them to fit her remaining kcal and gaps (protein short → protein-forward; fat over its target → lighter). In "reply" write one short line per option saying why it fits. Optionally give 1-3 "quickReplies" such as "anything else?".
C) "ANYTHING ELSE" / "other options" / "again": give 2-3 NEW options that are NOT in the already-suggested list and not in earlier assistant messages. Scan the history; NEVER repeat a dish; vary cuisine and cooking method. Never answer with the same pattern or just one item.
D) A question about one specific food ("how many calories in…"): answer briefly with a clear estimate, say whether it fits her kcal left, and put that ONE dish in "suggestions". Other general food, habit, meal-idea and lifestyle questions: answer helpfully, keep the food and nutrition focus.
SAFETY: you are not a doctor. No diagnosis, no medication or supplement-dose advice; for medical matters kindly say a doctor or dietitian is the right person, and still share simple food ideas if helpful.
RESTRICTIONS: if "avoidDairy" is true she avoids all milk products: never suggest dairy (milk, cheese, yogurt, butter, cream). If it is not given, assume no restriction. You do not know her name or older days; do not guess them.
Make the numbers in "suggestions" match your reply. Leave "suggestions" and "quickReplies" out (or empty) when they do not apply.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(ChatReplyShape)}`;

function gapLine(label: string, eaten: number, target: number | null | undefined): string | null {
  if (target == null) return null;
  const d = Math.round(target - eaten);
  return `${label}: ${eaten}/${target} g (${d >= 0 ? `${d} g left` : `${-d} g over`})`;
}

function chatPrompt(input: ChatRequest): string {
  const c = input.context;
  const body = [
    c.age != null ? `age ${c.age}` : null,
    c.sex ? `sex ${c.sex}` : null,
    c.heightCm != null ? `height ${c.heightCm} cm` : null,
    c.weightKg != null ? `weight ${c.weightKg} kg` : null,
    c.goal ? `goal ${c.goal}` : null,
  ].filter(Boolean);
  const gaps = [gapLine("protein", c.protein, c.proteinTarget), gapLine("carbs", c.carbs, c.carbsTarget), gapLine("fat", c.fat, c.fatTarget)].filter(Boolean);
  const lines = [
    `Her recorded data: ${body.length ? body.join(", ") : "(body details not recorded)"}.`,
    `Targets: ${c.kcalTarget} kcal/day${c.proteinTarget != null ? `, protein ${c.proteinTarget} g` : ""}${c.carbsTarget != null ? `, carbs ${c.carbsTarget} g` : ""}${c.fatTarget != null ? `, fat ${c.fatTarget} g` : ""}.`,
    `Today so far: ${c.eatenKcal} kcal, protein ${c.protein} g, carbs ${c.carbs} g, fat ${c.fat} g; kcal left ${c.remainingKcal}.`,
    gaps.length ? `Status vs targets: ${gaps.join("; ")}.` : "",
    c.todayMeals?.length ? `Eaten today: ${c.todayMeals.map((m) => `${m.name} (${m.kcal} kcal)`).join("; ")}.` : "Eaten today: nothing recorded yet.",
  ].filter(Boolean);
  if (c.avoidDairy) lines.push("avoidDairy: true (she avoids all milk products).");
  lines.push(input.shownDishes?.length ? `Dishes already suggested in this chat (do NOT suggest again): ${input.shownDishes.join("; ")}.` : "Dishes already suggested in this chat: none.");
  lines.push("Conversation (the last line is the new message to answer):");
  for (const m of input.messages) lines.push(`${m.role === "user" ? "user" : "assistant"}: ${m.text}`);
  return lines.join("\n");
}

export async function chatReply(input: ChatRequest): Promise<ChatReply> {
  if (process.env.AI_MOCK === "1") return mockChat(input);
  // Reply in the language of her latest message; the app language only decides when that is unclear.
  const latest = [...input.messages].reverse().find((m) => m.role === "user")?.text;
  const lang = pickReplyLang(latest, input.context.lang);
  return callAi(CHAT_SYSTEM(lang), [{ type: "text", text: chatPrompt(input) }], ChatReplySchema, lang);
}

// ---------------------------------------------------------------------------
// TEST MODE ONLY (AI_MOCK=1): a fake, fixed answer so the screens can be
// tested without an API key. The app shows a clear "AI จำลอง" badge.
// ---------------------------------------------------------------------------

function mockAnalyze(input: { images: string[]; text: string; lang: Lang }): AnalysisOut {
  const hasImage = input.images.length > 0;
  const items = [
    { name: "ข้าวสวย", name_th: "ข้าวสวย", name_en: "Steamed rice", amount: 1, unit: "ทัพพี", kcal: 160, protein: 3, carbs: 35, fat: 0.4, estimated: false, kind: "food", note: null, box: hasImage ? { x: 0.08, y: 0.45, w: 0.4, h: 0.4 } : null },
    { name: "ไก่ทอด", name_th: "ไก่ทอด", name_en: "Fried chicken", amount: 1, unit: "ชิ้น", kcal: 290, protein: 24, carbs: 9, fat: 17, estimated: false, kind: "food", note: null, box: hasImage ? { x: 0.5, y: 0.15, w: 0.38, h: 0.38 } : null },
    { name: "ผักลวก", name_th: "ผักลวก", name_en: "Blanched vegetables", amount: 1, unit: "ถ้วย", kcal: 35, protein: 2, carbs: 6, fat: 0.3, estimated: false, kind: "food", note: null, box: hasImage ? { x: 0.52, y: 0.58, w: 0.36, h: 0.3 } : null },
  ] as Analysis["items"];
  const t = input.text;
  if (/ครึ่ง/.test(t) && /ไก่/.test(t)) {
    const c = items[1];
    Object.assign(c, { amount: 0.5, kcal: c.kcal / 2, protein: c.protein / 2, carbs: c.carbs / 2, fat: c.fat / 2 });
  }
  if (/ชาเย็น|นม/.test(t)) {
    items.push({ name: "ชาเย็น", amount: 1, unit: "แก้ว", kcal: 250, protein: 3, carbs: 42, fat: 8, estimated: true, kind: "food", note: null, dairy: true, dairySource: "นมข้นหวาน นมข้นจืด", box: null });
  }
  const riceG = t.match(/ข้าว\D{0,6}(\d+)\s*(กรัม|g)/);
  if (riceG) {
    const g = Number(riceG[1]);
    Object.assign(items[0], { amount: g, unit: "กรัม", kcal: g * 1.3, protein: g * 0.027, carbs: g * 0.28, fat: g * 0.003, userAmount: true });
  }
  if (/ฉลาก|label/i.test(t)) {
    items.push({ name: "นมถั่วเหลือง", amount: 1, unit: "กล่อง", kcal: 120, protein: 7, carbs: 12, fat: 5, estimated: false, kind: "food", note: null, box: null, fromLabel: true });
  }
  if (/น้ำมัน/.test(t)) {
    items.push({ name: "น้ำมันพืช", amount: 1, unit: "ช้อนชา", kcal: 40, protein: 0, carbs: 0, fat: 4.5, estimated: true, kind: "extra", note: "ไม่ได้ระบุปริมาณ ใช้ค่าประมาณ 1 ช้อนชา", box: null });
  }
  // Round 40: an important detail is missing (how much oil) → ask, instead of adding anything silently.
  const question = /ผัด/.test(t) && !/น้ำมัน/.test(t) ? "ผัดใช้น้ำมันเยอะหรือน้อยคะ? (เช่น 1 ช้อนชา หรือ 1 ช้อนโต๊ะ)" : null;
  return { title: "ข้าวไก่ทอดกับผักลวก", title_th: "ข้าวไก่ทอดกับผักลวก", title_en: "Fried chicken rice with blanched vegetables", items, question, visual: "Thai ข้าวไก่ทอด (fried chicken rice): fried chicken piece with steamed rice and blanched vegetables on a plate" };
}

function mockRefine(input: RefineInput): Refine {
  const msg = input.message;
  const edits: Refine["edits"] = [];
  const touched: string[] = [];
  for (const it of input.items) {
    const key = it.name.replace(/(ทอด|ลวก|สวย|ย่าง|ผัด)$/, "");
    const at = msg.indexOf(key);
    if (at < 0) continue;
    // look only at the words right after this food's name
    const after = msg.slice(at, at + key.length + 14);
    const grams = after.match(/(\d+)\s*(กรัม|g)/);
    if (grams && /ข้าว/.test(it.name)) {
      const g = Number(grams[1]);
      edits.push({
        id: it.id,
        action: "update",
        item: { ...it, kind: "food", amount: g, unit: "กรัม", kcal: g * 1.3, protein: g * 0.027, carbs: g * 0.28, fat: g * 0.003, note: null, box: null, userAmount: true },
      });
      touched.push(`${it.name} ${g} กรัม`);
    } else if (/ครึ่ง/.test(after)) {
      edits.push({
        id: it.id,
        action: "update",
        item: { ...it, kind: it.kind === "extra" ? "extra" : "food", amount: it.amount / 2, kcal: it.kcal / 2, protein: it.protein / 2, carbs: it.carbs / 2, fat: it.fat / 2, note: "กินครึ่งเดียว", box: null },
      });
      touched.push(`${it.name} เหลือครึ่ง`);
    } else if (/ไม่ได้กิน|ไม่กิน/.test(after)) {
      edits.push({ id: it.id, action: "remove", item: null });
      touched.push(`ลบ${it.name}`);
    }
  }
  return {
    reply: touched.length ? `ปรับแล้ว: ${touched.join(", ")} รายการอื่นคงเดิม` : "ไม่มีรายการที่ต้องแก้ ยอดเท่าเดิม",
    question: null,
    edits,
    adds: [],
  };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// One ingredient's nutrition per 100 g (for recipes, when there is no label).
// No buffer here: these are plain food-table values for a raw ingredient.
// ---------------------------------------------------------------------------


const INGREDIENT_SYSTEM = `You are a nutrition table inside a Thai food diary app.
The user types ONE ingredient name (Thai or English) they use in home cooking.
Give its nutrition per 100 g, from standard food composition tables (Thai INMU / USDA).
Rules:
- Use the ingredient as it is normally bought before cooking: RAW, unless the name says it is cooked, dried, fried, canned, etc. Say which in "state".
- Read the whole name: a brand, cut or kind changes the values (e.g. "salmon trout" ≠ "salmon", "chicken thigh with skin" ≠ "chicken breast").
- Make sure kcal ≈ protein×4 + carbs×4 + fat×9 (roughly).
- Numbers only, no ranges. If you do not recognise it as food, set known to false.
- Drinks, water, ice, salt, spices and sweeteners ARE ingredients. 0 is a correct value when it is really 0 (plain water = 0 kcal).
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(IngredientRefSchema)}`;


export async function lookupIngredient(input: { name: string; lang: Lang; unit?: IngredientUnit | null }): Promise<(IngredientRef & { unitFor: IngredientUnit | null }) | null> {
  const unit = input.unit ?? null;
  // For a counted unit like "กลีบ" or "กระป๋อง", unitG must be the weight of ONE of that unit.
  const kind = unit ? UNITS[unit].kind : null;
  const text =
    unit && kind === "count"
      ? `${input.name}\nThe user counts it in "${UNITS[unit].th}" (${UNITS[unit].en}). Set unitG to the typical weight in grams of ONE ${UNITS[unit].en} of this ingredient (the edible amount, without the container unless it is eaten).`
      : unit && kind === "volume"
        ? `${input.name}\nThe user measures it by volume (${UNITS[unit].en}). Set gPerMl to the grams in 1 ml of this ingredient as it is usually measured (e.g. sugar 0.85, flour 0.53, oil 0.92).`
        : input.name;
  const r = process.env.AI_MOCK === "1" ? mockIngredient(input.name) : await callAi(INGREDIENT_SYSTEM, [{ type: "text", text }], IngredientRefSchema, input.lang);
  return cleanIngredientRef(r, unit);
}

// ---------------------------------------------------------------------------
// Round 41: translate ONE food name into USDA search words. Only the food name is sent
// (never her profile or diary). The app's own safe word list is tried first; this is the fallback.
// ---------------------------------------------------------------------------

export const UsdaQuerySchema = z.object({
  query: z.string().catch("").describe("2-6 English words to search the USDA FoodData Central database, in USDA style (main food first), e.g. 'chicken breast skinless raw', 'rice white cooked', 'oyster sauce'. Keep raw/cooked, the cooking method (boiled, fried, baked, grilled, steamed), the meat cut and skin on/skinless ONLY if the name says them. Never add words the name does not say."),
  product: z.boolean().catch(false).describe("true if the name is a packaged branded product (a brand name), not a generic food or ingredient"),
});

const USDA_QUERY_SYSTEM = `You translate a food or ingredient name (often Thai) into English search words for the USDA FoodData Central database.
Translate the meaning exactly. Do not guess the state or cooking method if the name doesn't say it.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(UsdaQuerySchema)}`;

export async function translateForUsda(input: { name: string; lang: Lang }): Promise<{ query: string; product: boolean }> {
  if (process.env.AI_MOCK === "1") return { query: /แซลมอน/.test(input.name) ? "salmon raw" : "chicken", product: false };
  const r = await callAi(USDA_QUERY_SYSTEM, [{ type: "text", text: input.name.slice(0, 120) }], UsdaQuerySchema, input.lang);
  const query = r.query.replace(/[^a-zA-Z0-9 ,%'-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return { query, product: r.product };
}

// TEST MODE ONLY (AI_MOCK=1): fixed answers.
function mockIngredient(name: string): IngredientRef {
  if (/มันฝรั่ง|potato/i.test(name)) return { known: true, kcal: 77, protein: 2, carbs: 17, fat: 0.1, unitG: 170, gPerMl: null, state: "raw" };
  if (/แซลมอน|salmon/i.test(name)) return { known: true, kcal: 141, protein: 20.5, carbs: 0, fat: 6, unitG: null, gPerMl: null, state: "raw" };
  if (/น้ำแข็ง|^ice$|เกลือ|salt/i.test(name)) return { known: true, kcal: 0, protein: 0, carbs: 0, fat: 0, unitG: null, gPerMl: null, state: "prepared" };
  if (/xyz/i.test(name)) return { known: false, kcal: 0, protein: 0, carbs: 0, fat: 0, unitG: null, gPerMl: null, state: null };
  return { known: true, kcal: 100, protein: 3, carbs: 15, fat: 2, unitG: null, gPerMl: 0.9, state: "raw" };
}

// ---------------------------------------------------------------------------
// Barcode digits from a photo (backup when the free stripe reader on the phone fails).
// The AI reads the NUMBERS printed under the stripes. The app then checks the
// last digit (check digit), so a misread number is caught before any lookup.
// ---------------------------------------------------------------------------

export const BarcodeDigitsSchema = z.object({
  digits: z.string().nullable().catch(null).describe("The digits printed under the barcode, digits only, no spaces; null if you cannot read them all clearly"),
});

const BARCODE_SYSTEM = `You read the numbers printed under a product barcode (EAN-13, EAN-8, UPC-A) in a photo of food or drink packaging.
Rules:
- Read every digit printed under or beside the black-and-white stripes, left to right, including the small first and last digits outside the stripes.
- Return digits only (no spaces or dashes). Usually 13 digits, sometimes 8 or 12.
- Do NOT guess. If any digit is blurry, cut off or hidden, return null.
- Ignore other numbers on the pack (weights, dates, phone numbers, nutrition).
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(BarcodeDigitsSchema)}`;

export async function readBarcodeDigits(input: { image: string; lang: Lang }): Promise<string | null> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image))
    throw new AiError("bad-output", trFor(input.lang)("รูปแบบรูปไม่รองรับ", "This picture format is not supported"), 400);
  if (process.env.AI_MOCK === "1") return "3017624010701";
  const r = await callAi(
    BARCODE_SYSTEM,
    [
      { type: "text", text: "Photo of a product barcode." },
      { type: "image_url", image_url: { url: input.image } },
    ],
    BarcodeDigitsSchema,
    input.lang,
  );
  const digits = (r.digits ?? "").replace(/\D/g, "");
  return digits || null;
}

// ---------------------------------------------------------------------------
// Nutrition label photo → the numbers printed on the pack (per serving / per pack).
// Used when the barcode database has the wrong numbers. The label always wins.
// ---------------------------------------------------------------------------

export const LabelSchema = z.object({
  servingG: z.number().nullable().catch(null).describe("Grams (or mL) of the amount the numbers below are for, e.g. 20 for '1 ซอง (20 ก.)'; null if not printed"),
  liquid: z.boolean().catch(false).describe("true if that amount is in mL (a drink)"),
  kcal: z.number().nullable().catch(null).describe("Energy in kcal for that amount; null if not readable"),
  protein: z.number().nullable().catch(null).describe("Protein in g for that amount; null if not printed"),
  carbs: z.number().nullable().catch(null).describe("Total carbohydrate in g for that amount; null if not printed"),
  fat: z.number().nullable().catch(null).describe("Total fat in g for that amount; null if not printed"),
});
export type LabelRead = z.infer<typeof LabelSchema>;

const LABEL_SYSTEM = `You read the nutrition numbers printed on a food or drink package in a photo (Thai or any language).
Thai words: ข้อมูลโภชนาการ = nutrition facts; หนึ่งหน่วยบริโภค = one serving; ซอง = sachet/pack; ก. or กรัม = g; มล. = mL;
พลังงานทั้งหมด / พลังงาน = energy (กิโลแคลอรี = kcal); โปรตีน = protein; คาร์โบไฮเดรตทั้งหมด = total carbs; ไขมันทั้งหมด = total fat.
Rules:
- Prefer the numbers for ONE SERVING (หนึ่งหน่วยบริโภค). servingG = the grams/mL of that serving as printed.
- If only a front "per pack" box is visible (e.g. "พลังงาน 70 กิโลแคลอรี" with net weight 20 ก.), use the whole pack: servingG = net weight.
- If only per-100 g numbers are printed, use servingG = 100 and those numbers.
- If energy is only in kJ, convert: kcal = kJ / 4.184, rounded.
- Copy numbers exactly as printed. Do NOT guess. Anything not clearly readable = null.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(LabelSchema)}`;

export async function readNutritionLabel(input: { image: string; lang: Lang }): Promise<LabelRead> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image))
    throw new AiError("bad-output", trFor(input.lang)("รูปแบบรูปไม่รองรับ", "This picture format is not supported"), 400);
  if (process.env.AI_MOCK === "1") return { servingG: 20, liquid: false, kcal: 70, protein: 1, carbs: 12, fat: 2 };
  return callAi(
    LABEL_SYSTEM,
    [
      { type: "text", text: "Photo of a nutrition label." },
      { type: "image_url", image_url: { url: input.image } },
    ],
    LabelSchema,
    input.lang,
  );
}

// ---------------------------------------------------------------------------
// Round 38: ANY photos of one product (front, back, label…) read together.
// Keeps what it can see (name, brand, size). Label numbers only if really printed.
// ---------------------------------------------------------------------------

export const PackSchema = z.object({
  name: z.string().nullable().catch(null).describe("Short product / food name as on the pack, in the pack's main language (e.g. 'อกไก่นุ่ม รสพริกไทยดำ'); null if not visible"),
  brand: z.string().nullable().catch(null).describe("Brand name; null if not visible"),
  netG: z.number().nullable().catch(null).describe("Net weight in g (or net volume in mL) of the whole pack, e.g. 200 for 'น้ำหนักสุทธิ 200 ก.'; null if not printed"),
  liquid: z.boolean().catch(false).describe("true if the pack size / serving is in mL (a drink or liquid)"),
  label: LabelSchema.nullable().catch(null).describe("Nutrition numbers ONLY if a nutrition table or energy box is clearly printed in a photo; else null"),
});
export type PackRead = z.infer<typeof PackSchema>;

const PACK_SYSTEM = `You look at 1 to 4 photos of the SAME food or drink product (front, back, side, nutrition label — any of them) and read what is printed.
Combine all photos into ONE answer for that one product.
- name: the product name as printed (keep the pack's language, short, no marketing words). brand separately.
- netG: the whole pack's net weight / volume (น้ำหนักสุทธิ / ปริมาตรสุทธิ / Net Wt).
- label: only if nutrition numbers are really printed in a photo. Follow these rules for it:
  Thai words: ข้อมูลโภชนาการ = nutrition facts; หนึ่งหน่วยบริโภค = one serving; ก. or กรัม = g; มล. = mL; พลังงาน = energy (กิโลแคลอรี = kcal);
  โปรตีน = protein; คาร์โบไฮเดรตทั้งหมด = total carbs; ไขมันทั้งหมด = total fat.
  Prefer ONE SERVING numbers (servingG = that serving's grams/mL). A front energy box for the whole pack → servingG = net weight.
  Only per-100 g numbers → servingG = 100. Energy only in kJ → kcal = kJ / 4.184.
  Copy numbers exactly. Do NOT guess or use typical values. No nutrition printed → label = null.
- Anything not visible = null. Never invent.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(PackSchema)}`;

export async function readPackPhotos(input: { images: string[]; lang: Lang }): Promise<PackRead> {
  const t = trFor(input.lang);
  if (!input.images.length || input.images.some((i) => !/^data:image\/(jpeg|png|webp);base64,/.test(i)))
    throw new AiError("bad-output", t("รูปแบบรูปไม่รองรับ", "This picture format is not supported"), 400);
  if (process.env.AI_MOCK === "1") {
    // Test mode: 1 photo = only the front (no numbers); 2+ photos = the label is in there too.
    const label = input.images.length > 1 ? { servingG: 20, liquid: false, kcal: 70, protein: 1, carbs: 12, fat: 2 } : null;
    return { name: "อกไก่นุ่ม", brand: "เบทาโกร", netG: 200, liquid: false, label };
  }
  const parts: Part[] = [{ type: "text", text: `${input.images.length} photo(s) of one product.` }];
  for (const url of input.images) parts.push({ type: "image_url", image_url: { url } });
  return callAi(PACK_SYSTEM, parts, PackSchema, input.lang);
}

// ---------------------------------------------------------------------------
// "What can I eat with what's left": food ideas from 7-Eleven, and menu ideas
// she can cook (each with a short recipe). Her own recipes are picked by the app, not the AI.
// The app (app/lib/suggest.ts) checks the numbers and keeps the best 3 per group.
// ---------------------------------------------------------------------------

export const SuggestSchema = z.object({
  ideas: z
    .array(
      z.object({
        place: z.enum(AI_PLACES).catch("7-eleven").describe("7-eleven = buy at 7-Eleven; menu = a simple dish she can cook at home"),
        name: z.string().describe("The product or dish name, the common name people search for"),
        amount: num.describe("How much, as a number"),
        unit: z.string().catch("").describe("Unit word, e.g. ชิ้น กล่อง ฟอง ซอง แก้ว ที่"),
        kcal: num.describe("kcal for that amount (for a menu: one serving of those ingredients)"),
        protein: num.describe("grams"),
        carbs: num.describe("grams"),
        fat: num.describe("grams"),
        why: z.string().catch("").describe("At most 4 friendly words why it's a good pick, e.g. โปรตีนสูง อิ่มนาน. No emoji."),
        ingredients: z.array(z.string()).nullish().catch(null).describe("menu only: 3–8 ingredients for ONE serving, each with its amount, e.g. อกไก่ 150 g; null for 7-eleven"),
        steps: z.array(z.string()).nullish().catch(null).describe("menu only: 3–6 short, easy cooking steps; null for 7-eleven"),
      }),
    )
    .catch([]),
});

export type SuggestInput = {
  kcalLeft: number;
  proteinLeft: number;
  slot: string;
  hour: number;
  eatenToday: string[];
  avoidDairy: boolean;
  lang: Lang;
  /** Round 40: her calorie buffer %; the room told to the AI is made smaller so ideas still fit. */
  bufferPct?: number;
};

const SUGGEST_SYSTEM = (lang: Lang) => `You are a friendly nutrition helper inside a Thai food diary app in Thailand.
The user asks: "I have this many kcal left today — what can I eat?" Give 8 ideas: 4 with place "7-eleven" and 4 with place "menu".
Rules:
- Each idea must be ONE thing to eat now, sized so its kcal is AT MOST the "kcal room" given. Aim for about 50–85% of the room; never above it. Give realistic numbers (your best estimate), not low and not padded.
- 7-eleven: real products sold at 7-Eleven Thailand (e.g. boiled eggs, chicken breast packs, onigiri, steamed buns, ready meals, unsweetened soy milk, Greek yogurt).
- menu: simple, well-known dishes anyone can cook at home in a normal kitchen (about 20 minutes or less), with easy-to-buy ingredients. Use the common dish name so she can also search it. Give ONE serving: "ingredients" with amounts (grams or spoons) and 3–6 short "steps". The kcal must match those ingredients. Prefer different dishes.
- She wants HIGH PROTEIN ideas: prefer eggs, chicken breast, fish, tofu, soy milk, lean meat. Try to help her reach the protein left.
- Fit the meal and time of day (breakfast / lunch / dinner / snack).
- Don't repeat what she already ate today.
- If "light mode" is on, she is at or over her target: only suggest very light, filling things (each at most the room). Keep the "why" kind and gentle, never scolding.
- No emoji anywhere.
- ${lang === "en" ? "Write name, unit, why, ingredients and steps in simple English (Thai dish names may be in English)." : "Write everything in simple Thai (a 7-Eleven product's own brand name may stay as printed)."}
- Check: kcal ≈ protein×4 + carbs×4 + fat×9.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(SuggestSchema)}`;

export async function suggestMeals(input: SuggestInput): Promise<AiGroups & { light: boolean }> {
  const { room, light } = kcalRoom(input.kcalLeft);
  const pct = cleanBufferPct(input.bufferPct);
  const raw = process.env.AI_MOCK === "1" ? mockSuggest() : await callAi(SUGGEST_SYSTEM(input.lang), [{ type: "text", text: suggestPrompt(input, aiRoom(room, pct), light) }], SuggestSchema, input.lang);
  return { ...fitAiIdeas(raw.ideas, input.kcalLeft, undefined, pct), light };
}

function suggestPrompt(input: SuggestInput, room: number, light: boolean): string {
  return [
    `kcal left today: ${Math.round(input.kcalLeft)}`,
    `kcal room for one idea: ${room}`,
    `light mode: ${light ? "on" : "off"}`,
    `protein still to eat today: ${Math.round(input.proteinLeft)} g`,
    `meal: ${input.slot}, time now in Thailand: ${input.hour}:00`,
    input.avoidDairy ? "She avoids milk and milk products: no dairy at all." : "",
    `Already eaten today: ${input.eatenToday.length ? input.eatenToday.join(", ") : "(nothing yet)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// TEST MODE ONLY (AI_MOCK=1): fixed ideas. One is too big and one has no recipe on purpose, so the filter can be seen working.
function mockSuggest(): z.infer<typeof SuggestSchema> {
  const ideas: RawIdea[] = [
    { place: "7-eleven", name: "ไข่ต้ม", amount: 2, unit: "ฟอง", kcal: 140, protein: 12, carbs: 1, fat: 10, why: "โปรตีนสูง อิ่มนาน" },
    { place: "7-eleven", name: "อกไก่นุ่ม รสพริกไทยดำ", amount: 1, unit: "ซอง", kcal: 100, protein: 22, carbs: 1, fat: 1, why: "โปรตีนสูง ไขมันน้อย" },
    { place: "7-eleven", name: "นมถั่วเหลืองไม่หวาน", amount: 1, unit: "กล่อง", kcal: 70, protein: 7, carbs: 3, fat: 3, why: "เบา มีโปรตีน" },
    {
      place: "menu", name: "ยำอกไก่", amount: 1, unit: "จาน", kcal: 220, protein: 32, carbs: 10, fat: 5, why: "โปรตีนสูง สดชื่น",
      ingredients: ["อกไก่ 150 g", "หอมแดง 2 หัว", "มะเขือเทศ 4 ลูก", "น้ำปลา 1 ช้อนโต๊ะ", "มะนาว 1 ลูก"],
      steps: ["ต้มอกไก่ให้สุก แล้วฉีกเป็นชิ้น", "ซอยหอมแดง ผ่ามะเขือเทศ", "ผสมน้ำปลากับมะนาว", "คลุกทุกอย่างเข้ากัน"],
    },
    {
      place: "menu", name: "ไข่ตุ๋น", amount: 1, unit: "ถ้วย", kcal: 150, protein: 13, carbs: 2, fat: 10, why: "นุ่ม ทำง่าย",
      ingredients: ["ไข่ไก่ 2 ฟอง", "น้ำ 100 ml", "ซีอิ๊วขาว 1 ช้อนชา", "ต้นหอม เล็กน้อย"],
      steps: ["ตีไข่กับน้ำและซีอิ๊ว", "เทใส่ถ้วย", "นึ่ง 12 นาที", "โรยต้นหอม"],
    },
    { place: "menu", name: "ข้าวผัดกุ้งจานใหญ่", amount: 1, unit: "จาน", kcal: 750, protein: 25, carbs: 100, fat: 25, why: "อิ่มจัด", ingredients: ["ข้าว 2 ถ้วย"], steps: ["ผัด"] },
    { place: "menu", name: "เมนูไม่มีสูตร", amount: 1, unit: "จาน", kcal: 150, protein: 10, carbs: 10, fat: 5, why: "", ingredients: null, steps: null },
  ];
  return { ideas };
}
