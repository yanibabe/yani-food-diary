// Round 74 preview helper (not part of the app): draws the weekly share card as SVG, then PNG with headless Chrome.
// Run: node scripts/render-share-week.ts <out-file.png>
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { layoutShareWeek, WEEK_COLORS, type WeekCmd } from "../app/lib/shareWeek.ts";
import { settleWeekCard } from "../app/lib/shareWeekJar.ts";
import { JAR_COLORS, type JarMacro } from "../app/lib/jar.ts";
import type { Measure } from "../app/lib/shareCard.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

const measure: Measure = (t, size, weight) =>
  Array.from(t).reduce((a, ch) => a + (/[฀-๿]/.test(ch) ? 0.5 : /[0-9]/.test(ch) ? 0.55 : 0.52) * size * (weight >= 400 ? 1.03 : 1), 0);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const FAM = "Thonburi, 'Helvetica Neue', sans-serif";

/** The three shapes as SVG, same maths as app/lib/jarShapes.ts. */
function shapeSvg(k: JarMacro, r: number, tf: string): string {
  const col = JAR_COLORS[k];
  if (k === "p") {
    const q = r * 1.05;
    return `<path transform="${tf}" fill="${col}" d="M0 ${q * 0.85} C${-q * 1.1} ${q * 0.1} ${-q * 0.85} ${-q * 0.9} 0 ${-q * 0.4} C${q * 0.85} ${-q * 0.9} ${q * 1.1} ${q * 0.1} 0 ${q * 0.85}Z"/>`;
  }
  if (k === "c") {
    const parts = [[-0.42, 0.12, 0.5], [0.42, 0.12, 0.5], [0, -0.25, 0.58], [0, 0.3, 0.5]];
    return `<g transform="${tf}" fill="${col}">${parts.map(([a, b, c]) => `<circle cx="${a * r}" cy="${b * r}" r="${c * r}"/>`).join("")}</g>`;
  }
  return `<circle transform="${tf}" r="${r}" fill="${col}"/>`;
}

function svg(w: number, h: number, cmds: WeekCmd[]): string {
  const o: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<defs>${[[0, 0, "246,220,205"], [1, 0.5, "228,222,243"], [0, 1, "223,232,218"]]
      .map(([x, y, c], i) => `<radialGradient id="g${i}" gradientUnits="userSpaceOnUse" cx="${Number(x) * w}" cy="${Number(y) * h}" r="${0.8 * Math.max(w, h * 0.6)}"><stop offset="0" stop-color="rgb(${c})"/><stop offset="0.7" stop-color="rgb(${c})" stop-opacity="0"/></radialGradient>`).join("")}</defs>`,
    `<rect width="${w}" height="${h}" fill="${WEEK_COLORS.bg}"/>`,
    `<rect width="${w}" height="${h}" fill="url(#g0)"/><rect width="${w}" height="${h}" fill="url(#g1)"/><rect width="${w}" height="${h}" fill="url(#g2)"/>`,
  ];
  let clip = 0;
  for (const c of cmds) {
    if (c.t === "rect") o.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="${c.fill}"/>`);
    else if (c.t === "text") o.push(`<text x="${c.x}" y="${c.y}" font-family="${FAM}" font-size="${c.size}" font-weight="${c.weight}" fill="${c.color}" text-anchor="${c.align === "left" ? "start" : c.align === "center" ? "middle" : "end"}"${c.spacing ? ` letter-spacing="${c.spacing}"` : ""}>${esc(c.s)}</text>`);
    else if (c.t === "shape") o.push(shapeSvg(c.k, c.r, `translate(${c.x} ${c.y})`));
    else if (c.t === "jar") {
      o.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="${WEEK_COLORS.jar}" stroke="#fff" stroke-width="4.5"/>`);
      for (const p of c.placed ?? []) o.push(shapeSvg(p.k, c.pieceR, `translate(${c.x + p.x} ${c.y + p.y}) rotate(${(p.a * 180) / Math.PI})`));
    } else if (c.t === "segbar") {
      const id = `cl${clip++}`;
      o.push(`<clipPath id="${id}"><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.h / 2}"/></clipPath><g clip-path="url(#${id})"><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${WEEK_COLORS.track}"/>`);
      let x = c.x;
      for (const p of c.parts) {
        o.push(`<rect x="${x}" y="${c.y}" width="${p.w + 1}" height="${c.h}" fill="${p.color}"/>`);
        if (p.w > 90) o.push(`<text x="${x + p.w / 2}" y="${c.y + c.h / 2 + 12}" font-family="${FAM}" font-size="36" font-weight="600" fill="${WEEK_COLORS.ink}" text-anchor="middle">${esc(p.label)}</text>`);
        x += p.w;
      }
      o.push("</g>");
    }
  }
  return o.join("\n") + "</svg>";
}

const item = (name: string, kcal: number, p: number, c: number, f: number): FoodItem => ({ id: name, name, amount: 1, unit: "จาน", kcal, protein: p, carbs: c, fat: f, estimated: true, kind: "food", note: null, box: null });
const meal = (date: string, slot: Entry["slot"], i: number, it: FoodItem): Entry => ({ id: `${date}${slot}${i}`, date, slot, title: it.name, items: [it], source: "manual", photoId: null, recipe: null, createdAt: i, updatedAt: i });
// Sample week 16-22 Nov 2026, Thursday not logged (same story as the approved mock-up).
const sample: Entry[] = [
  ["2026-11-16", 1450], ["2026-11-17", 1620], ["2026-11-18", 1380], ["2026-11-20", 1700], ["2026-11-21", 1510], ["2026-11-22", 1580],
].flatMap(([d, k], i) => {
  const kcal = Number(k);
  return [
    meal(String(d), "breakfast", i * 3, item("โจ๊กหมู", kcal * 0.25, 18 + (i % 3) * 3, 40, 8)),
    meal(String(d), "lunch", i * 3 + 1, item("ข้าวกะเพราไก่", kcal * 0.4, 28 + (i % 2) * 6, 78, 20)),
    meal(String(d), "dinner", i * 3 + 2, item("ต้มยำ", kcal * 0.35, 25, 65 + (i % 4) * 5, 12)),
  ];
});

const out = process.argv[2] || "docs/mockups/share-week-sample.png";
mkdirSync(dirname(out), { recursive: true });
const card = await settleWeekCard(layoutShareWeek({ entries: sample, date: "2026-11-18", target: 1600, proteinTarget: 81, lang: "th" }, measure));
const f = resolve(out.replace(/\.png$/, ""));
writeFileSync(f + ".svg", svg(card.w, card.h, card.cmds));
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
try {
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--screenshot=${f}.png`, `--window-size=${card.w},${card.h}`, `file://${f}.svg`], { stdio: "ignore" });
  console.log(`${f}.png  ${card.w}x${card.h}  pieces=${card.jar.order.length} unit=${card.unit}g`);
} catch {
  console.log(`${f}.svg written (Chrome PNG step failed)  ${card.w}x${card.h}`);
}
