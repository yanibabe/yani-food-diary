"use client";
// "Share this day": draws the whole day as one picture,
// then sends it through the iPhone share sheet (LINE, Messages, save to Photos…).
import { useEffect, useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import { thaiDateLabel } from "../lib/date";
import { fmtKcal } from "../lib/nutrition";
import { buildShareDay, shareFileName, splitTexts, type ShareDay } from "../lib/shareDay";
import { getPhoto } from "../lib/photos";
import { GLASS_ML } from "../lib/water";
import { SLOT_LABEL, type Entry } from "../lib/types";
import type { Lang } from "../lib/i18n";
import { Icon } from "./Icon";

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
  // Soft colors that match the clouds (a little deeper, so they show on glass)
  protein: "#E0A88C", // peach
  carbs: "#B3AAD8", // lilac
  fat: "#A3BD90", // sage
  water: "#9DBBDD", // soft blue
};

type Info = {
  day: ShareDay;
  date: string;
  dateLabel: string;
  name: string;
  target: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  water: { glasses: number; goal: number };
  lang: Lang;
  char: HTMLCanvasElement | null;
  photos: Map<string, HTMLImageElement>;
};
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
/** Her character: her black lines only, see-through everywhere else. */
async function drawCharacter(size: number): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(await loadImg("/character-lines.png"), 0, 0, size, size);
  return c;
}

/** Draw a photo cut to a rounded square (fills the square, like "cover"). */
function drawThumb(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, r: number) {
  const s = Math.min(img.width, img.height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.clip();
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, size, size);
  ctx.restore();
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
  const dot = (x: number, y: number, r: number, color: string) => {
    if (!draw) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const bar = (x: number, y: number, w: number, part: number, color: string) => {
    if (!draw) return;
    ctx.fillStyle = C.track;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 6, 3);
    ctx.fill();
    const pw = w * Math.max(0, Math.min(1, part));
    if (pw > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(6, pw), 6, 3);
      ctx.fill();
    }
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
  bar(barX, y, barW, target > 0 ? day.total.kcal / target : 0, left >= 0 ? C.ink : C.over);
  y += 6 + 52;
  boxes.push({ x: L, y: kTop, w: R - L, h: y - kTop, r: 72 });

  // Protein / carbs / fat: 3 small glass tiles, each with its own soft color + a thin line toward its target
  y += 26;
  const gap = 24;
  const tw = (R - L - gap * 2) / 3;
  const pct = splitTexts(day.split);
  const TH = pct ? 288 : 236;
  const macros = [
    { label: tr("โปรตีน", "Protein"), g: day.total.protein, of: info.macroTargets.protein, color: C.protein, pct: pct?.protein },
    { label: tr("คาร์บ", "Carbs"), g: day.total.carbs, of: info.macroTargets.carbs, color: C.carbs, pct: pct?.carbs },
    { label: tr("ไขมัน", "Fat"), g: day.total.fat, of: info.macroTargets.fat, color: C.fat, pct: pct?.fat },
  ];
  macros.forEach((mc, i) => {
    const x = L + i * (tw + gap);
    boxes.push({ x, y, w: tw, h: TH, r: 52 });
    font(27, 400);
    const lw = ctx.measureText(mc.label).width;
    dot(x + tw / 2 - lw / 2 - 18, y + 56, 8, mc.color);
    text(mc.label, x + tw / 2 + 9, y + 66, C.muted, "center");
    font(72, 200);
    text(`${mc.g}`, x + tw / 2, y + 150, C.ink, "center");
    font(25, 300);
    text(`${tr("จาก", "of")} ${Math.round(mc.of)} g`, x + tw / 2, y + 190, C.muted, "center");
    bar(x + 40, y + 208, tw - 80, mc.of > 0 ? mc.g / mc.of : 0, mc.color);
    if (mc.pct) {
      font(38, 300);
      text(mc.pct, x + tw / 2, y + 258, C.ink, "center");
    }
  });
  y += TH;

  // Water (only when some was logged)
  if (info.water.glasses > 0) {
    y += 26;
    const top = y;
    const h = 120;
    boxes.push({ x: L, y: top, w: R - L, h, r: 48 });
    font(30, 400);
    text(tr("น้ำ", "Water"), L + IN, top + 72, C.ink);
    font(30, 300);
    const ml = (info.water.glasses * GLASS_ML).toLocaleString("en-US");
    text(
      tr(`${info.water.glasses} / ${info.water.goal} แก้ว · ${ml} มล.`, `${info.water.glasses} / ${info.water.goal} glasses · ${ml} ml`),
      R - IN,
      top + 72,
      C.muted,
      "right",
    );
    // A row of small dots, one per glass of the goal
    const n = Math.min(20, Math.max(info.water.goal, info.water.glasses));
    const dx = 26;
    const startX = L + IN + 110;
    for (let k = 0; k < n; k++) {
      const filled = k < info.water.glasses;
      if (draw) {
        ctx.beginPath();
        ctx.arc(startX + k * dx, top + 62, 8, 0, Math.PI * 2);
        if (filled) {
          ctx.fillStyle = C.water;
          ctx.fill();
        } else {
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.track;
          ctx.stroke();
        }
      }
    }
    y = top + h;
  }

  // Meals: a small header per meal time (name + its kcal), then one glass card with a row per meal
  const THUMB = 116;
  const nameX = L + IN + THUMB + 32;
  const R2 = R - IN;
  const empty: string[] = [];
  day.slots.forEach((s) => {
    if (s.meals.length === 0) {
      empty.push(SLOT_LABEL[s.slot][info.lang]);
      return;
    }
    y += 64;
    font(28, 400);
    text(SLOT_LABEL[s.slot][info.lang], L + 28, y, C.muted);
    font(28, 300);
    text(`${fmtKcal(s.m.kcal)} kcal`, R - 28, y, C.muted, "right");
    y += 22;
    const cardTop = y;
    s.meals.forEach((m, j) => {
      const rowTop = y;
      if (j > 0 && draw) {
        ctx.fillStyle = C.line;
        ctx.fillRect(L + IN, rowTop, R - L - IN * 2, 2);
      }
      // Text first (to know how tall the row is)
      let ty = rowTop + 40 + 36;
      font(36, 400);
      const kcal = fmtKcal(m.m.kcal);
      const kw = ctx.measureText(kcal).width;
      text(kcal, R2, ty, C.ink, "right");
      font(36, 300);
      wrap(ctx, m.title, R2 - nameX - kw - 32, 2).forEach((t, k) => {
        if (k > 0) ty += 48;
        text(t, nameX, ty, C.ink);
      });
      font(26, 300);
      if (m.detail) {
        wrap(ctx, m.detail, R2 - nameX, 3).forEach((t) => {
          ty += 40;
          text(t, nameX, ty, C.muted);
        });
      }
      ty += 42;
      font(26, 300);
      const pcf: [string, number, string][] = [
        [tr("โปรตีน", "P"), m.m.protein, C.protein],
        [tr("คาร์บ", "C"), m.m.carbs, C.carbs],
        [tr("ไขมัน", "F"), m.m.fat, C.fat],
      ];
      let px = nameX;
      pcf.forEach(([lab, g, col]) => {
        dot(px + 7, ty - 9, 7, col);
        const t = `${lab} ${g} g`;
        text(t, px + 22, ty, C.muted);
        px += 22 + ctx.measureText(t).width + 28;
      });
      const textBottom = ty + 18;
      // Photo, or a soft round tile with the first letter when there is no photo
      const img = m.photoId ? info.photos.get(m.photoId) : undefined;
      const thumbY = rowTop + 40;
      if (draw) {
        if (img) drawThumb(ctx, img, L + IN, thumbY, THUMB, 32);
        else {
          ctx.beginPath();
          ctx.roundRect(L + IN, thumbY, THUMB, THUMB, 32);
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fill();
          font(44, 300);
          ctx.textBaseline = "middle";
          text(Array.from(m.title.trim())[0] ?? "•", L + IN + THUMB / 2, thumbY + THUMB / 2 + 2, C.muted, "center");
          ctx.textBaseline = "alphabetic";
        }
      }
      y = Math.max(textBottom, thumbY + THUMB) + 40;
    });
    boxes.push({ x: L, y: cardTop, w: R - L, h: y - cardTop, r: 56 });
  });

  // Meal times with nothing logged: one quiet line
  if (empty.length > 0) {
    y += 60;
    font(27, 300);
    text(fit(ctx, `${tr("ไม่ได้บันทึก", "Not logged")} · ${empty.join(" · ")}`, R - L), W / 2, y, C.muted, "center");
  }

  // Footer
  y += 84;
  font(24, 400);
  spaced("SNAPCAL", W / 2, y, 10, C.muted);
  return { h: y + PAD - 8, boxes };
}

async function makePicture(info: Omit<Info, "char" | "photos">): Promise<Blob> {
  const fam = calmFont();
  // Make sure the thin Thai + number font is ready, or the canvas uses a plain font.
  await Promise.all(
    [200, 300, 400].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค 0123 kcal").catch(() => [])),
  );
  // The character and the meal photos are nice to have: if one fails to load, the picture still works.
  const char = await drawCharacter(CHAR * 2).catch(() => null);
  const photos = new Map<string, HTMLImageElement>();
  const ids = info.day.slots.flatMap((s) => s.meals.map((m) => m.photoId)).filter((x): x is string => !!x);
  await Promise.all(
    ids.map(async (id) => {
      const src = await getPhoto(id);
      if (src) photos.set(id, await loadImg(src).catch(() => null as unknown as HTMLImageElement));
    }),
  );
  for (const [k, v] of photos) if (!v) photos.delete(k);
  const full: Info = { ...info, char, photos };
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

export function ShareDayButton({
  entries,
  date,
  target,
  name,
  macroTargets,
  water,
  tile = false,
}: {
  /** Round 60: true = a small tile in the home row (icon + short label) instead of the wide button. */
  tile?: boolean;
  entries: Entry[];
  date: string;
  target: number;
  name: string;
  macroTargets: { protein: number; carbs: number; fat: number };
  water: { glasses: number; goal: number };
}) {
  const { tr, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [pic, setPic] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mt = macroTargets;
  const wt = water;

  useEffect(() => {
    if (!open) return;
    let url = "";
    let stop = false;
    makePicture(
      { day: buildShareDay(entries, date), date, dateLabel: thaiDateLabel(date, lang), name, target, macroTargets: mt, water: wt, lang },
    )
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
    // mt / wt are rebuilt from these numbers, so list the numbers (not the objects).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entries, date, target, name, lang, mt.protein, mt.carbs, mt.fat, wt.glasses, wt.goal]);

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
        className={
          tile
            ? "flex min-h-[84px] w-full flex-col items-center justify-center gap-1.5 rounded-[22px] border border-white/90 bg-white/60 px-2 text-[15px] active:scale-[0.98]"
            : "glass flex min-h-[52px] w-full items-center justify-center gap-2 !rounded-full text-[16px] active:scale-[0.98]"
        }
        onClick={() => {
          setPic(null);
          setError(null);
          setOpen(true);
        }}
        data-testid="share-day-button"
      >
        <Icon name="export" className="h-5 w-5" />
        {tile ? tr("แชร์วันนี้", "Share day") : tr("แชร์สรุปวันนี้", "Share this day")}
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
                  {tr("แชร์รูปนี้", "Share this picture")}
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
