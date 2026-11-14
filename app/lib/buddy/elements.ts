// Yani's Parts Studio: the basic shapes ("elements") she builds face parts from,
// the checks for the parts file, and how a part turns into SVG.
// No React and no browser storage here, so the tests can use it.
// Coordinates are the buddy's 100x100 face box (before the shape moves the face down).

import { z } from "zod";

export const INK = "#2a2622";

export const ELEMENT_TYPES = [
  "dot",
  "ring",
  "oval",
  "ovalRing",
  "line",
  "curve",
  "deepCurve",
  "wave",
  "angle",
  "cross",
  "heart",
  "star",
  "sparkle",
  "tear",
  "half",
  "triangle",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** Thai label for each element button in the studio. */
export const ELEMENT_LABELS: Record<ElementType, string> = {
  dot: "จุด",
  ring: "วงกลม",
  oval: "วงรี",
  ovalRing: "วงรีเส้น",
  line: "เส้นตรง",
  curve: "เส้นโค้ง",
  deepCurve: "โค้งลึก",
  wave: "คลื่น ω",
  angle: "มุม >",
  cross: "กากบาท",
  heart: "หัวใจ",
  star: "ดาว",
  sparkle: "ประกาย",
  tear: "หยดน้ำ",
  half: "ครึ่งวงกลม",
  triangle: "สามเหลี่ยม",
};

/** Always a filled blob of color. */
const SOLID: ElementType[] = ["dot", "oval"];
/** Always just a line. */
const STROKE: ElementType[] = ["ring", "ovalRing", "line", "curve", "deepCurve", "wave", "angle", "cross"];
/** She can switch these between filled and outline. */
export const CAN_FILL: ElementType[] = ["heart", "star", "sparkle", "tear", "half", "triangle"];

export const KINDS = ["eyes", "brows", "nose", "mouth"] as const;
export type PartKind = (typeof KINDS)[number];

export const KIND_LABELS: Record<PartKind, { th: string; en: string }> = {
  eyes: { th: "ตา", en: "Eyes" },
  brows: { th: "คิ้ว", en: "Brows" },
  nose: { th: "จมูก", en: "Nose" },
  mouth: { th: "ปาก", en: "Mouth" },
};

/** Where each kind of part usually sits (face box coordinates). Used for the guide box and the zoomed choice buttons. */
export const ZONES: Record<PartKind, { x: number; y: number; w: number; h: number }> = {
  eyes: { x: 24, y: 38, w: 52, h: 26 },
  brows: { x: 24, y: 30, w: 52, h: 20 },
  nose: { x: 36, y: 48, w: 28, h: 16 },
  mouth: { x: 32, y: 52, w: 36, h: 22 },
};

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const num = (min: number, max: number) => z.number().finite().min(min).max(max);

export const ElSchema = z.object({
  type: z.enum(ELEMENT_TYPES),
  x: num(-20, 120),
  y: num(-20, 120),
  size: num(1, 60),
  rot: num(-360, 360),
  thick: num(0.3, 8),
  color,
  filled: z.boolean(),
  mirror: z.boolean(),
});
export type El = z.infer<typeof ElSchema>;

export const PartSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  kind: z.enum(KINDS),
  name: z.object({ th: z.string().min(1).max(30), en: z.string().max(30) }),
  visible: z.boolean(),
  items: z.array(ElSchema).max(40),
});
export type Part = z.infer<typeof PartSchema>;

export const LibrarySchema = z
  .object({ parts: z.array(PartSchema).max(300) })
  .refine((l) => new Set(l.parts.map((p) => `${p.kind}:${p.id}`)).size === l.parts.length, "Two parts share the same id");
export type Library = z.infer<typeof LibrarySchema>;

/** A fresh element dropped in the middle of a part's zone. */
export function newEl(type: ElementType, kind: PartKind): El {
  const z = ZONES[kind];
  const sym = kind === "eyes" || kind === "brows";
  return {
    type,
    x: sym ? 40 : 50,
    y: Math.round(z.y + z.h / 2),
    size: kind === "nose" ? 5 : 8,
    rot: 0,
    thick: 2.2,
    color: INK,
    filled: true,
    mirror: sym,
  };
}

const f = (n: number) => Number(n.toFixed(2));

/** The shape itself, drawn around (0,0). `r` is half the size. */
function shapePath(type: ElementType, r: number): { tag: "circle" | "ellipse" | "path"; attrs: string } {
  switch (type) {
    case "dot":
    case "ring":
      return { tag: "circle", attrs: `r="${f(r)}"` };
    case "oval":
    case "ovalRing":
      return { tag: "ellipse", attrs: `rx="${f(r * 0.84)}" ry="${f(r)}"` };
    case "line":
      return { tag: "path", attrs: `d="M${f(-r)} 0 L${f(r)} 0"` };
    case "curve":
      return { tag: "path", attrs: `d="M${f(-r)} 0 Q0 ${f(r)} ${f(r)} 0"` };
    case "deepCurve":
      return { tag: "path", attrs: `d="M${f(-r)} 0 C${f(-r)} ${f(r * 1.3)} ${f(r)} ${f(r * 1.3)} ${f(r)} 0"` };
    case "wave":
      return { tag: "path", attrs: `d="M${f(-r)} 0 Q${f(-r / 2)} ${f(r * 0.7)} 0 0 Q${f(r / 2)} ${f(r * 0.7)} ${f(r)} 0"` };
    case "angle":
      return { tag: "path", attrs: `d="M${f(-r * 0.85)} ${f(-r)} L${f(r * 0.85)} 0 L${f(-r * 0.85)} ${f(r)}"` };
    case "cross": {
      const a = f(r * 0.75);
      return { tag: "path", attrs: `d="M${-a} ${-a} L${a} ${a} M${a} ${-a} L${-a} ${a}"` };
    }
    case "heart":
      return {
        tag: "path",
        attrs: `d="M0 ${f(r * 0.9)} C${f(-r * 1.3)} ${f(r * 0.05)} ${f(-r * 0.9)} ${f(-r * 1.05)} 0 ${f(-r * 0.4)} C${f(r * 0.9)} ${f(-r * 1.05)} ${f(r * 1.3)} ${f(r * 0.05)} 0 ${f(r * 0.9)}Z"`,
      };
    case "star": {
      let d = "";
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        d += `${i ? "L" : "M"}${f(rr * Math.cos(a))} ${f(rr * Math.sin(a))} `;
      }
      return { tag: "path", attrs: `d="${d.trim()}Z"` };
    }
    case "sparkle": {
      const q = f(r * 0.18);
      const R = f(r);
      return { tag: "path", attrs: `d="M0 ${-R} Q${q} ${-q} ${R} 0 Q${q} ${q} 0 ${R} Q${-q} ${q} ${-R} 0 Q${-q} ${-q} 0 ${-R}Z"` };
    }
    case "tear":
      return {
        tag: "path",
        attrs: `d="M0 ${f(-r)} C${f(r * 0.35)} ${f(-r * 0.4)} ${f(r * 0.75)} ${f(r * 0.05)} ${f(r * 0.75)} ${f(r * 0.4)} C${f(r * 0.75)} ${f(r * 0.85)} ${f(r * 0.4)} ${f(r)} 0 ${f(r)} C${f(-r * 0.4)} ${f(r)} ${f(-r * 0.75)} ${f(r * 0.85)} ${f(-r * 0.75)} ${f(r * 0.4)} C${f(-r * 0.75)} ${f(r * 0.05)} ${f(-r * 0.35)} ${f(-r * 0.4)} 0 ${f(-r)}Z"`,
      };
    case "half":
      return { tag: "path", attrs: `d="M${f(-r)} 0 Q0 ${f(r * 1.67)} ${f(r)} 0Z"` };
    case "triangle":
      return { tag: "path", attrs: `d="M0 ${f(-r * 0.8)} L${f(r * 0.9)} ${f(r * 0.7)} L${f(-r * 0.9)} ${f(r * 0.7)}Z"` };
  }
}

export function isFilled(el: El): boolean {
  if (SOLID.includes(el.type)) return true;
  if (STROKE.includes(el.type)) return false;
  return el.filled;
}

/** Move + turn for one copy. The mirror copy sits at 100−x and is flipped left↔right. */
export function elTransform(el: El, mirrored: boolean): string {
  return mirrored
    ? `translate(${f(100 - el.x)} ${f(el.y)}) scale(-1 1) rotate(${f(el.rot)})`
    : `translate(${f(el.x)} ${f(el.y)}) rotate(${f(el.rot)})`;
}

/** Where the mirror copy's center lands. */
export function mirrorX(x: number): number {
  return 100 - x;
}

/** One element (plus its mirror copy when switched on). Only numbers and checked colors go in. */
export function elSvg(input: El): string {
  const p = ElSchema.safeParse(input);
  if (!p.success) return "";
  const el = p.data;
  const { tag, attrs } = shapePath(el.type, el.size / 2);
  const paint = isFilled(el)
    ? `fill="${el.color}"`
    : `fill="none" stroke="${el.color}" stroke-width="${f(el.thick)}" stroke-linecap="round" stroke-linejoin="round"`;
  const one = (m: boolean) => `<${tag} ${attrs} ${paint} transform="${elTransform(el, m)}"/>`;
  return one(false) + (el.mirror ? one(true) : "");
}

/** A whole part (its elements in order: first = bottom layer). */
export function partSvg(part: Pick<Part, "items">): string {
  return part.items.map(elSvg).join("");
}

/** Check a parts file. Returns the clean library, or a short reason why not. */
export function checkLibrary(v: unknown): { ok: true; library: Library } | { ok: false; error: string } {
  const p = LibrarySchema.safeParse(v);
  if (p.success) return { ok: true, library: p.data };
  const i = p.error.issues[0];
  return { ok: false, error: `${i.path.join(".") || "file"}: ${i.message}` };
}
