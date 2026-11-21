// Draws a report layout (lib/nutritionReport.ts) on a canvas and returns the PNG. Browser only.
import { RC, type Measure, type ReportLayout } from "../lib/nutritionReport";

function fontFamily(): string {
  const s = getComputedStyle(document.documentElement);
  const calm = s.getPropertyValue("--font-calm").trim();
  const thai = s.getPropertyValue("--font-thai").trim();
  return [thai, calm, "sans-serif"].filter(Boolean).join(", ");
}

/** `build` gets a measure function that uses the same fonts as the drawing, and returns the layout. */
export async function makeReportPicture(build: (measure: Measure) => ReportLayout, scale = 1): Promise<Blob> {
  const fam = fontFamily();
  // Make sure the app fonts are ready, or the canvas would measure and draw with a plain font.
  await Promise.all([400, 500, 600].map((w) => document.fonts.load(`${w} 32px ${fam}`, "กขค ABC 0123 kcal").catch(() => [])));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const measure: Measure = (t, size, weight) => {
    ctx.font = `${weight} ${size}px ${fam}`;
    return ctx.measureText(t).width;
  };
  const layout = build(measure);
  canvas.width = Math.round(layout.w * scale);
  canvas.height = Math.round(layout.h * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = RC.bg;
  ctx.fillRect(0, 0, layout.w, layout.h);
  ctx.textBaseline = "alphabetic";
  for (const c of layout.cmds) {
    if (c.t === "rect") {
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, c.r);
      if (c.fill) {
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
      ctx.font = `${c.weight} ${c.size}px ${fam}`;
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
