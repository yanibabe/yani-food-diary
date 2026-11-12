import { AiError, analyzeMeal } from "@/app/lib/server/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { image?: string | null; text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }
  const image = typeof body.image === "string" && body.image ? body.image : null;
  const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  if (!image && !text.trim()) {
    return Response.json({ error: "bad-request", message: "ใส่รูปหรือพิมพ์ว่ากินอะไร" }, { status: 400 });
  }
  try {
    const result = await analyzeMeal({ image, text });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[analyze]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
