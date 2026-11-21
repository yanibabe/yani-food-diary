// The weekly report picture, in the same "Frosted Calm" language as the daily card (shareCard.ts):
// a header card with the character, big light numbers, thin macro bars, then a soft bar chart and a
// "day by day" story with a meal picture for each day. Pure maths (no canvas, no React).
// The numbers come from buildWeekReport (nutritionReport.ts): averages use LOGGED days only,
// days without entries say "No data" (never 0 kcal), a day with one meal type is flagged.

import { fmtKcal } from "./nutrition.ts";
import { CARD_COLORS as C, fitText, wrapText, type Cmd, type Measure } from "./shareCard.ts";
import type { WeekReport } from "./nutritionReport.ts";
import type { ShareDay } from "./shareDay.ts";

export const WEEK_CARD_W = 1080;
const PAD = 56;
const IN = 44;
const THUMB = 112;

export type WeekDayStory = { date: string; label: string; share: ShareDay | null };
export type WeekCard = { w: number; h: number; cmds: Cmd[] };

const DAY = { th: ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
const BAR = "#EDB997"; // soft peach (same as the breakfast dot)
const NOFILL = "rgba(0,0,0,0)";
const OVER_BAR = "#C98258"; // the app's over colour, a little softer for a big bar

/** "Mon 16 Nov" / "จันทร์ 16 พ.ย." for the day-by-day rows. */
export function dayShortLabel(key: string, lang: "th" | "en"): string {
  const [y, mo, d] = key.split("-").map(Number);
  const parts = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).formatToParts(new Date(Date.UTC(y, mo - 1, d, 12)));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("weekday")} ${g("day")} ${g("month")}`;
}

export function layoutWeekCard(r: WeekReport, stories: WeekDayStory[], m: Measure): WeekCard {
  const tr = (th: string, en: string) => (r.lang === "en" ? en : th);
  const cmds: Cmd[] = [];
  const L = PAD;
  const R = WEEK_CARD_W - PAD;
  const CW = R - L;
  const txt = (s: string, x: number, y: number, size: number, weight: number, color: string, align: "left" | "center" | "right" = "left", spacing?: number) =>
    cmds.push({ t: "text", x, y, s, size, weight, color, align, ...(spacing ? { spacing } : {}) });
  const glass = (x: number, y: number, w: number, h: number, r2: number) => cmds.push({ t: "rect", x, y, w, h, r: r2, fill: C.glass, stroke: C.glassEdge });
  const w = (s: string, size: number, weight: number) => m(s, size, weight);

  // ---------- Header card ----------
  const hTop = PAD;
  const hIndex = cmds.length;
  cmds.push({ t: "rect", x: L, y: hTop, w: CW, h: 0, r: 56, fill: C.glass, stroke: C.glassEdge });
  cmds.push({ t: "char", x: R - IN - 96, y: hTop + IN - 6, size: 96 });
  const iL = L + IN;
  const iR = R - IN;
  const iW = iR - iL;
  let y = hTop + IN + 26;
  if (r.name) {
    txt(fitText(m, r.name.toUpperCase(), 26, 400, iW - 130), iL, y, 26, 400, C.muted, "left", 5);
    y += 52;
  } else y += 6;
  txt(fitText(m, r.rangeLabel, 40, 400, iW - 130), iL, y, 40, 400, C.ink);
  y += 40;
  txt(tr("รายงานรายสัปดาห์", "Weekly report"), iL, y + 40, 26, 300, C.muted);
  y += 40;

  const none = r.loggedDays === 0;
  const avg = r.avg;
  y += 134;
  const big = avg ? fmtKcal(avg.kcal) : "–";
  txt(big, iL, y, 122, 200, C.ink);
  const bw = w(big, 122, 200);
  txt(avg ? tr("kcal / วัน", "kcal / day") : tr("ยังไม่มีอาหารที่บันทึก", "No food logged"), iL + bw + 16, y, avg ? 30 : 28, 300, C.muted);
  if (r.target > 0) txt(`${tr("เป้า", "goal")} ${fmtKcal(r.target)}`, iR, y - 46, 32, 400, C.ink, "right");
  if (avg && r.vsTarget != null) {
    const v = r.vsTarget;
    txt(v === 0 ? tr("ตรงเป้า", "on goal") : v > 0 ? tr(`เกิน ${fmtKcal(v)}`, `${fmtKcal(v)} over`) : tr(`ต่ำกว่า ${fmtKcal(-v)}`, `${fmtKcal(-v)} under`), iR, y, 30, 300, v > 0 ? C.over : C.muted, "right");
  }
  y += 30;
  txt(tr("ค่าเฉลี่ยของวันที่มีบันทึก", "average of the days with food logged"), iL, y + 12, 24, 300, C.muted);
  y += 46;
  cmds.push({ t: "bar", x: iL, y, w: iW, part: avg && r.target > 0 ? avg.kcal / r.target : 0, color: avg && r.vsTarget != null && r.vsTarget > 0 ? C.over : C.ink });
  y += 6 + 44;

  const gap = 28;
  const cw = (iW - gap * 2) / 3;
  const mt = r.macroTargets;
  const macros = [
    { label: tr("โปรตีน", "Protein"), g: avg ? Math.round(avg.protein) : null, of: mt.protein, color: C.protein },
    { label: tr("คาร์บ", "Carbs"), g: avg ? Math.round(avg.carbs) : null, of: mt.carbs, color: C.carbs },
    { label: tr("ไขมัน", "Fat"), g: avg ? Math.round(avg.fat) : null, of: mt.fat, color: C.fat },
  ];
  macros.forEach((mc, i) => {
    const x = iL + i * (cw + gap);
    cmds.push({ t: "dot", x: x + 8, y: y + 10, r: 8, fill: mc.color });
    txt(mc.label, x + 26, y + 20, 26, 400, C.muted);
    const gs = mc.g == null ? "–" : `${mc.g}`;
    txt(gs, x, y + 88, 58, 300, C.ink);
    if (mc.of > 0) txt(`/ ${mc.of} g`, x + w(gs, 58, 300) + 12, y + 88, 25, 300, C.muted);
    cmds.push({ t: "bar", x, y: y + 108, w: cw, part: mc.g != null && mc.of > 0 ? mc.g / mc.of : 0, color: mc.color });
  });
  y += 108 + 6 + 36;

  // chips: days logged, few-meal days
  const chips: { label: string; value: string; dot: string }[] = [{ label: tr("วันที่บันทึก", "Days logged"), value: `${r.loggedDays} / 7`, dot: C.water }];
  if (r.fewDays) chips.push({ label: tr("บันทึกน้อย", "Few meals"), value: tr(`${r.fewDays} วัน`, `${r.fewDays} ${r.fewDays === 1 ? "day" : "days"}`), dot: C.over });
  let cx = iL;
  for (const c of chips) {
    const cwid = w(c.label, 26, 400) + w(c.value, 26, 300) + 70;
    cmds.push({ t: "rect", x: cx, y, w: cwid, h: 58, r: 29, fill: C.tile });
    cmds.push({ t: "dot", x: cx + 28, y: y + 29, r: 7, fill: c.dot });
    txt(c.label, cx + 46, y + 38, 26, 400, C.muted);
    txt(c.value, cx + 46 + w(c.label, 26, 400) + 14, y + 38, 26, 300, C.ink);
    cx += cwid + 16;
  }
  y += 58 + 38;
  (cmds[hIndex] as Extract<Cmd, { t: "rect" }>).h = y - hTop;

  // ---------- Calories per day ----------
  y += 62;
  cmds.push({ t: "dot", x: L + 38, y: y - 10, r: 10, fill: BAR });
  txt(tr("แคลอรีแต่ละวัน", "Calories each day"), L + 62, y, 32, 400, C.ink);
  y += 22;
  const CH = 470;
  glass(L, y, CW, CH, 52);
  const cx0 = L + IN;
  const cwid = CW - IN * 2;
  const col = cwid / 7;
  const top = y + 96;
  const base = y + 300;
  const maxK = Math.max(1000, ...r.days.map((d) => d.kcal), r.target || 0);
  const sc = (base - top) / (maxK * 1.1);
  cmds.push({ t: "line", x1: cx0, y1: base, x2: cx0 + cwid, y2: base, color: C.line, w: 2 });
  const ty = r.target > 0 ? base - r.target * sc : null;
  if (ty != null) {
    cmds.push({ t: "line", x1: cx0, y1: ty, x2: cx0 + cwid, y2: ty, color: "rgba(176,96,58,0.5)", w: 2, dash: [10, 9] });
    txt(`${tr("เป้า", "goal")} ${fmtKcal(r.target)}`, cx0 + cwid, ty - 12, 22, 400, C.over, "right");
  }
  r.days.forEach((d, i) => {
    const mx = cx0 + col * i + col / 2;
    const bwid = Math.min(58, col - 28);
    if (!d.logged) {
      cmds.push({ t: "rect", x: mx - bwid / 2, y: base - 10, w: bwid, h: 10, r: 5, fill: NOFILL, stroke: "#B9B1A6", dash: [6, 5] });
      txt(d.future ? tr("ยังไม่ถึง", "Upcoming") : tr("ไม่มีข้อมูล", "No data"), mx, base - 24, 19, 300, C.muted, "center");
    } else {
      const h = Math.max(10, d.kcal * sc);
      cmds.push(
        d.few
          ? { t: "rect", x: mx - bwid / 2, y: base - h, w: bwid, h, r: 20, fill: "rgba(237,185,151,0.25)", stroke: BAR, dash: [8, 6] }
          : { t: "rect", x: mx - bwid / 2, y: base - h, w: bwid, h, r: 20, fill: d.over ? OVER_BAR : BAR },
      );
      const label = fmtKcal(d.kcal);
      const ly = base - h - 14;
      // A value that would sit on the goal line gets a soft backing so both stay readable.
      if (ty != null && Math.abs(ly - 8 - ty) < 24) cmds.push({ t: "rect", x: mx - (w(label, 24, 400) + 20) / 2, y: ly - 26, w: w(label, 24, 400) + 20, h: 36, r: 12, fill: "rgba(255,255,255,0.92)" });
      txt(label, mx, ly, 24, 400, C.ink, "center");
    }
    txt(DAY[r.lang][i], mx, base + 40, 24, 400, d.logged ? C.ink : C.muted, "center");
    txt(String(Number(d.date.slice(8, 10))), mx, base + 70, 22, 300, C.muted, "center");
    if (d.logged && d.few) txt(tr("1 มื้อ", "1 meal"), mx, base + 98, 19, 400, C.over, "center");
  });
  // legend (only what is on the chart)
  const leg: { c: string; s: string; kind: "fill" | "dash" | "none" }[] = [{ c: BAR, s: tr("บันทึกแล้ว", "Logged"), kind: "fill" }];
  if (r.overDays) leg.push({ c: OVER_BAR, s: tr("เกินเป้า", "Over goal"), kind: "fill" });
  if (r.fewDays) leg.push({ c: BAR, s: tr("มื้อน้อย อาจไม่ครบ", "Few meals, maybe incomplete"), kind: "dash" });
  if (r.days.some((d) => !d.logged)) leg.push({ c: "#B9B1A6", s: tr("ไม่มีข้อมูล", "No data"), kind: "none" });
  let lx = cx0;
  const ly2 = y + CH - 30;
  for (const it of leg) {
    if (it.kind === "fill") cmds.push({ t: "dot", x: lx + 8, y: ly2 - 8, r: 8, fill: it.c });
    else cmds.push({ t: "rect", x: lx, y: ly2 - 16, w: 18, h: 16, r: 8, fill: it.kind === "dash" ? "rgba(237,185,151,0.25)" : NOFILL, stroke: it.c, dash: [4, 3] });
    txt(it.s, lx + 28, ly2 - 1, 21, 300, C.muted);
    lx += 28 + w(it.s, 21, 300) + 26;
  }
  y += CH;

  // ---------- Day by day ----------
  y += 62;
  cmds.push({ t: "dot", x: L + 38, y: y - 10, r: 10, fill: "#B3AAD8" });
  txt(tr("วันต่อวัน", "Day by day"), L + 62, y, 32, 400, C.ink);
  y += 22;
  const cardTop = y;
  const cIndex = cmds.length;
  cmds.push({ t: "rect", x: L, y: cardTop, w: CW, h: 0, r: 52, fill: C.glass, stroke: C.glassEdge });
  y += 14;
  r.days.forEach((d, i) => {
    const st = stories.find((s) => s.date === d.date);
    const label = st?.label ?? d.date;
    const rowTop = y;
    if (i > 0) cmds.push({ t: "rect", x: L + IN, y: rowTop, w: CW - IN * 2, h: 2, r: 1, fill: C.line });
    if (!d.logged) {
      txt(label, L + IN, rowTop + 60, 28, 300, C.muted);
      txt(d.future ? tr("ยังไม่ถึง", "Upcoming") : tr("ไม่มีข้อมูล", "No data"), R - IN, rowTop + 60, 26, 300, C.muted, "right");
      y = rowTop + 88;
      return;
    }
    const tx = L + 28 + THUMB + 26;
    const right = R - 32;
    const meals = (st?.share?.slots ?? []).flatMap((s) => s.meals);
    const pic = meals.find((x) => x.picId)?.picId ?? null;
    const thumbY = rowTop + 26;
    if (pic) cmds.push({ t: "pic", id: pic, x: L + 28, y: thumbY, size: THUMB, r: 30 });
    else {
      cmds.push({ t: "rect", x: L + 28, y: thumbY, w: THUMB, h: THUMB, r: 30, fill: C.tile });
      txt(String(Number(d.date.slice(8, 10))), L + 28 + THUMB / 2, thumbY + THUMB / 2 + 15, 42, 300, C.muted, "center");
    }
    let ty2 = rowTop + 26 + 32;
    const kc = fmtKcal(d.kcal);
    txt(kc, right, ty2 + 2, 34, 400, C.ink, "right");
    txt(fitText(m, label, 30, 400, right - tx - w(kc, 34, 400) - 24), tx, ty2, 30, 400, C.ink);
    ty2 += 36;
    const count = tr(`${d.mealSlots} มื้อ`, `${d.mealSlots} ${d.mealSlots === 1 ? "meal" : "meals"}`);
    txt(count, tx, ty2, 23, 300, d.few ? C.over : C.muted);
    const titles = meals.map((x) => x.title).filter(Boolean).join(" · ");
    if (titles) {
      const lines = wrapText(m, titles, 24, 300, right - tx - w(count, 23, 300) - 18, 2);
      lines.forEach((t2, k) => {
        txt(t2, tx + w(count, 23, 300) + 18, ty2 + k * 33, 24, 300, C.muted);
      });
      ty2 += (lines.length - 1) * 33;
    }
    ty2 += 42;
    let px = tx;
    (
      [
        [tr("โปรตีน", "P"), d.protein, C.protein],
        [tr("คาร์บ", "C"), d.carbs, C.carbs],
        [tr("ไขมัน", "F"), d.fat, C.fat],
      ] as [string, number, string][]
    ).forEach(([lab, g, color]) => {
      cmds.push({ t: "dot", x: px + 7, y: ty2 - 8, r: 7, fill: color });
      const t3 = `${lab} ${Math.round(g)} g`;
      txt(t3, px + 22, ty2, 24, 300, C.ink);
      px += 22 + w(t3, 24, 300) + 24;
    });
    y = Math.max(ty2 + 22, thumbY + THUMB) + 26;
  });
  y += 4;
  (cmds[cIndex] as Extract<Cmd, { t: "rect" }>).h = y - cardTop;

  // ---------- Footer ----------
  y += 66;
  const notes = [none ? tr("ยังไม่มีอาหารที่บันทึกในสัปดาห์นี้", "No food was logged this week") : tr(`ค่าเฉลี่ยคิดจาก ${r.loggedDays} วันที่มีบันทึก (จาก 7 วัน) วันที่ไม่มีข้อมูลไม่นับเป็น 0`, `Averages use the ${r.loggedDays} logged ${r.loggedDays === 1 ? "day" : "days"} (of 7); days without entries are not counted as 0`)];
  if (r.fewDays) notes.push(tr("วันที่บันทึกมื้อเดียวอาจยังไม่ครบทั้งวัน", "A day with one meal logged may be incomplete"));
  if (r.hasEstimate) notes.push(tr("บางรายการเป็นค่าประมาณ", "Some entries are estimates"));
  if (r.incompleteNutrients) notes.push(tr("อาหารบางรายการมีข้อมูลสารอาหารไม่ครบ ค่าอาจต่ำกว่าจริง", "Some foods have incomplete nutrient data, so totals may be understated"));
  notes.forEach((n) =>
    wrapText(m, n, 24, 300, CW - 80, 2).forEach((t4) => {
      txt(t4, WEEK_CARD_W / 2, y, 24, 300, C.muted, "center");
      y += 34;
    }),
  );
  y += 14;
  txt("SNAPCAL", WEEK_CARD_W / 2, y, 22, 400, C.muted, "center", 8);
  y += PAD;
  return { w: WEEK_CARD_W, h: Math.ceil(y), cmds };
}
