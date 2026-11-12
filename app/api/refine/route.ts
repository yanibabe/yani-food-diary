import { AiError, refineMeal, type RefineInput } from "@/app/lib/server/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: RefineInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body?.message?.trim() || !Array.isArray(body.items)) {
    return Response.json({ error: "bad-request", message: "พิมพ์ข้อความก่อนส่ง" }, { status: 400 });
  }
  try {
    const result = await refineMeal({
      title: String(body.title ?? "").slice(0, 200),
      items: body.items.slice(0, 40),
      history: (body.history ?? []).slice(-10),
      message: body.message.slice(0, 1000),
    });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[refine]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
