"use client";
// "Share this day": draws the whole day as one picture,
// then sends it through the iPhone share sheet (LINE, Messages, save to Photos…).
import { useEffect, useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import { thaiDateLabel } from "../lib/date";
import { buildShareDay, shareFileName } from "../lib/shareDay";
import { CARD_COLORS, layoutShareCard, type CardInput, type Measure } from "../lib/shareCard";
import { MEAL_PICS_KEY, parseMealPics } from "../lib/mealPics";
import { getPhoto } from "../lib/photos";
import { type Entry } from "../lib/types";
import { Icon } from "./Icon";
import { weekFileName } from "../lib/shareWeek";
import { weekRange } from "../lib/jar";
import { makeWeekPicture } from "./shareWeekDraw";

// "Frosted Calm" look. The layout (what goes where, how tall) is worked out in lib/shareCard.ts;
// here we only draw its commands on a canvas. A still picture can't blur, so the glass cards
// are white ~58% fill + a thin white border, and the color clouds are soft radial gradients.
const CLOUDS = [
  { x: 0.18, y: 0.06, r: 0.62, c: "243,217,200" }, // peach, top-left
  { x: 0.9, y: 0.5, r: 0.66, c: "227,224,242" }, // lavender, right
  { x: 0.28, y: 0.97, r: 0.66, c: "230,238,221" }, // sage, bottom
];

function calmFont(): string {
  const s = getComputedStyle(document.documentElement);
  const calm = s.getPropertyValue("--font-calm").trim();
  const thai = s.getPropertyValue("--font-thai").trim();
  return [calm, thai, "sans-serif"].filter(Boolean).join(", ");
}

/** Load a picture (her character file, or a meal picture from the phone). */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error("image " + src.slice(0, 40)));
    i.src = src;
  });
}

/** Draw a picture cut to a rounded square (fills the square, like "cover"). */
function drawThumb(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, r: number) {
  const s = Math.min(img.width, img.height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.clip();
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, size, size);
  ctx.restore();
}

async function makePicture(info: CardInput): Promise<Blob> {
  const fam = calmFont();
  // Make sure the thin Thai + number font is ready, or the canvas uses a plain font.
  await Promise.all([200, 300, 400].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค 0123 kcal").catch(() => [])));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const measure: Measure = (t, size, weight) => {
    ctx.font = `${weight} ${size}px ${fam}`;
    return ctx.measureText(t).width;
  };
  const card = layoutShareCard(info, measure);
  // The character and the meal pictures are nice to have: if one fails to load, the picture still works.
  const char = await loadImg("/character-lines.png").catch(() => null);
  const photos = new Map<string, HTMLImageElement>();
  const ids = [...new Set(card.cmds.flatMap((c) => (c.t === "pic" ? [c.id] : [])))];
  await Promise.all(
    ids.map(async (id) => {
      const src = await getPhoto(id).catch(() => null);
      if (src) {
        const img = await loadImg(src).catch(() => null);
        if (img) photos.set(id, img);
      }
    }),
  );
  canvas.width = card.w;
  canvas.height = card.h;
  const { w: W, h: H } = card;
  // Beige page + 3 soft color clouds
  ctx.fillStyle = CARD_COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  for (const cl of CLOUDS) {
    const cx = cl.x * W;
    const cy = cl.y * H;
    const r = cl.r * Math.max(W, Math.min(H, 1500) * 0.7);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${cl.c},1)`);
    g.addColorStop(1, `rgba(${cl.c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.textBaseline = "alphabetic";
  for (const c of card.cmds) {
    if (c.t === "rect") {
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, c.r);
      ctx.fillStyle = c.fill;
      ctx.fill();
      if (c.stroke) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.stroke;
        ctx.stroke();
      }
    } else if (c.t === "text") {
      ctx.font = `${c.weight} ${c.size}px ${fam}`;
      ctx.fillStyle = c.color;
      if (c.spacing) {
        // Wide letter spacing, one letter at a time (works on every iPhone)
        const chars = Array.from(c.s);
        const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + c.spacing * (chars.length - 1);
        let x = c.align === "center" ? c.x - total / 2 : c.align === "right" ? c.x - total : c.x;
        ctx.textAlign = "left";
        for (const ch of chars) {
          ctx.fillText(ch, x, c.y);
          x += ctx.measureText(ch).width + c.spacing;
        }
      } else {
        ctx.textAlign = c.align;
        ctx.fillText(c.s, c.x, c.y);
      }
    } else if (c.t === "dot") {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      if (c.fill) {
        ctx.fillStyle = c.fill;
        ctx.fill();
      }
      if (c.stroke) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.stroke;
        ctx.stroke();
      }
    } else if (c.t === "bar") {
      ctx.fillStyle = CARD_COLORS.track;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, 6, 3);
      ctx.fill();
      const pw = c.w * Math.max(0, Math.min(1, c.part));
      if (pw > 0) {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, Math.max(6, pw), 6, 3);
        ctx.fill();
      }
    } else if (c.t === "pic") {
      const img = photos.get(c.id);
      if (img) drawThumb(ctx, img, c.x, c.y, c.size, c.r);
      else {
        // Picture missing from the phone: the same soft tile as "no picture"
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.size, c.size, c.r);
        ctx.fillStyle = CARD_COLORS.tile;
        ctx.fill();
      }
    } else if (c.t === "char" && char) {
      ctx.drawImage(char, c.x, c.y, c.size, c.size);
    }
  }
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("toBlob"))), "image/png"));
}

/** The dish-name -> picture map (saved on the phone by the meal pictures). */
function readPics() {
  try {
    return parseMealPics(localStorage.getItem(MEAL_PICS_KEY));
  } catch {
    return {};
  }
}

export function ShareDayButton({
  entries,
  date,
  target,
  name,
  macroTargets,
  water,
  weightKg = null,
  tile = false,
}: {
  /** Round 71: the weight she logged on this day, if any. */
  weightKg?: number | null;
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
  // Round 74: "day" (the picture of this day) or "week" (the weekly card for her trainer).
  const [range, setRange] = useState<"day" | "week">("day");
  const [pic, setPic] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mt = macroTargets;
  const wt = water;

  useEffect(() => {
    if (!open) return;
    let url = "";
    let stop = false;
    (range === "week"
      ? makeWeekPicture({ entries, date, target, proteinTarget: mt.protein, lang })
      : makePicture(
      {
        day: buildShareDay(entries, date, readPics()),
        date,
        dateLabel: thaiDateLabel(date, lang),
        name,
        target,
        macroTargets: mt,
        water: wt,
        weightKg,
        lang,
      },
    ))
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
  }, [open, range, entries, date, target, name, lang, mt.protein, mt.carbs, mt.fat, wt.glasses, wt.goal, weightKg]);

  const fileName = range === "week" ? weekFileName(weekRange(date).start) : shareFileName(date);
  const file = pic ? new File([pic.blob], fileName, { type: "image/png" }) : null;
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
          setRange("day");
          setOpen(true);
        }}
        data-testid="share-day-button"
      >
        <Icon name="export" className="h-5 w-5" />
        {tile ? tr("แชร์วันนี้", "Share day") : tr("แชร์สรุปวันนี้", "Share this day")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={range === "week" ? tr("สรุปสัปดาห์นี้", "This week") : tr("สรุปวันนี้", "This day")}>
        <div className="space-y-3 pb-4" data-testid="share-day-sheet">
          <div className="flex gap-1 rounded-full bg-white/60 p-1" role="tablist" data-testid="share-range">
            {(["day", "week"] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                className={`min-h-[44px] flex-1 rounded-full text-[16px] ${range === r ? "bg-[#2b2724] text-white" : "text-muted"}`}
                onClick={() => {
                  if (r === range) return;
                  setPic(null);
                  setError(null);
                  setRange(r);
                }}
                data-testid={`share-range-${r}`}
              >
                {r === "day" ? tr("วันนี้", "Today") : tr("สัปดาห์นี้", "This week")}
              </button>
            ))}
          </div>
          {error && (
            <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
              {tr("ทำรูปไม่สำเร็จ", "Couldn't make the picture")}: {error}
            </p>
          )}
          {!pic && !error && <p className="py-10 text-center text-[15px] text-muted">{tr("กำลังทำรูป…", "Making the picture…")}</p>}
          {pic && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic.url} alt={range === "week" ? tr("รูปสรุปสัปดาห์นี้", "Picture of this week") : tr("รูปสรุปวันนี้", "Picture of this day")} className="w-full rounded-[22px] border border-line" data-testid="share-day-image" />
              {canShare ? (
                <button className="btn-primary w-full !min-h-[56px] text-[18px]" onClick={share} data-testid="share-day-send">
                  {tr("แชร์รูปนี้", "Share this picture")}
                </button>
              ) : (
                <a
                  className="btn-primary flex w-full !min-h-[56px] items-center justify-center text-[18px]"
                  href={pic.url}
                  download={fileName}
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
