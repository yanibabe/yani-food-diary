// Yani's own brand character on Today. Her drawing is NEVER changed: the app only
// paints a color behind her lines (body, hands, feet) and can put one small decoration on top.
// Layers come from scripts/character-layers.mjs. No React and no browser storage here, so tests can use it.

export type Name = { th: string; en: string };

/** White = exactly her original drawing. */
export const CHAR_COLORS = ["#ffffff", "#F4C0D1", "#FAC775", "#9FE1CB", "#B5D4F4", "#CECBF6", "#F5C4B3", "#C0DD97"] as const;

/** Drawing box = the picture's own pixels (480x480). */
export const CHAR_BOX = 480;

/** Small decorations. Flat soft color, no dark outline (her rule), placed so they never cover her face. */
export const DECOS = {
  none: { th: "ไม่มี", en: "None", s: "" },
  bow: {
    th: "โบว์",
    en: "Bow",
    s: '<g transform="translate(338 118) rotate(14) scale(4)"><path d="M0 0 C-3 -8 -12 -8 -11 0 C-12 8 -3 8 0 0Z M0 0 C3 -8 12 -8 11 0 C12 8 3 8 0 0Z" fill="#F4A6B8"/><ellipse rx="3" ry="3.4" fill="#ED93B1"/></g>',
  },
  flower: {
    th: "ดอกไม้",
    en: "Flower",
    s: (() => {
      let p = "";
      for (let i = 0; i < 5; i++) {
        const a = (i * 72 * Math.PI) / 180;
        p += `<circle cx="${(4.2 * Math.sin(a)).toFixed(2)}" cy="${(-4.2 * Math.cos(a)).toFixed(2)}" r="3.4" fill="#F4A6B8"/>`;
      }
      return `<g transform="translate(140 122) scale(4)">${p}<circle r="2.6" fill="#FAC775"/></g>`;
    })(),
  },
  cherry: {
    th: "เชอร์รี่",
    en: "Cherry",
    s: '<g transform="translate(318 96) scale(3.6)"><path d="M-5 1 Q-3 -8 2 -12 Q3 -6 6 2" stroke="#8DB860" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M2 -12 C6 -16 11 -14 12 -11 C8 -9 5 -10 2 -12Z" fill="#97C459"/><circle cx="-5" cy="3" r="4.4" fill="#E86B6B"/><circle cx="6" cy="4" r="4.4" fill="#F07F7F"/><circle cx="-6.4" cy="1.6" r="1.2" fill="#fff" opacity=".7"/></g>',
  },
  strawberry: {
    th: "สตรอว์เบอร์รี่",
    en: "Strawberry",
    s: '<g transform="translate(330 104) rotate(12) scale(4)"><path d="M0 7 C-8 1 -8 -7 0 -7 C8 -7 8 1 0 7Z" fill="#F07F7F"/><path d="M-6 -7 Q-3 -11 0 -8 Q3 -11 6 -7 Q0 -5 -6 -7Z" fill="#97C459"/><circle cx="-3" cy="-2" r=".8" fill="#FFE3A3"/><circle cx="3" cy="-2" r=".8" fill="#FFE3A3"/><circle cy="2" r=".8" fill="#FFE3A3"/></g>',
  },
  clip: {
    th: "กิ๊บ",
    en: "Hair clip",
    s: '<g transform="translate(150 128) rotate(-30) scale(4)"><rect x="-6" y="-4" width="12" height="3.6" rx="1.8" fill="#FAC775"/><rect x="-4" y="1.5" width="12" height="3.6" rx="1.8" fill="#F4A6B8"/></g>',
  },
  star: {
    th: "ดาว",
    en: "Star",
    s: (() => {
      let d = "";
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 ? 4 : 9;
        d += `${i ? "L" : "M"}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)} `;
      }
      return `<g transform="translate(336 110) rotate(12) scale(3.6)"><path d="${d.trim()}Z" fill="#FAC775" stroke="#FAC775" stroke-width="1.6" stroke-linejoin="round"/></g>`;
    })(),
  },
  heart: {
    th: "หัวใจ",
    en: "Heart",
    s: '<g transform="translate(336 112) rotate(14) scale(4)"><path d="M0 7 C-10 1 -7 -8 0 -3 C7 -8 10 1 0 7Z" fill="#F4A6B8"/></g>',
  },
} satisfies Record<string, Name & { s: string }>;

export type CharDeco = keyof typeof DECOS;

/** Soft pink cheeks: under the wink eye and under the monocle. */
export const BLUSH =
  '<ellipse cx="150" cy="268" rx="22" ry="12" fill="#ED93B1" opacity=".55"/><ellipse cx="318" cy="276" rx="22" ry="12" fill="#ED93B1" opacity=".55"/>';

export type CharLook = { color: string; deco: CharDeco; blush: boolean };

/** Before she picks anything: exactly her original drawing. */
export const DEFAULT_LOOK: CharLook = { color: "#ffffff", deco: "none", blush: false };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Turn anything (saved text, an old backup) into a safe look. Unknown values → default. */
export function cleanLook(v: unknown): CharLook {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const color = typeof o.color === "string" && HEX.test(o.color) ? o.color.toLowerCase() : DEFAULT_LOOK.color;
  const deco = typeof o.deco === "string" && Object.hasOwn(DECOS, o.deco) ? (o.deco as CharDeco) : DEFAULT_LOOK.deco;
  // Old Round 20 buddies kept cheeks in "extras".
  const blush = typeof o.blush === "boolean" ? o.blush : Array.isArray(o.extras) && o.extras.includes("blush");
  return { color, deco, blush };
}

export function parseLook(raw: string | null): CharLook {
  if (!raw) return DEFAULT_LOOK;
  try {
    return cleanLook(JSON.parse(raw));
  } catch {
    return DEFAULT_LOOK;
  }
}

/** What goes on top of her lines. Only our own fixed pieces, never saved text. */
export function overlaySvg(look: CharLook): string {
  const l = cleanLook(look);
  return (l.blush ? BLUSH : "") + DECOS[l.deco].s;
}
