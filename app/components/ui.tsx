"use client";
import { useEffect, useState } from "react";
import { fmtG, fmtKcal } from "../lib/nutrition";
import { useLang } from "../lib/lang";
import { getPhoto } from "../lib/photos";
import { macroSplit } from "../lib/macroSplit";
import { macroTip } from "../lib/macroTip";
import type { Macros } from "../lib/types";

/** Bottom sheet that slides up over the page. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { tr } = useLang();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/30" aria-label={tr("ปิด", "Close")} onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-[560px] overflow-y-auto sheet rounded-t-[28px] px-5 pt-3 safe-bottom shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-medium">{title}</h2>
            <button onClick={onClose} className="h-10 w-10 rounded-full bg-white/70 text-[20px] text-muted" aria-label={tr("ปิด", "Close")}>
              ×
            </button>
          </div>
        )}
        {children}
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
