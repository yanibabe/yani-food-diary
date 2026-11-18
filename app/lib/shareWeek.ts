// Round 74 (part B): the weekly share card for her trainer. Pure maths (no canvas, no React, no physics):
// it turns the week's meals into the facts and a list of simple drawing commands.
// The phone draws the commands on a canvas (components/shareWeekDraw.ts); tests and the preview script
// use a fake text measurer. Look = the approved "แบบที่ 1" in public/_try/jar-ideas.html (1 CSS px = 3 picture px).

import { fmtKcal, pickMacros, sumMacros } from "./nutrition.ts";
import { shiftDateKey } from "./date.ts";
import { JAR_COLORS, JAR_MACROS, JAR_NAMES, JAR_SHAPES, JAR_MAX_PIECES, JAR_BASE_UNIT, pickUnit, piecesFor, percentBar, weekRange, type JarGrams, type JarMacro } from "./jar.ts";
import type { Cmd, Measure } from "./shareCard.ts";
import type { Entry } from "./types.ts";

export const WEEK_W = 1080;
const S = 3;
const SIDE = 16 * S; // phone padding
const TOP = 20 * S;
const CARD_X = SIDE;
const CARD_W = WEEK_W - 2 * SIDE;
const PADX = 18 * S;
export const WEEK_JAR_H = 230 * S;
export const WEEK_PIECE_R = 11 * S;
export const WEEK_JAR_PAD = 10 * S;

export const WEEK_COLORS = {
  ink: "#2b2622",
  muted: "#9a918a",
  card: "#fffdfb",
  kpi: "#f6f2ee",
  jar: "#f6f1ec",
  jarEdge: "#ffffff",
  track: "#efe9e3",
  none: "#e8e2dc", // day with no log
  over: "#F58B05", // over the kcal target
  ok: "#a7cfe6", // logged, not over
  bg: "#f6f2ee",
} as const;

// ---------------------------------------------------------------- facts

export type WeekDay = { date: string; logged: boolean; kcal: number; over: boolean };

export type WeekFacts = {
  start: string;
  end: string;
  days: WeekDay[]; // Monday .. Sunday
  loggedDays: number;
  grams: JarGrams; // whole week
  avgKcal: number | null; // per LOGGED day
  avgG: JarGrams; // per LOGGED day
};

const round = (n: number) => Math.round(n);

/** Everything the card says, worked out from the saved meals. Averages divide by logged days only. */
export function buildWeekFacts(entries: Entry[], date: string, target: number): WeekFacts {
  const { start, end } = weekRange(date);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({ date: shiftDateKey(start, i), logged: false, kcal: 0, over: false }));
  const grams: JarGrams = { p: 0, c: 0, f: 0 };
  let kcal = 0;
  for (const e of entries) {
    const d = days.find((x) => x.date === e.date);
    if (!d) continue;
    d.logged = true;
    const m = sumMacros(e.items.map(pickMacros));
    d.kcal += m.kcal || 0;
    grams.p += m.protein > 0 ? m.protein : 0;
    grams.c += m.carbs > 0 ? m.carbs : 0;
    grams.f += m.fat > 0 ? m.fat : 0;
    kcal += m.kcal || 0;
  }
  for (const d of days) d.over = d.logged && d.kcal > target;
  const loggedDays = days.filter((d) => d.logged).length;
  const avgG = loggedDays ? { p: grams.p / loggedDays, c: grams.c / loggedDays, f: grams.f / loggedDays } : { p: 0, c: 0, f: 0 };
  return { start, end, days, loggedDays, grams, avgKcal: loggedDays ? kcal / loggedDays : null, avgG };
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "16 – 22 พ.ย." (or "28 พ.ย. – 4 ธ.ค." across two months; English "Nov 16 – 22"). */
export function weekRangeLabel(start: string, end: string, lang: "th" | "en"): string {
  const [, m1, d1] = start.split("-").map(Number);
  const [, m2, d2] = end.split("-").map(Number);
  const M = lang === "en" ? EN_MONTH : TH_MONTH;
  if (lang === "en") return m1 === m2 ? `${M[m1 - 1]} ${d1} – ${d2}` : `${M[m1 - 1]} ${d1} – ${M[m2 - 1]} ${d2}`;
  return m1 === m2 ? `${d1} – ${d2} ${M[m2 - 1]}` : `${d1} ${M[m1 - 1]} – ${d2} ${M[m2 - 1]}`;
}

export const DAY_LETTERS = { th: ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"], en: ["M", "T", "W", "T", "F", "S", "S"] };

/** Good range in grams per day: carbs 45–65% of the kcal target ÷ 4, fat 20–35% ÷ 9. */
export function goodRange(k: "c" | "f", targetKcal: number): { lo: number; hi: number } {
  return k === "c" ? { lo: (targetKcal * 0.45) / 4, hi: (targetKcal * 0.65) / 4 } : { lo: (targetKcal * 0.2) / 9, hi: (targetKcal * 0.35) / 9 };
}

export type WeekRow = { k: JarMacro; avg: number; text: string; fill: number };

/** The three rows. Protein: avg / target. Carbs and fat: avg · range. Track fill = avg ÷ (target or range top), at most 1. */
export function weekRows(avgG: JarGrams, targetKcal: number, proteinTarget: number, lang: "th" | "en"): WeekRow[] {
  const rangeWord = lang === "en" ? "range" : "ช่วง";
  return JAR_MACROS.map((k) => {
    const avg = round(avgG[k]);
    if (k === "p") {
      return { k, avg, text: `${avg} / ${round(proteinTarget)} g`, fill: clamp01(proteinTarget > 0 ? avgG.p / proteinTarget : 0) };
    }
    const r = goodRange(k, targetKcal);
    return { k, avg, text: `${avg} g · ${rangeWord} ${round(r.lo)}–${round(r.hi)}`, fill: clamp01(r.hi > 0 ? avgG[k] / r.hi : 0) };
  });
}

const clamp01 = (n: number) => (n > 0 ? Math.min(1, n) : 0);

/** The piece list for the jar: whole-week grams, 20 g per piece, raised until at most 150 pieces. */
export function weekPieces(grams: JarGrams): { unit: number; capped: boolean; counts: Record<JarMacro, number> } {
  const unit = pickUnit(grams, JAR_BASE_UNIT.week);
  const counts = piecesFor(grams, unit);
  return { unit, capped: unit > JAR_BASE_UNIT.week, counts };
}

// ---------------------------------------------------------------- seeded random + order

/** Small seeded random (mulberry32): the same seed always gives the same numbers. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The pieces in a random (but seeded) order. */
export function pieceOrder(counts: Record<JarMacro, number>, seed: number): JarMacro[] {
  const list: JarMacro[] = JAR_MACROS.flatMap((k) => Array<JarMacro>(counts[k]).fill(k));
  const rnd = seededRandom(seed);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export type Placed = { k: JarMacro; x: number; y: number; a: number };

/** No-physics fallback: a tidy hex pile from the floor up, in the given (random) order. Always inside the jar. */
export function packFallback(order: JarMacro[], W: number, H: number, r: number, seed: number): Placed[] {
  const rnd = seededRandom(seed ^ 0x9e3779b9);
  const pad = WEEK_JAR_PAD;
  const d = r * 1.8;
  const cols = Math.max(1, Math.floor((W - 2 * pad - 2 * r - d / 2) / d) + 1);
  const left = pad + r;
  return order.map((k, i) => {
    const row = Math.floor(i / cols);
    const c = i % cols;
    const x = Math.min(W - pad - r, left + c * d + (row % 2 ? d / 2 : 0));
    const y = H - pad - r - row * d * 0.87;
    return { k, x, y, a: rnd() * 6.28 };
  });
}

// ---------------------------------------------------------------- the picture

export type WeekCmd =
  | Cmd
  /** The jar: rounded box + the settled pieces (null until the pile is worked out; then drawn empty). */
  | { t: "jar"; x: number; y: number; w: number; h: number; r: number; pieceR: number; order: JarMacro[]; seed: number; placed: Placed[] | null }
  /** One flat shape (heart / cloud / circle) centred at x,y with radius r. */
  | { t: "shape"; k: JarMacro; x: number; y: number; r: number }
  /** A pill with coloured parts side by side (the % bar). */
  | { t: "segbar"; x: number; y: number; w: number; h: number; parts: { w: number; color: string; label: string }[]; empty: string };

export type WeekInput = {
  entries: Entry[];
  date: string; // any day inside the week
  target: number;
  proteinTarget: number;
  lang: "th" | "en";
};

export type WeekCard = {
  w: number;
  h: number;
  cmds: WeekCmd[];
  facts: WeekFacts;
  rows: WeekRow[];
  pct: JarGrams;
  unit: number;
  capped: boolean;
  jar: { x: number; y: number; w: number; h: number; order: JarMacro[]; seed: number };
};

export function layoutShareWeek(inp: WeekInput, measure: Measure): WeekCard {
  const tr = (th: string, en: string) => (inp.lang === "en" ? en : th);
  const C = WEEK_COLORS;
  const facts = buildWeekFacts(inp.entries, inp.date, inp.target);
  const rows = weekRows(facts.avgG, inp.target, inp.proteinTarget, inp.lang);
  const pct = percentBar(facts.grams);
  const { unit, capped, counts } = weekPieces(facts.grams);
  const seed = hashSeed(`${facts.start}|${round(facts.grams.p)},${round(facts.grams.c)},${round(facts.grams.f)}`);
  const order = pieceOrder(counts, seed);

  const cmds: WeekCmd[] = [];
  const txt = (s: string, x: number, y: number, size: number, weight: number, color: string, align: "left" | "center" | "right" = "left", spacing?: number) =>
    cmds.push({ t: "text", x, y, s, size, weight, color, align, ...(spacing ? { spacing } : {}) });
  const L = CARD_X + PADX;
  const R = CARD_X + CARD_W - PADX;
  const IW = R - L;
  const top = TOP;
  // The card box goes first, but its height is only known at the end (added with unshift below).

  // header
  // Wide letter spacing only on "SNAPCAL": spacing pulls Thai vowel/tone marks away from their letters.
  const brandSp = 0.2 * 12 * S;
  txt("SNAPCAL", L, top + 96, 12 * S, 400, C.muted, "left", brandSp);
  txt(tr(" ·  สรุปสัปดาห์", " ·  WEEK SUMMARY"), L + measure("SNAPCAL", 12 * S, 400) + 7 * brandSp, top + 96, 12 * S, 400, C.muted);
  txt(weekRangeLabel(facts.start, facts.end, inp.lang), L, top + 168, 20 * S, 500, C.ink);

  // KPI boxes
  const kTop = top + 234;
  const kH = 172;
  const kW = (IW - 8 * S) / 2;
  const kpi = (i: number, big: string, bigSub: string, small: string) => {
    const x = L + i * (kW + 8 * S);
    cmds.push({ t: "rect", x, y: kTop, w: kW, h: kH, r: 16 * S, fill: C.kpi });
    txt(big, x + 10 * S, kTop + 82, 20 * S, 400, C.ink);
    if (bigSub) txt(bigSub, x + 10 * S + measure(big, 20 * S, 400) + 2, kTop + 82, 14 * S, 400, C.muted);
    txt(small, x + 10 * S, kTop + 132, 11.5 * S, 400, C.muted);
  };
  kpi(0, facts.avgKcal == null ? "–" : fmtKcal(facts.avgKcal), "", tr(`kcal/วัน (เป้า ${fmtKcal(inp.target)})`, `kcal/day (goal ${fmtKcal(inp.target)})`));
  kpi(1, String(facts.loggedDays), "/7", tr("วันที่บันทึก", "days logged"));

  // jar
  const jTop = kTop + kH + 14 * S;
  cmds.push({ t: "jar", x: L, y: jTop, w: IW, h: WEEK_JAR_H, r: 26 * S, pieceR: WEEK_PIECE_R, order, seed, placed: null });
  let y = jTop + WEEK_JAR_H;
  const pieceNote = capped
    ? tr(`1 ชิ้น = ${unit} g (ปรับให้พอดีโหล)`, `1 piece = ${unit} g (scaled to fit the jar)`)
    : tr(`1 ชิ้น = ${unit} g`, `1 piece = ${unit} g`);
  txt(pieceNote, WEEK_W / 2, y + 42, 10.5 * S, 400, C.muted, "center");
  y += 62;

  // % bar
  const bTop = y + 12 * S - 12;
  const total = pct.p + pct.c + pct.f;
  cmds.push({
    t: "segbar", x: L, y: bTop, w: IW, h: 26 * S,
    parts: JAR_MACROS.filter((k) => pct[k] > 0).map((k) => ({ w: (IW * pct[k]) / 100, color: JAR_COLORS[k], label: `${pct[k]}%` })),
    empty: total > 0 ? "" : tr("ยังไม่มีข้อมูล", "No data yet"),
  });
  y = bTop + 26 * S;

  // three rows
  const rowFont = 12.5 * S;
  const valW = Math.max(...rows.map((r) => measure(r.text, rowFont, 400)));
  const nameW = 50 * S;
  const nameX = L + 18 * S + 10 * S;
  const trackX = nameX + nameW + 6 * S;
  const trackR = R - valW - 8 * S;
  const lTop = y + 12 * S;
  rows.forEach((r, i) => {
    const cy = lTop + 9 * S + i * 26 * S;
    cmds.push({ t: "shape", k: r.k, x: L + 9 * S, y: cy, r: 14 * 1.5 });
    txt(inp.lang === "en" ? JAR_NAMES[r.k].en : JAR_NAMES[r.k].th, nameX, cy + 13, 13.5 * S, 400, C.ink);
    const tw = Math.max(0, trackR - trackX);
    cmds.push({ t: "rect", x: trackX, y: cy - 12, w: tw, h: 8 * S, r: 4 * S, fill: C.track });
    if (r.fill > 0) cmds.push({ t: "rect", x: trackX, y: cy - 12, w: Math.max(8 * S, tw * r.fill), h: 8 * S, r: 4 * S, fill: JAR_COLORS[r.k] });
    txt(r.text, R, cy + 13, rowFont, r.avg > 0 ? 500 : 400, C.ink, "right");
  });
  y = lTop + 3 * 26 * S - 8 * S;

  // day strip
  const dTop = y + 14 * S;
  const gap = 4 * S;
  const colW = (IW - 6 * gap) / 7;
  facts.days.forEach((d, i) => {
    const cx = L + i * (colW + gap) + colW / 2;
    txt(DAY_LETTERS[inp.lang][i], cx, dTop + 30, 10.5 * S, 400, C.muted, "center");
    const bw = colW * 0.7;
    cmds.push({ t: "rect", x: cx - bw / 2, y: dTop + 42, w: bw, h: 6 * S, r: 3 * S, fill: !d.logged ? C.none : d.over ? C.over : C.ok });
  });
  y = dTop + 42 + 6 * S;

  // footer
  txt(tr("เฉลี่ยต่อวันที่บันทึก · ตัวเลขเป็นค่าประมาณ (~)", "Average per logged day · numbers are estimates (~)"), WEEK_W / 2, y + 12 * S + 24, 11 * S, 400, C.muted, "center");
  const cardBottom = y + 12 * S + 24 + 20 * S;
  const h = cardBottom + TOP;
  cmds.unshift({ t: "rect", x: CARD_X, y: top, w: CARD_W, h: cardBottom - top, r: 28 * S, fill: C.card });
  return { w: WEEK_W, h, cmds, facts, rows, pct, unit, capped, jar: { x: L, y: jTop, w: IW, h: WEEK_JAR_H, order, seed } };
}

export function weekFileName(start: string): string {
  return `snapcal-week-${start}.png`;
}

export { JAR_MAX_PIECES, JAR_SHAPES };
