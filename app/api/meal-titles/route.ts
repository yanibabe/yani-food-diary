import { AiError } from "@/app/lib/server/ai";
import { checkMealTitles } from "@/app/lib/server/mealTitles";
import { parseTitleRequest } from "@/app/lib/mealTitles";
import { passcodeBlock } from "@/app/lib/server/passcode";
import { aiGuard } from "@/app/lib/server/aiGuard";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { meals?: unknown; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const limited = aiGuard(req, "meal-titles", lang);
  if (limited) return limited;
  const checked = parseTitleRequest(body);
  if (!checked.ok) return Response.json({ error: "bad-request", message: checked.error }, { status: 400 });
  try {
    const fixes = await checkMealTitles(checked.meals, lang);
    return Response.json({ fixes, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[meal-titles]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
