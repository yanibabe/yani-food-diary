"use client";
import { useMemo, useRef, useState } from "react";
import { blankItem, changeAmount, cleanBox, cleanNumber, fmtAmount, fmtKcal, newId, pickMacros, sumMacros } from "../lib/nutrition";
import { SLOT_LABEL, SLOTS, type FoodItem, type MealSlot } from "../lib/types";
import { Badge, KcalBig, MacroCards, NumberField, Sheet } from "./ui";

export type MealDraft = {
  title: string;
  slot: MealSlot;
  items: FoodItem[];
};

type ChatMsg = { role: "user" | "assistant"; text: string; error?: boolean };

/** Photo with food labels drawn where the AI found each item. */
export function LabeledPhoto({ src, items, onTap }: { src: string; items: FoodItem[]; onTap?: (id: string) => void }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] bg-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="รูปอาหาร" className="block w-full" />
      {items
        .filter((i) => i.box)
        .map((i) => {
          const b = i.box!;
          return (
            <button
              key={i.id}
              onClick={() => onTap?.(i.id)}
              className="absolute rounded-2xl border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
              style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
              aria-label={`${i.name} ${Math.round(i.kcal)} kcal`}
            >
              <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded-full bg-paper/95 px-2.5 py-1 text-left text-[13px] font-semibold text-ink shadow">
                {i.name} · <span className="num">{fmtKcal(i.kcal)}</span>
                {i.estimated ? " ~" : ""}
              </span>
            </button>
          );
        })}
    </div>
  );
}

export function ItemEditor({
  item,
  onChange,
  onDelete,
  onDone,
}: {
  item: FoodItem;
  onChange: (it: FoodItem) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const set = (patch: Partial<FoodItem>) => onChange({ ...item, ...patch });
  return (
    <div className="space-y-4 pb-2">
      <div>
        <label className="label" htmlFor="it-name">ชื่อ</label>
        <input id="it-name" className="field" value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="เช่น ไก่ทอด" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="it-amount">ปริมาณที่กิน</label>
          <NumberField
            id="it-amount"
            value={item.amount}
            onChange={(n) => n != null && onChange(changeAmount(item, n))}
          />
        </div>
        <div>
          <label className="label" htmlFor="it-unit">หน่วย</label>
          <input id="it-unit" className="field" value={item.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="จาน / ชิ้น / กรัม" />
        </div>
      </div>
      <p className="-mt-2 text-[13px] text-muted">เปลี่ยนปริมาณแล้วแคลอรีและสารอาหารจะปรับตามสัดส่วนให้เอง</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="it-kcal">แคลอรี (kcal)</label>
          <NumberField id="it-kcal" value={item.kcal} onChange={(n) => set({ kcal: cleanNumber(n) })} />
        </div>
        <div>
          <label className="label" htmlFor="it-p">โปรตีน (g)</label>
          <NumberField id="it-p" value={item.protein} onChange={(n) => set({ protein: cleanNumber(n) })} />
        </div>
        <div>
          <label className="label" htmlFor="it-c">คาร์บ (g)</label>
          <NumberField id="it-c" value={item.carbs} onChange={(n) => set({ carbs: cleanNumber(n) })} />
        </div>
        <div>
          <label className="label" htmlFor="it-f">ไขมัน (g)</label>
          <NumberField id="it-f" value={item.fat} onChange={(n) => set({ fat: cleanNumber(n) })} />
        </div>
      </div>
      <label className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-cream px-4">
        <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={item.estimated} onChange={(e) => set({ estimated: e.target.checked })} />
        <span>เป็นค่าประมาณ</span>
      </label>
      {item.note && <p className="rounded-2xl bg-warn px-4 py-3 text-[14px] text-warn-ink">{item.note}</p>}
      <div className="flex gap-3 pt-1">
        <button className="btn-soft flex-1 !bg-[#f6e1dc] !text-danger" onClick={onDelete}>ลบรายการนี้</button>
        <button className="btn-primary flex-1" onClick={onDone}>เสร็จ</button>
      </div>
    </div>
  );
}

export function MealReview({
  photo,
  initial,
  mockBadge,
  firstQuestion,
  chatEnabled,
  chatDisabledReason,
  saveLabel = "บันทึกลงวันนี้",
  onSave,
  onCancel,
  onDelete,
  startEditingId,
}: {
  photo: string | null;
  initial: MealDraft;
  mockBadge?: boolean;
  firstQuestion?: string | null;
  chatEnabled: boolean;
  chatDisabledReason?: string;
  saveLabel?: string;
  onSave: (d: MealDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
  startEditingId?: string | null;
}) {
  const [title, setTitle] = useState(initial.title);
  const [slot, setSlot] = useState<MealSlot>(initial.slot);
  const [items, setItems] = useState<FoodItem[]>(initial.items);
  const [editingId, setEditingId] = useState<string | null>(startEditingId ?? null);
  const [chat, setChat] = useState<ChatMsg[]>(firstQuestion ? [{ role: "assistant", text: firstQuestion }] : []);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const total = useMemo(() => sumMacros(items.map(pickMacros)), [items]);
  const editing = items.find((i) => i.id === editingId) ?? null;
  const amountSummary = items.length
    ? items.map((i) => `${i.name || "ไม่มีชื่อ"} ${fmtAmount(i.amount)} ${i.unit}`).join(" · ")
    : "ยังไม่มีรายการ";

  async function sendChat() {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    setChat((c) => [...c, { role: "user", text }]);
    setMsg("");
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          items: items.map(({ id, name, amount, unit, kcal, protein, carbs, fat, kind, estimated }) => ({
            id, name, amount, unit, kcal, protein, carbs, fat, kind, estimated,
          })),
          history: chat.filter((c) => !c.error).map(({ role, text }) => ({ role, text })),
          message: text,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        const why = data?.message ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}`;
        setChat((c) => [...c, { role: "assistant", text: `ยังแก้ด้วย AI ไม่ได้: ${why} — แตะรายการเพื่อแก้เองได้`, error: true }]);
        return;
      }
      const r = data.result as {
        reply: string;
        question: string | null;
        edits: { id: string; action: "update" | "remove"; item: Omit<FoodItem, "id"> | null }[];
        adds: Omit<FoodItem, "id">[];
      };
      const changed: string[] = [];
      setItems((prev) => {
        let next = [...prev];
        for (const e of r.edits) {
          const idx = next.findIndex((x) => x.id === e.id);
          if (idx < 0) continue; // ignore ids we don't know
          if (e.action === "remove") {
            next = next.filter((x) => x.id !== e.id);
          } else if (e.item) {
            const old = next[idx];
            next[idx] = {
              ...old,
              name: e.item.name || old.name,
              amount: cleanNumber(e.item.amount),
              unit: e.item.unit || old.unit,
              kcal: cleanNumber(e.item.kcal),
              protein: cleanNumber(e.item.protein),
              carbs: cleanNumber(e.item.carbs),
              fat: cleanNumber(e.item.fat),
              estimated: Boolean(e.item.estimated),
              note: e.item.note ?? old.note,
              box: old.box, // the photo position never changes
            };
            changed.push(old.id);
          }
        }
        for (const a of r.adds) {
          const id = newId("it");
          next.push({
            ...a,
            id,
            amount: cleanNumber(a.amount),
            kcal: cleanNumber(a.kcal),
            protein: cleanNumber(a.protein),
            carbs: cleanNumber(a.carbs),
            fat: cleanNumber(a.fat),
            estimated: Boolean(a.estimated),
            kind: a.kind === "extra" ? "extra" : "food",
            note: a.note ?? null,
            box: cleanBox(a.box),
          });
          changed.push(id);
        }
        return next;
      });
      setFlash(changed);
      setTimeout(() => setFlash([]), 2500);
      setChat((c) => [
        ...c,
        { role: "assistant", text: r.reply },
        ...(r.question ? [{ role: "assistant" as const, text: r.question }] : []),
      ]);
    } catch (e) {
      setChat((c) => [
        ...c,
        { role: "assistant", text: `เชื่อมต่อไม่ได้: ${e instanceof Error ? e.message : String(e)}`, error: true },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  }

  function addManual() {
    const it = blankItem();
    setItems((p) => [...p, it]);
    setEditingId(it.id);
  }

  const canSave = items.length > 0 && items.every((i) => i.name.trim());

  return (
    <div className="space-y-5">
      {mockBadge && (
        <div className="rounded-2xl bg-warn px-4 py-2.5 text-[14px] text-warn-ink">
          โหมดทดสอบ: ผลนี้มาจาก <b>AI จำลอง</b> ไม่ใช่ AI จริง
        </div>
      )}

      {photo && <LabeledPhoto src={photo} items={items} onTap={setEditingId} />}

      <div className="card space-y-4 p-5">
        <input
          className="w-full bg-transparent text-center text-[24px] font-semibold outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อมื้อ"
          aria-label="ชื่อมื้อ"
        />
        <p className="text-center text-[14px] text-muted" data-testid="amount-summary">{amountSummary}</p>
        <KcalBig kcal={total.kcal} />
        <MacroCards m={total} />
      </div>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[18px] font-semibold">รายการในจาน</h3>
          <span className="text-[13px] text-muted">แตะเพื่อแก้</span>
        </div>
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => setEditingId(i.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors ${
                  flash.includes(i.id) ? "bg-olive-soft" : ""
                }`}
                data-testid="meal-item"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{i.name || "ไม่มีชื่อ"}</span>
                    {i.kind === "extra" && <Badge tone="olive">เพิ่มเติม</Badge>}
                    {i.estimated && <Badge>ประมาณ</Badge>}
                  </div>
                  <div className="text-[14px] text-muted">
                    {fmtAmount(i.amount)} {i.unit}
                    {i.note ? ` · ${i.note}` : ""}
                  </div>
                </div>
                <div className="num text-right text-[20px] font-semibold">
                  {fmtKcal(i.kcal)}
                  <span className="ml-0.5 text-[12px] font-normal text-muted">kcal</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-soft mt-2 w-full" onClick={addManual}>+ เพิ่มรายการเอง</button>
      </section>

      <section className="card p-4">
        <h3 className="mb-1 px-1 text-[18px] font-semibold">อธิบายเพิ่ม</h3>
        <p className="mb-3 px-1 text-[14px] text-muted">เช่น “ไก่กินครึ่งชิ้น แต่ผักกินหมด” หรือ “ผัดน้ำมัน 1 ช้อนโต๊ะ”</p>
        {chat.length > 0 && (
          <div className="mb-3 space-y-2" data-testid="chat-log">
            {chat.map((c, k) => (
              <div key={k} className={`flex ${c.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px] ${
                    c.role === "user" ? "bg-olive text-white" : c.error ? "bg-warn text-warn-ink" : "bg-cream"
                  }`}
                >
                  {c.text}
                </div>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
        )}
        {chatEnabled ? (
          <div className="flex items-end gap-2">
            <textarea
              className="field min-h-[48px] flex-1 resize-none"
              rows={1}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="พิมพ์อธิบายเพิ่ม…"
              aria-label="อธิบายเพิ่ม"
            />
            <button className="btn-primary !min-h-[48px] shrink-0" onClick={sendChat} disabled={sending || !msg.trim()}>
              {sending ? "…" : "ส่ง"}
            </button>
          </div>
        ) : (
          <p className="rounded-2xl bg-cream px-4 py-3 text-[14px] text-muted">{chatDisabledReason ?? "AI ยังไม่พร้อม — แตะรายการเพื่อแก้เองได้"}</p>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <span className="label px-1">บันทึกเป็นมื้อ</span>
        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((s) => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={`min-h-[48px] rounded-2xl font-medium ${slot === s ? "bg-olive text-white" : "bg-cream text-ink"}`}
              aria-pressed={slot === s}
            >
              {SLOT_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <button className="btn-soft flex-1" onClick={onCancel}>ยกเลิก</button>
        <button
          className="btn-primary flex-[2]"
          disabled={!canSave}
          onClick={() => onSave({ title: title.trim() || items[0]?.name || "อาหาร", slot, items })}
        >
          {saveLabel}
        </button>
      </div>
      {!canSave && items.length > 0 && <p className="text-center text-[14px] text-muted">ใส่ชื่อให้ทุกรายการก่อนบันทึก</p>}

      {onDelete && (
        <>
          {confirmDelete ? (
            <div className="card space-y-3 p-4 text-center">
              <p>ลบมื้อนี้ออกจากไดอารี?</p>
              <div className="flex gap-3">
                <button className="btn-soft flex-1" onClick={() => setConfirmDelete(false)}>ไม่ลบ</button>
                <button className="btn-primary flex-1 !bg-danger" onClick={onDelete}>ลบเลย</button>
              </div>
            </div>
          ) : (
            <button className="w-full py-3 text-danger" onClick={() => setConfirmDelete(true)}>ลบมื้อนี้</button>
          )}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditingId(null)} title="แก้รายการ">
        {editing && (
          <ItemEditor
            item={editing}
            onChange={(it) => setItems((p) => p.map((x) => (x.id === it.id ? it : x)))}
            onDelete={() => {
              setItems((p) => p.filter((x) => x.id !== editing.id));
              setEditingId(null);
            }}
            onDone={() => setEditingId(null)}
          />
        )}
      </Sheet>
    </div>
  );
}
