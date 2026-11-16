"use client";
// "Share my day with my trainer": draws the whole day as one picture,
// then sends it through the iPhone share sheet (LINE, Messages, save to Photos…).
import { useEffect, useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import { thaiDateLabel } from "../lib/date";
import { fmtKcal } from "../lib/nutrition";
import { buildShareDay, shareFileName, type ShareDay } from "../lib/shareDay";
import { SLOT_LABEL, type Entry } from "../lib/types";
import type { Lang } from "../lib/i18n";

const W = 1080;
const PAD = 72; // outside edge
const IN = 56; // inside the white card
const SLOT_COLORS = ["#ffd84d", "#8cc9b2", "#7fb2ea", "#f09aab"];
const C = {
  cream: "#f8f6f3",
  paper: "#ffffff",
  line: "#ebe6e0",
  ink: "#1a1a1a",
  muted: "#8b857e",
  protein: "#ffe1e6",
  proteinInk: "#a03a50",
  carbs: "#fff1bf",
  carbsInk: "#7a5b00",
  fat: "#dcebff",
  fatInk: "#2e5c8f",
  warnInk: "#8a5212",
};

type Info = { day: ShareDay; dateLabel: string; name: string; target: number; lang: Lang };

function fontFamilies(): string {
  const s = getComputedStyle(document.documentElement);
  const thai = s.getPropertyValue("--font-thai").trim();
  const round = s.getPropertyValue("--font-round-latin").trim();
  return [round, thai, "sans-serif"].filter(Boolean).join(", ");
}

/** Cut text to fit maxW, adding "…". */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

/** Break text into lines that fit maxW (Thai has no spaces, so break by character). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of Array.from(text)) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch.trimStart();
      if (lines.length === maxLines) break;
    } else cur += ch;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && lines.join("").length < text.length) {
    lines[maxLines - 1] = fit(ctx, lines[maxLines - 1] + "…", maxW);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Draws the picture. Runs twice: once to measure the height, once to draw. */
function paint(ctx: CanvasRenderingContext2D, info: Info, fam: string, draw: boolean): { h: number; cardBottom: number } {
  const tr = (th: string, en: string) => (info.lang === "en" ? en : th);
  const font = (size: number, weight = 500) => (ctx.font = `${weight} ${size}px ${fam}`);
  const text = (t: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") => {
    if (!draw) return;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
  };
  const L = PAD + IN;
  const R = W - PAD - IN;
  const inner = R - L;
  const { day, target } = info;
  ctx.textBaseline = "alphabetic";

  let y = PAD + IN;
  // Header
  font(30, 700);
  y += 30;
  text("SnapCal", L, y, C.muted);
  if (info.name) text(info.name, R, y, C.muted, "right");
  font(46, 700);
  y += 70;
  text(fit(ctx, info.dateLabel, inner), L, y, C.ink);

  // Big total
  y += 40;
  if (draw) roundRect(ctx, L, y, inner, 200, 36, C.cream);
  font(96, 800);
  const big = fmtKcal(day.total.kcal);
  text(big, L + 40, y + 120, C.ink);
  const bigW = ctx.measureText(big).width;
  font(34, 600);
  text(`/ ${fmtKcal(target)} kcal`, L + 40 + bigW + 18, y + 120, C.muted);
  const left = target - day.total.kcal;
  font(32, 600);
  text(
    left >= 0 ? tr(`เหลืออีก ${fmtKcal(left)} kcal`, `${fmtKcal(left)} kcal left`) : tr(`เกินเป้า ${fmtKcal(-left)} kcal`, `${fmtKcal(-left)} kcal over`),
    L + 40,
    y + 170,
    left >= 0 ? C.ink : C.warnInk,
  );
  y += 200;

  // Protein / carbs / fat
  y += 24;
  const gap = 20;
  const bw = (inner - gap * 2) / 3;
  const macros = [
    { label: tr("โปรตีน", "Protein"), g: day.total.protein, bg: C.protein, ink: C.proteinInk },
    { label: tr("คาร์บ", "Carbs"), g: day.total.carbs, bg: C.carbs, ink: C.carbsInk },
    { label: tr("ไขมัน", "Fat"), g: day.total.fat, bg: C.fat, ink: C.fatInk },
  ];
  macros.forEach((mc, i) => {
    const x = L + i * (bw + gap);
    if (draw) roundRect(ctx, x, y, bw, 150, 30, mc.bg);
    font(30, 600);
    text(mc.label, x + bw / 2, y + 52, mc.ink, "center");
    font(58, 800);
    text(`${mc.g}`, x + bw / 2 - 14, y + 120, C.ink, "center");
    const nw = ctx.measureText(`${mc.g}`).width;
    font(30, 600);
    text("g", x + bw / 2 - 14 + nw / 2 + 8, y + 120, C.muted);
  });
  y += 150;

  // Meals
  info.day.slots.forEach((s, i) => {
    y += 64;
    if (draw) {
      ctx.beginPath();
      ctx.arc(L + 12, y - 13, 12, 0, Math.PI * 2);
      ctx.fillStyle = SLOT_COLORS[i % SLOT_COLORS.length];
      ctx.fill();
    }
    font(38, 700);
    text(SLOT_LABEL[s.slot][info.lang], L + 40, y, C.ink);
    font(32, 600);
    text(`${fmtKcal(s.m.kcal)} kcal`, R, y, C.muted, "right");
    y += 18;
    if (s.meals.length === 0) {
      y += 50;
      font(30, 500);
      text(tr("ไม่ได้บันทึก", "Nothing logged"), L + 40, y, C.muted);
      y += 16;
      return;
    }
    s.meals.forEach((m, j) => {
      if (j > 0 && draw) {
        ctx.fillStyle = C.line;
        ctx.fillRect(L + 40, y + 6, inner - 40, 2);
      }
      font(34, 800);
      const kcal = `${fmtKcal(m.m.kcal)}`;
      const kw = ctx.measureText(kcal).width;
      y += 56;
      text(kcal, R, y, C.ink, "right");
      font(34, 600);
      const titleLines = wrap(ctx, m.title, inner - 40 - kw - 32, 2);
      titleLines.forEach((t, k) => {
        if (k > 0) y += 46;
        text(t, L + 40, y, C.ink);
      });
      if (m.detail) {
        font(26, 500);
        wrap(ctx, m.detail, inner - 40, 3).forEach((t) => {
          y += 38;
          text(t, L + 40, y, C.muted);
        });
      }
      y += 42;
      font(28, 600);
      text(
        tr(`โปรตีน ${m.m.protein} · คาร์บ ${m.m.carbs} · ไขมัน ${m.m.fat} g`, `Protein ${m.m.protein} · Carbs ${m.m.carbs} · Fat ${m.m.fat} g`),
        L + 40,
        y,
        C.muted,
      );
      y += 16;
    });
  });

  y += 40 + IN;
  const cardBottom = y;
  // Footer, under the white card
  y += 56;
  font(26, 500);
  text(tr("บันทึกด้วย SnapCal", "Logged with SnapCal"), W / 2, y, C.muted, "center");
  return { h: y + PAD - 20, cardBottom };
}

async function makePicture(info: Info): Promise<Blob> {
  const fam = fontFamilies();
  // Make sure the Thai + number fonts are ready, or the canvas uses a plain font.
  await Promise.all(
    [500, 600, 700, 800].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค 0123 kcal").catch(() => [])),
  );
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const size = paint(ctx, info, fam, false);
  const H = Math.ceil(size.h);
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);
  // White card: from the top edge to just above the footer.
  roundRect(ctx, PAD, PAD, W - PAD * 2, size.cardBottom - PAD, 48, C.paper);
  paint(ctx, info, fam, true);
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("toBlob"))), "image/png"));
}

export function ShareDayButton({ entries, date, target, name }: { entries: Entry[]; date: string; target: number; name: string }) {
  const { tr, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [pic, setPic] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let url = "";
    let stop = false;
    makePicture({ day: buildShareDay(entries, date), dateLabel: thaiDateLabel(date, lang), name, target, lang })
      .then((blob) => {
        if (stop) return;
        url = URL.createObjectURL(blob);
        setPic({ blob, url });
      })
      .catch((e) => !stop && setError(String(e?.message || e)));
    return () => {
      stop = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, entries, date, target, name, lang]);

  const file = pic ? new File([pic.blob], shareFileName(date), { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      // Closing the share sheet is not an error.
      if ((e as Error)?.name !== "AbortError") setError(String((e as Error)?.message || e));
    }
  };

  return (
    <>
      <button
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-paper text-[16px] font-medium active:scale-[0.98]"
        onClick={() => {
          setPic(null);
          setError(null);
          setOpen(true);
        }}
        data-testid="share-day-button"
      >
        {tr("ส่งสรุปวันนี้ให้เทรนเนอร์", "Send this day to my trainer")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr("สรุปวันนี้", "This day")}>
        <div className="space-y-3 pb-4" data-testid="share-day-sheet">
          {error && (
            <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
              {tr("ทำรูปไม่สำเร็จ", "Couldn't make the picture")}: {error}
            </p>
          )}
          {!pic && !error && <p className="py-10 text-center text-[15px] text-muted">{tr("กำลังทำรูป…", "Making the picture…")}</p>}
          {pic && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic.url} alt={tr("รูปสรุปวันนี้", "Picture of this day")} className="w-full rounded-[22px] border border-line" data-testid="share-day-image" />
              {canShare ? (
                <button className="btn-primary w-full !min-h-[56px] text-[18px]" onClick={share} data-testid="share-day-send">
                  {tr("ส่งรูปนี้", "Send this picture")}
                </button>
              ) : (
                <a
                  className="btn-primary flex w-full !min-h-[56px] items-center justify-center text-[18px]"
                  href={pic.url}
                  download={shareFileName(date)}
                  data-testid="share-day-download"
                >
                  {tr("บันทึกรูปนี้", "Save this picture")}
                </a>
              )}
              <p className="text-center text-[13px] text-muted">
                {tr("ส่งทาง LINE ข้อความ หรือบันทึกลงรูปภาพได้", "Send by LINE, Messages, or save to Photos")}
              </p>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
