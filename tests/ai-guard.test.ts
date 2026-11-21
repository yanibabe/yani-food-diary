// Production AI protection: kill switch + server-side rate limits on EVERY paid route (incl. background ones).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BACKGROUND_ROUTES, aiDisabled, aiGuard, decide, resetGuardState, state, visitorOf, type PaidRoute } from "../app/lib/server/aiGuard.ts";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const E = (o: Record<string, string> = {}) => o;
test.beforeEach(() => resetGuardState());

test("kill switch: AI_DISABLED turns every paid route off before anything is counted", () => {
  for (const v of ["1", "true", "TRUE", "yes", "on", " 1 "]) assert.equal(aiDisabled(E({ AI_DISABLED: v })), true, v);
  for (const v of ["", "0", "false", "no", "off"]) assert.equal(aiDisabled(E({ AI_DISABLED: v })), false, v);
  assert.equal(aiDisabled(E()), false);
  const d = decide("1.1.1.1", "analyze", NOW, E({ AI_DISABLED: "1" }));
  assert.deepEqual(d, { ok: false, status: 503, code: "ai-off", reason: "off" });
  for (const r of ["analyze", "refine", "chat", "suggest", "ingredient", "label-photo", "barcode-photo", "pack-photos", "meal-picture", "meal-titles", "translate-names", "usda-translate"] as PaidRoute[]) {
    assert.equal(decide("x", r, NOW, E({ AI_DISABLED: "1" })).ok, false, r);
  }
});

test("per-minute limit per visitor, then it recovers after the minute", () => {
  const env = E({ AI_MAX_PER_MIN: "3" });
  for (let i = 0; i < 3; i++) assert.equal(decide("a", "chat", NOW + i * 1000, env).ok, true);
  const d = decide("a", "chat", NOW + 4000, env);
  assert.deepEqual(d, { ok: false, status: 429, code: "rate-limit", reason: "minute" });
  assert.equal(decide("a", "chat", NOW + 61_500, env).ok, true, "a minute later it works again");
});

test("limits are per visitor: one visitor cannot use up another's allowance", () => {
  const env = E({ AI_MAX_PER_MIN: "1" });
  assert.equal(decide("a", "analyze", NOW, env).ok, true);
  assert.equal(decide("a", "analyze", NOW, env).ok, false);
  assert.equal(decide("b", "analyze", NOW, env).ok, true);
});

test("daily limit per visitor, reset on a new day", () => {
  const env = E({ AI_MAX_PER_DAY: "2", AI_MAX_PER_MIN: "100" });
  assert.equal(decide("a", "refine", NOW, env).ok, true);
  assert.equal(decide("a", "refine", NOW + 70_000, env).ok, true);
  const d = decide("a", "refine", NOW + 140_000, env);
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "day");
  assert.equal(decide("a", "refine", NOW + 24 * 3600 * 1000, env).ok, true);
});

test("background calls (picture / meal names / translation / USDA translate) have their own smaller daily allowance", () => {
  assert.deepEqual([...BACKGROUND_ROUTES].sort(), ["meal-picture", "meal-titles", "translate-names", "usda-translate"]);
  const env = E({ AI_MAX_BG_PER_DAY: "2", AI_MAX_PER_MIN: "100", AI_MAX_PER_DAY: "100" });
  assert.equal(decide("a", "meal-picture", NOW, env).ok, true);
  assert.equal(decide("a", "meal-titles", NOW + 1000, env).ok, true);
  const d = decide("a", "translate-names", NOW + 2000, env);
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "background-day");
  assert.equal(decide("a", "analyze", NOW + 3000, env).ok, true, "taps (analyze, chat…) are not blocked by the background allowance");
});

test("setting a limit to 0 blocks that kind completely; junk values fall back to the defaults", () => {
  assert.equal(decide("a", "meal-picture", NOW, E({ AI_MAX_BG_PER_DAY: "0" })).ok, false);
  assert.equal(decide("a", "analyze", NOW, E({ AI_MAX_PER_DAY_ALL: "0" })).ok, false);
  for (const bad of ["abc", "-5", "NaN", ""]) assert.equal(decide("z" + bad, "analyze", NOW, E({ AI_MAX_PER_MIN: bad })).ok, true, bad);
});

test("instance-wide daily cap protects the whole server", () => {
  const env = E({ AI_MAX_PER_DAY_ALL: "2", AI_MAX_PER_MIN: "100" });
  assert.equal(decide("a", "chat", NOW, env).ok, true);
  assert.equal(decide("b", "chat", NOW, env).ok, true);
  const d = decide("c", "chat", NOW, env);
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "all-day");
});

test("visitor id: first forwarded address, else real-ip, else a shared bucket; memory stays bounded", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  assert.equal(visitorOf(h({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
  assert.equal(visitorOf(h({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  assert.equal(visitorOf(h({})), "unknown");
  for (let i = 0; i < 5200; i++) decide("ip" + i, "chat", NOW, E({ AI_MAX_PER_MIN: "100" }));
  assert.ok(state.visitors.size <= 5000, "memory is bounded: " + state.visitors.size);
});

test("the refusal is the same {error,message} shape the app already shows, in Thai and English", async () => {
  process.env.AI_DISABLED = "1";
  try {
    const en = aiGuard(new Request("http://x/api/chat", { method: "POST" }), "chat", "en");
    assert.ok(en);
    assert.equal(en!.status, 503);
    const b = (await en!.json()) as { error: string; message: string };
    assert.equal(b.error, "ai-off");
    assert.match(b.message, /switched off/);
    const th = aiGuard(new Request("http://x/api/chat", { method: "POST" }), "chat", "th");
    assert.match(((await th!.json()) as { message: string }).message, /AI ปิดชั่วคราว/);
  } finally {
    delete process.env.AI_DISABLED;
  }
  assert.equal(aiGuard(new Request("http://x/api/chat", { method: "POST" }), "chat", "en"), null);
});

// ---- every paid route is guarded (scan the source, so a new route cannot be forgotten) ----
const PAID_FUNCS = ["analyzeMeal", "refineMeal", "chatReply", "lookupIngredient", "translateForUsda", "readBarcodeDigits", "readNutritionLabel", "readPackPhotos", "suggestMeals", "drawMealPicture", "checkMealTitles", "translateNames"];
function routes(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) routes(p, out);
    else if (f === "route.ts") out.push(p);
  }
  return out;
}
const ROUTE_DIR = new URL("../app/api", import.meta.url).pathname;

test("every route that can reach the paid AI calls aiGuard right after the passcode check", () => {
  const paid = routes(ROUTE_DIR).filter((p) => PAID_FUNCS.some((fn) => new RegExp(`\\b${fn}\\(`).test(readFileSync(p, "utf8"))));
  assert.ok(paid.length >= 11, "found the paid routes: " + paid.length);
  for (const p of paid) {
    const s = readFileSync(p, "utf8");
    assert.match(s, /import \{ aiGuard \} from "@\/app\/lib\/server\/aiGuard"/, p);
    assert.ok(/aiGuard\(req, "/.test(s), p);
    if (!p.includes("/usda/")) assert.ok(s.indexOf("passcodeBlock(req, lang)") < s.indexOf("aiGuard(req"), "guard after passcode: " + p);
  }
});

test("the USDA search skips its (paid, automatic) AI translation when the guard refuses", () => {
  const s = readFileSync(join(ROUTE_DIR, "food/usda/route.ts"), "utf8");
  assert.match(s, /aiGuard\(req, "usda-translate", lang\) \? null : /);
});

test("status tells the app AI is off (so it shows manual entry) without exposing anything else", () => {
  const ai = readFileSync(new URL("../app/lib/server/ai.ts", import.meta.url), "utf8");
  assert.match(ai, /configured: Boolean\(process\.env\.OPENROUTER_API_KEY\) && !aiDisabled\(\)/);
  assert.match(ai, /disabled: aiDisabled\(\)/);
});
