// Round 38: one or more photos of ONE product (any side). The AI keeps what it can see:
// name, brand, pack size, and the nutrition numbers if they are printed.
// No numbers in any photo → average values for that food by name (marked as an estimate on the phone).
import { AiError, lookupIngredient, readPackPhotos } from "@/app/lib/server/ai";
import { fixIsValid } from "@/app/lib/food/labelFix";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";
import { aiGuard } from "@/app/lib/server/aiGuard";

export const maxDuration = 60;
const MAX_PHOTOS = 4;

export async function POST(req: Request) {
  let body: { images?: unknown; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const t = trFor(lang);
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const limited = aiGuard(req, "pack-photos", lang);
  if (limited) return limited;
  const images = Array.isArray(body.images) ? body.images.filter((i): i is string => typeof i === "string" && !!i) : [];
  if (!images.length) return Response.json({ error: "bad-request", message: t("ยังไม่ได้เลือกรูป", "No picture chosen") }, { status: 400 });
  if (images.length > MAX_PHOTOS)
    return Response.json({ error: "bad-request", message: t(`ใส่ได้สูงสุด ${MAX_PHOTOS} รูป`, `Up to ${MAX_PHOTOS} photos`) }, { status: 400 });
  try {
    const r = await readPackPhotos({ images, lang });
    const l = r.label;
    // Real label numbers need a size and calories. A front energy box with no size → use the pack's net weight.
    const servingG = l?.servingG ?? (l?.kcal != null ? r.netG : null);
    const label = l && servingG != null && l.kcal != null && fixIsValid({ servingG, kcal: l.kcal }) ? { ...l, servingG, liquid: l.liquid || r.liquid } : null;
    const name = [r.name, r.brand].map((s) => s?.trim()).filter(Boolean).join(" · ") || null;
    const netG = r.netG != null && r.netG > 0 && r.netG < 20000 ? Math.round(r.netG) : null;
    // No real numbers → typical values for that food (same lookup as typing the name).
    const average = !label && r.name ? await lookupIngredient({ name: r.name, lang }) : null;
    return Response.json({ product: { name, netG, liquid: r.liquid }, label, average, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[pack-photos]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
