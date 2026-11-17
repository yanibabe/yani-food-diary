import { AiError, analyzeMeal } from "@/app/lib/server/ai";
import { trFor } from "@/app/lib/i18n";
import { parseAnalyzeImages, MAX_MEAL_PHOTOS } from "@/app/lib/mealPhotos";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { image?: string | null; images?: unknown; text?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const parsed = parseAnalyzeImages(body);
  const t = trFor(lang);
  if (!parsed.ok && parsed.reason === "too-many")
    return Response.json({ error: "bad-request", message: t(`ใส่ได้สูงสุด ${MAX_MEAL_PHOTOS} รูป`, `Up to ${MAX_MEAL_PHOTOS} photos`) }, { status: 400 });
  if (!parsed.ok && parsed.reason === "bad-format")
    return Response.json({ error: "bad-request", message: t("รูปแบบรูปไม่รองรับ", "This picture format is not supported") }, { status: 400 });
  const images = parsed.ok ? parsed.images : [];
  const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  if (!images.length && !text.trim()) {
    return Response.json({ error: "bad-request", message: trFor(lang)("ใส่รูปหรือพิมพ์ว่ากินอะไร", "Add a photo or type what you ate") }, { status: 400 });
  }
  try {
    const result = await analyzeMeal({ images, text, lang });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[analyze]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
