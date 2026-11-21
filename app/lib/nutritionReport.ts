// Professional nutrition reports (daily + weekly) for sharing with a trainer / coach.
// Two layers, both pure (no React, no canvas) so the tests can run them:
//   1. buildDayReport / buildWeekReport: the numbers, worked out from the saved meals (same sums as Today and the old week card).
//   2. layoutDayReport / layoutWeekReport: turn those numbers into drawing commands (rect / text / line / dot) with a text-measure function.
// Rules the reports follow:
//   - A day or meal with NO entries is "not logged" (shown as a dash / "No data"), never as 0 kcal.
//   - Weekly averages divide by the days that have food logged (not by 7), and say so.
//   - A day with only one meal logged is marked "few meals" so it is not read as a complete day.
//   - "~" marks estimated values; incomplete nutrient data is called out.

import { shiftDateKey, thaiDateLabel } from "./date.ts";
import { weekStart } from "./body.ts";
import { fmtAmount, fmtKcal, pickMacros, sumMacros } from "./nutrition.ts";
import { macroSplit, type Split } from "./macroSplit.ts";
import { isEstimated } from "./provenance.ts";
import { displayUnit } from "./unitNames.ts";
import type { NameAlt } from "./names.ts";
import type { Lang } from "./i18n.ts";
import { SLOTS, SLOT_LABEL, type Entry, type MealSlot } from "./types.ts";

// ---------------------------------------------------------------- shared drawing vocabulary

export type Measure = (text: string, size: number, weight: number) => number;
export type RCmd =
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number; fill?: string; stroke?: string; dash?: number[]; lw?: number }
  | { t: "text"; x: number; y: number; s: string; size: number; weight: number; color: string; align: "left" | "center" | "right" }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; color: string; w: number; dash?: number[] }
  | { t: "dot"; x: number; y: number; r: number; fill: string };
export type ReportLayout = { w: number; h: number; cmds: RCmd[] };

export const REPORT_W = 1080;
const PAD = 56;
export const RC = {
  bg: "#f6f3ee",
  card: "#ffffff",
  border: "#e6e0d6",
  ink: "#2b2724",
  muted: "#6b655e",
  track: "#ece7df",
  protein: "#c0624a",
  carbs: "#6a62b0",
  fat: "#4f8a58",
  ok: "#3f7a4a",
  over: "#b4701f",
  bar: "#3f4b5b",
  barLight: "#c6ced8",
  noData: "#bdb6ab",
};

const L = (lang: Lang) => (th: string, en: string) => (lang === "en" ? en : th);

/** Cut a text to fit `maxW` (adds "…"). Works letter by letter, so Thai (no spaces) is fine. */
export function fitText(measure: Measure, text: string, size: number, weight: number, maxW: number): string {
  if (measure(text, size, weight) <= maxW) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join("").trimEnd() + "…", size, weight) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join("").trimEnd() + "…";
}

/** Wrap a text into at most `maxLines` lines (last line gets "…" when cut). Spaces break words; Thai breaks anywhere. */
export function wrapText(measure: Measure, text: string, size: number, weight: number, maxW: number, maxLines: number): string[] {
  const words = text.includes(" ") ? text.split(" ") : Array.from(text);
  const sep = text.includes(" ") ? " " : "";
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const next = cur ? cur + sep + words[i] : words[i];
    if (measure(next, size, weight) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = words[i];
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fitText(measure, kept[maxLines - 1] + sep + lines.slice(maxLines).join(sep), size, weight, maxW);
  return kept;
}

// ---------------------------------------------------------------- DAILY: the numbers

export type ReportMeal = { title: string; kcal: number; detail: string; est: boolean };
export type ReportSlot = { slot: MealSlot; label: string; logged: boolean; kcal: number; meals: ReportMeal[] };

export type DayReport = {
  lang: Lang;
  date: string;
  dateLabel: string;
  name: string;
  target: number;
  /** Whole-number totals of the foods logged that day. */
  total: { kcal: number; protein: number; carbs: number; fat: number };
  macroTargets: { protein: number; carbs: number; fat: number };
  split: Split | null;
  slots: ReportSlot[];
  mealCount: number;
  notLogged: MealSlot[];
  /** Some food has an estimated value ("~"). */
  hasEstimate: boolean;
  /** Some food is missing protein / carbs / fat (so those totals may be too low). */
  incompleteNutrients: boolean;
  /** Only shown when really logged (0 glasses = not logged). */
  water: { glasses: number; goal: number } | null;
  weightKg: number | null;
};

export function buildDayReport(i: {
  entries: Entry[];
  date: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  lang: Lang;
  name?: string;
  show?: (name: string, alt?: NameAlt) => string;
  water?: { glasses: number; goal: number } | null;
  weightKg?: number | null;
}): DayReport {
  const show = i.show ?? ((n: string) => n);
  const unit = (it: { unit: string; amount: number }) => displayUnit(it.unit, i.lang, it.amount);
  const day = i.entries.filter((e) => e.date === i.date).sort((a, b) => a.createdAt - b.createdAt);
  const slots: ReportSlot[] = SLOTS.map((slot) => {
    const list = day.filter((e) => e.slot === slot);
    const meals = list.map((e) => ({
      title: show(e.title, e.alt),
      kcal: Math.round(sumMacros(e.items.map(pickMacros)).kcal),
      detail: e.items.length > 1 ? e.items.map((it) => `${show(it.name, it.alt)} ${fmtAmount(it.amount)} ${unit(it)}`.trim()).join(" · ") : "",
      est: e.items.some((it) => isEstimated(it, e)),
    }));
    return { slot, label: SLOT_LABEL[slot][i.lang], logged: list.length > 0, kcal: meals.reduce((a, m) => a + m.kcal, 0), meals };
  });
  const sum = sumMacros(day.flatMap((e) => e.items.map(pickMacros)));
  return {
    lang: i.lang,
    date: i.date,
    dateLabel: thaiDateLabel(i.date, i.lang),
    name: (i.name ?? "").trim(),
    target: i.target,
    total: { kcal: Math.round(sum.kcal), protein: Math.round(sum.protein), carbs: Math.round(sum.carbs), fat: Math.round(sum.fat) },
    macroTargets: { protein: Math.round(i.macroTargets.protein), carbs: Math.round(i.macroTargets.carbs), fat: Math.round(i.macroTargets.fat) },
    split: macroSplit(sum),
    slots,
    mealCount: day.length,
    notLogged: slots.filter((s) => !s.logged).map((s) => s.slot),
    hasEstimate: day.some((e) => e.items.some((it) => isEstimated(it, e))),
    incompleteNutrients: day.some((e) => e.items.some((it) => (it.missing?.length ?? 0) > 0)),
    water: i.water && i.water.glasses > 0 ? i.water : null,
    weightKg: i.weightKg ?? null,
  };
}

// ---------------------------------------------------------------- WEEKLY: the numbers

export type ReportDay = {
  date: string;
  logged: boolean;
  future: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Meal types (breakfast, lunch…) that have something logged. */
  mealSlots: number;
  /** Logged, but only one meal type: may be an incomplete day. */
  few: boolean;
  over: boolean;
};

export type WeekReport = {
  lang: Lang;
  start: string;
  end: string;
  rangeLabel: string;
  name: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  days: ReportDay[];
  loggedDays: number;
  /** Averages are per LOGGED day (never divided by 7). Null when nothing is logged. */
  avg: { kcal: number; protein: number; carbs: number; fat: number } | null;
  /** avg kcal − target (negative = under). Null without data or target. */
  vsTarget: number | null;
  fewDays: number;
  overDays: number;
  hasEstimate: boolean;
  incompleteNutrients: boolean;
};

export function weekRangeText(start: string, end: string, lang: Lang): string {
  const part = (key: string, withYear: boolean) => {
    const [y, m, d] = key.split("-").map(Number);
    const parts = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("weekday")} ${get("day")} ${get("month")}${withYear ? ` ${get("year")}` : ""}`;
  };
  return `${part(start, false)} – ${part(end, true)}`;
}

export function buildWeekReport(i: {
  entries: Entry[];
  date: string;
  today: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  lang: Lang;
  name?: string;
}): WeekReport {
  const start = weekStart(i.date);
  const end = shiftDateKey(start, 6);
  const days: ReportDay[] = Array.from({ length: 7 }, (_, n) => {
    const date = shiftDateKey(start, n);
    const list = i.entries.filter((e) => e.date === date);
    const m = sumMacros(list.flatMap((e) => e.items.map(pickMacros)));
    const slots = new Set(list.map((e) => e.slot)).size;
    const logged = list.length > 0;
    return { date, logged, future: date > i.today, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, mealSlots: slots, few: logged && slots <= 1, over: logged && i.target > 0 && m.kcal > i.target };
  });
  const logged = days.filter((d) => d.logged);
  const n = logged.length;
  const sumOf = (k: "kcal" | "protein" | "carbs" | "fat") => logged.reduce((a, d) => a + d[k], 0);
  const avg = n ? { kcal: sumOf("kcal") / n, protein: sumOf("protein") / n, carbs: sumOf("carbs") / n, fat: sumOf("fat") / n } : null;
  const inWeek = i.entries.filter((e) => e.date >= start && e.date <= end);
  return {
    lang: i.lang,
    start,
    end,
    rangeLabel: weekRangeText(start, end, i.lang),
    name: (i.name ?? "").trim(),
    target: i.target,
    macroTargets: { protein: Math.round(i.macroTargets.protein), carbs: Math.round(i.macroTargets.carbs), fat: Math.round(i.macroTargets.fat) },
    days,
    loggedDays: n,
    avg,
    vsTarget: avg && i.target > 0 ? Math.round(avg.kcal) - Math.round(i.target) : null,
    fewDays: days.filter((d) => d.few).length,
    overDays: days.filter((d) => d.over).length,
    hasEstimate: inWeek.some((e) => e.items.some((it) => isEstimated(it, e))),
    incompleteNutrients: inWeek.some((e) => e.items.some((it) => (it.missing?.length ?? 0) > 0)),
  };
}

// ---------------------------------------------------------------- shared layout pieces

class Canvasless {
  cmds: RCmd[] = [];
  rect(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, extra: { dash?: number[]; lw?: number } = {}) {
    this.cmds.push({ t: "rect", x, y, w, h, r, fill, stroke, ...extra });
  }
  text(s: string, x: number, y: number, size: number, weight: number, color: string, align: "left" | "center" | "right" = "left") {
    this.cmds.push({ t: "text", x, y, s, size, weight, color, align });
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, w = 2, dash?: number[]) {
    this.cmds.push({ t: "line", x1, y1, x2, y2, color, w, dash });
  }
  dot(x: number, y: number, r: number, fill: string) {
    this.cmds.push({ t: "dot", x, y, r, fill });
  }
  card(x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h, 28, RC.card, RC.border);
  }
}

function header(b: Canvasless, m: Measure, y: number, title: string, rightMain: string, rightSub: string): number {
  b.text("SnapCal", PAD, y + 44, 44, 600, RC.ink);
  b.text(title, PAD, y + 88, 26, 400, RC.muted);
  b.text(fitText(m, rightMain, 30, 500, 560), REPORT_W - PAD, y + 44, 30, 500, RC.ink, "right");
  if (rightSub) b.text(fitText(m, rightSub, 24, 400, 560), REPORT_W - PAD, y + 88, 24, 400, RC.muted, "right");
  b.line(PAD, y + 116, REPORT_W - PAD, y + 116, RC.border, 2);
  return y + 148;
}

function macroCard(b: Canvasless, m: Measure, x: number, y: number, w: number, h: number, o: { label: string; color: string; grams: number; targetText: string; frac: number; right?: string; gramsText?: string }) {
  b.card(x, y, w, h);
  b.dot(x + 34, y + 44, 9, o.color);
  b.text(o.label, x + 54, y + 53, 26, 500, RC.ink);
  if (o.right) b.text(o.right, x + w - 30, y + 53, 24, 400, RC.muted, "right");
  const g = o.gramsText ?? `${Math.round(o.grams)}`;
  b.text(g, x + 34, y + 126, 60, 500, RC.ink);
  b.text("g", x + 34 + m(g, 60, 500) + 8, y + 126, 28, 400, RC.muted);
  b.text(o.targetText, x + 34, y + 160, 22, 400, RC.muted);
  b.rect(x + 34, y + h - 34, w - 68, 10, 5, RC.track);
  const fw = (w - 68) * Math.max(0, Math.min(1, o.frac));
  if (fw > 0) b.rect(x + 34, y + h - 34, Math.max(10, fw), 10, 5, o.color);
}

function notes(b: Canvasless, m: Measure, y: number, lines: string[]): number {
  for (const line of lines) {
    for (const part of wrapText(m, line, 20, 400, REPORT_W - 2 * PAD, 2)) {
      b.text(part, PAD, y + 20, 20, 400, RC.muted);
      y += 28;
    }
    y += 6;
  }
  return y;
}

// ---------------------------------------------------------------- DAILY: the layout

export function layoutDayReport(d: DayReport, m: Measure): ReportLayout {
  const t = L(d.lang);
  const b = new Canvasless();
  let y = PAD;
  y = header(b, m, y, t("รายงานโภชนาการรายวัน", "Daily nutrition report"), d.dateLabel, d.name);
  const inner = REPORT_W - 2 * PAD;

  // Summary card: calories consumed vs target.
  const SH = 292;
  b.card(PAD, y, inner, SH);
  const px = PAD + 36;
  b.text(t("แคลอรีที่กินวันนี้", "Calories consumed"), px, y + 58, 24, 400, RC.muted);
  const kc = fmtKcal(d.total.kcal);
  const none = d.mealCount === 0;
  const bigText = none ? "–" : kc;
  b.text(bigText, px, y + 156, 104, 500, RC.ink);
  if (!none) b.text("kcal", px + m(bigText, 104, 500) + 14, y + 156, 32, 400, RC.muted);
  else b.text(t("ยังไม่มีอาหารที่บันทึก", "No food logged"), px + m(bigText, 104, 500) + 24, y + 152, 28, 400, RC.muted);
  const rx = REPORT_W - PAD - 36;
  if (d.target > 0) {
    b.text(t("เป้าหมาย", "Target"), rx, y + 58, 24, 400, RC.muted, "right");
    b.text(`${fmtKcal(d.target)} kcal`, rx, y + 112, 48, 500, RC.ink, "right");
    if (!none) {
      const diff = Math.round(d.target) - d.total.kcal;
      b.text(diff >= 0 ? t(`เหลืออีก ${fmtKcal(diff)} kcal`, `${fmtKcal(diff)} kcal remaining`) : t(`เกินเป้า ${fmtKcal(-diff)} kcal`, `${fmtKcal(-diff)} kcal over target`), rx, y + 156, 28, 500, diff >= 0 ? RC.ok : RC.over, "right");
    }
    const bw = inner - 72;
    b.rect(px, y + 196, bw, 18, 9, RC.track);
    if (!none) {
      const frac = Math.max(0, Math.min(1, d.total.kcal / d.target));
      if (frac > 0) b.rect(px, y + 196, Math.max(18, bw * frac), 18, 9, d.total.kcal > d.target ? RC.over : RC.bar);
    }
  }
  const mealsLine = none
    ? t("วันนี้ยังไม่มีมื้อที่บันทึก (ไม่ใช่การกิน 0 kcal)", "Nothing was logged for this day (not the same as eating 0 kcal)")
    : t(`บันทึกแล้ว ${d.mealCount} รายการ`, `${d.mealCount} ${d.mealCount === 1 ? "meal entry" : "meal entries"} logged`) +
      (d.notLogged.length ? ` · ${t("ยังไม่ได้บันทึก", "Not logged")}: ${d.notLogged.map((s) => SLOT_LABEL[s][d.lang]).join(", ")}` : "");
  b.text(fitText(m, mealsLine, 22, 400, inner - 72), px, y + 258, 22, 400, RC.muted);
  y += SH + 24;

  // Macro cards.
  const gap = 20;
  const cw = (inner - 2 * gap) / 3;
  const mt = d.macroTargets;
  const split = d.split;
  const macros = [
    { label: t("โปรตีน", "Protein"), color: RC.protein, g: d.total.protein, tg: mt.protein, pct: split?.protein },
    { label: t("คาร์โบไฮเดรต", "Carbs"), color: RC.carbs, g: d.total.carbs, tg: mt.carbs, pct: split?.carbs },
    { label: t("ไขมัน", "Fat"), color: RC.fat, g: d.total.fat, tg: mt.fat, pct: split?.fat },
  ];
  macros.forEach((o, n) =>
    macroCard(b, m, PAD + n * (cw + gap), y, cw, 210, {
      label: o.label,
      color: o.color,
      grams: o.g,
      gramsText: none ? "–" : undefined,
      targetText: none ? t("ไม่มีข้อมูล", "No data") : o.tg > 0 ? t(`เป้า ${o.tg} g`, `of ${o.tg} g target`) : "",
      frac: none || !(o.tg > 0) ? 0 : o.g / o.tg,
      right: !none && o.pct != null ? `${o.pct}%` : undefined,
    }),
  );
  y += 210 + 40;
  if (!none && split) {
    b.text(t("% = สัดส่วนของพลังงานทั้งวัน", "% = share of the day's calories"), PAD, y - 12, 20, 400, RC.muted);
    y += 24;
  }

  // Meal breakdown.
  b.text(t("รายการอาหาร", "Meals"), PAD, y + 34, 32, 600, RC.ink);
  b.line(PAD, y + 54, REPORT_W - PAD, y + 54, RC.border, 2);
  y += 82;
  for (const s of d.slots) {
    b.text(s.label, PAD, y + 28, 28, 600, s.logged ? RC.ink : RC.muted);
    b.text(s.logged ? `${fmtKcal(s.kcal)} kcal` : t("ยังไม่ได้บันทึก", "Not logged"), REPORT_W - PAD, y + 28, 28, s.logged ? 600 : 400, s.logged ? RC.ink : RC.noData, "right");
    y += 46;
    for (const meal of s.meals) {
      const kcalText = `${meal.est ? "~" : ""}${fmtKcal(meal.kcal)} kcal`;
      const kw = m(kcalText, 28, 500);
      const lines = wrapText(m, meal.title || t("อาหาร", "Meal"), 28, 500, inner - kw - 52, 2);
      lines.forEach((line, k) => b.text(line, PAD + 18, y + 28 + k * 36, 28, 500, RC.ink));
      b.text(kcalText, REPORT_W - PAD, y + 28, 28, 500, RC.ink, "right");
      y += 40 + (lines.length - 1) * 36;
      if (meal.detail) {
        b.text(fitText(m, meal.detail, 22, 400, inner - 40), PAD + 18, y + 22, 22, 400, RC.muted);
        y += 32;
      }
      y += 8;
    }
    y += 10;
    b.line(PAD, y, REPORT_W - PAD, y, RC.border, 1);
    y += 22;
  }

  // Extras only when really logged.
  const extras: string[] = [];
  if (d.water) extras.push(t(`น้ำ ${d.water.glasses}/${d.water.goal} แก้ว`, `Water ${d.water.glasses}/${d.water.goal} glasses`));
  if (d.weightKg != null) extras.push(t(`น้ำหนัก ${fmtAmount(d.weightKg)} กก.`, `Weight ${fmtAmount(d.weightKg)} kg`));
  if (extras.length) {
    b.text(extras.join("   ·   "), PAD, y + 28, 26, 500, RC.ink);
    y += 56;
  }

  // Honest footnotes.
  const foot = [t("ยอดรวมนับเฉพาะอาหารที่บันทึกไว้ใน SnapCal เท่านั้น", "Totals count only the foods logged in SnapCal.")];
  if (d.hasEstimate) foot.push(t("“~” คือค่าประมาณ", "“~” marks an estimated value."));
  if (d.incompleteNutrients) foot.push(t("อาหารบางรายการมีข้อมูลสารอาหารไม่ครบ ค่าโปรตีน/คาร์บ/ไขมันอาจต่ำกว่าจริง", "Some foods have incomplete nutrient data; protein, carbs or fat may be understated."));
  y = notes(b, m, y + 6, foot);
  b.text(t("สร้างด้วย SnapCal", "Generated with SnapCal"), REPORT_W - PAD, y + 24, 20, 500, RC.muted, "right");
  y += 52;
  return { w: REPORT_W, h: Math.ceil(y + PAD - 24), cmds: b.cmds };
}

// ---------------------------------------------------------------- WEEKLY: the layout

const WD = { th: ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };

export function layoutWeekReport(w: WeekReport, m: Measure): ReportLayout {
  const t = L(w.lang);
  const b = new Canvasless();
  let y = PAD;
  y = header(b, m, y, t("รายงานโภชนาการรายสัปดาห์", "Weekly nutrition report"), w.rangeLabel, w.name);
  const inner = REPORT_W - 2 * PAD;
  const noData = w.loggedDays === 0;

  // Summary: average per logged day + days logged.
  const gap = 20;
  const aw = Math.round(inner * 0.62);
  const bw2 = inner - aw - gap;
  const SH = 250;
  b.card(PAD, y, aw, SH);
  b.text(t("แคลอรีเฉลี่ยต่อวันที่บันทึก", "Average calories per logged day"), PAD + 34, y + 56, 24, 400, RC.muted);
  const avgText = w.avg ? fmtKcal(w.avg.kcal) : "–";
  b.text(avgText, PAD + 34, y + 156, 100, 500, RC.ink);
  if (w.avg) b.text("kcal", PAD + 34 + m(avgText, 100, 500) + 14, y + 156, 30, 400, RC.muted);
  if (w.avg && w.vsTarget != null) {
    const v = w.vsTarget;
    b.text(v === 0 ? t(`ตรงเป้า ${fmtKcal(w.target)} kcal`, `On target (${fmtKcal(w.target)} kcal)`) : t(`${v > 0 ? "+" : "−"}${fmtKcal(Math.abs(v))} kcal/วัน เทียบเป้า ${fmtKcal(w.target)}`, `${v > 0 ? "+" : "−"}${fmtKcal(Math.abs(v))} kcal/day vs target ${fmtKcal(w.target)}`), PAD + 34, y + 206, 26, 500, v > 0 ? RC.over : RC.muted);
  } else if (!w.avg) b.text(t("สัปดาห์นี้ยังไม่มีอาหารที่บันทึก", "No food logged this week"), PAD + 34, y + 206, 26, 400, RC.muted);
  else if (w.target > 0) b.text(t(`เป้าหมาย ${fmtKcal(w.target)} kcal`, `Target ${fmtKcal(w.target)} kcal`), PAD + 34, y + 206, 26, 400, RC.muted);
  const x2 = PAD + aw + gap;
  b.card(x2, y, bw2, SH);
  b.text(t("วันที่มีบันทึกอาหาร", "Days with food logged"), x2 + 30, y + 56, 24, 400, RC.muted);
  const dl = `${w.loggedDays}`;
  b.text(dl, x2 + 30, y + 156, 100, 500, RC.ink);
  b.text("/ 7", x2 + 30 + m(dl, 100, 500) + 12, y + 156, 40, 400, RC.muted);
  for (const [n, line] of wrapText(m, t("วันที่ไม่มีบันทึกไม่ถูกนับเป็น 0", "Days without entries are not counted as 0"), 20, 400, bw2 - 60, 2).entries()) b.text(line, x2 + 30, y + 196 + n * 26, 20, 400, RC.muted);
  y += SH + 24;

  // Average macros per logged day.
  const cw = (inner - 2 * gap) / 3;
  const mt = w.macroTargets;
  const rows = [
    { label: t("โปรตีน", "Protein"), color: RC.protein, g: w.avg?.protein ?? 0, tg: mt.protein },
    { label: t("คาร์โบไฮเดรต", "Carbs"), color: RC.carbs, g: w.avg?.carbs ?? 0, tg: mt.carbs },
    { label: t("ไขมัน", "Fat"), color: RC.fat, g: w.avg?.fat ?? 0, tg: mt.fat },
  ];
  rows.forEach((o, n) =>
    macroCard(b, m, PAD + n * (cw + gap), y, cw, 210, {
      label: o.label,
      color: o.color,
      grams: o.g,
      gramsText: w.avg ? undefined : "–",
      targetText: !w.avg ? t("ไม่มีข้อมูล", "No data") : o.tg > 0 ? t(`เฉลี่ย/วัน · เป้า ${o.tg} g`, `avg/day · target ${o.tg} g`) : t("เฉลี่ยต่อวัน", "avg per day"),
      frac: w.avg && o.tg > 0 ? o.g / o.tg : 0,
    }),
  );
  y += 210 + 24;

  // Calories per day chart.
  const CH = 520;
  b.card(PAD, y, inner, CH);
  b.text(t("แคลอรีรายวัน", "Calories per day"), PAD + 34, y + 54, 30, 600, RC.ink);
  const cx0 = PAD + 36;
  const cwid = inner - 72;
  const col = cwid / 7;
  const top = y + 112;
  const base = y + 372;
  const plotH = base - top;
  const maxK = Math.max(1000, ...w.days.map((d) => d.kcal), w.target || 0);
  const scale = plotH / (maxK * 1.12);
  b.line(cx0, base, cx0 + cwid, base, RC.border, 2);
  if (w.target > 0) {
    const ty = base - w.target * scale;
    b.line(cx0, ty, cx0 + cwid, ty, RC.muted, 2, [10, 8]);
    b.text(t(`เป้า ${fmtKcal(w.target)}`, `Target ${fmtKcal(w.target)}`), cx0 + cwid, ty - 10, 20, 500, RC.muted, "right");
  }
  w.days.forEach((d, n) => {
    const cxm = cx0 + col * n + col / 2;
    const bwid = Math.min(72, col - 26);
    if (!d.logged) {
      b.rect(cxm - bwid / 2, base - 12, bwid, 12, 4, undefined, RC.noData, { dash: [6, 5], lw: 2 });
      b.text(d.future ? t("ยังไม่ถึง", "Upcoming") : t("ไม่มีข้อมูล", "No data"), cxm, base - 26, 18, 400, RC.noData, "center");
    } else {
      const h = Math.max(8, d.kcal * scale);
      const fill = d.few ? RC.barLight : d.over ? RC.over : RC.bar;
      b.rect(cxm - bwid / 2, base - h, bwid, h, 8, fill, d.few ? RC.bar : undefined, d.few ? { dash: [8, 6], lw: 2 } : {});
      b.text(fmtKcal(d.kcal), cxm, base - h - 12, 22, 600, RC.ink, "center");
    }
    b.text(WD[w.lang][n], cxm, base + 34, 22, 500, d.logged ? RC.ink : RC.muted, "center");
    b.text(String(Number(d.date.slice(8, 10))), cxm, base + 62, 22, 400, RC.muted, "center");
    if (d.logged && d.few) b.text(t("1 มื้อ", "1 meal"), cxm, base + 88, 18, 500, RC.over, "center");
  });
  // Legend (only what is on the chart).
  const legend: { c: string; label: string; kind: "solid" | "few" | "none" }[] = [{ c: RC.bar, label: t("วันที่บันทึก", "Logged day"), kind: "solid" }];
  if (w.overDays) legend.push({ c: RC.over, label: t("เกินเป้า", "Over target"), kind: "solid" });
  if (w.fewDays) legend.push({ c: RC.barLight, label: t("บันทึกน้อย อาจไม่ครบ", "Few meals logged, may be incomplete"), kind: "few" });
  if (w.days.some((d) => !d.logged)) legend.push({ c: RC.noData, label: t("ไม่มีข้อมูล", "No data"), kind: "none" });
  let lx = cx0;
  const ly = y + CH - 34;
  for (const it of legend) {
    if (it.kind === "none") b.rect(lx, ly - 14, 22, 14, 3, undefined, RC.noData, { dash: [5, 4], lw: 2 });
    else if (it.kind === "few") b.rect(lx, ly - 18, 22, 18, 3, it.c, RC.bar, { dash: [6, 4], lw: 2 });
    else b.rect(lx, ly - 18, 22, 18, 3, it.c);
    b.text(it.label, lx + 32, ly - 1, 20, 400, RC.muted);
    lx += 32 + m(it.label, 20, 400) + 30;
  }
  y += CH + 24;

  // Table: one row per day, "–" for nothing logged.
  const TR = 56;
  const TH = 64 + 7 * TR + 70;
  b.card(PAD, y, inner, TH);
  const ix = PAD + 36;
  const colR = { meals: ix + 470, kcal: ix + 626, p: ix + 726, c: ix + 810, f: ix + inner - 72 };
  b.text(t("วัน", "Day"), ix, y + 42, 20, 500, RC.muted);
  b.text(t("มื้อ", "Meals"), colR.meals, y + 42, 20, 500, RC.muted, "right");
  b.text("kcal", colR.kcal, y + 42, 20, 500, RC.muted, "right");
  b.text(t("โปรตีน", "P"), colR.p, y + 42, 20, 500, RC.muted, "right");
  b.text(t("คาร์บ", "C"), colR.c, y + 42, 20, 500, RC.muted, "right");
  b.text(t("ไขมัน", "F"), colR.f, y + 42, 20, 500, RC.muted, "right");
  b.line(ix, y + 56, PAD + inner - 36, y + 56, RC.border, 1);
  const f = (d: string) => {
    const [yy, mm, dd] = d.split("-").map(Number);
    return new Intl.DateTimeFormat(w.lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(yy, mm - 1, dd, 12)));
  };
  w.days.forEach((d, n) => {
    const ry = y + 64 + n * TR + 36;
    b.text(f(d.date), ix, ry, 24, d.logged ? 500 : 400, d.logged ? RC.ink : RC.muted);
    if (d.logged) {
      b.text(String(d.mealSlots), colR.meals, ry, 24, 400, d.few ? RC.over : RC.ink, "right");
      b.text(fmtKcal(d.kcal), colR.kcal, ry, 24, 600, RC.ink, "right");
      b.text(String(Math.round(d.protein)), colR.p, ry, 24, 400, RC.ink, "right");
      b.text(String(Math.round(d.carbs)), colR.c, ry, 24, 400, RC.ink, "right");
      b.text(String(Math.round(d.fat)), colR.f, ry, 24, 400, RC.ink, "right");
    } else {
      b.text(d.future ? t("ยังไม่ถึง", "Upcoming") : t("ไม่มีข้อมูล", "No data"), colR.kcal, ry, 22, 400, RC.noData, "right");
      for (const k of ["meals", "p", "c", "f"] as const) b.text("–", colR[k], ry, 24, 400, RC.noData, "right");
    }
  });
  const ay = y + 64 + 7 * TR + 14;
  b.line(ix, ay, PAD + inner - 36, ay, RC.border, 1);
  b.text(t("เฉลี่ย (เฉพาะวันที่บันทึก)", "Average (logged days only)"), ix, ay + 38, 22, 600, RC.ink);
  if (w.avg) {
    b.text(fmtKcal(w.avg.kcal), colR.kcal, ay + 38, 24, 600, RC.ink, "right");
    b.text(String(Math.round(w.avg.protein)), colR.p, ay + 38, 24, 600, RC.ink, "right");
    b.text(String(Math.round(w.avg.carbs)), colR.c, ay + 38, 24, 600, RC.ink, "right");
    b.text(String(Math.round(w.avg.fat)), colR.f, ay + 38, 24, 600, RC.ink, "right");
  } else b.text("–", colR.kcal, ay + 38, 24, 400, RC.noData, "right");
  y += TH + 24;

  const foot = [noData ? t("ยังไม่มีอาหารที่บันทึกในสัปดาห์นี้", "No food was logged this week.") : t(`ค่าเฉลี่ยคิดจาก ${w.loggedDays} วันที่มีบันทึก (จาก 7 วัน) วันที่ไม่มีข้อมูลไม่ถูกนับเป็น 0`, `Averages use the ${w.loggedDays} logged day${w.loggedDays === 1 ? "" : "s"} (of 7). Days without entries are not counted as 0.`)];
  if (w.fewDays) foot.push(t("วันที่บันทึกแค่มื้อเดียวอาจยังไม่ครบทั้งวัน อย่าตีความว่าเป็นปริมาณที่กินทั้งหมด", "A day with only one meal logged may be incomplete; do not read it as the full day's intake."));
  if (w.hasEstimate) foot.push(t("บางรายการเป็นค่าประมาณ", "Some entries are estimated values."));
  if (w.incompleteNutrients) foot.push(t("อาหารบางรายการมีข้อมูลสารอาหารไม่ครบ ค่าอาจต่ำกว่าจริง", "Some foods have incomplete nutrient data, so those totals may be understated."));
  y = notes(b, m, y, foot);
  b.text(t("สร้างด้วย SnapCal", "Generated with SnapCal"), REPORT_W - PAD, y + 24, 20, 500, RC.muted, "right");
  y += 52;
  return { w: REPORT_W, h: Math.ceil(y + PAD - 24), cmds: b.cmds };
}

export function reportFileName(kind: "day" | "week", key: string): string {
  return kind === "day" ? `snapcal-day-${key}.png` : `snapcal-week-${key}.png`;
}
