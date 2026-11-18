"use client";
// Round 74: three small daily goal jars (protein / carbs / fat) on the Today kcal card.
// Protein: one dashed goal line. Carbs and fat: a soft "good range" band. matter-js loads after the first paint.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../lib/lang";
import { JAR_MACROS, JAR_NAMES, type JarGrams, type JarMacro } from "../lib/jar";
import {
  DAILY_SEEN_KEY,
  dailyJarConfig,
  dailyPieces,
  dailyStatus,
  parseDailySeen,
  serializeDailySeen,
  settledCount,
  statusText,
  statusTone,
  targetLine,
} from "../lib/dailyJars";
import type { DailyJarController } from "../lib/jarPhysics";
import { JarShapeIcon } from "./JarShapeIcon";

const JAR_H = 156;

function readSeen() {
  try {
    return parseDailySeen(localStorage.getItem(DAILY_SEEN_KEY));
  } catch {
    return null;
  }
}

export function DailyJars({
  grams,
  kcalTarget,
  proteinTarget,
  date,
  today,
}: {
  grams: JarGrams;
  kcalTarget: number;
  proteinTarget: number;
  date: string;
  today: string;
}) {
  const { tr, lang } = useLang();
  const cfg = useMemo(() => dailyJarConfig(kcalTarget, proteinTarget), [kcalTarget, proteinTarget]);
  const pieces = { p: dailyPieces(grams.p, cfg.p.full), c: dailyPieces(grams.c, cfg.c.full), f: dailyPieces(grams.f, cfg.f.full) };
  const piecesKey = `${pieces.p}/${pieces.c}/${pieces.f}`;
  const cfgKey = JAR_MACROS.map((k) => `${cfg[k].full}`).join("/");

  const canvases = useRef<Partial<Record<JarMacro, HTMLCanvasElement | null>>>({});
  const firstCol = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const ctls = useRef<Partial<Record<JarMacro, DailyJarController>>>({});
  const latest = useRef({ pieces, date, today });
  const applied = useRef<{ date: string } | null>(null);

  // Keep what apply() needs fresh (written in an effect, never during render).
  useEffect(() => {
    latest.current = { pieces, date, today };
  });

  useEffect(() => {
    const el = firstCol.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function apply(first: boolean) {
    const { pieces: n, date: d, today: t } = latest.current;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = d === t && !reduced;
    const reset = first || applied.current?.date !== d;
    const seen = reset ? readSeen() : null;
    for (const k of JAR_MACROS) {
      const ctl = ctls.current[k];
      if (!ctl) continue;
      // First view: pieces she already saw today settle at once. Later changes: only the new ones drop.
      const settled = reset ? settledCount(seen, d, k, n[k], animate) : 0;
      ctl.set(n[k], settled, animate, reset);
    }
    applied.current = { date: d };
    if (d === t) {
      try {
        localStorage.setItem(DAILY_SEEN_KEY, serializeDailySeen(d, n));
      } catch {
        /* private mode: no memory, still fine */
      }
    }
  }

  // Build the three jars (matter-js is downloaded here, after the first paint).
  useEffect(() => {
    if (width < 40) return;
    let dead = false;
    import("../lib/jarPhysics").then((m) => {
      if (dead) return;
      for (const k of JAR_MACROS) {
        const cv = canvases.current[k];
        if (!cv) continue;
        const c = cfg[k];
        ctls.current[k] = m.createDailyJar({ canvas: cv, k, guide: { full: c.full, goal: c.goal, range: c.range } });
      }
      applied.current = null;
      apply(true);
    });
    return () => {
      dead = true;
      for (const k of JAR_MACROS) ctls.current[k]?.destroy();
      ctls.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, cfgKey]);

  // New meals / another day.
  useEffect(() => {
    if (Object.keys(ctls.current).length > 0) apply(false);
  }, [piecesKey, date]);

  return (
    <div data-testid="daily-jars">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="text-[14px]">{tr("สารอาหารวันนี้", "Nutrients today")}</span>
        <span className="text-[12px] text-muted">{tr("เส้น = เป้า · แถบ = ช่วงที่ดี", "Line = goal · band = good range")}</span>
      </div>
      <div className="flex gap-2">
        {JAR_MACROS.map((k, i) => {
          const g = Math.round(grams[k]);
          const st = dailyStatus(k, grams[k], cfg[k]);
          const tone = statusTone(st);
          return (
            <div key={k} ref={i === 0 ? firstCol : undefined} className="min-w-0 flex-1 text-center" data-testid={`jar-${k}`}>
              <div className="daily-jar relative w-full overflow-hidden" style={{ height: JAR_H }}>
                <canvas
                  ref={(el) => {
                    canvases.current[k] = el;
                  }}
                  className="absolute inset-0 block h-full w-full"
                  aria-hidden
                />
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[13.5px]">
                <JarShapeIcon k={k} size={16} />
                {tr(JAR_NAMES[k].th, JAR_NAMES[k].en)}
              </div>
              <div className="num mt-0.5 text-[22px] font-light leading-tight" data-testid={`jar-grams-${k}`}>
                {g}
                <span className="ml-0.5 text-[12px] text-muted">g</span>
              </div>
              <div className="text-[11.5px] text-muted">{targetLine(k, cfg[k], lang === "en" ? "en" : "th")}</div>
              <div
                className="mt-0.5 min-h-[18px] text-[12px]"
                style={{ color: tone === "ok" ? "#3f7fa6" : tone === "over" ? "#c86f00" : "var(--muted, #9a918a)", fontWeight: tone === "ok" ? 500 : 400 }}
                data-testid={`jar-status-${k}`}
              >
                {statusText(st, lang === "en" ? "en" : "th")}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[12px] leading-snug text-muted">
        {tr("ดูแคลอรี่รวมก่อน · โปรตีนเติมให้ถึงเส้น", "Look at total calories first · fill protein up to the line")}
        <br />
        {tr("คาร์บกับไขมันอยู่ในแถบก็ดีแล้ว", "Carbs and fat inside the band is good enough")}
      </p>
    </div>
  );
}
