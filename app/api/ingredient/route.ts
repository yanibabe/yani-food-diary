import { AiError, lookupIngredient } from "@/app/lib/server/ai";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { name?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return Response.json({ error: "bad-request", message: trFor(lang)("ยังไม่ได้ใส่ชื่อวัตถุดิบ", "No ingredient name") }, { status: 400 });
  try {
    const result = await lookupIngredient({ name, lang });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[ingredient]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
