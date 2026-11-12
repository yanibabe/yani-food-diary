// SERVER ONLY. Talks to the Claude API. The API key is read from the
// server's environment (ANTHROPIC_API_KEY) and never reaches the phone.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const BoxSchema = z.object({
  x: z.number().describe("left edge, 0..1 of image width"),
  y: z.number().describe("top edge, 0..1 of image height"),
  w: z.number().describe("width, 0..1"),
  h: z.number().describe("height, 0..1"),
});

const ItemSchema = z.object({
  name: z.string().describe("Food name in Thai"),
  amount: z.number().describe("How much was EATEN, as a number"),
  unit: z.string().describe("Thai unit word, e.g. จาน ชิ้น ถ้วย ช้อนโต๊ะ กรัม"),
  kcal: z.number(),
  protein: z.number().describe("grams"),
  carbs: z.number().describe("grams"),
  fat: z.number().describe("grams"),
  estimated: z.boolean().describe("true if amount or recipe is uncertain"),
  kind: z.enum(["food", "extra"]).describe("extra = oil, sauce, dressing, sugar or add-on"),
  note: z.string().nullable().describe("Short Thai note, e.g. why it is an estimate"),
  box: BoxSchema.nullable().describe("Where this food is in the photo; null if not locatable or no photo"),
});

export const AnalysisSchema = z.object({
  title: z.string().describe("Short Thai name for the whole meal"),
  items: z.array(ItemSchema),
  question: z
    .string()
    .nullable()
    .describe("ONE short Thai question if something important is unclear, else null"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

const EditSchema = z.object({
  id: z.string().describe("id of an existing item"),
  action: z.enum(["update", "remove"]),
  item: ItemSchema.nullable().describe("Full new values for update; null for remove"),
});

export const RefineSchema = z.object({
  reply: z.string().describe("One or two short Thai sentences saying what changed"),
  question: z.string().nullable(),
  edits: z.array(EditSchema).describe("ONLY items the user's message is about"),
  adds: z.array(ItemSchema).describe("New items the user mentioned (e.g. oil, sauce)"),
});
export type Refine = z.infer<typeof RefineSchema>;

const ANALYZE_SYSTEM = `You are a careful nutrition assistant inside a Thai food diary app.
Estimate what the user ate from a photo and/or their description.
Rules:
- Write every name, unit, note and question in Thai.
- List each separate food on the plate as its own item. Numbers are for the amount actually EATEN, using the user's note (e.g. "ate half the chicken" → half portion).
- If the user mentions oil, sauce, dressing, sugar or other add-ons, list each as its own item with kind "extra".
- Cooking oil you cannot see: only add it if the cooking method clearly uses oil (fried, stir-fried); mark it estimated and say so in note.
- Set estimated=true whenever portion size or recipe is a guess.
- box: when there is a photo and you can locate the food, give its bounding box as fractions (0..1) of the image. Otherwise null.
- question: ask at most ONE short question only if the answer would change calories a lot. Otherwise null.
- Use typical Thai portion sizes and Thai food composition values. Be realistic, not optimistic.`;

const REFINE_SYSTEM = `You are a careful nutrition assistant inside a Thai food diary app.
The user already has a list of food items for one plate. They are now explaining more about what they actually ate.
Rules:
- Change ONLY the items their message is about. Do not touch other items.
- For an update, return the full new values for that item: amount eaten and nutrients scaled to what was actually eaten. Keep its box unchanged.
- "Ate it all" / "finished it" means no change for that item.
- If they mention oil, sauce or add-ons that are not in the list, add them in adds (kind "extra"); if the amount is unclear, give a typical amount, set estimated=true, and say so in note.
- If a change is ambiguous, make no edit for it and ask one short question.
- Write reply, names, units, notes and question in Thai.`;

export class AiError extends Error {
  constructor(
    public code: "not-configured" | "auth" | "rate-limit" | "refusal" | "network" | "bad-output" | "api",
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function aiStatus() {
  return {
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    mock: process.env.AI_MOCK === "1",
    model: MODEL,
  };
}

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError("not-configured", "ยังไม่ได้ตั้งค่า Claude API key บนเซิร์ฟเวอร์", 503);
  }
  return new Anthropic();
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError)
    return new AiError("auth", "API key ไม่ถูกต้องหรือหมดอายุ (401)", 502);
  if (e instanceof Anthropic.PermissionDeniedError)
    return new AiError("auth", "API key นี้ไม่มีสิทธิ์ใช้โมเดลนี้ (403)", 502);
  if (e instanceof Anthropic.RateLimitError)
    return new AiError("rate-limit", "เรียก AI ถี่เกินไปหรือเครดิตหมด ลองใหม่อีกครั้ง (429)", 503);
  if (e instanceof Anthropic.APIConnectionError)
    return new AiError("network", "เชื่อมต่อ Claude API ไม่ได้ (เครือข่าย)", 503);
  if (e instanceof Anthropic.APIError)
    return new AiError("api", `Claude API ตอบกลับข้อผิดพลาด ${e.status ?? ""}: ${e.message}`, 502);
  return new AiError("api", e instanceof Error ? e.message : "เกิดข้อผิดพลาด", 500);
}

async function callClaude<T>(
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: z.ZodType<T>,
  effort: "low" | "medium",
): Promise<T> {
  try {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      // If Claude declines for a safety reason, the API retries on a fallback model.
      fallbacks: "default",
      system,
      output_config: { effort, format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") {
      throw new AiError("refusal", "AI ปฏิเสธคำขอนี้ ลองเปลี่ยนรูปหรือข้อความ", 422);
    }
    if (res.stop_reason === "max_tokens") {
      throw new AiError("bad-output", "คำตอบของ AI ยาวเกินและถูกตัด ลองอีกครั้ง", 502);
    }
    if (!res.parsed_output) throw new AiError("bad-output", "อ่านผลจาก AI ไม่ได้ ลองอีกครั้ง", 502);
    return res.parsed_output as T;
  } catch (e) {
    throw toAiError(e);
  }
}

function parseDataUrl(dataUrl: string): { media: "image/jpeg" | "image/png" | "image/webp"; data: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new AiError("bad-output", "รูปแบบรูปไม่รองรับ", 400);
  return { media: m[1] as "image/jpeg", data: m[2] };
}

export async function analyzeMeal(input: { image: string | null; text: string }): Promise<Analysis> {
  if (process.env.AI_MOCK === "1") return mockAnalyze(input);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    const img = parseDataUrl(input.image);
    content.push({ type: "image", source: { type: "base64", media_type: img.media, data: img.data } });
  }
  content.push({
    type: "text",
    text: input.image
      ? `Photo of my meal. My extra notes: ${input.text || "(none)"}`
      : `No photo. What I ate: ${input.text}`,
  });
  return callClaude(ANALYZE_SYSTEM, content, AnalysisSchema, "medium");
}

export type RefineInput = {
  title: string;
  items: { id: string; name: string; amount: number; unit: string; kcal: number; protein: number; carbs: number; fat: number; kind: string; estimated: boolean }[];
  history: { role: "user" | "assistant"; text: string }[];
  message: string;
};

export async function refineMeal(input: RefineInput): Promise<Refine> {
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
  return callClaude(REFINE_SYSTEM, [{ type: "text", text }], RefineSchema, "low");
}

// ---------------------------------------------------------------------------
// TEST MODE ONLY (AI_MOCK=1): a fake, fixed answer so the screens can be
// tested without an API key. The app shows a clear "AI จำลอง" badge.
// ---------------------------------------------------------------------------

function mockAnalyze(input: { image: string | null; text: string }): Analysis {
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
    if (/ครึ่ง/.test(after)) {
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
