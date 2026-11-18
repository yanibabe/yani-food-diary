"use client";
// Round 73: the small "Nutrient jar" card on Today. A tiny still picture of the jar (plain canvas, no physics library)
// and the % bar. Tap it and the full jar opens as a layer.

import { useEffect, useRef } from "react";
import { useLang } from "../lib/lang";
import { JAR_COLORS, JAR_MACROS, JAR_SHAPES, JAR_BASE_UNIT, percentBar, pickUnit, piecesFor, totalGrams, type JarGrams, type JarMacro } from "../lib/jar";
import { drawJarShape } from "../lib/jarShapes";
import { Icon } from "./Icon";

const BOX = 84; // the mini jar, in CSS pixels
const MAX_SHOWN = 26;

/** Which shapes to show in the mini jar: about MAX_SHOWN pieces, split like the real pieces, in a fixed pleasant order. */
function miniPieces(g: JarGrams): JarMacro[] {
  const unit = pickUnit(g, JAR_BASE_UNIT.day);
  const n = piecesFor(g, unit);
  const total = n.p + n.c + n.f;
  if (!total) return [];
  const scale = total > MAX_SHOWN ? MAX_SHOWN / total : 1;
  const list: JarMacro[] = [];
  const counts = JAR_MACROS.map((k) => ({ k, c: Math.max(n[k] > 0 ? 1 : 0, Math.round(n[k] * scale)) }));
  // Mix them (round robin) so no color sits in one block.
  let left = counts.reduce((a, x) => a + x.c, 0);
  while (left > 0) {
    for (const x of counts) {
      if (x.c > 0) {
        list.push(x.k);
        x.c--;
        left--;
      }
    }
  }
  return list;
}

function MiniJar({ grams }: { grams: JarGrams }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = BOX * dpr;
    cv.height = BOX * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, BOX, BOX);
    const list = miniPieces(grams);
    const r = list.length > 14 ? 8.5 : 10.5;
    const step = r * 2.05;
    const perRow = Math.max(1, Math.floor((BOX - 10) / step));
    const left = (BOX - perRow * step) / 2 + step / 2;
    list.forEach((k, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const odd = row % 2 ? step * 0.25 : -step * 0.25 * (row ? 1 : 0);
      ctx.save();
      ctx.translate(left + col * step + odd, BOX - 6 - r - row * step * 0.88);
      ctx.rotate((((i * 53) % 40) - 20) * (Math.PI / 180));
      drawJarShape(ctx, JAR_SHAPES[k], r * 0.86, JAR_COLORS[k]);
      ctx.restore();
    });
  }, [grams]);
  return <canvas ref={ref} style={{ width: BOX, height: BOX }} aria-hidden />;
}

export function JarCard({ grams, onOpen }: { grams: JarGrams; onOpen: () => void }) {
  const { tr } = useLang();
  const empty = !(totalGrams(grams) > 0);
  const pct = percentBar(grams);
  return (
    <button
      className="card flex w-full items-center gap-3.5 p-3.5 text-left active:scale-[0.99]"
      onClick={onOpen}
      data-testid="jar-card"
      aria-label={tr("โหลสารอาหาร เปิดดู", "Nutrient jar, open")}
    >
      <span className="jar-glass relative block shrink-0 overflow-hidden" style={{ width: BOX, height: BOX, borderRadius: "22px 22px 28px 28px" }}>
        <MiniJar grams={grams} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[18px] font-medium">{tr("โหลสารอาหาร", "Nutrient jar")}</span>
          <Icon name="caret-right" className="h-4 w-4 shrink-0 text-muted" />
        </span>
        {empty ? (
          <span className="mt-1 block text-[14px] leading-snug text-muted" data-testid="jar-card-empty">
            {tr("ยังไม่มีอะไรในโหล บันทึกมื้อแรกเลย", "Nothing in the jar yet. Log your first meal")}
          </span>
        ) : (
          <span className="mt-2 flex h-6 overflow-hidden rounded-full bg-white" data-testid="jar-card-bar">
            {JAR_MACROS.map((k) => (
              <span
                key={k}
                className="flex items-center justify-center text-[11.5px] font-semibold text-ink"
                style={{ width: `${pct[k]}%`, background: JAR_COLORS[k] }}
              >
                {pct[k] >= 9 ? `${pct[k]}%` : ""}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}
