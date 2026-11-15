import { AiError, suggestMeals } from "@/app/lib/server/ai";
import { passcodeBlock } from "@/app/lib/server/passcode";
import type { RecipeOption } from "@/app/lib/suggest";

export const maxDuration = 60;

const n = (v: unknown, max: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(Math.max(x, -max), max) : 0;
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body?.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const recipes: RecipeOption[] = (Array.isArray(body.recipes) ? body.recipes : []).slice(0, 30).map((r: Record<string, unknown>) => ({
    id: String(r?.id ?? "").slice(0, 60),
    name: String(r?.name ?? "").slice(0, 80),
    kcal: n(r?.kcal, 5000),
    protein: n(r?.protein, 500),
    carbs: n(r?.carbs, 1000),
    fat: n(r?.fat, 500),
  })).filter((r) => r.id && r.name && r.kcal > 0);
  try {
    const result = await suggestMeals({
      kcalLeft: n(body.kcalLeft, 10000),
      proteinLeft: Math.max(0, n(body.proteinLeft, 1000)),
      slot: String(body.slot ?? "snack").slice(0, 20),
      hour: Math.round(n(body.hour, 23)),
      recipes,
      eatenToday: (Array.isArray(body.eatenToday) ? body.eatenToday : []).slice(0, 20).map((t) => String(t).slice(0, 80)),
      avoidDairy: body.avoidDairy === true,
      lang,
    });
    return Response.json({ result, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[suggest]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
