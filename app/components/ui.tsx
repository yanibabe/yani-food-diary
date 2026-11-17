"use client";
import { useEffect, useState } from "react";
import { energyCheck, fmtG, fmtKcal } from "../lib/nutrition";
import { useLang } from "../lib/lang";
import { getPhoto } from "../lib/photos";
import { macroSplit } from "../lib/macroSplit";
import { macroTip } from "../lib/macroTip";
import { sourceLabel } from "../lib/provenance";
import type { MacroKey, Macros, Provenance } from "../lib/types";
import { Icon } from "./Icon";

/** Bottom sheet that slides up over the page. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  keyboardSafe = false,
  header,
  leaving = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** For sheets with a typing box: fixed height inside the part of the screen NOT covered by the phone keyboard. */
  keyboardSafe?: boolean;
  /** Round 49: stays fixed at the top, under the title (e.g. a search box). Only `children` scroll, in their own area below it. */
  header?: React.ReactNode;
  /** Round 50: the sheet is on its way out to another page — it softens a little (still open, still tappable-safe). */
  leaving?: boolean;
}) {
  const { tr } = useLang();
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!open || !keyboardSafe) return;
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setVv({ top: v.offsetTop, height: v.height });
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
      setVv(null);
    };
  }, [open, keyboardSafe]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-x-0 z-50 flex items-end justify-center"
      style={keyboardSafe && vv ? { top: vv.top, height: vv.height } : { top: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button className="absolute inset-0 bg-ink/30" aria-label={tr("ปิด", "Close")} onClick={onClose} />
      <div
        className={`relative flex w-full max-w-[560px] flex-col overflow-hidden sheet rounded-t-[28px] shadow-2xl ${leaving ? "sheet-leaving" : ""} ${keyboardSafe ? "h-[92%]" : "max-h-[88dvh]"}`}
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-medium">{title}</h2>
              <button onClick={onClose} className="h-10 w-10 rounded-full bg-white/70 text-[20px] text-muted grid place-items-center" aria-label={tr("ปิด", "Close")}>
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
          )}
          {header && <div className="pb-3" data-testid="sheet-header">{header}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 safe-bottom" data-testid="sheet-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Round 37: a small frosted popup in the middle of the screen while a photo is being read
 * (food photo, barcode photo, label photo), so she always sees what the app is doing.
 * `text` = what is happening now ("กำลังอ่านฉลาก…"). Shown while `text` is not null.
 */
export function WaitPopup({ text, note }: { text: string | null; note?: string }) {
  const { tr } = useLang();
  if (!text) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/25 px-8" role="status" aria-live="polite" data-testid="wait-popup">
      <div className="sheet w-full max-w-[320px] rounded-[26px] border px-6 py-7 text-center shadow-2xl">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-[3px] border-olive-soft border-t-ink" aria-hidden />
        <p className="mt-4 text-[18px]" data-testid="wait-text">{text}</p>
        <p className="mt-1 text-[14px] text-muted">{tr("อาจใช้เวลาสักครู่", "This may take a moment")}</p>
        {note && <p className="mt-4 rounded-2xl bg-warn px-4 py-3 text-[14px] text-warn-ink">{note}</p>}
      </div>
    </div>
  );
}

/** The 3 macro tiles. With showSplit (Today), each tile also shows its share of the calories (always 100% together). */
export function MacroCards({ m, targets, showSplit }: { m: Macros; targets?: { protein: number; carbs: number; fat: number }; showSplit?: boolean }) {
  const { tr } = useLang();
  const split = showSplit ? macroSplit(m) : null;
  const cards = [
    { key: "protein", label: tr("โปรตีน", "Protein"), value: m.protein, target: targets?.protein, dot: "bg-protein-dot" },
    { key: "carbs", label: tr("คาร์บ", "Carbs"), value: m.carbs, target: targets?.carbs, dot: "bg-carbs-dot" },
    { key: "fat", label: tr("ไขมัน", "Fat"), value: m.fat, target: targets?.fat, dot: "bg-fat-dot" },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map((c) => (
        <div key={c.key} className="rounded-[20px] border border-white/90 bg-white/55 px-3 py-3 text-center" data-testid={`macro-${c.key}`}>
          <div className="flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
            {c.label}
          </div>
          <div className="num mt-1 text-[28px] leading-none">
            {fmtG(c.value)}
            <span className="ml-0.5 text-[13px] text-muted">g</span>
          </div>
          {c.target != null && (
            <>
              <div className="mx-auto mt-2 h-1 w-[80%] overflow-hidden rounded-full bg-ink/10">
                <div className={`h-full rounded-full ${c.dot}`} style={{ width: `${Math.min(100, (c.value / Math.max(1, c.target)) * 100)}%` }} />
              </div>
              <div className="mt-1 text-[12px] text-muted">{tr("จาก", "of")} {Math.round(c.target)} g</div>
            </>
          )}
          {showSplit && (
            <div className="num mt-1 text-[15px] leading-none" data-testid={`split-${c.key}`}>
              {split ? `${split[c.key]}%` : "–"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** One short tip under the tiles on Today: the one thing that matters most right now (no AI). */
export function MacroTipLine({ m, targets, kcalTarget }: { m: Macros; targets: { protein: number; carbs: number; fat: number }; kcalTarget: number }) {
  const { lang } = useLang();
  const tip = macroTip(m, targets, kcalTarget);
  if (!tip) return null;
  const dot = { ok: "bg-ink/30", protein: "bg-protein-dot", carbs: "bg-carbs-dot", fat: "bg-fat-dot" }[tip.key];
  return (
    <div className="flex items-start gap-2.5 rounded-[20px] border border-white/90 bg-white/55 px-4 py-3 text-left text-[14px] leading-snug" data-testid="macro-tip" data-tip={tip.key}>
      <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span>{tip[lang === "en" ? "en" : "th"]}</span>
    </div>
  );
}

export function KcalBig({ kcal, label }: { kcal: number; label?: string }) {
  const { tr } = useLang();
  label ??= tr("แคลอรีรวม", "Total calories");
  return (
    <div className="text-center">
      <div className="text-[14px] text-muted">{label}</div>
      <div className="num text-[58px] leading-none" data-testid="total-kcal">
        {fmtKcal(kcal)}
      </div>
      <div className="text-[15px] text-muted">kcal</div>
    </div>
  );
}

/** Shows a photo saved in IndexedDB. */
export function StoredPhoto({ id, className, alt = "" }: { id: string | null; className?: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (id) getPhoto(id).then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, [id]);
  if (!id || !src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

export function useAiStatus() {
  const [s, setS] = useState<{ configured: boolean; mock: boolean; model: string } | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ configured: false, mock: false, model: "" }));
  }, []);
  return s;
}

export function NumberField({
  value,
  onChange,
  step = "any",
  className = "field num",
  ...rest
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  step?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  // Keep the typed text so "0." or "" doesn't jump around while typing.
  const [text, setText] = useState(value == null ? "" : String(Math.round(value * 100) / 100));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    const cur = text === "" ? null : Number(text);
    if (cur !== value) setText(value == null ? "" : String(Math.round(value * 100) / 100));
  }
  return (
    <input
      {...rest}
      className={className}
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        setText(t);
        if (t === "") onChange(null);
        else if (!Number.isNaN(Number(t))) onChange(Number(t));
      }}
    />
  );
}

export function Badge({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "olive" | "muted" }) {
  const cls =
    tone === "warn" ? "bg-warn text-warn-ink" : tone === "olive" ? "bg-olive-soft text-olive-dark" : "bg-cream text-muted";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${cls}`}>{children}</span>;
}

/**
 * Round 39: one small badge that says where the numbers came from (same Badge look as before).
 * Label → olive; estimates → the usual soft yellow; everything else → quiet grey.
 */
export function ProvenanceBadge({ prov }: { prov: Provenance }) {
  const { lang } = useLang();
  const tone = prov.source === "label" ? "olive" : prov.verification === "estimated" ? "warn" : "muted";
  return (
    <span data-testid="prov-badge" data-source={prov.source} data-verification={prov.verification}>
      <Badge tone={tone}>{sourceLabel(prov)[lang]}</Badge>
    </span>
  );
}

/** Round 39: "no data for protein / fat" — missing values are unknown, never a real 0. */
export function MissingNote({ missing, className = "" }: { missing: MacroKey[] | undefined; className?: string }) {
  const { tr } = useLang();
  if (!missing?.length) return null;
  const names: Record<MacroKey, string> = { protein: tr("โปรตีน", "protein"), carbs: tr("คาร์บ", "carbs"), fat: tr("ไขมัน", "fat") };
  const list = missing.map((k) => names[k]).join(tr(" / ", " / "));
  return (
    <p className={`text-[13px] text-muted ${className}`} data-testid="missing-note">
      {tr(`ไม่มีข้อมูล${list}ในบางรายการ — ตัวเลขรวมของ${list}อาจต่ำกว่าจริง`, `No ${list} data for some items — the ${list} total may be too low`)}
    </p>
  );
}

/** Round 39: a gentle hint when kcal and protein/carbs/fat don't fit together (4/4/9). Never changes numbers. */
export function EnergyHint({ m, missing }: { m: Macros; missing?: MacroKey[] }) {
  const { tr } = useLang();
  const c = energyCheck(m, missing);
  if (c.status === "ok" || c.status === "unknown") return null;
  return (
    <p className="text-[12px] text-muted" data-testid="energy-hint" data-status={c.status}>
      {c.status === "high"
        ? tr(
            `แคลอรี่สูงกว่าที่โปรตีน/คาร์บ/ไขมันรวมกันได้ (~${fmtKcal(c.fromMacros)} kcal) — อาจพิมพ์ผิดหรือขาดบางค่า ลองเช็กอีกครั้ง`,
            `Calories are higher than protein/carbs/fat add up to (~${fmtKcal(c.fromMacros)} kcal) — maybe a typo or a missing value. Worth a check.`,
          )
        : tr(
            `แคลอรี่ต่ำกว่าที่โปรตีน/คาร์บ/ไขมันรวมกันได้ (~${fmtKcal(c.fromMacros)} kcal) — ปกติได้ถ้ามีใยอาหารหรือสารให้ความหวานเยอะ แต่ลองเช็กอีกครั้ง`,
            `Calories are lower than protein/carbs/fat add up to (~${fmtKcal(c.fromMacros)} kcal) — normal with lots of fibre or sweeteners, but worth a check.`,
          )}
    </p>
  );
}

/** The recipe "logo": Phosphor Light cooking pot (Round 34; was a hand-drawn pot). */
export function PotIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <Icon name="cooking-pot" className={className} />;
}

/** Soft color tiles for recipe icons, picked from the recipe id so each keeps its color. */
const POT_TONES = ["#f3dccd", "#e6e2f3", "#e2eadb", "#f1e6d4", "#e4ecf3", "#f2dfe0"];
export function potTone(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return POT_TONES[h % POT_TONES.length];
}

export function PotTile({ id, size = 40, radius = 12 }: { id: string; size?: number; radius?: number }) {
  return (
    <div className="grid shrink-0 place-items-center text-ink" style={{ width: size, height: size, borderRadius: radius, background: potTone(id) }}>
      <PotIcon className="h-[58%] w-[58%] opacity-60" />
    </div>
  );
}
