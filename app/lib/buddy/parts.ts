// "My buddy": a soft blob/food character she dresses up. Shown small on Today.
// All parts are drawn here as SVG text. No React and no browser storage, so the tests can use it.
// Copied from the approved design: docs/buddy-design/prototype.html
// Her rule: add-ons are flat soft color with NO dark outline. Only eyes/mouth/glasses use the dark line.

export type Name = { th: string; en: string };

type Shape = Name & {
  /** Body path in a 100x100 box. */
  d: string;
  /** How far to move the face down. */
  dy: number;
  /** Y of the top of the head (head add-ons sit here). */
  top: number;
  /** Left side point for earrings (right side is mirrored). */
  ex: number;
  ey: number;
};

export const SHAPES = {
  blob: { th: "ก้อนนุ่ม", en: "Blob", d: "M50 14 C72 12 88 28 86 52 C84 74 70 88 48 86 C26 84 12 70 14 48 C16 28 30 15 50 14Z", dy: 0, top: 14, ex: 15, ey: 58 },
  mochi: { th: "โมจิ", en: "Mochi", d: "M14 66 C14 40 30 24 50 24 C70 24 86 40 86 66 C86 80 74 84 50 84 C26 84 14 80 14 66Z", dy: 8, top: 24, ex: 15, ey: 64 },
  onigiri: { th: "ข้าวปั้น", en: "Onigiri", d: "M50 14 C58 14 88 64 86 74 C84 84 70 86 50 86 C30 86 16 84 14 74 C12 64 42 14 50 14Z", dy: 8, top: 16, ex: 22, ey: 64 },
  bun: { th: "ซาลาเปา", en: "Bun", d: "M12 70 C12 46 30 30 50 22 C70 30 88 46 88 70 C88 82 70 86 50 86 C30 86 12 82 12 70Z", dy: 10, top: 22, ex: 13, ey: 66 },
  cloud: { th: "เมฆ", en: "Cloud", d: "M24 80 C8 80 8 58 22 56 C18 38 38 30 46 40 C52 22 78 28 74 46 C92 46 92 74 78 80Z", dy: 10, top: 30, ex: 11, ey: 64 },
  jelly: {
    th: "เยลลี่",
    en: "Jelly",
    d: "M18 50 C18 28 32 16 50 16 C68 16 82 28 82 50 L82 80 C76 86 72 76 66 82 C60 88 56 78 50 82 C44 88 40 78 34 82 C28 88 24 76 18 82Z",
    dy: 0,
    top: 16,
    ex: 18,
    ey: 56,
  },
} satisfies Record<string, Shape>;

export const COLORS = ["#F4C0D1", "#FAC775", "#9FE1CB", "#B5D4F4", "#CECBF6", "#F5C4B3", "#ffffff"] as const;

const INK = "#2a2622";
const k = `stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

export const EYES = {
  dot: { th: "จุด", en: "Dots", s: `<circle cx="40" cy="52" r="3" fill="${INK}"/><circle cx="60" cy="52" r="3" fill="${INK}"/>` },
  shine: {
    th: "ตาวิบวับ",
    en: "Sparkly",
    s: `<ellipse cx="40" cy="52" rx="4.2" ry="5" fill="${INK}"/><ellipse cx="60" cy="52" rx="4.2" ry="5" fill="${INK}"/><circle cx="41.5" cy="50" r="1.6" fill="#fff"/><circle cx="61.5" cy="50" r="1.6" fill="#fff"/>`,
  },
  happy: { th: "ยิ้มตาปิด", en: "Happy", s: `<path d="M35 53 Q40 47 45 53 M55 53 Q60 47 65 53" ${k}/>` },
  calm: { th: "สงบ", en: "Calm", s: `<path d="M35 50 Q40 55 45 50 M55 50 Q60 55 65 50" ${k}/>` },
  squint: { th: "> <", en: "> <", s: `<path d="M36 48 L43 52 L36 56 M64 48 L57 52 L64 56" ${k}/>` },
  wink: { th: "ขยิบตา", en: "Wink", s: `<circle cx="40" cy="52" r="3" fill="${INK}"/><path d="M55 53 Q60 48 65 53" ${k}/>` },
} satisfies Record<string, Name & { s: string }>;

export const MOUTHS = {
  smile: { th: "ยิ้ม", en: "Smile", s: `<path d="M45 61 Q50 66 55 61" ${k}/>` },
  cat: { th: "ω", en: "ω", s: `<path d="M44 61 Q47 65 50 61 Q53 65 56 61" ${k}/>` },
  open: {
    th: "ยิ้มกว้าง",
    en: "Big smile",
    s: `<path d="M44 60 Q50 70 56 60Z" fill="#D85A30" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
  },
  o: { th: "o", en: "o", s: `<ellipse cx="50" cy="63" rx="2.4" ry="3" fill="${INK}"/>` },
  flat: { th: "เฉยๆ", en: "Plain", s: `<path d="M46 62 L54 62" ${k}/>` },
  tongue: { th: "แลบลิ้น", en: "Tongue", s: `<path d="M44 60 Q50 65 56 60" ${k}/><path d="M48 62.5 Q50 69 52 62.5Z" fill="#ED93B1"/>` },
} satisfies Record<string, Name & { s: string }>;

function flower(y: number): string {
  const cx = 33;
  const cy = y + 9;
  let p = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    p += `<circle cx="${(cx + 4.2 * Math.sin(a)).toFixed(1)}" cy="${(cy - 4.2 * Math.cos(a)).toFixed(1)}" r="3.4" fill="#F4A6B8"/>`;
  }
  return p + `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#FAC775"/>`;
}

/** On the head: only ONE (keeps it minimal). `f(top)` draws it at the head's top. */
export const HEADS = {
  none: { th: "ไม่มี", en: "None", f: () => "" },
  bow: {
    th: "โบว์",
    en: "Bow",
    f: (y: number) =>
      `<g transform="translate(68 ${y + 7}) rotate(14)"><path d="M0 0 C-3 -8 -12 -8 -11 0 C-12 8 -3 8 0 0Z M0 0 C3 -8 12 -8 11 0 C12 8 3 8 0 0Z" fill="#F4A6B8"/><ellipse rx="3" ry="3.4" fill="#ED93B1"/></g>`,
  },
  sprout: {
    th: "ใบไม้",
    en: "Sprout",
    f: (top: number) => {
      const y = top + 2;
      return `<path d="M50 ${y} L50 ${y - 7}" stroke="#97C459" stroke-width="2.4" stroke-linecap="round"/><path d="M50 ${y - 6} C46 ${y - 15} 38 ${y - 13} 37 ${y - 9} C40 ${y - 4} 46 ${y - 4} 50 ${y - 6}Z" fill="#97C459"/><path d="M50 ${y - 6} C54 ${y - 15} 62 ${y - 13} 63 ${y - 9} C60 ${y - 4} 54 ${y - 4} 50 ${y - 6}Z" fill="#B5D98A"/>`;
    },
  },
  flower: { th: "ดอกไม้", en: "Flower", f: flower },
  hat: {
    th: "หมวก",
    en: "Hat",
    f: (y: number) =>
      `<g transform="rotate(-8 50 ${y})"><ellipse cx="50" cy="${y + 1}" rx="18" ry="7.5" fill="#D98880"/><ellipse cx="50" cy="${y + 3.5}" rx="15" ry="3" fill="#C97470"/><circle cx="53" cy="${y - 6.5}" r="2.2" fill="#D98880"/></g>`,
  },
  clip: {
    th: "กิ๊บ",
    en: "Hair clip",
    f: (y: number) =>
      `<rect x="26" y="${y + 8}" width="12" height="3.6" rx="1.8" fill="#FAC775" transform="rotate(-30 32 ${y + 10})"/><rect x="29" y="${y + 13}" width="12" height="3.6" rx="1.8" fill="#F4A6B8" transform="rotate(-30 35 ${y + 15})"/>`,
  },
  cherry: {
    th: "เชอร์รี่",
    en: "Cherry",
    f: (y: number) =>
      `<path d="M45 ${y - 1} Q47 ${y - 10} 52 ${y - 14} Q53 ${y - 8} 56 ${y}" stroke="#8DB860" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M52 ${y - 14} C56 ${y - 18} 61 ${y - 16} 62 ${y - 13} C58 ${y - 11} 55 ${y - 12} 52 ${y - 14}Z" fill="#97C459"/><circle cx="45" cy="${y + 1}" r="4.4" fill="#E86B6B"/><circle cx="56" cy="${y + 2}" r="4.4" fill="#F07F7F"/><circle cx="43.6" cy="${y - 0.4}" r="1.2" fill="#fff" opacity=".7"/>`,
  },
  strawberry: {
    th: "สตรอว์เบอร์รี่",
    en: "Strawberry",
    f: (y: number) =>
      `<path d="M50 ${y + 4} C42 ${y - 2} 42 ${y - 10} 50 ${y - 10} C58 ${y - 10} 58 ${y - 2} 50 ${y + 4}Z" fill="#F07F7F"/><path d="M44 ${y - 10} Q47 ${y - 14} 50 ${y - 11} Q53 ${y - 14} 56 ${y - 10} Q50 ${y - 8} 44 ${y - 10}Z" fill="#97C459"/><circle cx="47" cy="${y - 5}" r=".8" fill="#FFE3A3"/><circle cx="53" cy="${y - 5}" r=".8" fill="#FFE3A3"/><circle cx="50" cy="${y - 1}" r=".8" fill="#FFE3A3"/>`,
  },
  orange: {
    th: "ส้ม",
    en: "Orange",
    f: (y: number) =>
      `<circle cx="50" cy="${y - 3}" r="6.5" fill="#F5A04A"/><circle cx="48" cy="${y - 5}" r="1.4" fill="#fff" opacity=".5"/><path d="M50 ${y - 9} C52 ${y - 14} 58 ${y - 14} 59 ${y - 11} C56 ${y - 8} 53 ${y - 9} 50 ${y - 9}Z" fill="#97C459"/>`,
  },
} satisfies Record<string, Name & { f: (top: number) => string }>;

/** Other extras: pick as many as she likes. */
export const EXTRAS = {
  blush: { th: "แก้มชมพู", en: "Pink cheeks" },
  nose: { th: "จมูก", en: "Nose" },
  glasses: { th: "แว่น", en: "Glasses" },
  earrings: { th: "ต่างหู", en: "Earrings" },
  coffee: { th: "แก้วกาแฟ", en: "Coffee" },
} satisfies Record<string, Name>;

export type BuddyShape = keyof typeof SHAPES;
export type BuddyEyes = keyof typeof EYES;
export type BuddyMouth = keyof typeof MOUTHS;
export type BuddyHead = keyof typeof HEADS;
export type BuddyExtra = keyof typeof EXTRAS;

export type BuddyConfig = {
  shape: BuddyShape;
  color: string;
  eyes: BuddyEyes;
  mouth: BuddyMouth;
  head: BuddyHead;
  extras: BuddyExtra[];
};

/** Shown before she makes her own. */
export const DEFAULT_BUDDY: BuddyConfig = {
  shape: "blob",
  color: "#B5D4F4",
  eyes: "shine",
  mouth: "smile",
  head: "none",
  extras: ["blush"],
};

function pick<T extends string>(table: Record<T, unknown>, v: unknown, fallback: T): T {
  return typeof v === "string" && Object.hasOwn(table, v) ? (v as T) : fallback;
}

/** Turn anything (saved text, a backup) into a safe buddy. Unknown parts fall back to the default. */
export function cleanBuddy(v: unknown): BuddyConfig {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const d = DEFAULT_BUDDY;
  const color = typeof o.color === "string" ? COLORS.find((c) => c.toLowerCase() === (o.color as string).toLowerCase()) : undefined;
  const extras = Array.isArray(o.extras)
    ? (Object.keys(EXTRAS) as BuddyExtra[]).filter((x) => (o.extras as unknown[]).includes(x))
    : d.extras;
  return {
    shape: pick(SHAPES, o.shape, d.shape),
    color: color ?? d.color,
    eyes: pick(EYES, o.eyes, d.eyes),
    mouth: pick(MOUTHS, o.mouth, d.mouth),
    head: pick(HEADS, o.head, d.head),
    extras,
  };
}

/** Read the saved text. Nothing saved (or broken) → null, so the app shows the default. */
export function parseBuddy(raw: string | null): BuddyConfig | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? cleanBuddy(v) : null;
  } catch {
    return null;
  }
}

/** The box to draw in: a little bigger than 100x100 so head add-ons and the coffee are not cut off. */
export const BUDDY_VIEWBOX = "-4 -8 108 108";

/** The inside of the <svg>: body, face, add-ons. Always built from our own parts (never from saved text). */
export function buddySvg(input: BuddyConfig): string {
  const b = cleanBuddy(input);
  const s: Shape = SHAPES[b.shape];
  const has = (x: BuddyExtra) => b.extras.includes(x);
  let o = `<path d="${s.d}" fill="${b.color}" stroke="${b.color === "#ffffff" ? "#e2ddd5" : "none"}" stroke-width="1.5"/>`;
  if (b.shape === "onigiri") o += '<path d="M34 72 L66 72 L66 86 Q50 87 34 86Z" fill="#2C4A3A"/>';
  if (b.shape === "bun") o += '<path d="M44 30 Q50 34 56 30 M47 26 Q50 30 53 26" stroke="#0003" stroke-width="1.6" fill="none" stroke-linecap="round"/>';

  let f = "";
  if (has("blush")) f += '<ellipse cx="33" cy="60" rx="5" ry="3" fill="#ED93B1" opacity=".55"/><ellipse cx="67" cy="60" rx="5" ry="3" fill="#ED93B1" opacity=".55"/>';
  f += EYES[b.eyes].s;
  if (has("nose")) f += '<ellipse cx="50" cy="57" rx="2.2" ry="1.6" fill="#D85A30" opacity=".7"/>';
  f += MOUTHS[b.mouth].s;
  if (has("glasses")) f += `<g stroke="${INK}" stroke-width="1.8" fill="none"><circle cx="40" cy="52" r="8"/><circle cx="60" cy="52" r="8"/><path d="M48 51 Q50 49 52 51"/></g>`;
  o += `<g transform="translate(0 ${s.dy})">${f}</g>`;

  if (has("earrings")) {
    for (const x of [s.ex, 100 - s.ex]) {
      o += `<circle cx="${x}" cy="${s.ey + 3}" r="1.6" fill="#E6B450"/><circle cx="${x}" cy="${s.ey + 8}" r="3" fill="#F6E7C8"/>`;
    }
  }
  o += HEADS[b.head].f(s.top);
  if (has("coffee")) {
    o +=
      '<g transform="translate(70 66) rotate(8)"><path d="M3 4 L17 4 L15 22 Q10 24 5 22Z" fill="#F7F3EC"/><path d="M3.8 10 L16.2 10 L15.4 17 L4.6 17Z" fill="#C9A27E"/><rect x="1.5" y="1" width="17" height="4" rx="2" fill="#8A6A50"/><path d="M8 -2 Q6 -5 8 -8 M12 -2 Q14 -5 12 -8" stroke="#C8C2B8" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>';
  }
  return o;
}
