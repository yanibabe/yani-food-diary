"use client";
import { OffAttribution } from "./OffAttribution";
import { aiFetch } from "../lib/aiFetch";
import { useMemo, useRef, useState } from "react";
import { AI_MARGIN, blankItem, changeAmount, cleanBox, cleanNumber, fmtAmount, fmtKcal, newId, pickMacros, sumMacros } from "../lib/nutrition";
import { aiDairy, dairyItems, isDairy, warnDairy } from "../lib/dairy";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
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
  const { tr } = useLang();
  return (
    <div className="relative overflow-hidden rounded-[26px] bg-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={tr("รูปอาหาร", "Food photo")} className="block w-full" />
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
              {/* The label may be wider than a small box; kcal is never cut off. */}
              <span
                className={`absolute top-1.5 flex max-w-[58vw] items-center gap-1 whitespace-nowrap rounded-full bg-paper/95 px-2.5 py-1 text-[13px] font-semibold text-ink shadow sm:max-w-[300px] ${
                  b.x + b.w / 2 > 0.6 ? "right-1.5" : "left-1.5"
                }`}
              >
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="num shrink-0">· {fmtKcal(i.kcal)}{i.estimated ? "~" : ""}</span>
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
  showDairy,
}: {
  showDairy?: boolean;
  item: FoodItem;
  onChange: (it: FoodItem) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const set = (patch: Partial<FoodItem>) => onChange({ ...item, ...patch });
  const { tr } = useLang();
  return (
    <div className="space-y-4 pb-2">
      <div>
        <label className="label" htmlFor="it-name">{tr("ชื่อ", "Name")}</label>
        <input id="it-name" className="field" value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder={tr("เช่น ไก่ทอด", "e.g. fried chicken")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="it-amount">{tr("ปริมาณที่กิน", "Amount eaten")}</label>
          <NumberField
            id="it-amount"
            value={item.amount}
            onChange={(n) => n != null && onChange(changeAmount(item, n))}
          />
        </div>
        <div>
          <label className="label" htmlFor="it-unit">{tr("หน่วย", "Unit")}</label>
          <input id="it-unit" className="field" value={item.unit} onChange={(e) => set({ unit: e.target.value })} placeholder={tr("จาน / ชิ้น / กรัม", "plate / piece / g")} />
        </div>
      </div>
      <p className="-mt-2 text-[13px] text-muted">
        {tr("เปลี่ยนปริมาณแล้วแคลอรีและสารอาหารจะปรับตามสัดส่วนให้เอง", "Change the amount and the calories and nutrients change to match")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="it-kcal">{tr("แคลอรี (kcal)", "Calories (kcal)")}</label>
          <NumberField id="it-kcal" value={item.kcal} onChange={(n) => set({ kcal: cleanNumber(n) })} />
        </div>
        <div>
          <label className="label" htmlFor="it-p">{tr("โปรตีน (g)", "Protein (g)")}</label>
          <NumberField id="it-p" value={item.protein} onChange={(n) => set({ protein: cleanNumber(n) })} />
        </div>
        <div>
          <label className="label" htmlFor="it-c">{tr("คาร์บ (g)", "Carbs (g)")}</label>
          <NumberField id="it-c" value={item.carbs} onChange={(n) => set({ carbs: cleanNumber(n) })} />
        </div>
        <div>
          <label className="label" htmlFor="it-f">{tr("ไขมัน (g)", "Fat (g)")}</label>
          <NumberField id="it-f" value={item.fat} onChange={(n) => set({ fat: cleanNumber(n) })} />
        </div>
      </div>
      <label className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-cream px-4">
        <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={item.estimated} onChange={(e) => set({ estimated: e.target.checked })} />
        <span>{tr("เป็นค่าประมาณ", "This is an estimate")}</span>
      </label>
      {showDairy && (
        <label className="flex min-h-[48px] items-center gap-3 rounded-2xl bg-cream px-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--olive)]"
            checked={isDairy(item)}
            onChange={(e) => set({ dairy: e.target.checked })}
            data-testid="dairy-check"
          />
          <span>🥛 {tr("มีนมหรือผลิตภัณฑ์จากนม", "Has milk or milk products")}</span>
        </label>
      )}
      {item.note && <p className="rounded-2xl bg-warn px-4 py-3 text-[14px] text-warn-ink">{item.note}</p>}
      <div className="flex gap-3 pt-1">
        <button className="btn-soft flex-1 !border-danger !text-danger" onClick={onDelete}>{tr("ลบรายการนี้", "Delete this item")}</button>
        <button className="btn-primary flex-1" onClick={onDone}>{tr("เสร็จ", "Done")}</button>
      </div>
    </div>
  );
}

export function MealReview({
  photo,
  initial,
  mockBadge,
  marginNote,
  firstQuestion,
  chatEnabled,
  chatDisabledReason,
  saveLabel,
  onSave,
  onCancel,
  onDelete,
  startEditingId,
}: {
  photo: string | null;
  initial: MealDraft;
  mockBadge?: boolean;
  /** Show "AI numbers include a +15% safety margin". */
  marginNote?: boolean;
  firstQuestion?: string | null;
  chatEnabled: boolean;
  chatDisabledReason?: string;
  saveLabel?: string;
  onSave: (d: MealDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
  startEditingId?: string | null;
}) {
  const { tr, lang } = useLang();
  saveLabel ??= tr("บันทึกลงวันนี้", "Save to my diary");
  const [title, setTitle] = useState(initial.title);
  const [slot, setSlot] = useState<MealSlot>(initial.slot);
  const [items, setItems] = useState<FoodItem[]>(initial.items);
  const pct = Math.round(AI_MARGIN * 100);
  const [editingId, setEditingId] = useState<string | null>(startEditingId ?? null);
  const [chat, setChat] = useState<ChatMsg[]>(firstQuestion ? [{ role: "assistant", text: firstQuestion }] : []);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const total = useMemo(() => sumMacros(items.map(pickMacros)), [items]);
  const { goals } = useStore();
  const avoidDairy = warnDairy(goals);
  const milky = avoidDairy ? dairyItems(items) : [];
  const editing = items.find((i) => i.id === editingId) ?? null;
  const amountSummary = items.length
    ? items.map((i) => `${i.name || tr("ไม่มีชื่อ", "No name")} ${fmtAmount(i.amount)} ${i.unit}`).join(" · ")
    : tr("ยังไม่มีรายการ", "Nothing yet");

  async function sendChat() {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    setChat((c) => [...c, { role: "user", text }]);
    setMsg("");
    try {
      const res = await aiFetch(
        "/api/refine",
        {
          title,
          items: items.map(({ id, name, amount, unit, kcal, protein, carbs, fat, kind, estimated, margin }) => ({
            id, name, amount, unit, kcal, protein, carbs, fat, kind, estimated, margin: margin === true,
          })),
          history: chat.filter((c) => !c.error).map(({ role, text }) => ({ role, text })),
          message: text,
          lang,
        },
        lang,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        const why = data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`;
        setChat((c) => [
          ...c,
          { role: "assistant", text: tr(`ยังแก้ด้วย AI ไม่ได้: ${why} — แตะรายการเพื่อแก้เองได้`, `The AI couldn't change it: ${why} — tap an item to edit it yourself`), error: true },
        ]);
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
              dairy: aiDairy(e.item.name || old.name, e.item.dairy) || old.dairy === true,
              dairySource: e.item.dairySource ?? old.dairySource ?? null,
              margin: e.item.margin === false ? false : old.margin,
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
            dairy: aiDairy(a.name, a.dairy),
            dairySource: a.dairySource ?? null,
            margin: a.margin === true,
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
        { role: "assistant", text: `${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`, error: true },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  }

  function addManual() {
    const it = blankItem(tr("จาน", "plate"));
    setItems((p) => [...p, it]);
    setEditingId(it.id);
  }

  const canSave = items.length > 0 && items.every((i) => i.name.trim());

  return (
    <div className="space-y-5">
      {mockBadge && (
        <div className="rounded-2xl bg-warn px-4 py-2.5 text-[14px] text-warn-ink">
          {tr("โหมดทดสอบ: ผลนี้มาจาก", "Test mode: this result is from a")} <b>{tr("AI จำลอง", "pretend AI")}</b>{" "}
          {tr("ไม่ใช่ AI จริง", "not the real AI")}
        </div>
      )}

      {photo && <LabeledPhoto src={photo} items={items} onTap={setEditingId} />}

      {milky.length > 0 && (
        <div className="rounded-[22px] bg-warn px-4 py-3 text-warn-ink" role="note" data-testid="dairy-warning">
          <p className="font-semibold">🥛 {tr("อาจมีนม", "May contain milk")}</p>
          <p className="text-[15px]">
            {milky.map((i) => `${i.name || tr("ไม่มีชื่อ", "No name")}${i.dairySource ? ` (${i.dairySource})` : ""}`).join(" · ")}
          </p>
          <p className="mt-1 text-[13px] opacity-80">{tr("คุณตั้งไว้ว่าเลี่ยงนม · เป็นการเดา ไม่ใช่ข้อมูลแน่นอน", "You chose to avoid milk · This is a guess, not a sure thing")}</p>
        </div>
      )}

      <div className="card space-y-4 p-5">
        <input
          className="w-full bg-transparent text-center text-[24px] font-semibold outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tr("ชื่อมื้อ", "Meal name")}
          aria-label={tr("ชื่อมื้อ", "Meal name")}
        />
        <p className="text-center text-[14px] text-muted" data-testid="amount-summary">{amountSummary}</p>
        <KcalBig kcal={total.kcal} />
        <MacroCards m={total} />
        {items.some((i) => i.ref?.source === "off") && <OffAttribution />}
        {marginNote && items.some((i) => i.margin) && (
          <p className="text-center text-[13px] text-muted" data-testid="margin-note">
            {tr(
              `รายการที่มีป้าย +${pct}% คือ AI กะปริมาณเอง จึงบวกเผื่อไว้ · ถ้าบอกน้ำหนักจริง (เช่น "แซลมอน 120 กรัม") จะไม่บวกเพิ่ม`,
              `Items marked +${pct}% are the AI's own guess, so a safety margin is added · Tell it the real weight (e.g. "salmon 120 g") and no margin is added`,
            )}
          </p>
        )}
      </div>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[18px] font-semibold">{tr("รายการในจาน", "On the plate")}</h3>
          <span className="text-[13px] text-muted">{tr("แตะเพื่อแก้", "Tap to edit")}</span>
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
                    <span className="font-medium">{i.name || tr("ไม่มีชื่อ", "No name")}</span>
                    {i.kind === "extra" && <Badge tone="olive">{tr("เพิ่มเติม", "Extra")}</Badge>}
                    {i.estimated && <Badge>{tr("ประมาณ", "Estimate")}</Badge>}
                    {marginNote && i.margin && <Badge tone="muted">+{pct}%</Badge>}
                    {marginNote && i.margin === false && <Badge tone="olive">{tr("น้ำหนักจริง", "Exact amount")}</Badge>}
                    {avoidDairy && isDairy(i) && <Badge>🥛 {tr("นม", "Milk")}</Badge>}
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
        <button className="btn-soft mt-2 w-full" onClick={addManual}>+ {tr("เพิ่มรายการเอง", "Add an item myself")}</button>
      </section>

      <section className="card p-4">
        <h3 className="mb-1 px-1 text-[18px] font-semibold">{tr("อธิบายเพิ่ม", "Tell the AI more")}</h3>
        <p className="mb-3 px-1 text-[14px] text-muted">
          {tr("เช่น “ไก่กินครึ่งชิ้น แต่ผักกินหมด” หรือ “ผัดน้ำมัน 1 ช้อนโต๊ะ”", "e.g. “I ate half the chicken but all the vegetables” or “fried with 1 tbsp oil”")}
        </p>
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
        {sending && (
          <p className="rounded-2xl bg-warn px-4 py-2.5 text-[14px] text-warn-ink" data-testid="stay-note">
            {tr("AI กำลังแก้ให้… อย่าปิดหน้านี้นะ ถ้าปิดไป อาจต้องเริ่มใหม่", "The AI is updating it… Please keep this page open. If you close it, you may need to start again.")}
          </p>
        )}
        {chatEnabled ? (
          <div className="flex items-end gap-2">
            <textarea
              className="field min-h-[48px] flex-1 resize-none"
              rows={1}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={tr("พิมพ์อธิบายเพิ่ม…", "Type more details…")}
              aria-label={tr("อธิบายเพิ่ม", "Tell the AI more")}
            />
            <button className="btn-primary !min-h-[48px] shrink-0" onClick={sendChat} disabled={sending || !msg.trim()}>
              {sending ? "…" : tr("ส่ง", "Send")}
            </button>
          </div>
        ) : (
          <p className="rounded-2xl bg-cream px-4 py-3 text-[14px] text-muted">{chatDisabledReason ?? tr("AI ยังไม่พร้อม — แตะรายการเพื่อแก้เองได้", "The AI isn't ready — tap an item to edit it yourself")}</p>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <span className="label px-1">{tr("บันทึกเป็นมื้อ", "Save as")}</span>
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map((s) => (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={`min-h-[48px] rounded-2xl font-medium ${slot === s ? "bg-olive text-white" : "bg-cream text-ink"}`}
              aria-pressed={slot === s}
            >
              {SLOT_LABEL[s][lang]}
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <button className="btn-soft flex-1" onClick={onCancel}>{tr("ยกเลิก", "Cancel")}</button>
        <button
          className="btn-primary flex-[2]"
          disabled={!canSave}
          onClick={() => onSave({ title: title.trim() || items[0]?.name || tr("อาหาร", "Meal"), slot, items })}
        >
          {saveLabel}
        </button>
      </div>
      {!canSave && items.length > 0 && <p className="text-center text-[14px] text-muted">{tr("ใส่ชื่อให้ทุกรายการก่อนบันทึก", "Give every item a name before saving")}</p>}

      {onDelete && (
        <>
          {confirmDelete ? (
            <div className="card space-y-3 p-4 text-center">
              <p>{tr("ลบมื้อนี้ออกจากไดอารี?", "Delete this meal from your diary?")}</p>
              <div className="flex gap-3">
                <button className="btn-soft flex-1" onClick={() => setConfirmDelete(false)}>{tr("ไม่ลบ", "Keep it")}</button>
                <button className="btn-primary flex-1 !bg-danger" onClick={onDelete}>{tr("ลบเลย", "Delete")}</button>
              </div>
            </div>
          ) : (
            <button className="w-full py-3 text-danger" onClick={() => setConfirmDelete(true)}>{tr("ลบมื้อนี้", "Delete this meal")}</button>
          )}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditingId(null)} title={tr("แก้รายการ", "Edit item")}>
        {editing && (
          <ItemEditor
            showDairy={avoidDairy}
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
