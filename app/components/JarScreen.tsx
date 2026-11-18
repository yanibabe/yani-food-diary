"use client";
// Round 73: the full nutrient jar, a full-screen layer on Today. Loaded only when she opens it (next/dynamic), and the
// physics library (matter-js) is loaded only from here (dynamic import), so Today stays light.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
import { shortDayLabel } from "../lib/date";
import {
  JAR_BASE_UNIT,
  JAR_COLORS,
  JAR_KCAL_PER_G,
  JAR_MACROS,
  JAR_NAMES,
  JAR_SEEN_KEY,
  dayGrams,
  diffPieces,
  parseSeen,
  percentBar,
  pickUnit,
  pourPlan,
  serializeSeen,
  totalGrams,
  totalPieces,
  piecesFor,
  weekGrams,
  weekRange,
  type JarMacro,
  type JarMode,
} from "../lib/jar";
import type { JarController } from "../lib/jarPhysics";
import { Icon } from "./Icon";
import { JarShapeIcon } from "./JarShapeIcon";

const SHAKE_LIMIT = 14; // m/s² of phone movement that counts as a shake
const SHAKE_GAP_MS = 500;

type MotionCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

export default function JarScreen({ date, today, onBack }: { date: string; today: string; onBack: () => void }) {
  const { tr, lang } = useLang();
  const { entries } = useStore();
  const [mode, setMode] = useState<JarMode>("day");
  const [sel, setSel] = useState<JarMacro | null>(null);
  const [pourKey, setPourKey] = useState(0);
  const [ctlReady, setCtlReady] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const ctlRef = useRef<JarController | null>(null);
  const motionRef = useRef<{ on: boolean; fn: ((e: DeviceMotionEvent) => void) | null }>({ on: false, fn: null });
  const firstPour = useRef(true);

  const data = useMemo(() => {
    if (mode === "day") {
      const grams = dayGrams(entries, date);
      return { grams, loggedDays: grams.p + grams.c + grams.f > 0 ? 1 : 0 };
    }
    return weekGrams(entries, date);
  }, [entries, date, mode]);
  const { grams, loggedDays } = data;
  const unit = pickUnit(grams, JAR_BASE_UNIT[mode]);
  const pct = percentBar(grams);
  const empty = !(totalGrams(grams) > 0);
  const range = weekRange(date);

  // Start the physics (only now is matter-js downloaded).
  useEffect(() => {
    let cancelled = false;
    let made: JarController | null = null;
    const mo = motionRef.current;
    import("../lib/jarPhysics").then((m) => {
      if (cancelled || !hostRef.current || !cvRef.current) return;
      made = m.createJar({ host: hostRef.current, canvas: cvRef.current, onSelect: setSel });
      ctlRef.current = made;
      setCtlReady(true);
    });
    return () => {
      cancelled = true;
      made?.destroy();
      ctlRef.current = null;
      if (mo.fn) window.removeEventListener("devicemotion", mo.fn);
      mo.fn = null;
      mo.on = false;
    };
  }, []);

  // Pour when the jar is ready, when she switches Today / This week, or taps "Pour again".
  useEffect(() => {
    const ctl = ctlRef.current;
    if (!ctlReady || !ctl) return;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    let seen = null;
    const isToday = mode === "day" && date === today;
    // Only the first pour after opening knows what she has already seen; later pours drop everything.
    if (isToday && firstPour.current) {
      try {
        seen = parseSeen(localStorage.getItem(JAR_SEEN_KEY));
      } catch {
        seen = null;
      }
    }
    firstPour.current = false;
    const { settled, fresh } = diffPieces(seen, date, grams, unit);
    ctl.pour(pourPlan(settled, fresh), { animate: !reduced });
    if (isToday) {
      try {
        localStorage.setItem(JAR_SEEN_KEY, serializeSeen(date, grams));
      } catch {
        /* just not remembered */
      }
    }
    // grams/unit change only with mode/date/entries; those are the real triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctlReady, mode, pourKey, date, today]);

  const shakeNow = (power = 1) => ctlRef.current?.shake(power);

  const onShakeButton = () => {
    // iOS asks for permission only from a tap, so ask right here, in the same tap.
    const Ctor = typeof DeviceMotionEvent !== "undefined" ? (DeviceMotionEvent as unknown as MotionCtor) : null;
    const ask = Ctor?.requestPermission ? Ctor.requestPermission() : null;
    shakeNow();
    const mo = motionRef.current;
    if (mo.on || typeof DeviceMotionEvent === "undefined") return;
    const start = () => {
      if (mo.on) return;
      let last = 0;
      const fn = (e: DeviceMotionEvent) => {
        const a = e.acceleration;
        const m = Math.hypot(a?.x || 0, a?.y || 0, a?.z || 0);
        const now = performance.now();
        if (m > SHAKE_LIMIT && now - last > SHAKE_GAP_MS) {
          last = now;
          shakeNow(Math.min(1.6, m / 18));
        }
      };
      mo.fn = fn;
      mo.on = true;
      window.addEventListener("devicemotion", fn);
    };
    if (ask) ask.then((p) => p === "granted" && start()).catch(() => {});
    else start();
  };

  const name = (k: JarMacro) => JAR_NAMES[k][lang];
  const g = (n: number) => Math.round(n).toLocaleString("en-US");
  const dayLabel = date === today ? tr("วันนี้", "Today") : tr("วันนั้น", "That day");
  const pieces = piecesFor(grams, unit);
  const selGrams = sel ? grams[sel] : 0;

  return (
    <div className="add-layer fixed inset-0 z-[70] flex flex-col" data-testid="jar-screen">
      <header className="px-5 pb-1 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
        <div className="mx-auto flex max-w-[430px] items-center gap-3">
          <button className="glass grid h-11 w-11 shrink-0 place-items-center !rounded-full" onClick={onBack} aria-label={tr("กลับ", "Back")} data-testid="jar-back">
            <Icon name="caret-left" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-light leading-tight">{tr("โหลสารอาหาร", "Nutrient jar")}</h1>
            <p className="truncate text-[13px] text-muted">
              {mode === "day"
                ? date === today
                  ? tr("สิ่งที่กินวันนี้", "What you ate today")
                  : shortDayLabel(date, today, lang)
                : `${shortDayLabel(range.start, today, lang)} – ${shortDayLabel(range.end, today, lang)}`}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-4">
        <div className="mt-2 flex justify-center">
          <div className="inline-flex rounded-full border border-white/85 bg-white/55 p-[3px]" role="tablist">
            {(["day", "week"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={`rounded-full px-4 py-1.5 text-[14px] ${mode === m ? "bg-ink text-white" : "text-muted"}`}
                onClick={() => mode !== m && setMode(m)}
                data-testid={`jar-mode-${m}`}
              >
                {m === "day" ? dayLabel : tr("สัปดาห์นี้", "This week")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5" data-testid="jar-chips">
          {JAR_MACROS.map((k) => (
            <span key={k} className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/85 bg-white/60 py-1.5 pl-2 pr-3 text-[13px]">
              <JarShapeIcon k={k} />
              {name(k)} <b className="font-semibold">{g(grams[k])} g</b>
            </span>
          ))}
        </div>

        {!empty && (
          <div className="mx-1.5 mt-3 flex h-[30px] overflow-hidden rounded-full bg-white" data-testid="jar-bar">
            {JAR_MACROS.map((k) => (
              <span key={k} className="flex items-center justify-center text-[12.5px] font-semibold text-ink transition-all duration-500" style={{ width: `${pct[k]}%`, background: JAR_COLORS[k] }}>
                {pct[k] >= 6 ? `${pct[k]}%` : ""}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2 text-center text-[13px] text-muted" data-testid="jar-note">
          {tr(`1 ชิ้น = ${unit} กรัม · % = สัดส่วนน้ำหนัก`, `1 piece = ${unit} g · % = share of weight`)}
        </p>

        <div className="mt-2.5 flex justify-center gap-2.5">
          <button className="rounded-full bg-white/75 px-[18px] py-2.5 text-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.05)] active:scale-[0.97]" onClick={onShakeButton} data-testid="jar-shake">
            {tr("เขย่าโหล", "Shake the jar")}
          </button>
          <button className="rounded-full bg-ink px-[18px] py-2.5 text-[15px] text-white active:scale-[0.97]" onClick={() => setPourKey((k) => k + 1)} data-testid="jar-repour">
            {tr("เทใหม่", "Pour again")}
          </button>
        </div>

        <div className="relative mb-[calc(env(safe-area-inset-bottom,0px)+14px)] mt-3.5 min-h-0 flex-1">
          <div ref={hostRef} className="jar-glass absolute inset-0 overflow-hidden" style={{ borderRadius: "34px 34px 44px 44px" }} data-testid="jar-host">
            <canvas ref={cvRef} className="absolute inset-0 h-full w-full" style={{ touchAction: "none" }} aria-label={tr(`${totalPieces(pieces)} ชิ้นในโหล`, `${totalPieces(pieces)} pieces in the jar`)} />
            {empty && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center text-[15px] text-muted" data-testid="jar-empty">
                {tr("ยังไม่มีอะไรในโหล บันทึกมื้อแรกเลย", "Nothing in the jar yet. Log your first meal")}
              </div>
            )}
            <div
              className={`absolute inset-x-3 bottom-3 z-[5] flex items-center gap-3 rounded-[24px] bg-white/90 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md transition-transform duration-300 ${sel ? "translate-y-0" : "translate-y-[140%]"}`}
              aria-hidden={!sel}
              data-testid="jar-info"
            >
              {sel && (
                <>
                  <JarShapeIcon k={sel} size={36} />
                  <div className="min-w-0 flex-1">
                    <b className="block text-[15.5px] font-medium">
                      {name(sel)} {mode === "week" ? tr("ทั้งสัปดาห์", "this week") : dayLabel} {g(selGrams)} g
                    </b>
                    <span className="text-[12.5px] text-muted">
                      {mode === "week"
                        ? tr(`เฉลี่ยวันละ ${g(selGrams / Math.max(1, loggedDays))} g · 1 ชิ้น = ${unit} g`, `Average ${g(selGrams / Math.max(1, loggedDays))} g a day · 1 piece = ${unit} g`)
                        : tr(`1 ชิ้น = ${unit} g`, `1 piece = ${unit} g`)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-[20px] font-light leading-none">
                    {g(selGrams * JAR_KCAL_PER_G[sel])} <small className="text-[11px] text-muted">kcal</small>
                  </div>
                  <button
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f1ece6] text-muted"
                    onClick={() => {
                      ctlRef.current?.clearSelection();
                      setSel(null);
                    }}
                    aria-label={tr("ปิด", "Close")}
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
