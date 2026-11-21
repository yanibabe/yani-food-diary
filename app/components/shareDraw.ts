// Draws a share card (shareCard.ts / shareWeekCard.ts commands) on a canvas and gives back a PNG. Browser only.
// "Frosted Calm" look: a still picture can't blur, so the glass cards are white ~58% fill + a thin white
// border, and the colour clouds are soft radial gradients. The character and meal pictures are nice to
// have: if one fails to load, the picture still works.
import { CARD_COLORS, type Cmd, type Measure } from "../lib/shareCard";
import { getPhoto } from "../lib/photos";

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

/** `build` gets a measure function that uses the same fonts as the drawing, and returns the card. */
export async function makeSharePicture(build: (measure: Measure) => { w: number; h: number; cmds: Cmd[] }): Promise<Blob> {
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
  const card = build(measure);
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
        ctx.setLineDash(c.dash ?? []);
        ctx.strokeStyle = c.stroke;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (c.t === "line") {
      ctx.beginPath();
      ctx.setLineDash(c.dash ?? []);
      ctx.lineWidth = c.w;
      ctx.strokeStyle = c.color;
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.setLineDash([]);
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
