// Phase 2A: text contrast (WCAG AA), tap-area helper, and the "back to today" action.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} not found`);
  return m![1];
};
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Every surface text can sit on: the page, the three soft background clouds, paper, white, and the tinted tiles.
const SURFACES = ["#f4efe7", "#f3d9c8", "#e3e0f2", "#e6eedd", "#fbf8f4", "#ffffff", "#efe6da", "#f6e3d6", "#f7e6dc", "#e9e6f5", "#e5ecdc", "#f6e7d6", "#e6eef7"];

test("secondary and accent text colours reach 4.5:1 (WCAG AA) on every surface", () => {
  for (const name of ["muted", "calm-muted", "protein-ink", "carbs-ink", "fat-ink", "water-ink", "warn-ink", "danger", "ink"]) {
    const c = token(name);
    for (const bg of SURFACES) assert.ok(ratio(c, bg) >= 4.5, `--${name} ${c} on ${bg} is ${ratio(c, bg).toFixed(2)}:1`);
  }
});

test("the over-target colour (ring and bars) reaches 3:1 against the page and white", () => {
  const c = token("over");
  for (const bg of ["#f4efe7", "#ffffff", "#fbf8f4"]) assert.ok(ratio(c, bg) >= 3, `--over on ${bg} is ${ratio(c, bg).toFixed(2)}:1`);
});

test("the muted token is the same in the base and calm themes", () => {
  assert.equal(token("muted"), token("calm-muted"));
});

test("a .hit44 helper gives a 44×44 px tap area without changing the visible size", () => {
  const rule = css.slice(css.indexOf(".hit44::after"), css.indexOf("}", css.indexOf(".hit44::after")));
  assert.match(rule, /min-width:\s*44px/);
  assert.match(rule, /min-height:\s*44px/);
  assert.match(rule, /position:\s*absolute/);
});

test("small icon buttons use the helper (sheet close, water +, water goal ±, search clear, weight range)", () => {
  const files: [string, number][] = [
    ["../app/components/ui.tsx", 1],
    ["../app/components/HomeTiles.tsx", 1],
    ["../app/components/WaterCard.tsx", 2],
    ["../app/components/WeightCard.tsx", 1],
    ["../app/page.tsx", 1],
  ];
  for (const [f, n] of files) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok((src.match(/\bhit44\b/g) ?? []).length >= n, `${f} should use hit44 ${n}×`);
  }
});

test("no tap target in the touched files is set below 44px any more (Meal Review is untouched on purpose)", () => {
  for (const f of ["UsdaPicker", "AddIngredientSheet", "IngredientScan", "CustomIngredientList"]) {
    const src = readFileSync(new URL(`../app/components/${f}.tsx`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /min-h-\[(3[0-9]|40)px\]/, `${f}.tsx still has a sub-44px minimum height`);
  }
  const edit = readFileSync(new URL("../app/recipes/[id]/edit/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(edit, /min-h-\[(3[0-9]|40)px\]/);
});

test("Back to today: shown only when looking at another day, one tap, Thai and English", () => {
  assert.match(page, /date !== today && \(/);
  assert.match(page, /data-testid="back-to-today"/);
  assert.match(page, /onClick=\{\(\) => go\(today\)\}/);
  assert.ok(page.includes("กลับมาวันนี้") && page.includes("Back to today"));
  assert.match(page, /const go = \(d: string\) => router\.replace\(d === today \? "\/" : /); // today goes to "/" (no ?date=)
});
