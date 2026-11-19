import { AiError } from "@/app/lib/server/ai";
import { translateNames } from "@/app/lib/server/translateNames";
import { parseTranslateRequest } from "@/app/lib/translateNames";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { names?: unknown; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const checked = parseTranslateRequest(body);
  if (!checked.ok) return Response.json({ error: "bad-request", message: checked.error }, { status: 400 });
  try {
    const pairs = await translateNames(checked.names, lang);
    return Response.json({ pairs, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[translate-names]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
