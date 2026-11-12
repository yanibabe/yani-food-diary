import { AiError, readSteps } from "@/app/lib/server/ai";
import { thaiDateKey } from "@/app/lib/date";
import { trFor } from "@/app/lib/i18n";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { image?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  if (typeof body.image !== "string" || !body.image) {
    return Response.json({ error: "bad-request", message: trFor(lang)("ยังไม่ได้เลือกรูป", "No picture chosen") }, { status: 400 });
  }
  try {
    const result = await readSteps({ image: body.image, today: thaiDateKey(), lang });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[steps]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
