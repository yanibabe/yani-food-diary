"use client";
import { useEffect, useState } from "react";
import { fmtG, fmtKcal } from "../lib/nutrition";
import { getPhoto } from "../lib/photos";
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
      <button className="absolute inset-0 bg-ink/30" aria-label="ปิด" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-paper px-5 pt-3 safe-bottom shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[20px] font-semibold">{title}</h2>
            <button onClick={onClose} className="h-10 w-10 rounded-full bg-cream text-[20px] text-muted" aria-label="ปิด">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function MacroCards({ m, targets }: { m: Macros; targets?: { protein: number; carbs: number; fat: number } }) {
  const cards = [
    { key: "protein", label: "โปรตีน", value: m.protein, target: targets?.protein, bg: "bg-protein", ink: "text-protein-ink" },
    { key: "carbs", label: "คาร์บ", value: m.carbs, target: targets?.carbs, bg: "bg-carbs", ink: "text-carbs-ink" },
    { key: "fat", label: "ไขมัน", value: m.fat, target: targets?.fat, bg: "bg-fat", ink: "text-fat-ink" },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map((c) => (
        <div key={c.key} className={`${c.bg} rounded-[20px] px-3 py-3`} data-testid={`macro-${c.key}`}>
          <div className={`text-[14px] font-medium ${c.ink}`}>{c.label}</div>
          <div className={`num mt-1 text-[26px] font-bold leading-none ${c.ink}`}>
            {fmtG(c.value)}
            <span className="ml-0.5 text-[14px] font-semibold">g</span>
          </div>
          {c.target != null && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
                <div
                  className={`h-full rounded-full ${c.ink.replace("text-", "bg-")}`}
                  style={{ width: `${Math.min(100, (c.value / Math.max(1, c.target)) * 100)}%`, opacity: 0.7 }}
                />
              </div>
              <div className={`mt-1 text-[12px] ${c.ink} opacity-80`}>จาก {Math.round(c.target)} g</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function KcalBig({ kcal, label = "แคลอรีรวม" }: { kcal: number; label?: string }) {
  return (
    <div className="text-center">
      <div className="text-[14px] text-muted">{label}</div>
      <div className="num text-[56px] font-bold leading-none" data-testid="total-kcal">
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
