import { AiError, chatReply } from "@/app/lib/server/ai";
import { ChatRequestSchema } from "@/app/lib/foodChat";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const guess = (raw as { context?: { lang?: unknown } } | null)?.context?.lang;
  const lang = guess === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  // Unknown fields are dropped here, so nothing but the allowed numbers and messages can reach the AI.
  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "bad-request", message: trFor(lang)("พิมพ์ข้อความก่อนส่ง", "Type a message first") }, { status: 400 });
  }
  try {
    const result = await chatReply(parsed.data);
    return Response.json({ reply: result.reply, suggestions: result.suggestions, quickReplies: result.quickReplies, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[chat]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
