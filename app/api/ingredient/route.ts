import { AiError, lookupIngredient } from "@/app/lib/server/ai";
import { trFor } from "@/app/lib/i18n";
import { UNITS, type IngredientUnit } from "@/app/lib/types";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { name?: string; lang?: string; unit?: string };
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
    // A counted unit (clove, can, ladle…): ask the AI for the weight of ONE of that unit.
    // Round 39: a volume unit (spoon, cup, ml): ask for the grams in 1 ml (its density).
    // Answer shape unchanged, plus an optional "state" (raw / cooked / dried / prepared).
    const u = typeof body.unit === "string" && body.unit in UNITS ? (body.unit as IngredientUnit) : null;
    const unit = u && UNITS[u].kind !== "mass" ? u : null;
    const result = await lookupIngredient({ name, lang, unit });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[ingredient]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
