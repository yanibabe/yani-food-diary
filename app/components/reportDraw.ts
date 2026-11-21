// Draws a report layout (lib/nutritionReport.ts) on a canvas and returns the PNG. Browser only.
import { RC, type Measure, type ReportLayout } from "../lib/nutritionReport";

function fontFamily(): string {
  const s = getComputedStyle(document.documentElement);
  const calm = s.getPropertyValue("--font-calm").trim();
  const thai = s.getPropertyValue("--font-thai").trim();
  return [calm, thai, "sans-serif"].filter(Boolean).join(", ");
}

/** `build` gets a measure function that uses the same fonts as the drawing, and returns the layout. */
export async function makeReportPicture(build: (measure: Measure) => ReportLayout, scale = 1): Promise<Blob> {
  const fam = fontFamily();
  // Make sure the app fonts are ready, or the canvas would measure and draw with a plain font.
  await Promise.all([300, 400, 500].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค ABC 0123 kcal").catch(() => [])));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // The app's calm font tops out at 500, so 600/700 draw as 500 (and measure as 500).
  const wt = (w: number) => Math.min(500, Math.max(300, w));
  const measure: Measure = (t, size, weight) => {
    ctx.font = `${wt(weight)} ${size}px ${fam}`;
    return ctx.measureText(t).width;
  };
  const layout = build(measure);
  canvas.width = Math.round(layout.w * scale);
  canvas.height = Math.round(layout.h * scale);
  ctx.scale(scale, scale);
  // Same soft beige page with three colour clouds as the app (.calm-backdrop).
  ctx.fillStyle = RC.bg;
  ctx.fillRect(0, 0, layout.w, layout.h);
  const cloud = (cx: number, cy: number, r: number, col: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(1, col + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, layout.w, layout.h);
  };
  cloud(layout.w * 0.18, layout.h * 0.04, Math.max(layout.w, layout.h * 0.3) * 0.75, RC.cloudPeach);
  cloud(layout.w * 0.92, layout.h * 0.5, Math.max(layout.w, layout.h * 0.3) * 0.7, RC.cloudLilac);
  cloud(layout.w * 0.25, layout.h * 0.98, Math.max(layout.w, layout.h * 0.3) * 0.75, RC.cloudSage);
  ctx.textBaseline = "alphabetic";
  for (const c of layout.cmds) {
    if (c.t === "rect") {
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, c.r);
      if (c.shadow && c.fill) {
        ctx.save();
        ctx.shadowColor = RC.shadow;
        ctx.shadowBlur = 36;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = c.fill;
        ctx.fill();
        ctx.restore();
      }
      if (c.grad) {
        const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
        g.addColorStop(0, c.grad[0]);
        g.addColorStop(1, c.grad[1]);
        ctx.fillStyle = g;
        ctx.fill();
      } else if (c.fill) {
        ctx.fillStyle = c.fill;
        ctx.fill();
      }
      if (c.stroke) {
        ctx.setLineDash(c.dash ?? []);
        ctx.lineWidth = c.lw ?? 2;
        ctx.strokeStyle = c.stroke;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (c.t === "text") {
      ctx.font = `${wt(c.weight)} ${c.size}px ${fam}`;
      ctx.fillStyle = c.color;
      ctx.textAlign = c.align;
      ctx.fillText(c.s, c.x, c.y);
    } else if (c.t === "line") {
      ctx.beginPath();
      ctx.setLineDash(c.dash ?? []);
      ctx.lineWidth = c.w;
      ctx.strokeStyle = c.color;
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (c.t === "dot") {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = c.fill;
      ctx.fill();
    }
  }
  return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("toBlob"))), "image/png"));
}
