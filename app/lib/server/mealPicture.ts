// SERVER ONLY. Draws a pretty picture of a meal (Round 67).
// Step A (only when no `visual` is given): a cheap text model writes ONE short English sentence
// describing how the dish looks. Step B: an image model draws it. Numbers never come from the picture.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { trFor, type Lang } from "../i18n.ts";
import { AiError } from "./ai.ts";
import { VISUAL_SYSTEM, imagePrompt, visualPrompt, type PictureInput, type PictureOut } from "../mealPictureText.ts";
export { PICTURE_STYLE, imagePrompt, visualPrompt, type PictureInput, type PictureOut } from "../mealPictureText.ts";

const CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const IMAGE_ENDPOINT = "https://openrouter.ai/api/v1/images";
export const VISUAL_MODEL = "deepseek/deepseek-v4.1-flash-1017";
export const IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
const VISUAL_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 40_000;

const VisualSchema = z.object({ visual: z.string().min(3) });

function failFor(status: number, msg: string, lang: Lang): AiError {
  const t = trFor(lang);
  const m = String(msg).slice(0, 200);
  if (status === 401) return new AiError("auth", `${t("API key ไม่ถูกต้อง", "The API key is wrong")} (401): ${m}`, 502);
  if (status === 402) return new AiError("credits", `${t("เครดิต OpenRouter ไม่พอ", "Not enough OpenRouter credit")} (402): ${m}`, 502);
  if (status === 429) return new AiError("rate-limit", t("เรียก AI ถี่เกินไป ลองใหม่อีกครั้ง (429)", "Too many AI requests. Please try again (429)"), 503);
  return new AiError("api", `${t("OpenRouter ตอบกลับข้อผิดพลาด", "OpenRouter returned an error")} ${status}: ${m}`, 502);
}

async function post(url: string, body: unknown, key: string, ms: number, lang: Lang): Promise<unknown> {
  const t = trFor(lang);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw e instanceof Error && e.name === "AbortError"
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
    throw failFor(res.status, msg, lang);
  }
  return res.json().catch(() => null);
}

function parseVisual(text: string, lang: Lang): string {
  const bad = new AiError("bad-output", trFor(lang)("อ่านผลจาก AI ไม่ได้ ลองอีกครั้ง", "Couldn't read the AI's answer. Please try again."), 502);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw bad;
    try {
      raw = JSON.parse(m[0]);
    } catch {
      throw bad;
    }
  }
  const p = VisualSchema.safeParse(raw);
  if (!p.success) throw bad;
  return p.data.visual.trim().slice(0, 400);
}

async function writeVisual(input: PictureInput, key: string): Promise<string> {
  const data = (await post(
    CHAT_ENDPOINT,
    {
      model: VISUAL_MODEL,
      reasoning: { enabled: false },
      provider: { sort: "latency", require_parameters: true },
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISUAL_SYSTEM },
        { role: "user", content: visualPrompt(input) },
      ],
    },
    key,
    VISUAL_TIMEOUT_MS,
    input.lang,
  )) as { choices?: { message?: { content?: string } }[] } | null;
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new AiError("bad-output", trFor(input.lang)("AI ไม่ได้ตอบกลับ ลองอีกครั้ง", "The AI didn't answer. Please try again."), 502);
  return parseVisual(text, input.lang);
}

async function drawImage(visual: string, key: string, lang: Lang): Promise<string> {
  const data = (await post(
    IMAGE_ENDPOINT,
    { model: IMAGE_MODEL, prompt: imagePrompt(visual), aspect_ratio: "1:1", n: 1 },
    key,
    IMAGE_TIMEOUT_MS,
    lang,
  )) as { data?: { b64_json?: string; media_type?: string }[] } | null;
  const first = data?.data?.[0];
  if (!first?.b64_json) throw new AiError("bad-output", trFor(lang)("AI วาดรูปไม่สำเร็จ ลองอีกครั้ง", "The AI couldn't draw the picture. Please try again."), 502);
  const type = /^image\/(png|jpeg|webp)$/.test(first.media_type ?? "") ? first.media_type : "image/png";
  return `data:${type};base64,${first.b64_json}`;
}

// TEST MODE ONLY (AI_MOCK=1): one of a few small sample pictures, no network.
async function mockPicture(input: PictureInput): Promise<PictureOut> {
  let h = 0;
  for (const ch of input.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const file = `c${(h % 4) + 1}.jpeg`;
  const buf = await readFile(path.join(process.cwd(), "public", "mock-pictures", file));
  await new Promise((r) => setTimeout(r, 900)); // long enough to see the shimmer
  return { image: `data:image/jpeg;base64,${buf.toString("base64")}`, visual: input.visual?.trim() || `Mock picture of ${input.title}` };
}

export async function drawMealPicture(input: PictureInput): Promise<PictureOut> {
  if (process.env.AI_MOCK === "1") return mockPicture(input);
  const t = trFor(input.lang);
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AiError("not-configured", t("ยังไม่ได้ตั้งค่า OpenRouter API key บนเซิร์ฟเวอร์", "The OpenRouter API key is not set up on the server"), 503);
  const visual = input.visual?.trim() ? input.visual.trim().slice(0, 400) : await writeVisual(input, key);
  return { image: await drawImage(visual, key, input.lang), visual };
}
