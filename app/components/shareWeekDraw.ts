// Round 74 (part B): draws the weekly card's commands (lib/shareWeek.ts) on a canvas and gives back a PNG.
// Same kind of picture as the day card, so it goes through the same share sheet / download.
import { drawJarShape } from "../lib/jarShapes";
import { JAR_COLORS, JAR_SHAPES } from "../lib/jar";
import { layoutShareWeek, WEEK_COLORS, type WeekInput } from "../lib/shareWeek";
import { settleWeekCard } from "../lib/shareWeekJar";
import type { Measure } from "../lib/shareCard";

const CLOUDS = [
  { x: 0, y: 0, r: 0.8, c: "246,220,205" }, // peach, top-left
  { x: 1, y: 0.5, r: 0.7, c: "228,222,243" }, // lavender, right
  { x: 0, y: 1, r: 0.8, c: "223,232,218" }, // sage, bottom-left
];

function calmFont(): string {
  const s = getComputedStyle(document.documentElement);
  return [s.getPropertyValue("--font-calm").trim(), s.getPropertyValue("--font-thai").trim(), "sans-serif"].filter(Boolean).join(", ");
}

export async function makeWeekPicture(inp: WeekInput): Promise<Blob> {
  const fam = calmFont();
  await Promise.all([300, 400, 500, 600].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค 0123 kcal").catch(() => [])));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const measure: Measure = (t, size, weight) => {
    ctx.font = `${weight} ${size}px ${fam}`;
    return ctx.measureText(t).width;
  };
  const card = await settleWeekCard(layoutShareWeek(inp, measure));
  const { w: W, h: H } = card;
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = WEEK_COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  for (const cl of CLOUDS) {
    const rad = cl.r * Math.max(W, H * 0.6);
    const g = ctx.createRadialGradient(cl.x * W, cl.y * H, 0, cl.x * W, cl.y * H, rad);
    g.addColorStop(0, `rgba(${cl.c},1)`);
    g.addColorStop(0.7, `rgba(${cl.c},0)`);
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
    } else if (c.t === "text") {
      ctx.font = `${c.weight} ${c.size}px ${fam}`;
      ctx.fillStyle = c.color;
      if (c.spacing) {
        const chars = Array.from(c.s);
        let x = c.x;
        ctx.textAlign = "left";
        for (const ch of chars) {
          ctx.fillText(ch, x, c.y);
          x += ctx.measureText(ch).width + c.spacing;
        }
      } else {
        ctx.textAlign = c.align;
        ctx.fillText(c.s, c.x, c.y);
      }
    } else if (c.t === "shape") {
      ctx.save();
      ctx.translate(c.x, c.y);
      drawJarShape(ctx, JAR_SHAPES[c.k], c.r, JAR_COLORS[c.k]);
      ctx.restore();
    } else if (c.t === "jar") {
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, c.r);
      ctx.fillStyle = WEEK_COLORS.jar;
      ctx.fill();
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = WEEK_COLORS.jarEdge;
      ctx.stroke();
      for (const p of c.placed ?? []) {
        ctx.save();
        ctx.translate(c.x + p.x, c.y + p.y);
        ctx.rotate(p.a);
        drawJarShape(ctx, JAR_SHAPES[p.k], c.pieceR, JAR_COLORS[p.k]);
        ctx.restore();
      }
    } else if (c.t === "segbar") {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, c.h / 2);
      ctx.clip();
      ctx.fillStyle = WEEK_COLORS.track;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      let x = c.x;
      ctx.textAlign = "center";
      for (const part of c.parts) {
        ctx.fillStyle = part.color;
        ctx.fillRect(x, c.y, part.w + 1, c.h);
        if (part.w > 90) {
          ctx.font = `600 ${12 * 3}px ${fam}`;
          ctx.fillStyle = WEEK_COLORS.ink;
          ctx.fillText(part.label, x + part.w / 2, c.y + c.h / 2 + 12);
        }
        x += part.w;
      }
      if (c.empty) {
        ctx.font = `400 ${12 * 3}px ${fam}`;
        ctx.fillStyle = WEEK_COLORS.muted;
        ctx.fillText(c.empty, c.x + c.w / 2, c.y + c.h / 2 + 12);
      }
      ctx.restore();
    }
  }
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("toBlob"))), "image/png"));
}
