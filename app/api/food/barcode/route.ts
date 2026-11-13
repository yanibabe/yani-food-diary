// The phone asks here; this server asks Open Food Facts (browsers can't set a User-Agent).
// Same passcode as the AI, so strangers with the link can't use up our OFF limit.

import pkg from "@/package.json";
import { offConfig } from "@/app/lib/food/config";
import { OffError, OpenFoodFactsProvider, normalizeOffProduct, type OffProduct } from "@/app/lib/food/openFoodFacts";
import { cleanBarcode } from "@/app/lib/food/provider";
import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";

export const maxDuration = 60;

type Hit = { code: string; product: OffProduct } | null;
// A small memory cache on this server copy, to save calls. Found: 24 h. Not found: 1 h.
const cache = new Map<string, { at: number; hit: Hit }>();
const FOUND_MS = 24 * 3600_000;
const MISSING_MS = 3600_000;
let provider: OpenFoodFactsProvider | null = null;

export async function POST(req: Request) {
  let body: { code?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const tr = trFor(lang);
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;

  const code = cleanBarcode(String(body.code ?? ""));
  if (!code) return Response.json({ error: "bad-code", message: tr("บาร์โค้ดต้องเป็นตัวเลข 8–14 หลัก", "A barcode is 8–14 digits") }, { status: 400 });

  const cfg = offConfig(process.env, pkg.version);
  if (!cfg.ok) {
    console.error("[barcode] not set up:", cfg.reason);
    return Response.json({ error: "not-configured", message: tr("ยังไม่ได้ตั้งค่าการค้นหาบาร์โค้ดบนเซิร์ฟเวอร์", "Barcode lookup is not set up on the server") }, { status: 503 });
  }

  const now = Date.now();
  const saved = cache.get(code);
  let hit: Hit;
  if (saved && now - saved.at < (saved.hit ? FOUND_MS : MISSING_MS)) {
    hit = saved.hit;
  } else {
    provider ??= new OpenFoodFactsProvider(cfg);
    try {
      hit = await provider.fetchProduct(code);
    } catch (e) {
      const err = e instanceof OffError ? e : new OffError("network", String(e));
      console.error("[barcode]", err.code, err.message);
      const message =
        err.code === "rate-limited"
          ? tr("Open Food Facts มีคนใช้เยอะ ลองใหม่ในอีก 1 นาที", "Open Food Facts is busy. Try again in a minute.")
          : tr("ค้นหาบาร์โค้ดไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't look up the barcode. Please try again.");
      return Response.json({ error: err.code, message }, { status: err.code === "rate-limited" ? 429 : 502 });
    }
    cache.set(code, { at: now, hit });
  }

  if (!hit) return Response.json({ code, found: false, product: null, food: null });
  return Response.json({ code: hit.code, found: true, product: hit.product, food: normalizeOffProduct(hit.code, hit.product) });
}
