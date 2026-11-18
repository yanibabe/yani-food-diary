// Round 71: the layout of the "share this day" picture. Pure maths (no canvas, no React):
// it turns the day's facts into a list of simple drawing commands plus the picture height.
// The phone draws the commands on a canvas (ShareDayButton.tsx); tests and the preview script
// use a fake text measurer, so every height can be checked without a browser.

import { fmtKcal } from "./nutrition.ts";
import { splitTexts, type ShareDay } from "./shareDay.ts";
import { SLOT_LABEL, type MealSlot } from "./types.ts";

export const CARD_W = 1080;
export const CARD_MIN_H = 1350;
const PAD = 56;
const IN = 44;
const THUMB = 150;

export const CARD_COLORS = {
  bg: "#F4EFE7",
  glass: "rgba(255,255,255,0.58)",
  glassEdge: "rgba(255,255,255,0.92)",
  tile: "rgba(255,255,255,0.75)",
  ink: "#2B2724",
  muted: "#8F877D",
  line: "rgba(43,39,36,0.09)",
  track: "rgba(43,39,36,0.12)",
  over: "#B0603A",
  protein: "#E0A88C", // peach
  carbs: "#B3AAD8", // lavender
  fat: "#A3BD90", // sage
  water: "#9DBBDD",
} as const;

/** The little dot by each meal time (morning peach, noon sage, evening lavender, snack blue). */
export const SLOT_DOT: Record<MealSlot, string> = {
  breakfast: "#EDB997",
  lunch: "#A3BD90",
  dinner: "#B3AAD8",
  snack: "#9DBBDD",
};

export type Align = "left" | "center" | "right";
export type Cmd =
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number; fill: string; stroke?: string }
  | { t: "text"; x: number; y: number; s: string; size: number; weight: number; color: string; align: Align; spacing?: number }
  | { t: "dot"; x: number; y: number; r: number; fill?: string; stroke?: string }
  | { t: "bar"; x: number; y: number; w: number; part: number; color: string }
  /** A picture (id in the phone's photo store) cut to a rounded square. */
  | { t: "pic"; id: string; x: number; y: number; size: number; r: number }
  /** The small line character at the top. */
  | { t: "char"; x: number; y: number; size: number };

export type Measure = (text: string, size: number, weight: number) => number;

export type CardInput = {
  day: ShareDay;
  date: string;
  dateLabel: string;
  name: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  water: { glasses: number; goal: number };
  /** The weight logged that day, if any. */
  weightKg?: number | null;
  lang: "th" | "en";
};

export type Card = { w: number; h: number; cmds: Cmd[]; /** Every meal's rows, for tests: top and height. */ rows: { slot: MealSlot; title: string; y: number; h: number; lines: number }[] };

/** Cut text to fit maxW, adding "…". */
export function fitText(measure: Measure, text: string, size: number, weight: number, maxW: number): string {
  if (measure(text, size, weight) <= maxW) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && measure(chars.join("") + "…", size, weight) > maxW) chars.pop();
  return chars.join("") + "…";
}

/** Break text into lines that fit maxW. Thai has no spaces, so it breaks by letter (spaces and " · " are used when there). Never more than maxLines; the last line ends in "…" if cut. */
export function wrapText(measure: Measure, text: string, size: number, weight: number, maxW: number, maxLines: number): string[] {
  const chars = Array.from(text.trim());
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < chars.length; i++) {
    const ch = chars[i];
    if (cur && measure(cur + ch, size, weight) > maxW) {
      if (lines.length === maxLines - 1) break; // last line: stop, finish below
      // Prefer breaking after a space / separator in the last 40% of the line
      const cut = Math.max(cur.lastIndexOf(" "), cur.lastIndexOf("·"));
      if (cut > cur.length * 0.6 && ch !== " ") {
        lines.push(cur.slice(0, cut + 1).trimEnd());
        cur = cur.slice(cut + 1) + ch;
      } else {
        lines.push(cur.trimEnd());
        cur = ch === " " ? "" : ch;
      }
    } else cur += ch;
  }
  if (i < chars.length) {
    // Ran out of lines: the rest goes into the last line, cut with "…"
    cur = cur + chars.slice(i).join("");
    lines.push(fitText(measure, cur, size, weight, maxW));
  } else if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export function layoutShareCard(inp: CardInput, measure: Measure): Card {
  const tr = (th: string, en: string) => (inp.lang === "en" ? en : th);
  const cmds: Cmd[] = [];
  const rows: Card["rows"] = [];
  const C = CARD_COLORS;
  const L = PAD;
  const R = CARD_W - PAD;
  const CW = R - L;
  const { day, target } = inp;
  const txt = (s: string, x: number, y: number, size: number, weight: number, color: string, align: Align = "left", spacing?: number) =>
    cmds.push({ t: "text", x, y, s, size, weight, color, align, ...(spacing ? { spacing } : {}) });
  const card = (x: number, y: number, w: number, h: number, r: number) => cmds.push({ t: "rect", x, y, w, h, r, fill: C.glass, stroke: C.glassEdge });
  const w = (s: string, size: number, weight: number) => measure(s, size, weight);

  // ---------- Header card ----------
  let y = PAD;
  const hTop = y;
  // Reserve the card first (so it sits under the text); height is filled in below.
  const hIndex = cmds.length;
  cmds.push({ t: "rect", x: L, y: hTop, w: CW, h: 0, r: 56, fill: C.glass, stroke: C.glassEdge });
  cmds.push({ t: "char", x: R - IN - 96, y: hTop + IN - 6, size: 96 });
  const innerL = L + IN;
  const innerR = R - IN;
  const innerW = innerR - innerL;

  y = hTop + IN + 26;
  if (inp.name.trim()) {
    txt(fitText(measure, inp.name.trim().toUpperCase(), 26, 400, innerW - 130), innerL, y, 26, 400, C.muted, "left", 5);
    y += 52;
  } else y += 6;
  txt(fitText(measure, inp.dateLabel, 40, 400, innerW - 130), innerL, y, 40, 400, C.ink);
  y += 40;

  // Calories
  const left = target - day.total.kcal;
  const kcalS = fmtKcal(day.total.kcal);
  y += 118;
  txt(kcalS, innerL, y, 122, 200, C.ink);
  const kw = w(kcalS, 122, 200);
  txt("kcal", innerL + kw + 16, y, 34, 300, C.muted);
  txt(`${tr("เป้า", "goal")} ${fmtKcal(target)}`, innerR, y - 46, 32, 400, C.ink, "right");
  txt(
    left >= 0 ? tr(`เหลือ ${fmtKcal(left)}`, `${fmtKcal(left)} left`) : tr(`เกิน ${fmtKcal(-left)}`, `${fmtKcal(-left)} over`),
    innerR,
    y,
    30,
    300,
    left >= 0 ? C.muted : C.over,
    "right",
  );
  y += 34;
  cmds.push({ t: "bar", x: innerL, y, w: innerW, part: target > 0 ? day.total.kcal / target : 0, color: left >= 0 ? C.ink : C.over });
  y += 6 + 44;

  // Protein / carbs / fat, three columns with a bar each
  const gap = 28;
  const cw = (innerW - gap * 2) / 3;
  const pct = splitTexts(day.split);
  const macros = [
    { label: tr("โปรตีน", "Protein"), g: day.total.protein, of: inp.macroTargets.protein, color: C.protein, pct: pct?.protein },
    { label: tr("คาร์บ", "Carbs"), g: day.total.carbs, of: inp.macroTargets.carbs, color: C.carbs, pct: pct?.carbs },
    { label: tr("ไขมัน", "Fat"), g: day.total.fat, of: inp.macroTargets.fat, color: C.fat, pct: pct?.fat },
  ];
  macros.forEach((m, i) => {
    const x = innerL + i * (cw + gap);
    cmds.push({ t: "dot", x: x + 8, y: y + 10, r: 8, fill: m.color });
    txt(m.label, x + 26, y + 20, 26, 400, C.muted);
    if (m.pct) txt(m.pct, x + cw, y + 20, 24, 300, C.muted, "right");
    const gs = `${m.g}`;
    txt(gs, x, y + 88, 58, 300, C.ink);
    txt(`/ ${Math.round(m.of)} g`, x + w(gs, 58, 300) + 12, y + 88, 25, 300, C.muted);
    cmds.push({ t: "bar", x, y: y + 108, w: cw, part: m.of > 0 ? m.g / m.of : 0, color: m.color });
  });
  y += 108 + 6 + 36;

  // Water + weight, when logged
  const chips: { label: string; value: string }[] = [];
  if (inp.water.glasses > 0) chips.push({ label: tr("น้ำ", "Water"), value: tr(`${inp.water.glasses} / ${inp.water.goal} แก้ว`, `${inp.water.glasses} / ${inp.water.goal} glasses`) });
  if (inp.weightKg != null && inp.weightKg > 0) chips.push({ label: tr("น้ำหนัก", "Weight"), value: `${Math.round(inp.weightKg * 10) / 10} kg` });
  if (chips.length) {
    let cx = innerL;
    chips.forEach((c) => {
      const cwid = w(c.label, 26, 400) + w(c.value, 26, 300) + 70;
      cmds.push({ t: "rect", x: cx, y, w: cwid, h: 58, r: 29, fill: C.tile });
      cmds.push({ t: "dot", x: cx + 28, y: y + 29, r: 7, fill: c.label === tr("น้ำ", "Water") ? C.water : C.muted });
      txt(c.label, cx + 46, y + 38, 26, 400, C.muted);
      txt(c.value, cx + 46 + w(c.label, 26, 400) + 14, y + 38, 26, 300, C.ink);
      cx += cwid + 16;
    });
    y += 58 + 36;
  }
  y += 2;
  const hh = y - hTop;
  (cmds[hIndex] as Extract<Cmd, { t: "rect" }>).h = hh;
  y = hTop + hh;

  // ---------- Meals ----------
  let any = false;
  const empty: string[] = [];
  for (const s of day.slots) {
    if (s.meals.length === 0) {
      empty.push(SLOT_LABEL[s.slot][inp.lang]);
      continue;
    }
    any = true;
    y += 62;
    cmds.push({ t: "dot", x: L + 38, y: y - 10, r: 10, fill: SLOT_DOT[s.slot] });
    txt(SLOT_LABEL[s.slot][inp.lang], L + 62, y, 32, 400, C.ink);
    txt(`${fmtKcal(s.m.kcal)} kcal`, R - 24, y, 28, 300, C.muted, "right");
    y += 22;
    const cardTop = y;
    const cIndex = cmds.length;
    cmds.push({ t: "rect", x: L, y: cardTop, w: CW, h: 0, r: 52, fill: C.glass, stroke: C.glassEdge });
    s.meals.forEach((m, j) => {
      const rowTop = y;
      if (j > 0) cmds.push({ t: "rect", x: L + IN, y: rowTop, w: CW - IN * 2, h: 2, r: 1, fill: C.line });
      const tx = L + 28 + THUMB + 28;
      const right = R - 28;
      let ty = rowTop + 30 + 34;
      // kcal on the right
      const kcal = `${m.est ? "~" : ""}${fmtKcal(m.m.kcal)}`;
      const kwid = w(kcal, 34, 400);
      txt(kcal, right, ty, 34, 400, C.ink, "right");
      txt("kcal", right, ty + 32, 22, 300, C.muted, "right");
      const titleLines = wrapText(measure, m.title || "—", 34, 400, right - tx - Math.max(kwid, 60) - 20, 2);
      titleLines.forEach((t, k) => {
        if (k > 0) ty += 44;
        txt(t, tx, ty, 34, 400, C.ink);
      });
      // Foods with amounts ("~" after the ones that are estimates)
      const foods = m.items.map((i) => i.text + (i.est ? " ~" : "")).join(" · ");
      let lines = 0;
      if (foods) {
        const fl = wrapText(measure, foods, 25, 300, right - tx, 4);
        fl.forEach((t) => {
          ty += 37;
          txt(t, tx, ty, 25, 300, C.muted);
          lines++;
        });
      }
      ty += 44;
      let px = tx;
      const pcf: [string, number, string][] = [
        [tr("โปรตีน", "P"), m.m.protein, C.protein],
        [tr("คาร์บ", "C"), m.m.carbs, C.carbs],
        [tr("ไขมัน", "F"), m.m.fat, C.fat],
      ];
      pcf.forEach(([lab, g, col]) => {
        cmds.push({ t: "dot", x: px + 7, y: ty - 9, r: 7, fill: col });
        const t = `${lab} ${g} g`;
        txt(t, px + 22, ty, 25, 300, C.ink);
        px += 22 + w(t, 25, 300) + 26;
      });
      // Picture, or a soft tile
      const thumbY = rowTop + 30;
      if (m.picId) cmds.push({ t: "pic", id: m.picId, x: L + 28, y: thumbY, size: THUMB, r: 34 });
      else {
        cmds.push({ t: "rect", x: L + 28, y: thumbY, w: THUMB, h: THUMB, r: 34, fill: C.tile });
        cmds.push({ t: "text", x: L + 28 + THUMB / 2, y: thumbY + THUMB / 2 + 14, s: Array.from(m.title.trim())[0] ?? "•", size: 46, weight: 300, color: C.muted, align: "center" });
      }
      y = Math.max(ty + 20, thumbY + THUMB) + 30;
      rows.push({ slot: s.slot, title: m.title, y: rowTop, h: y - rowTop, lines: titleLines.length + lines });
    });
    (cmds[cIndex] as Extract<Cmd, { t: "rect" }>).h = y - cardTop;
  }

  if (!any) {
    y += 90;
    txt(tr("ยังไม่ได้บันทึกอาหาร", "No food logged yet"), CARD_W / 2, y, 30, 300, C.muted, "center");
  } else if (empty.length > 0) {
    y += 64;
    txt(fitText(measure, `${tr("ไม่ได้บันทึก", "Not logged")} · ${empty.join(" · ")}`, 27, 300, CW), CARD_W / 2, y, 27, 300, C.muted, "center");
  }

  // ---------- Footer ----------
  y += 70;
  const anyEst = day.slots.some((s) => s.meals.some((m) => m.est));
  const note = anyEst
    ? tr("~ = ค่าประมาณจากรูปหรือค่าทั่วไป อาจคลาดเคลื่อนได้เล็กน้อย", "~ = estimated from a photo or typical values, so it can be a little off")
    : tr("ตัวเลขจากที่บันทึกไว้ในแอป", "Numbers from what was logged in the app");
  wrapText(measure, note, 24, 300, CW - 80, 2).forEach((t) => {
    txt(t, CARD_W / 2, y, 24, 300, C.muted, "center");
    y += 34;
  });
  y += 14;
  txt("SNAPCAL", CARD_W / 2, y, 22, 400, C.muted, "center", 8);
  y += PAD;
  return { w: CARD_W, h: Math.max(CARD_MIN_H, Math.ceil(y)), cmds, rows };
}
