// SERVER ONLY (Round 69). "The AI never invents the numbers" for a photo / text meal:
//   1) the vision model names each item (English `en`), grams and cooking state,
//   2) this file searches the local food table for candidates (milliseconds),
//   3) ONE fast text call picks a candidate per item (or "none"),
//   4) code computes nutrients = per 100 g × grams ÷ 100.
// Items with no good match keep the vision model's own estimate. Anything slow or broken falls back to
// that estimate too: the meal is never blocked.

import { foodById, nutrientsFor, searchFoods, type Candidate, type DbFood } from "./foodDb.ts";
import type { MacroKey, Provenance } from "../types.ts";

export const PICK_MODEL = "deepseek/deepseek-v4.1-flash-1017";
export const PICK_TIMEOUT_MS = 3000;
/** A database value more than this many times above or below the vision estimate is not trusted. */
export const SANITY_RATIO = 2.5;
/** A candidate must contain at least this share of the searched name's words (mixed dishes share only one ingredient). */
export const MIN_COVERAGE = 0.7;
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** What the vision model gives for one item (only the fields this file needs). */
export type VisionItem = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams?: number | null;
  en?: string | null;
  state?: string | null;
  fromLabel?: boolean;
  estimated?: boolean;
  kind?: string;
};

/** Extra fields the server adds to an item the table matched. The phone reads `prov`, `ref`, `missing`. */
export type GroundedFields = {
  prov: Provenance;
  ref: { source: "usda"; sourceId: string } | null;
  missing?: MacroKey[];
  dbMatch: { id: string; description: string; per100Kcal: number };
};

export type Grounding = {
  matched: number;
  estimated: number;
  /** Why an item kept the vision estimate: no-candidates | none | sanity | label | no-grams. */
  reasons: Record<string, number>;
  pick: "ok" | "failed" | "skipped";
  ms: number;
};

/** Items that never go to the table: numbers read off a printed label, or no name / weight to look up. */
export function skipReason(it: VisionItem): "label" | "no-grams" | "no-name" | null {
  if (it.fromLabel === true) return "label";
  if (!(typeof it.grams === "number" && it.grams > 0)) return "no-grams";
  if (!it.en || !it.en.trim()) return "no-name";
  return null;
}

/** The prompt for the pick call. Exported so a test can look at it. */
export function buildPickPrompt(items: { i: number; en: string; state: string; grams: number; candidates: Candidate[] }[]): { system: string; user: string } {
  const system = `You match foods to a nutrition database. For each numbered item choose the ONE candidate that is the same food, in the same state, or 0 if none fits.
Rules:
- Same cooking state: cooked rice is not raw rice, a fried egg is not a raw egg, boiled is not fried. Prefer the candidate whose state matches the item's state.
- Same food: oyster sauce is not oil, soy sauce is not soy milk, egg white is not a whole egg, dried is not fresh.
- Choose 0 when the item is a mixed or cooked dish (e.g. pad kra pao, som tam, curry, noodle soup) and no candidate is that dish, or when every candidate is a different main ingredient. Do NOT choose a dish just because it shares one ingredient.
- Plain ingredients (rice, egg, banana, oil, sauce, chicken breast) should match the plain candidate. Brand-free generic entries are fine.
Reply ONLY with JSON: {"picks":[{"i":1,"c":2},{"i":2,"c":0}]} where i = item number, c = candidate number (0 = none).`;
  const lines = items.map((it) => {
    const cands = it.candidates.map((c, k) => `  ${k + 1}) ${c.name} - ${Math.round(c.per100.kcal)} kcal/100 g`).join("\n");
    return `Item ${it.i}: "${it.en}" (state: ${it.state || "unknown"}, about ${Math.round(it.grams)} g)\n${cands}`;
  });
  return { system, user: lines.join("\n\n") };
}

/** Read the model's answer → item number → candidate number (1-based, 0 = none). Bad parts are ignored. */
export function parsePicks(text: string, max: Record<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return out;
    try {
      data = JSON.parse(m[0]);
    } catch {
      return out;
    }
  }
  const picks = (data as { picks?: unknown })?.picks;
  if (!Array.isArray(picks)) return out;
  for (const p of picks) {
    const i = Number((p as { i?: unknown })?.i);
    const c = Number((p as { c?: unknown })?.c);
    if (!Number.isInteger(i) || !Number.isInteger(c) || !(i in max)) continue;
    if (c >= 0 && c <= max[i]) out.set(i, c);
  }
  return out;
}

export type PickFn = (system: string, user: string, ms: number) => Promise<string>;

/** The real pick call: DeepSeek through OpenRouter, thinking off, fastest provider. Throws on any problem. */
export const pickWithDeepSeek: PickFn = async (system, user, ms) => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("no key");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PICK_MODEL,
        reasoning: { enabled: false },
        provider: { sort: "latency", require_parameters: true },
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`pick ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("empty");
    return text;
  } finally {
    clearTimeout(timer);
  }
};

/** Database numbers vs the vision estimate: both tiny is fine; otherwise within SANITY_RATIO either way. */
export function passesSanity(dbKcal: number, visionKcal: number): boolean {
  if (dbKcal <= 15 && visionKcal <= 15) return true;
  if (dbKcal <= 0 || visionKcal <= 0) return false;
  const ratio = dbKcal / visionKcal;
  return ratio <= SANITY_RATIO && ratio >= 1 / SANITY_RATIO;
}

function provFor(food: DbFood): Provenance {
  // USDA: real measurements, but nobody checked this is exactly her food → "database" + "unverified".
  if (food.src !== "r") return { source: "database", verification: "unverified", via: "usda" };
  // The app's own rough Thai / typical table: a reference value, an estimate.
  return { source: "reference", verification: "estimated", via: "picked" };
}

/**
 * Put database numbers on the items the table can back. Never throws: any problem = the vision estimate stays.
 * `pick` is injectable so tests need no network.
 */
export async function groundItems<T extends VisionItem>(
  items: T[],
  opts: { pick?: PickFn; timeoutMs?: number; log?: (msg: string) => void } = {},
): Promise<{ items: (T & Partial<GroundedFields>)[]; grounding: Grounding }> {
  const started = Date.now();
  const log = opts.log ?? ((m: string) => console.log(m));
  const reasons: Record<string, number> = {};
  const note = (r: string) => (reasons[r] = (reasons[r] ?? 0) + 1);
  const out: (T & Partial<GroundedFields>)[] = items.map((it) => ({ ...it }));

  // 1) candidates, locally
  const pending: { idx: number; i: number; en: string; state: string; grams: number; candidates: Candidate[] }[] = [];
  items.forEach((it, idx) => {
    const skip = skipReason(it);
    if (skip) return note(skip);
    const state = (it.state ?? "").toLowerCase();
    const candidates = searchFoods(it.en!, { state: state && state !== "other" ? state : null, limit: 6, minCoverage: MIN_COVERAGE });
    if (!candidates.length) return note("no-candidates");
    pending.push({ idx, i: pending.length + 1, en: it.en!.trim(), state, grams: it.grams!, candidates });
  });
  if (!pending.length) return { items: out, grounding: { matched: 0, estimated: items.length, reasons, pick: "skipped", ms: Date.now() - started } };

  // 2) one fast pick call
  let picks = new Map<number, number>();
  let pickState: Grounding["pick"] = "ok";
  try {
    const { system, user } = buildPickPrompt(pending);
    const ms = opts.timeoutMs ?? PICK_TIMEOUT_MS;
    // A hard stop here too, in case the call itself ignores its time limit.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`pick took longer than ${ms} ms`)), ms)));
    const text = await Promise.race([(opts.pick ?? pickWithDeepSeek)(system, user, ms), late]).finally(() => clearTimeout(timer));
    picks = parsePicks(text, Object.fromEntries(pending.map((p) => [p.i, p.candidates.length])));
  } catch (e) {
    pickState = "failed";
    log(`[food-db] pick failed, keeping vision estimates: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 3) code computes the numbers
  let matched = 0;
  for (const p of pending) {
    const c = picks.get(p.i);
    if (pickState === "failed") {
      note("pick-failed");
      continue;
    }
    if (!c) {
      note("none");
      continue;
    }
    const food = foodById(p.candidates[c - 1].id);
    if (!food) {
      note("none");
      continue;
    }
    const n = nutrientsFor(food, p.grams);
    const it = items[p.idx];
    if (!passesSanity(n.kcal, it.kcal)) {
      log(`[food-db] sanity: "${it.en}" -> "${food.name}" gives ${n.kcal} kcal, vision said ${Math.round(it.kcal)}; keeping the vision estimate`);
      note("sanity");
      continue;
    }
    const missing = (["protein", "carbs", "fat"] as const).filter((k) => n[k] == null);
    Object.assign(out[p.idx], {
      kcal: n.kcal,
      protein: n.protein ?? 0,
      carbs: n.carbs ?? 0,
      fat: n.fat ?? 0,
      prov: provFor(food),
      ref: food.src === "r" ? null : { source: "usda" as const, sourceId: food.id },
      ...(missing.length ? { missing } : {}),
      dbMatch: { id: food.id, description: food.name, per100Kcal: food.per100.kcal },
    });
    matched++;
  }
  return { items: out, grounding: { matched, estimated: items.length - matched, reasons, pick: pickState, ms: Date.now() - started } };
}
