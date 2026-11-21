import { AiError } from "@/app/lib/server/ai";
import { drawMealPicture, type PictureInput } from "@/app/lib/server/mealPicture";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";
import { aiGuard } from "@/app/lib/server/aiGuard";

export const maxDuration = 60;

type Body = { title?: unknown; items?: unknown; hint?: unknown; visual?: unknown; lang?: unknown };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body?.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const limited = aiGuard(req, "meal-picture", lang);
  if (limited) return limited;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title || !Array.isArray(body.items)) {
    return Response.json({ error: "bad-request", message: trFor(lang)("ไม่มีชื่อมื้ออาหาร", "The meal has no name") }, { status: 400 });
  }
  const items: PictureInput["items"] = body.items.slice(0, 40).map((i) => {
    const o = (i ?? {}) as Record<string, unknown>;
    return { name: String(o.name ?? "").slice(0, 120), amount: Number(o.amount) || 0, unit: String(o.unit ?? "").slice(0, 40) };
  });
  try {
    const out = await drawMealPicture({
      title,
      items,
      hint: typeof body.hint === "string" ? body.hint.slice(0, 300) : undefined,
      visual: typeof body.visual === "string" ? body.visual.slice(0, 400) : undefined,
      lang,
    });
    return Response.json({ image: out.image, visual: out.visual, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[meal-picture]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
