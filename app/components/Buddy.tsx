"use client";
// "My buddy": the little character at the top of Today, and the dress-up sheet ("แต่งตัวของฉัน").

import { useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import {
  BUDDY_VIEWBOX,
  COLORS,
  DEFAULT_BUDDY,
  EXTRAS,
  HEADS,
  LIBRARY,
  SHAPES,
  buddySvg,
  partsOf,
  type BuddyConfig,
  type BuddyExtra,
  type Name,
} from "../lib/buddy/parts";
import { KIND_LABELS, ZONES, partSvg, type Part, type PartKind } from "../lib/buddy/elements";

/** Just one face part, zoomed into its area (her wish: choice buttons show only the part). */
export function PartPicture({ part, kind, size }: { part: Pick<Part, "items">; kind: PartKind; size: number }) {
  const z = ZONES[kind];
  return (
    <svg
      viewBox={`${z.x} ${z.y} ${z.w} ${z.h}`}
      width={size}
      height={Math.round((size * z.h) / z.w)}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: partSvg(part) }}
    />
  );
}

/** The drawing. Safe to inject: buddySvg only ever uses our own parts, never saved text. */
export function BuddyPicture({ buddy, size, className = "" }: { buddy: BuddyConfig; size: number; className?: string }) {
  return (
    <svg
      viewBox={BUDDY_VIEWBOX}
      width={size}
      height={size}
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: buddySvg(buddy) }}
    />
  );
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-testid={testId}
      className={`min-h-[40px] rounded-full border px-4 text-[15px] ${on ? "border-ink bg-yellow font-semibold" : "border-line bg-paper"}`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-1 pb-2 text-[14px] text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Dress-up sheet. Changes show live in the big preview; nothing is saved until "Save". */
export function BuddyMaker({
  open,
  start,
  onClose,
  onSave,
}: {
  open: boolean;
  start: BuddyConfig | null;
  onClose: () => void;
  onSave: (b: BuddyConfig) => string | null;
}) {
  const { tr, lang } = useLang();
  const [draft, setDraft] = useState<BuddyConfig>(start ?? DEFAULT_BUDDY);
  const [error, setError] = useState<string | null>(null);
  const name = (n: Name) => n[lang];
  const set = <K extends keyof BuddyConfig>(key: K, v: BuddyConfig[K]) => setDraft((d) => ({ ...d, [key]: v }));
  const toggle = (x: BuddyExtra) =>
    setDraft((d) => ({ ...d, extras: d.extras.includes(x) ? d.extras.filter((e) => e !== x) : [...d.extras, x] }));

  /** Only the parts Yani switched on in her studio. The buddy's own color sits behind, so it looks like her face. */
  function partChoices(kind: PartKind) {
    const list = partsOf(LIBRARY, kind, true);
    const optional = kind === "brows" || kind === "nose";
    return (
      <>
        {optional && (
          <Chip on={draft[kind] === "none"} onClick={() => set(kind, "none")} testId={`buddy-${kind}-none`}>
            {tr("ไม่มี", "None")}
          </Chip>
        )}
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => set(kind, p.id)}
            aria-pressed={draft[kind] === p.id}
            aria-label={name(p.name) || p.name.th}
            title={name(p.name) || p.name.th}
            data-testid={`buddy-${kind}-${p.id}`}
            className={`flex h-12 w-[68px] items-center justify-center overflow-hidden rounded-2xl border ${draft[kind] === p.id ? "border-ink outline-2 outline-offset-1 outline-ink" : "border-line"}`}
            style={{ background: draft.color }}
          >
            <PartPicture part={p} kind={kind} size={60} />
          </button>
        ))}
      </>
    );
  }

  function choices<T extends string>(table: Record<T, Name>, key: "shape" | "head") {
    return (Object.keys(table) as T[]).map((v) => (
      <Chip key={v} on={draft[key] === v} onClick={() => set(key, v as never)} testId={`buddy-${key}-${v}`}>
        {name(table[v])}
      </Chip>
    ));
  }

  return (
    <Sheet open={open} onClose={onClose} title={tr("แต่งตัวของฉัน", "My buddy")}>
      <div className="space-y-5 pb-4" data-testid="buddy-maker">
        {/* Stays at the top while she scrolls the choices, so every change is visible. */}
        <div className="sticky top-0 z-10 -mx-1 flex justify-center rounded-[20px] bg-cream py-3 shadow-[0_8px_12px_-10px_rgba(0,0,0,0.15)]">
          <BuddyPicture buddy={draft} size={140} />
        </div>

        <Row label={tr("รูปร่าง", "Shape")}>{choices(SHAPES, "shape")}</Row>

        <Row label={tr("สี", "Color")}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              aria-pressed={draft.color === c}
              aria-label={c}
              data-testid={`buddy-color-${c.slice(1)}`}
              className={`h-10 w-10 rounded-full border border-line ${draft.color === c ? "outline-2 outline-offset-2 outline-ink" : ""}`}
              style={{ background: c }}
            />
          ))}
        </Row>

        {(["eyes", "brows", "nose", "mouth"] as const).map((kind) =>
          kind !== "eyes" && kind !== "mouth" && partsOf(LIBRARY, kind, true).length === 0 ? null : (
            <Row key={kind} label={name(KIND_LABELS[kind])}>
              {partChoices(kind)}
            </Row>
          ),
        )}
        <Row label={tr("บนหัว (เลือก 1 อย่าง)", "On the head (pick 1)")}>{choices(HEADS, "head")}</Row>

        <Row label={tr("ของแต่งอื่นๆ (เลือกได้หลายอัน)", "Other extras (pick any)")}>
          {(Object.keys(EXTRAS) as BuddyExtra[]).map((x) => (
            <Chip key={x} on={draft.extras.includes(x)} onClick={() => toggle(x)} testId={`buddy-extra-${x}`}>
              {name(EXTRAS[x])}
            </Chip>
          ))}
        </Row>

        {error && (
          <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
            {tr("บันทึกไม่สำเร็จ", "Couldn't save")}: {error}
          </p>
        )}

        <button
          className="btn-primary w-full"
          data-testid="buddy-save"
          onClick={() => {
            const err = onSave(draft);
            if (err) setError(err);
            else onClose();
          }}
        >
          {tr("บันทึก", "Save")}
        </button>
      </div>
    </Sheet>
  );
}
