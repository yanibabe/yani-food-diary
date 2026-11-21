// Production protection for every PAID AI route (server side), plus an emergency switch.
//
//  1. KILL SWITCH: AI_DISABLED=1 (or "true") in the server settings turns every paid AI call off at once.
//     Calls answer 503 {error:"ai-off"} before anything is sent to the AI. The app keeps working by hand
//     (manual entry, own foods, recipes, backup, ...). Needs a redeploy to take effect on Vercel (see docs/EMERGENCY_AI_OFF.md);
//     the instant alternative is revoking / capping the key at OpenRouter.
//  2. RATE LIMITS per visitor (IP) and per server instance, in memory:
//       - AI_MAX_PER_MIN   calls per minute per visitor            (default 20)
//       - AI_MAX_PER_DAY   calls per day per visitor               (default 300)
//       - AI_MAX_BG_PER_DAY  background calls per day per visitor  (default 120)  [picture / meal names / name translation]
//       - AI_MAX_PER_DAY_ALL calls per day per server instance     (default 3000)
//     Set any of them to 0 to block that kind completely.
//     Honest limit: Vercel can run several instances, so these are a best-effort fence, not a hard budget.
//     The hard budget is the spending limit on the OpenRouter key (see docs/EMERGENCY_AI_OFF.md).
// Nothing is logged except the route name and the refusal reason (never food words, photos, IPs or keys).
import { trFor, type Lang } from "../i18n.ts";

export type PaidRoute =
  | "analyze" | "refine" | "chat" | "suggest" | "ingredient"
  | "label-photo" | "barcode-photo" | "pack-photos"
  | "meal-picture" | "meal-titles" | "translate-names" | "usda-translate";

/** Calls the visitor did not ask for with a tap: they get their own smaller daily allowance. */
export const BACKGROUND_ROUTES: readonly PaidRoute[] = ["meal-picture", "meal-titles", "translate-names", "usda-translate"];

type Env = Record<string, string | undefined>;
type Decision = { ok: true } | { ok: false; status: 429 | 503; code: "ai-off" | "rate-limit"; reason: "off" | "minute" | "day" | "background-day" | "all-day" };

type Visitor = { minute: number[]; day: string; paid: number; background: number };
const MAX_VISITORS = 5000;
export const state = { visitors: new Map<string, Visitor>(), allDay: "", all: 0 };

export function resetGuardState() {
  state.visitors.clear();
  state.allDay = "";
  state.all = 0;
}

function num(env: Env, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function aiDisabled(env: Env = process.env): boolean {
  const v = env.AI_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Pure decision (the route wrapper turns it into an answer). Counts the call when it is allowed. */
export function decide(visitorId: string, route: PaidRoute, now: number, env: Env = process.env): Decision {
  if (aiDisabled(env)) return { ok: false, status: 503, code: "ai-off", reason: "off" };
  const perMin = num(env, "AI_MAX_PER_MIN", 20);
  const perDay = num(env, "AI_MAX_PER_DAY", 300);
  const bgDay = num(env, "AI_MAX_BG_PER_DAY", 120);
  const allDay = num(env, "AI_MAX_PER_DAY_ALL", 3000);
  const today = dayKey(now);
  if (state.allDay !== today) { state.allDay = today; state.all = 0; }
  if (state.all >= allDay) return { ok: false, status: 429, code: "rate-limit", reason: "all-day" };

  let v = state.visitors.get(visitorId);
  if (!v || v.day !== today) {
    if (!v && state.visitors.size >= MAX_VISITORS) {
      // keep memory bounded: drop the oldest entry
      const first = state.visitors.keys().next().value;
      if (first !== undefined) state.visitors.delete(first);
    }
    v = { minute: v?.minute ?? [], day: today, paid: 0, background: 0 };
    state.visitors.set(visitorId, v);
  }
  while (v.minute.length && now - v.minute[0] > 60_000) v.minute.shift();
  const background = BACKGROUND_ROUTES.includes(route);
  if (v.minute.length >= perMin) return { ok: false, status: 429, code: "rate-limit", reason: "minute" };
  if (v.paid >= perDay) return { ok: false, status: 429, code: "rate-limit", reason: "day" };
  if (background && v.background >= bgDay) return { ok: false, status: 429, code: "rate-limit", reason: "background-day" };
  v.minute.push(now);
  v.paid++;
  if (background) v.background++;
  state.all++;
  return { ok: true };
}

/** Who is asking: the first address of x-forwarded-for (Vercel sets it), else x-real-ip, else one shared bucket. */
export function visitorOf(headers: Pick<Headers, "get">): string {
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (xff || headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
}

/** null = allowed. Otherwise the answer to send (same {error, message} shape the app already shows). Call AFTER passcodeBlock. */
export function aiGuard(req: Request, route: PaidRoute, lang: Lang): Response | null {
  const d = decide(visitorOf(req.headers), route, Date.now());
  if (d.ok) return null;
  const t = trFor(lang);
  console.error("[ai-guard]", route, d.reason);
  const message = d.code === "ai-off"
    ? t("AI ปิดชั่วคราว — กรอกเองได้เลย", "AI is switched off for now — you can enter it yourself")
    : t("เรียก AI ถี่เกินไป ลองใหม่อีกครั้งภายหลัง", "Too many AI requests. Please try again later");
  return Response.json({ error: d.code, message }, { status: d.status, headers: { "retry-after": d.code === "rate-limit" ? "60" : "3600" } });
}
