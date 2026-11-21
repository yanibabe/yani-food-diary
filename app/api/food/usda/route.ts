// Round 41: USDA FoodData Central lookups for the phone. The USDA key stays here on the server.
// POST { action: "search", name, query?, branded?, lang }  → ranked results (she confirms one on the phone)
// POST { action: "detail", fdcId, lang }                   → one food with all nutrients + household measures
// Only food words are sent to USDA — never her profile, weight or diary.

import { trFor } from "@/app/lib/i18n";
import { passcodeBlock } from "@/app/lib/server/passcode";
import { aiGuard } from "@/app/lib/server/aiGuard";
import { translateForUsda } from "@/app/lib/server/ai";
import { UsdaClient, UsdaError, sharedUsdaClient } from "@/app/lib/food/usda";
import { mockUsdaFetch } from "@/app/lib/food/usdaMock";
import { searchUsda } from "@/app/lib/food/usdaSearch";
import { localUsdaFood } from "@/app/lib/food/usdaLocal";

export const maxDuration = 30;

let mockClient: UsdaClient | null = null;
function client(): UsdaClient {
  // Test mode: fake USDA answers (no key, no network).
  if (process.env.USDA_MOCK === "1") return (mockClient ??= new UsdaClient({ apiKey: "mock", fetch: mockUsdaFetch() }));
  return sharedUsdaClient(process.env);
}

export async function POST(req: Request) {
  let body: { action?: string; name?: string; query?: string; branded?: boolean; fdcId?: number; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request", message: "ข้อมูลที่ส่งมาไม่ถูกต้อง / Bad request" }, { status: 400 });
  }
  const lang = body.lang === "en" ? "en" : "th";
  const t = trFor(lang);
  const blocked = await passcodeBlock(req, lang);
  if (blocked) return blocked;

  try {
    // Round 77: the live client may be missing (no key) — local foods can still answer, so the error waits until it is needed.
    let c: UsdaClient | null = null;
    let clientError: unknown = null;
    try {
      c = client();
    } catch (e) {
      clientError = e;
    }
    const live = (): UsdaClient => {
      if (!c) throw clientError;
      return c;
    };
    if (body.action === "detail") {
      const id = Number(body.fdcId);
      // The bundled table has this id (fast, works offline)? Answer from it. Otherwise live USDA.
      const food = localUsdaFood(id) ?? (await live().food(id));
      if (!food) return Response.json({ error: "not-found", message: t("ไม่พบอาหารนี้ใน USDA", "This food wasn't found in USDA") }, { status: 404 });
      return Response.json({ food, mock: process.env.USDA_MOCK === "1" });
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name && !body.query) return Response.json({ error: "bad-request", message: t("ยังไม่ได้ใส่ชื่ออาหาร", "No food name") }, { status: 400 });
    const canTranslate = Boolean(process.env.OPENROUTER_API_KEY) || process.env.AI_MOCK === "1";
    const out = await searchUsda(
      { search: (...a) => live().search(...a) },
      { name, query: typeof body.query === "string" ? body.query : null, branded: body.branded === true, local: process.env.USDA_MOCK !== "1" },
      canTranslate ? async (n) => (aiGuard(req, "usda-translate", lang) ? null : (await translateForUsda({ name: n, lang })).query || null) : null,
    );
    return Response.json({ ...out, mock: process.env.USDA_MOCK === "1" });
  } catch (e) {
    const err = e instanceof UsdaError ? e : new UsdaError("network", "USDA lookup failed");
    // Only the error code is logged — never the key, never her food words.
    console.error("[usda]", err.code, err.status ?? "");
    const map: Record<UsdaError["code"], [number, string, string]> = {
      "not-configured": [503, "ยังไม่ได้ตั้งค่า USDA บนเซิร์ฟเวอร์", "USDA isn't set up on the server yet"],
      auth: [502, "USDA ไม่รับ API key — ต้องตรวจการตั้งค่า", "USDA didn't accept the API key — the setup needs checking"],
      "rate-limited": [429, "USDA มีคนใช้เยอะ ลองอีกครั้งภายหลัง", "USDA is busy. Please try again later"],
      timeout: [504, "USDA ตอบช้าเกินไป ลองอีกครั้ง", "USDA took too long. Please try again"],
      network: [503, "เชื่อมต่อ USDA ไม่ได้ ลองอีกครั้ง", "Couldn't reach USDA. Please try again"],
      http: [502, "USDA มีปัญหาชั่วคราว ลองอีกครั้ง", "USDA had a problem. Please try again"],
      "bad-response": [502, "อ่านคำตอบจาก USDA ไม่ได้ ลองอีกครั้ง", "Couldn't read USDA's answer. Please try again"],
    };
    const [status, th, en] = map[err.code];
    return Response.json({ error: err.code, message: t(th, en) }, { status });
  }
}
