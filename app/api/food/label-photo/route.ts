// The AI reads the nutrition numbers from a photo of the pack's label.
// Answer is per serving / per pack; the phone saves it as her label fix for that barcode.
import { AiError, readNutritionLabel } from "@/app/lib/server/ai";
import { fixIsValid } from "@/app/lib/food/labelFix";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { image?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  if (typeof body.image !== "string" || !body.image) {
    return Response.json({ error: "bad-request", message: trFor(lang)("ยังไม่ได้เลือกรูป", "No picture chosen") }, { status: 400 });
  }
  try {
    const r = await readNutritionLabel({ image: body.image, lang });
    // Pack size and calories are a must; without them it counts as "couldn't read".
    const label = r.servingG != null && r.kcal != null && fixIsValid({ servingG: r.servingG, kcal: r.kcal }) ? r : null;
    return Response.json({ label, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[label-photo]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
