// SERVER ONLY. Talks to the AI through OpenRouter (playground rule).
// The key is read from the server's environment (OPENROUTER_API_KEY) and
// never reaches the phone.

import { z } from "zod";
import { trFor, type Lang } from "../i18n.ts";
import { AI_MARGIN, markMargin } from "../nutrition.ts";

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
});

export const AnalysisSchema = z.object({
  title: z.string().catch("").describe("Short name for the whole meal"),
  items: z.array(ItemSchema),
  question: z.string().nullish().describe("ONE short question if something important is unclear, else null"),
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
- ${languageRule(lang)}
- List each separate food on the plate as its own item. Numbers are for the amount actually EATEN, using the user's note (e.g. "ate half the chicken" → half portion).
- If the user mentions oil, sauce, dressing, sugar or other add-ons, list each as its own item with kind "extra".
- How to estimate each food, step by step:
  1) Judge its size against the plate, bowl, spoon or hand in the photo. Standard Thai plates are about 23–26 cm wide; a plate of rice is often 150–250 g of cooked rice.
  2) Write the eaten weight in grams.
  3) Work out kcal from grams using values for the dish AS COOKED in Thai shops and homes (cooked rice ≈ 130 kcal/100 g), not for plain raw ingredients.
- Thai dishes are often cooked with a lot of oil, coconut milk, sugar and fatty meat. Be generous with cooking oil — when a dish is fried or stir-fried, assume a bit MORE oil than looks likely. Count this hidden energy: stir-fried, deep-fried and fried-egg dishes soak up oil (often 1–2 tbsp = 120–240 kcal per plate); curries with coconut milk, sweet sauces and pork belly add a lot too. Include it in the dish's kcal, or list cooking oil as its own "extra" item (estimated=true, say so in note) — never both.
- Photo estimates usually come out TOO LOW, because portions look smaller in photos and hidden oil is missed. When you are unsure between two sizes, pick the larger, typical restaurant portion.
- Check your numbers: kcal should be close to protein×4 + carbs×4 + fat×9.
- Set estimated=true whenever portion size or recipe is a guess.
- When the user gives an item's exact weight or volume, use it EXACTLY (do not enlarge it) and set userAmount=true. If they say how it was cooked (e.g. grilled with no oil, air-fried, steamed), follow that: do not add oil they said they did not use. Use plain food-table values for those items; the app adds no margin to them.
- dairy: think about how the dish is usually made in Thailand (e.g. Thai iced tea, coffee drinks, bakery, creamy soups, some curries and desserts use milk, butter or condensed milk). Set dairy=true when it likely contains ANY milk product, and name it in dairySource.
- box: when there is a photo and you can locate the food, give its bounding box as fractions (0..1) of the image. Otherwise null.
- question: ask at most ONE short question only if the answer would change calories a lot. Otherwise null.
- Use typical Thai portion sizes and Thai food composition values (e.g. INMU Thai Food Composition Table). Be realistic: do not shrink portions or leave out cooking fat.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(AnalysisSchema)}`;

const REFINE_SYSTEM = (lang: Lang) => `You are a careful nutrition assistant inside a Thai food diary app.
The user already has a list of food items for one plate. They are now explaining more about what they actually ate.
Rules:
- Change ONLY the items their message is about. Do not touch other items.
- For an update, return the full new values for that item: amount eaten and nutrients scaled to what was actually eaten. Keep its box unchanged.
- "Ate it all" / "finished it" means no change for that item.
- Items with margin=true already include the app's +${Math.round(AI_MARGIN * 100)}% safety margin; items with margin=false do not. When you update an item by scaling (e.g. "ate half"), scale from its current numbers and set userAmount=false. If you must re-estimate an item from scratch without an exact amount, add ${Math.round(AI_MARGIN * 100)}% to your best guess (userAmount=false).
- If the user now gives an item's exact weight or volume (e.g. "salmon was 120 g"), recalculate that item with plain food-table values for exactly that amount, with NO margin, and set userAmount=true. Same for new items in adds: userAmount=true only if they gave the exact amount. Do NOT add the margin yourself to adds — the app adds it when userAmount is false.
- If they mention oil, sauce or add-ons that are not in the list, add them in adds (kind "extra"); if the amount is unclear, give a typical amount, set estimated=true, and say so in note.
- For every item you return, set dairy=true (and dairySource) when it likely contains ANY milk product.
- If a change is ambiguous, make no edit for it and ask one short question.
- ${languageRule(lang)}
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(RefineSchema)}`;

export class AiError extends Error {
  constructor(
    public code: "not-configured" | "auth" | "rate-limit" | "credits" | "timeout" | "network" | "bad-output" | "api",
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function aiStatus() {
  return {
    configured: Boolean(process.env.OPENROUTER_API_KEY),
    mock: process.env.AI_MOCK === "1",
    model: MODEL,
    passcode: Boolean(process.env.APP_PASSCODE?.trim()),
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

async function callAi<T>(system: string, content: Part[], schema: z.ZodType<T>, lang: Lang): Promise<T> {
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

type AiItem = Analysis["items"][number];
/** What the app gets back: each item says if the +15% margin was added (margin=true). */
export type MarkedItem = AiItem & { margin: boolean };
export type AnalysisOut = Omit<Analysis, "items"> & { items: MarkedItem[] };
export type RefineOut = Omit<Refine, "edits" | "adds"> & {
  edits: (Omit<Refine["edits"][number], "item"> & { item?: (AiItem & { margin?: boolean }) | null })[];
  adds: MarkedItem[];
};

/** The margin is only for amounts the AI had to guess. Exact amounts from the user stay as they are. */
const marked = (i: AiItem): MarkedItem => markMargin(i);

export async function analyzeMeal(input: { image: string | null; text: string; lang: Lang }): Promise<AnalysisOut> {
  if (process.env.AI_MOCK === "1") return addMargin(mockAnalyze(input));
  const content: Part[] = [
    {
      type: "text",
      text: input.image
        ? `Photo of my meal. My extra notes: ${input.text || "(none)"}`
        : `No photo. What I ate: ${input.text}`,
    },
  ];
  if (input.image) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image))
      throw new AiError("bad-output", trFor(input.lang)("รูปแบบรูปไม่รองรับ", "This picture format is not supported"), 400);
    content.push({ type: "image_url", image_url: { url: input.image } });
  }
  return addMargin(await callAi(ANALYZE_SYSTEM(input.lang), content, AnalysisSchema, input.lang));
}

/** Guessed items get the safety margin (see AI_MARGIN in nutrition.ts); exact ones don't. */
function addMargin(a: Analysis): AnalysisOut {
  return { ...a, items: a.items.map(marked) };
}

export type RefineInput = {
  title: string;
  items: { id: string; name: string; amount: number; unit: string; kcal: number; protein: number; carbs: number; fat: number; kind: string; estimated: boolean; margin: boolean }[];
  history: { role: "user" | "assistant"; text: string }[];
  message: string;
  lang: Lang;
};

export async function refineMeal(input: RefineInput): Promise<RefineOut> {
  if (process.env.AI_MOCK === "1") return marginOnAdds(mockRefine(input));
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
  return marginOnAdds(await callAi(REFINE_SYSTEM(input.lang), [{ type: "text", text }], RefineSchema, input.lang));
}

/**
 * New items from a chat message get the margin unless the amount was exact.
 * Edits scale from numbers that already have it (margin unchanged), except an
 * edit with an exact amount, which has no margin.
 */
function marginOnAdds(r: Refine): RefineOut {
  return {
    ...r,
    edits: r.edits.map((e) => (e.item?.userAmount ? { ...e, item: { ...e.item, margin: false } } : e)),
    adds: r.adds.map(marked),
  };
}

// ---------------------------------------------------------------------------
// TEST MODE ONLY (AI_MOCK=1): a fake, fixed answer so the screens can be
// tested without an API key. The app shows a clear "AI จำลอง" badge.
// ---------------------------------------------------------------------------

function mockAnalyze(input: { image: string | null; text: string; lang: Lang }): Analysis {
  const items: Analysis["items"] = [
    { name: "ข้าวสวย", amount: 1, unit: "ทัพพี", kcal: 160, protein: 3, carbs: 35, fat: 0.4, estimated: false, kind: "food", note: null, box: input.image ? { x: 0.08, y: 0.45, w: 0.4, h: 0.4 } : null },
    { name: "ไก่ทอด", amount: 1, unit: "ชิ้น", kcal: 290, protein: 24, carbs: 9, fat: 17, estimated: false, kind: "food", note: null, box: input.image ? { x: 0.5, y: 0.15, w: 0.38, h: 0.38 } : null },
    { name: "ผักลวก", amount: 1, unit: "ถ้วย", kcal: 35, protein: 2, carbs: 6, fat: 0.3, estimated: false, kind: "food", note: null, box: input.image ? { x: 0.52, y: 0.58, w: 0.36, h: 0.3 } : null },
  ];
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
  if (/น้ำมัน/.test(t)) {
    items.push({ name: "น้ำมันพืช", amount: 1, unit: "ช้อนชา", kcal: 40, protein: 0, carbs: 0, fat: 4.5, estimated: true, kind: "extra", note: "ไม่ได้ระบุปริมาณ ใช้ค่าประมาณ 1 ช้อนชา", box: null });
  }
  return { title: "ข้าวไก่ทอดกับผักลวก", items, question: null };
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
// Steps from a screenshot (Apple Health / Fitness / any step app).
// ---------------------------------------------------------------------------

export const StepsSchema = z.object({
  steps: z.coerce.number().nullable().catch(null).describe("The step count for ONE day, as a whole number; null if no clear step count is shown"),
  date: z.string().nullable().catch(null).describe("That day as YYYY-MM-DD, or null if the screenshot does not show which day"),
  note: z.string().nullish().describe("Short note if something is unclear, else null"),
});
export type StepsRead = z.infer<typeof StepsSchema>;

const STEPS_SYSTEM = (lang: Lang, today: string) => `You read step counts from phone screenshots (Apple Health, Fitness, Google Fit, watch apps, etc.).
Today is ${today} (Thailand time). Rules:
- Find the step count for ONE day. Use the big, clearly labelled number for steps ("Steps", "ก้าว"). Do NOT use distance, flights climbed, calories or minutes.
- If the screen shows a week or month chart, use only the day the screen highlights or names; if none is clear, set steps to null.
- If the screen says "Today" / "วันนี้", the date is ${today}. "Yesterday" / "เมื่อวาน" is the day before. If only a weekday or a date without a year is shown, pick the most recent such day that is not after today. If no day is shown at all, date = null.
- Read the number exactly, ignoring commas (e.g. "8,432" → 8432).
- note: ${lang === "en" ? "in simple English" : "in Thai"}, only if something is unclear; else null.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(StepsSchema)}`;

export async function readSteps(input: { image: string; today: string; lang: Lang }): Promise<StepsRead> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.image))
    throw new AiError("bad-output", trFor(input.lang)("รูปแบบรูปไม่รองรับ", "This picture format is not supported"), 400);
  if (process.env.AI_MOCK === "1") return { steps: 8432, date: input.today, note: null };
  const r = await callAi(
    STEPS_SYSTEM(input.lang, input.today),
    [
      { type: "text", text: "Screenshot of my step count." },
      { type: "image_url", image_url: { url: input.image } },
    ],
    StepsSchema,
    input.lang,
  );
  const steps = r.steps != null && Number.isFinite(r.steps) && r.steps >= 0 ? Math.round(r.steps) : null;
  const date = r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= input.today ? r.date : null;
  return { steps, date, note: r.note ?? null };
}

// ---------------------------------------------------------------------------
// One ingredient's nutrition per 100 g (for recipes, when there is no label).
// No safety margin here: these are plain food-table values for a raw ingredient.
// ---------------------------------------------------------------------------

export const IngredientRefSchema = z.object({
  known: z.boolean().catch(true).describe("false if this is not a food/ingredient you recognise"),
  kcal: num.describe("kcal per 100 g"),
  protein: num.describe("grams per 100 g"),
  carbs: num.describe("grams per 100 g"),
  fat: num.describe("grams per 100 g"),
  unitG: z.coerce.number().nullable().catch(null).describe("Typical weight in grams of ONE piece / egg / fruit, if people count it in pieces; else null"),
  gPerMl: z.coerce.number().nullable().catch(null).describe("Grams per ml if it is a liquid or sauce (e.g. oil 0.92, milk 1.03); else null"),
});
export type IngredientRef = z.infer<typeof IngredientRefSchema>;

const INGREDIENT_SYSTEM = `You are a nutrition table inside a Thai food diary app.
The user types ONE ingredient name (Thai or English) they use in home cooking.
Give its nutrition per 100 g, from standard food composition tables (Thai INMU / USDA).
Rules:
- Use the ingredient as it is normally bought before cooking: RAW, unless the name says it is cooked, dried, fried, canned, etc.
- Read the whole name: a brand, cut or kind changes the values (e.g. "salmon trout" ≠ "salmon", "chicken thigh with skin" ≠ "chicken breast").
- Make sure kcal ≈ protein×4 + carbs×4 + fat×9 (roughly).
- Numbers only, no ranges. If you do not recognise it as food, set known to false.
Return ONLY a JSON object matching this JSON Schema:
${shapeOf(IngredientRefSchema)}`;

const clamp = (n: number, max: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function lookupIngredient(input: { name: string; lang: Lang }): Promise<IngredientRef | null> {
  const r = process.env.AI_MOCK === "1" ? mockIngredient(input.name) : await callAi(INGREDIENT_SYSTEM, [{ type: "text", text: input.name }], IngredientRefSchema, input.lang);
  if (!r.known || !(r.kcal > 0)) return null;
  return {
    known: true,
    kcal: Math.round(clamp(r.kcal, 900)),
    protein: round1(clamp(r.protein, 100)),
    carbs: round1(clamp(r.carbs, 100)),
    fat: round1(clamp(r.fat, 100)),
    unitG: r.unitG != null && r.unitG > 0 && r.unitG < 5000 ? Math.round(r.unitG) : null,
    gPerMl: r.gPerMl != null && r.gPerMl > 0.3 && r.gPerMl < 3 ? Math.round(r.gPerMl * 100) / 100 : null,
  };
}

// TEST MODE ONLY (AI_MOCK=1): fixed answers.
function mockIngredient(name: string): IngredientRef {
  if (/มันฝรั่ง|potato/i.test(name)) return { known: true, kcal: 77, protein: 2, carbs: 17, fat: 0.1, unitG: 170, gPerMl: null };
  if (/แซลมอน|salmon/i.test(name)) return { known: true, kcal: 141, protein: 20.5, carbs: 0, fat: 6, unitG: null, gPerMl: null };
  if (/xyz/i.test(name)) return { known: false, kcal: 0, protein: 0, carbs: 0, fat: 0, unitG: null, gPerMl: null };
  return { known: true, kcal: 100, protein: 3, carbs: 15, fat: 2, unitG: null, gPerMl: null };
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
