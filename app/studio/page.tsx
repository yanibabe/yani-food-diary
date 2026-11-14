"use client";
// Yani's Parts Studio (/studio). For HER only, on her Mac with `npm run dev`. Not linked from the app.
// She builds face parts (eyes, brows, nose, mouth) from basic elements. Customers only see parts she switches on.

import { useCallback, useEffect, useRef, useState } from "react";
import { BUDDY_VIEWBOX, COLORS, SHAPES, buddySvg, type BuddyConfig, type BuddyShape } from "../lib/buddy/parts";
import {
  CAN_FILL,
  ELEMENT_LABELS,
  ELEMENT_TYPES,
  INK,
  KINDS,
  KIND_LABELS,
  ZONES,
  checkLibrary,
  elSvg,
  newEl,
  type El,
  type ElementType,
  type Library,
  type Part,
  type PartKind,
} from "../lib/buddy/elements";
import { PartPicture } from "../components/Buddy";

export default function StudioPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream p-6 text-center text-muted">
        หน้านี้เปิดได้เฉพาะบน Mac ของผู้สร้างแอปเท่านั้น · Not available here.
      </main>
    );
  }
  return <Studio />;
}

const ELEMENT_COLORS = [INK, "#ffffff", "#F4A6B8", "#ED93B1", "#E86B6B", "#D85A30", "#E38B6B", "#7FB6E8", "#97C459", "#FAC775"];
const round = (n: number, step = 0.5) => Math.round(n / step) * step;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function ElIcon({ type }: { type: ElementType }) {
  const el: El = { type, x: 10, y: type === "half" || type === "curve" || type === "deepCurve" ? 7 : 10, size: 12, rot: 0, thick: 1.6, color: INK, filled: true, mirror: false };
  return <svg viewBox="0 0 20 20" width={26} height={26} aria-hidden dangerouslySetInnerHTML={{ __html: elSvg(el) }} />;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-[13px]">
      <span className="flex justify-between text-muted">
        {label} <span className="tabular-nums text-ink">{value}</span>
      </span>
      <input type="range" className="w-full accent-[#1a1a1a]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Btn({ children, onClick, disabled, tone = "plain", title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "plain" | "dark" | "danger"; title?: string }) {
  const c = tone === "dark" ? "bg-ink text-white border-ink" : tone === "danger" ? "border-[#e8c4bc] text-danger bg-paper" : "border-line bg-paper";
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`min-h-[34px] rounded-full border px-3 text-[13px] disabled:opacity-40 ${c}`}>
      {children}
    </button>
  );
}

function Studio() {
  const [lib, setLib] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState<PartKind>("eyes");
  const [editing, setEditing] = useState<Record<PartKind, string | null>>({ eyes: null, brows: null, nose: null, mouth: null });
  const [sel, setSel] = useState<number | null>(null);
  const [shape, setShape] = useState<BuddyShape>("blob");
  const [color, setColor] = useState<string>("#B5D4F4");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; sx: number; sy: number; ex: number; ey: number } | null>(null);

  useEffect(() => {
    fetch("/api/studio/parts")
      .then(async (r) => {
        const v = checkLibrary(await r.json());
        if (!v.ok) throw new Error(v.error);
        setLib(v.library);
        const first = (k: PartKind) => v.library.parts.find((p) => p.kind === k)?.id ?? null;
        setEditing({ eyes: first("eyes"), brows: null, nose: null, mouth: first("mouth") });
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);

  const editId = editing[kind];
  const part = lib?.parts.find((p) => p.kind === kind && p.id === editId) ?? null;
  const el = part && sel !== null ? (part.items[sel] ?? null) : null;

  const change = useCallback((fn: (l: Library) => Library) => {
    setLib((l) => (l ? fn(l) : l));
    setDirty(true);
    setStatus(null);
  }, []);

  const changePart = useCallback(
    (fn: (p: Part) => Part) => {
      if (!editId) return;
      change((l) => ({ parts: l.parts.map((p) => (p.kind === kind && p.id === editId ? fn(p) : p)) }));
    },
    [change, editId, kind],
  );

  const changeEl = useCallback(
    (patch: Partial<El>) => {
      if (sel === null) return;
      changePart((p) => ({ ...p, items: p.items.map((e, i) => (i === sel ? { ...e, ...patch } : e)) }));
    },
    [changePart, sel],
  );

  function newPart(from?: Part) {
    const id = `${kind}-${Date.now().toString(36)}`;
    const p: Part = from
      ? { ...structuredClone(from), id, name: { th: `${from.name.th} (สำเนา)`.slice(0, 30), en: from.name.en ? `${from.name.en} copy`.slice(0, 30) : "" } }
      : { id, kind, name: { th: "ชิ้นใหม่", en: "" }, visible: false, items: [] };
    change((l) => ({ parts: [...l.parts, p] }));
    setEditing((e) => ({ ...e, [kind]: id }));
    setSel(null);
  }

  function deletePart(p: Part) {
    if (!window.confirm(`ลบ "${p.name.th}" ใช่ไหม? (ลบแล้วกด บันทึก ถึงจะหายจากไฟล์จริง)`)) return;
    change((l) => ({ parts: l.parts.filter((x) => !(x.kind === p.kind && x.id === p.id)) }));
    if (editId === p.id) {
      setEditing((e) => ({ ...e, [kind]: null }));
      setSel(null);
    }
  }

  function addEl(type: ElementType) {
    if (!part) return;
    changePart((p) => ({ ...p, items: [...p.items, newEl(type, kind)] }));
    setSel(part.items.length);
  }

  function moveLayer(dir: -1 | 1) {
    if (sel === null || !part) return;
    const j = sel + dir;
    if (j < 0 || j >= part.items.length) return;
    changePart((p) => {
      const items = [...p.items];
      [items[sel], items[j]] = [items[j], items[sel]];
      return { ...p, items };
    });
    setSel(j);
  }

  function dupEl() {
    if (!el || !part) return;
    changePart((p) => ({ ...p, items: [...p.items, { ...el, x: clamp(el.x + 3, -20, 120), y: clamp(el.y + 3, -20, 120) }] }));
    setSel(part.items.length);
  }

  function delEl() {
    if (sel === null) return;
    changePart((p) => ({ ...p, items: p.items.filter((_, i) => i !== sel) }));
    setSel(null);
  }

  // Arrow keys nudge the chosen element (Shift = bigger steps). Not while typing in a box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (!el || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      const step = e.shiftKey ? 2 : 0.5;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      changeEl({ x: clamp(round(el.x + d[0]), -20, 120), y: clamp(round(el.y + d[1]), -20, 120) });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [el, changeEl]);

  function toFace(e: React.PointerEvent) {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  async function save() {
    if (!lib) return;
    const v = checkLibrary(lib);
    if (!v.ok) return setStatus({ ok: false, text: `บันทึกไม่ได้: ${v.error}` });
    try {
      const r = await fetch("/api/studio/parts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(v.library) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDirty(false);
      setStatus({ ok: true, text: `บันทึกแล้ว ✓ (${j.count} ชิ้น) · พร้อมเมื่อไหร่ บอกว่า "ใส่ลงแอป"` });
    } catch (e) {
      setStatus({ ok: false, text: `บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  if (loadError) return <main className="p-8 text-danger">เปิดคลังไม่ได้: {loadError}</main>;
  if (!lib) return <main className="p-8 text-muted">กำลังเปิด…</main>;

  const face: BuddyConfig = {
    shape,
    color,
    eyes: editing.eyes ?? "none",
    brows: editing.brows ?? "none",
    nose: editing.nose ?? "none",
    mouth: editing.mouth ?? "none",
    head: "none",
    extras: [],
  };
  const dy = SHAPES[shape].dy;
  const zone = ZONES[kind];
  const list = lib.parts.filter((p) => p.kind === kind);

  return (
    <main className="min-h-dvh bg-cream p-5 text-ink">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold">🎨 สตูดิโอแต่งหน้า</h1>
        <span className="text-[13px] text-muted">ออกแบบชิ้นส่วนเอง · ลูกค้าเห็นเฉพาะชิ้นที่เปิด “ลูกค้าเห็น”</span>
        <div className="ml-auto flex items-center gap-3">
          {status && <span className={`text-[13px] ${status.ok ? "text-[#3d7a3d]" : "text-danger"}`}>{status.text}</span>}
          {dirty && !status && <span className="text-[13px] text-warn-ink">ยังไม่ได้บันทึก</span>}
          <Btn tone="dark" onClick={save} disabled={!dirty}>
            บันทึกลงไฟล์
          </Btn>
        </div>
      </header>

      <div className="grid gap-4" style={{ gridTemplateColumns: "300px minmax(360px,1fr) 300px" }}>
        {/* LEFT: kinds + my library */}
        <section className="rounded-[20px] border border-line bg-paper p-4">
          <div className="mb-3 grid grid-cols-4 gap-1 rounded-full bg-cream p-1">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setSel(null);
                }}
                className={`min-h-[34px] rounded-full text-[14px] ${k === kind ? "bg-ink font-semibold text-white" : ""}`}
              >
                {KIND_LABELS[k].th}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[13px] text-muted">คลังของฉัน · {KIND_LABELS[kind].th} ({list.length})</p>
          <ul className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {list.map((p) => (
              <li key={p.id} className={`rounded-2xl border p-2 ${p.id === editId ? "border-ink bg-yellow/40" : "border-line"}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="แก้ไข"
                    onClick={() => {
                      setEditing((e) => ({ ...e, [kind]: p.id }));
                      setSel(null);
                    }}
                    className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line"
                    style={{ background: color }}
                  >
                    <PartPicture part={p} kind={kind} size={56} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{p.name.th}</p>
                    <label className="flex items-center gap-1 text-[12px] text-muted">
                      <input
                        type="checkbox"
                        checked={p.visible}
                        onChange={(e) => change((l) => ({ parts: l.parts.map((x) => (x.kind === p.kind && x.id === p.id ? { ...x, visible: e.target.checked } : x)) }))}
                      />
                      ลูกค้าเห็น
                    </label>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <Btn
                    onClick={() => {
                      setEditing((e) => ({ ...e, [kind]: p.id }));
                      setSel(null);
                    }}
                  >
                    แก้ไข
                  </Btn>
                  <Btn onClick={() => newPart(p)}>ทำสำเนา</Btn>
                  <Btn tone="danger" onClick={() => deletePart(p)}>
                    ลบ
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Btn tone="dark" onClick={() => newPart()}>
              + สร้าง{KIND_LABELS[kind].th}ใหม่
            </Btn>
            {(kind === "brows" || kind === "nose") && (
              <Btn onClick={() => setEditing((e) => ({ ...e, [kind]: null }))} title="ดูหน้าแบบไม่มีชิ้นนี้">
                ไม่ใส่
              </Btn>
            )}
          </div>
        </section>

        {/* MIDDLE: the big live buddy */}
        <section className="rounded-[20px] border border-line bg-paper p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {part ? (
              <>
                <input
                  aria-label="ชื่อภาษาไทย"
                  className="min-h-[36px] w-40 rounded-full border border-line px-3 text-[14px]"
                  value={part.name.th}
                  maxLength={30}
                  onChange={(e) => changePart((p) => ({ ...p, name: { ...p.name, th: e.target.value } }))}
                  placeholder="ชื่อ (ไทย)"
                />
                <input
                  aria-label="English name"
                  className="min-h-[36px] w-36 rounded-full border border-line px-3 text-[14px]"
                  value={part.name.en}
                  maxLength={30}
                  onChange={(e) => changePart((p) => ({ ...p, name: { ...p.name, en: e.target.value } }))}
                  placeholder="English name"
                />
              </>
            ) : (
              <span className="text-[14px] text-muted">เลือกชิ้นทางซ้ายเพื่อแก้ไข หรือกด “สร้างใหม่”</span>
            )}
          </div>

          <div className="flex justify-center rounded-2xl bg-cream">
            <svg
              ref={svgRef}
              viewBox={BUDDY_VIEWBOX}
              className="aspect-square w-full max-w-[520px] touch-none select-none"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSel(null);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const p = toFace(e);
                changeEl({ x: clamp(round(d.ex + p.x - d.sx), -20, 120), y: clamp(round(d.ey + p.y - d.sy), -20, 120) });
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: buddySvg(face, lib, kind) }} />
              <g transform={`translate(0 ${dy})`}>
                <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={3} fill="none" stroke="#8b857e" strokeWidth={0.4} strokeDasharray="1.5 1.5" pointerEvents="none" />
                <line x1={50} y1={zone.y - 2} x2={50} y2={zone.y + zone.h + 2} stroke="#8b857e" strokeWidth={0.25} strokeDasharray="1 1.5" pointerEvents="none" />
                {part?.items.map((it, i) => (
                  <g
                    key={i}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
                      const p = toFace(e);
                      setSel(i);
                      drag.current = { i, sx: p.x, sy: p.y, ex: it.x, ey: it.y };
                    }}
                    dangerouslySetInnerHTML={{ __html: elSvg(it) }}
                  />
                ))}
                {el && (
                  <g pointerEvents="none" fill="none" stroke="#e0567a" strokeWidth={0.5} strokeDasharray="1.2 1">
                    <circle cx={el.x} cy={el.y} r={el.size / 2 + 2} />
                    {el.mirror && <circle cx={100 - el.x} cy={el.y} r={el.size / 2 + 2} />}
                  </g>
                )}
              </g>
            </svg>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">ลองกับ:</span>
            {(Object.keys(SHAPES) as BuddyShape[]).map((s) => (
              <Btn key={s} tone={s === shape ? "dark" : "plain"} onClick={() => setShape(s)}>
                {SHAPES[s].th}
              </Btn>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border border-line ${c === color ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">ลากชิ้นด้วยเมาส์ · ลูกศรขยับทีละนิด (Shift = ทีละเยอะ) · กรอบเส้นประ = ที่อยู่ของ{KIND_LABELS[kind].th}</p>
        </section>

        {/* RIGHT: elements + the chosen element's controls */}
        <section className="rounded-[20px] border border-line bg-paper p-4">
          <p className="mb-2 text-[13px] text-muted">เพิ่มรูปทรง{part ? "" : " (เลือกชิ้นก่อน)"}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {ELEMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!part}
                onClick={() => addEl(t)}
                className="flex flex-col items-center rounded-xl border border-line py-1 text-[11px] disabled:opacity-40"
              >
                <ElIcon type={t} />
                {ELEMENT_LABELS[t]}
              </button>
            ))}
          </div>

          {part && part.items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {part.items.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSel(i)}
                  className={`rounded-full border px-2 py-0.5 text-[12px] ${i === sel ? "border-ink bg-yellow" : "border-line"}`}
                >
                  {i + 1}. {ELEMENT_LABELS[it.type]}
                </button>
              ))}
            </div>
          )}

          {el ? (
            <div className="mt-4 space-y-3 border-t border-line pt-3">
              <p className="text-[14px] font-semibold">{ELEMENT_LABELS[el.type]}</p>
              <Slider label="ขนาด" value={el.size} min={1} max={40} step={0.2} onChange={(v) => changeEl({ size: v })} />
              <Slider label="หมุน" value={el.rot} min={-180} max={180} step={1} onChange={(v) => changeEl({ rot: v })} />
              <Slider label="ความหนาเส้น" value={el.thick} min={0.4} max={6} step={0.1} onChange={(v) => changeEl({ thick: v })} />
              <div>
                <p className="mb-1 text-[13px] text-muted">สี</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ELEMENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => changeEl({ color: c })}
                      className={`h-7 w-7 rounded-full border border-line ${c.toLowerCase() === el.color.toLowerCase() ? "outline-2 outline-offset-1 outline-ink" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                  <input type="color" aria-label="สีอื่น" value={el.color} onChange={(e) => changeEl({ color: e.target.value })} className="h-7 w-9" />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[13px]">
                {CAN_FILL.includes(el.type) && (
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={el.filled} onChange={(e) => changeEl({ filled: e.target.checked })} /> ระบายสีเต็ม
                  </label>
                )}
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={el.mirror} onChange={(e) => changeEl({ mirror: e.target.checked })} /> กระจกซ้าย-ขวา
                </label>
              </div>
              <div className="flex flex-wrap gap-1">
                <Btn onClick={() => moveLayer(1)} disabled={sel === part!.items.length - 1}>
                  ขึ้นบน
                </Btn>
                <Btn onClick={() => moveLayer(-1)} disabled={sel === 0}>
                  ลงล่าง
                </Btn>
                <Btn onClick={dupEl}>ทำสำเนา</Btn>
                <Btn tone="danger" onClick={delEl}>
                  ลบ
                </Btn>
              </div>
              <p className="text-[12px] tabular-nums text-muted">
                ตำแหน่ง x {el.x} · y {el.y}
              </p>
            </div>
          ) : (
            part && <p className="mt-4 text-[13px] text-muted">แตะรูปทรงบนตัวการ์ตูน หรือกดหมายเลขด้านบน เพื่อปรับ</p>
          )}
        </section>
      </div>
    </main>
  );
}
