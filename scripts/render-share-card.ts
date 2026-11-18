// Round 71 preview helper (not part of the app): draws the share-day card as SVG, then PNG with headless Chrome.
// Run: node scripts/render-share-card.ts <out-dir>
// Text widths here are a rough ruler (no real fonts), so wrapping is approximate. The real picture is drawn in the browser.
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildShareDay } from "../app/lib/shareDay.ts";
import { CARD_COLORS, layoutShareCard, type CardInput, type Cmd, type Measure } from "../app/lib/shareCard.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

const measure: Measure = (t, size, weight) =>
  Array.from(t).reduce((a, ch) => a + (/[฀-๿]/.test(ch) ? 0.5 : /[0-9]/.test(ch) ? 0.55 : 0.52) * size * (weight >= 400 ? 1.03 : 1), 0);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const FAM = "Thonburi, 'Helvetica Neue', sans-serif";

function svg(w: number, h: number, cmds: Cmd[]): string {
  const o: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs>${[["a", 0.18, 0.06, "243,217,200"], ["b", 0.9, 0.5, "227,224,242"], ["c", 0.28, 0.97, "230,238,221"]]
      .map(([id, x, y, c]) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${Number(x) * w}" cy="${Number(y) * h}" r="${0.66 * Math.max(w, Math.min(h, 1500) * 0.7)}"><stop offset="0" stop-color="rgb(${c})"/><stop offset="1" stop-color="rgb(${c})" stop-opacity="0"/></radialGradient>`).join("")}</defs>`,
    `<rect width="${w}" height="${h}" fill="${CARD_COLORS.bg}"/>`,
    `<rect width="${w}" height="${h}" fill="url(#a)"/><rect width="${w}" height="${h}" fill="url(#b)"/><rect width="${w}" height="${h}" fill="url(#c)"/>`,
  ];
  for (const c of cmds) {
    if (c.t === "rect") o.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="${c.fill}"${c.stroke ? ` stroke="${c.stroke}" stroke-width="2"` : ""}/>`);
    else if (c.t === "text") o.push(`<text x="${c.x}" y="${c.y}" font-family="${FAM}" font-size="${c.size}" font-weight="${c.weight}" fill="${c.color}" text-anchor="${c.align === "left" ? "start" : c.align === "center" ? "middle" : "end"}"${c.spacing ? ` letter-spacing="${c.spacing}"` : ""}>${esc(c.s)}</text>`);
    else if (c.t === "dot") o.push(`<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${c.fill ?? "none"}"${c.stroke ? ` stroke="${c.stroke}" stroke-width="2"` : ""}/>`);
    else if (c.t === "bar") o.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="6" rx="3" fill="${CARD_COLORS.track}"/><rect x="${c.x}" y="${c.y}" width="${Math.max(6, c.w * Math.max(0, Math.min(1, c.part)))}" height="6" rx="3" fill="${c.color}"/>`);
    else if (c.t === "pic") o.push(`<rect x="${c.x}" y="${c.y}" width="${c.size}" height="${c.size}" rx="${c.r}" fill="#EAD9C4"/><text x="${c.x + c.size / 2}" y="${c.y + c.size / 2 + 10}" font-size="28" text-anchor="middle" fill="#9C948A" font-family="${FAM}">picture</text>`);
  }
  return o.join("\n") + "</svg>";
}

const item = (name: string, kcal: number, p: number, c: number, f: number, amount = 1, unit = "จาน", estimated = true): FoodItem => ({ id: name, name, amount, unit, kcal, protein: p, carbs: c, fat: f, estimated, kind: "food", note: null, box: null });
const e = (id: string, slot: Entry["slot"], title: string, items: FoodItem[], t: number, photoId: string | null = null): Entry => ({ id, date: "2026-11-18", slot, title, items, source: "manual", photoId, recipe: null, createdAt: t, updatedAt: t });
const base = (entries: Entry[], extra: Partial<CardInput> = {}): CardInput => ({
  day: buildShareDay(entries, "2026-11-18"), date: "2026-11-18", dateLabel: "วันพุธ 18 พ.ย. 2569", name: "Yani", target: 1800,
  macroTargets: { protein: 90, carbs: 220, fat: 60 }, water: { glasses: 6, goal: 8 }, weightKg: 54.2, lang: "th", ...extra,
});
const many = [
  e("1", "breakfast", "โจ๊กหมูใส่ไข่", [item("โจ๊กหมู", 220, 12, 30, 5, 1, "ถ้วย"), item("ไข่ต้ม", 70, 6, 0.5, 5, 1, "ฟอง", false)], 1, "p1"),
  e("2", "breakfast", "กาแฟเย็น", [item("กาแฟเย็น", 120, 2, 18, 4, 1, "แก้ว")], 2),
  e("3", "lunch", "ข้าวกะเพราหมูสับไข่ดาวพิเศษราดข้าวร้อนๆ ใส่พริกเยอะมากๆ", [item("ข้าวสวย", 240, 4, 52, 0.5, 150, "กรัม"), item("กะเพราหมูสับ", 260, 18, 6, 18, 1, "จาน"), item("ไข่ดาว", 130, 6, 0.5, 11, 1, "ฟอง")], 3, "p2"),
  e("4", "lunch", "ส้มตำไทย", [item("ส้มตำ", 110, 3, 20, 2, 1, "จาน")], 4),
  e("5", "dinner", "ต้มยำกุ้งน้ำข้น", [item("ต้มยำกุ้ง", 280, 24, 10, 15, 1, "ถ้วย")], 5),
  e("6", "dinner", "ข้าวสวย", [item("ข้าวสวย", 200, 4, 44, 0.4, 130, "กรัม", false)], 6),
  e("7", "snack", "กล้วยหอม", [item("กล้วยหอม", 90, 1, 23, 0.3, 1, "ผล", false)], 7),
  e("8", "snack", "โยเกิร์ตกรีก", [item("โยเกิร์ต", 100, 10, 6, 3, 1, "ถ้วย")], 8),
];
const out = process.argv[2] || ".";
mkdirSync(out, { recursive: true });
const cases: [string, CardInput][] = [
  ["empty", base([], { water: { glasses: 0, goal: 8 }, weightKg: null })],
  ["one-meal", base([many[2]])],
  ["many-meals", base(many)],
];
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
for (const [name, inp] of cases) {
  const card = layoutShareCard(inp, measure);
  const f = `${out}/share-card-${name}`;
  writeFileSync(f + ".svg", svg(card.w, card.h, card.cmds));
  try {
    execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--screenshot=${f}.png`, `--window-size=${card.w},${card.h}`, `file://${f}.svg`], { stdio: "ignore" });
    console.log(`${f}.png  ${card.w}x${card.h}`);
  } catch {
    console.log(`${f}.svg written (Chrome PNG step failed)  ${card.w}x${card.h}`);
  }
}
