"use client";
// "Share my day with my trainer": draws the whole day as one picture,
// then sends it through the iPhone share sheet (LINE, Messages, save to Photos…).
import { useEffect, useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import { thaiDateLabel } from "../lib/date";
import { fmtKcal } from "../lib/nutrition";
import { buildShareDay, shareFileName, type ShareDay } from "../lib/shareDay";
import { BACKUP_KEYS } from "../lib/backup";
import { BLUSH, CHAR_BOX, DECOS, cleanLook, parseLook, type CharLook } from "../lib/character";
import { SLOT_LABEL, type Entry } from "../lib/types";
import type { Lang } from "../lib/i18n";

// "Frosted Calm" look (Round 30). A still picture can't blur, so the glass cards are
// white ~55% fill + a thin white border, and the color clouds are soft radial gradients.
const W = 1080;
const PAD = 64; // page edge
const IN = 48; // inside a glass card
const CHAR = 180; // character size
const C = {
  bg: "#F4EFE7",
  clouds: [
    { x: 0.18, y: 0.08, r: 0.62, c: "243,217,200" }, // peach, top-left
    { x: 0.9, y: 0.5, r: 0.66, c: "227,224,242" }, // lilac, right
    { x: 0.28, y: 0.97, r: 0.66, c: "230,238,221" }, // sage, bottom
  ],
  glass: "rgba(255,255,255,0.55)",
  glassEdge: "rgba(255,255,255,0.9)",
  ink: "#2B2724",
  muted: "#9C948A",
  line: "rgba(43,39,36,0.09)",
  track: "rgba(43,39,36,0.12)",
  over: "#B0603A",
};

type Info = { day: ShareDay; date: string; dateLabel: string; name: string; target: number; lang: Lang; char: HTMLCanvasElement | null };
type Box = { x: number; y: number; w: number; h: number; r: number };

function calmFont(): string {
  const s = getComputedStyle(document.documentElement);
  const calm = s.getPropertyValue("--font-calm").trim();
  const thai = s.getPropertyValue("--font-thai").trim();
  return [calm, thai, "sans-serif"].filter(Boolean).join(", ");
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

/** Load a picture (her character files, or our own small SVG pieces). */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error("image " + src.slice(0, 40)));
    i.src = src;
  });
}
const svgUrl = (inner: string) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHAR_BOX} ${CHAR_BOX}">${inner}</svg>`);

/** Her character, same layers as on Today: color (through the body mask) → cheeks → her lines → decoration. */
async function drawCharacter(look: CharLook, size: number): Promise<HTMLCanvasElement> {
  const l = cleanLook(look);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const [body, lines] = await Promise.all([loadImg("/character-body.png"), loadImg("/character-lines.png")]);
  ctx.fillStyle = l.color;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(body, 0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
  if (l.blush) ctx.drawImage(await loadImg(svgUrl(BLUSH)), 0, 0, size, size);
  ctx.drawImage(lines, 0, 0, size, size);
  if (l.deco !== "none") ctx.drawImage(await loadImg(svgUrl(DECOS[l.deco].s)), 0, 0, size, size);
  return c;
}

/** Lays out (and, when draw is true, writes) everything. Runs twice: measure, then draw.
 *  Returns the page height and where the glass cards go. */
function paint(ctx: CanvasRenderingContext2D, info: Info, fam: string, draw: boolean): { h: number; boxes: Box[] } {
  const tr = (th: string, en: string) => (info.lang === "en" ? en : th);
  const font = (size: number, weight = 300) => (ctx.font = `${weight} ${size}px ${fam}`);
  const text = (t: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") => {
    if (!draw) return;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
  };
  /** Wide letter spacing, drawn one letter at a time (works on every iPhone). */
  const spaced = (t: string, cx: number, y: number, gap: number, color: string) => {
    const chars = Array.from(t);
    const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * (chars.length - 1);
    let x = cx - total / 2;
    for (const ch of chars) {
      text(ch, x, y, color);
      x += ctx.measureText(ch).width + gap;
    }
  };
  const boxes: Box[] = [];
  const L = PAD;
  const R = W - PAD;
  const { day, target } = info;
  ctx.textBaseline = "alphabetic";

  // Character + name · date
  let y = PAD + 8;
  if (draw && info.char) ctx.drawImage(info.char, (W - CHAR) / 2, y, CHAR, CHAR);
  y += CHAR + 44;
  const [yy, mm, dd] = info.date.split("-");
  font(28, 400);
  const who = (info.name ? info.name.toUpperCase() + "  ·  " : "") + `${Number(dd)} · ${Number(mm)} · ${yy}`;
  spaced(fit(ctx, who, W - PAD * 4), W / 2, y, 7, C.muted);
  y += 44;
  font(30, 300);
  text(fit(ctx, info.dateLabel, W - PAD * 2), W / 2, y, C.muted, "center");

  // Big kcal
  y += 40;
  const kTop = y;
  y += 56 + 150;
  font(170, 200);
  text(fmtKcal(day.total.kcal), W / 2, y, C.ink, "center");
  y += 62;
  const left = target - day.total.kcal;
  font(32, 300);
  text(
    `kcal · ${tr("เป้า", "goal")} ${fmtKcal(target)} · ` +
      (left >= 0 ? tr(`เหลือ ${fmtKcal(left)}`, `${fmtKcal(left)} left`) : tr(`เกิน ${fmtKcal(-left)}`, `${fmtKcal(-left)} over`)),
    W / 2,
    y,
    left >= 0 ? C.muted : C.over,
    "center",
  );
  y += 44;
  const barX = L + IN + 40;
  const barW = R - L - (IN + 40) * 2;
  if (draw) {
    ctx.fillStyle = C.track;
    ctx.fillRect(barX, y, barW, 4);
    ctx.fillStyle = left >= 0 ? C.ink : C.over;
    ctx.fillRect(barX, y, barW * Math.min(1, target > 0 ? day.total.kcal / target : 0), 4);
  }
  y += 4 + 52;
  boxes.push({ x: L, y: kTop, w: R - L, h: y - kTop, r: 72 });

  // Protein / carbs / fat: 3 small glass tiles
  y += 26;
  const gap = 24;
  const tw = (R - L - gap * 2) / 3;
  const macros = [
    { label: tr("โปรตีน", "Protein"), g: day.total.protein },
    { label: tr("คาร์บ", "Carbs"), g: day.total.carbs },
    { label: tr("ไขมัน", "Fat"), g: day.total.fat },
  ];
  macros.forEach((mc, i) => {
    const x = L + i * (tw + gap);
    boxes.push({ x, y, w: tw, h: 170, r: 52 });
    font(68, 300);
    text(`${mc.g}`, x + tw / 2, y + 92, C.ink, "center");
    font(28, 300);
    text(`${mc.label} g`, x + tw / 2, y + 138, C.muted, "center");
  });
  y += 170;

  // Meals: one glass card, one line per meal, thin lines between
  y += 26;
  const mTop = y;
  y += 16;
  const slotW = 170;
  const nameX = L + IN + slotW;
  const R2 = R - IN;
  let first = true;
  const divider = () => {
    if (!first && draw) {
      ctx.fillStyle = C.line;
      ctx.fillRect(L + IN, y, R - L - IN * 2, 2);
    }
    first = false;
  };
  day.slots.forEach((s) => {
    if (s.meals.length === 0) {
      divider();
      y += 76;
      font(28, 300);
      text(SLOT_LABEL[s.slot][info.lang], L + IN, y, C.muted);
      font(34, 300);
      text("—", nameX, y, C.muted);
      y += 34;
      return;
    }
    s.meals.forEach((m, j) => {
      divider();
      y += 76;
      if (j === 0) {
        font(28, 300);
        text(SLOT_LABEL[s.slot][info.lang], L + IN, y, C.muted);
      }
      font(36, 400);
      const kcal = fmtKcal(m.m.kcal);
      const kw = ctx.measureText(kcal).width;
      text(kcal, R2, y, C.ink, "right");
      font(36, 300);
      wrap(ctx, m.title, R2 - nameX - kw - 32, 2).forEach((t, k) => {
        if (k > 0) y += 48;
        text(t, nameX, y, C.ink);
      });
      font(26, 300);
      if (m.detail) {
        wrap(ctx, m.detail, R2 - nameX, 3).forEach((t) => {
          y += 40;
          text(t, nameX, y, C.muted);
        });
      }
      y += 40;
      text(
        tr(`โปรตีน ${m.m.protein} · คาร์บ ${m.m.carbs} · ไขมัน ${m.m.fat} g`, `Protein ${m.m.protein} · Carbs ${m.m.carbs} · Fat ${m.m.fat} g`),
        nameX,
        y,
        C.muted,
      );
      y += 34;
    });
  });
  y += 24;
  boxes.push({ x: L, y: mTop, w: R - L, h: y - mTop, r: 64 });

  // Footer
  y += 64;
  font(24, 400);
  spaced("SNAPCAL", W / 2, y, 10, C.muted);
  return { h: y + PAD - 8, boxes };
}

async function makePicture(info: Omit<Info, "char">, look: CharLook): Promise<Blob> {
  const fam = calmFont();
  // Make sure the thin Thai + number font is ready, or the canvas uses a plain font.
  await Promise.all(
    [200, 300, 400].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค 0123 kcal").catch(() => [])),
  );
  // The character is nice to have: if it fails to load, the picture still works.
  const char = await drawCharacter(look, CHAR * 2).catch(() => null);
  const full: Info = { ...info, char };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const size = paint(ctx, full, fam, false);
  const H = Math.ceil(size.h);
  canvas.width = W;
  canvas.height = H;
  // Beige page + 3 soft color clouds
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  for (const cl of C.clouds) {
    const cx = cl.x * W;
    const cy = cl.y * H;
    const r = cl.r * Math.max(W, H * 0.7);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${cl.c},1)`);
    g.addColorStop(1, `rgba(${cl.c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Glass cards
  for (const b of size.boxes) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.r);
    ctx.fillStyle = C.glass;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.glassEdge;
    ctx.stroke();
  }
  paint(ctx, full, fam, true);
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("toBlob"))), "image/png"));
}

function savedLook(): CharLook {
  try {
    return parseLook(localStorage.getItem(BACKUP_KEYS.buddy));
  } catch {
    return parseLook(null);
  }
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
    makePicture({ day: buildShareDay(entries, date), date, dateLabel: thaiDateLabel(date, lang), name, target, lang }, savedLook())
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
