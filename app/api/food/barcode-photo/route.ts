// Backup reader: the AI reads the digits printed under a barcode in a photo.
// The phone's free stripe reader runs first; this only runs when that fails.
import { AiError, readBarcodeDigits } from "@/app/lib/server/ai";
import { barcodeCheckOk } from "@/app/lib/food/provider";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";
import { aiGuard } from "@/app/lib/server/aiGuard";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { image?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;
  const limited = aiGuard(req, "barcode-photo", lang);
  if (limited) return limited;
  if (typeof body.image !== "string" || !body.image) {
    return Response.json({ error: "bad-request", message: trFor(lang)("ยังไม่ได้เลือกรูป", "No picture chosen") }, { status: 400 });
  }
  try {
    const digits = await readBarcodeDigits({ image: body.image, lang });
    // A number that fails the check digit is treated as "couldn't read": never look up a wrong product.
    const code = digits && barcodeCheckOk(digits) ? digits : null;
    return Response.json({ code, mock: process.env.AI_MOCK === "1" });
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("api", String(e), 500);
    console.error("[barcode-photo]", err.code, err.message);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
