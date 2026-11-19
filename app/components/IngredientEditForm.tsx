"use client";
// Round 66: the edit form for one saved ingredient (opens in a bottom sheet from the My ingredients list),
// with a quiet one-step "Delete this ingredient". Same rules as CustomIngredientList: empty protein/carbs/fat = unknown (null).

import { useState } from "react";
import { useLang } from "../lib/lang";
import { STATE_LABEL } from "../lib/foodRef";
import { deleteCustom, editCustom, type CustomIngredient, type CustomInput } from "../lib/customIngredients";
import type { FoodState } from "../lib/types";
import { NumberField } from "./ui";
import { renameAlt, type NameAlt } from "../lib/names";
import { OtherNameField } from "./OtherNameField";

type Draft = { name: string; alt?: NameAlt; state: FoodState | ""; basis: "g" | "ml" | "unit"; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; gpu: number | null };

const draftOf = (c: CustomIngredient): Draft => ({ name: c.name, alt: c.alt, state: c.state ?? "", basis: c.basis === "perUnit" ? "unit" : c.per, kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat, gpu: c.gramsPerUnit });

export function IngredientEditForm({
  item,
  list,
  onChange,
  onForget,
  onClose,
}: {
  item: CustomIngredient;
  list: CustomIngredient[];
  onChange: (l: CustomIngredient[]) => void;
  onForget: (c: CustomIngredient) => void;
  onClose: () => void;
}) {
  const { tr, lang } = useLang();
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  function save() {
    const input = { ...item, name: draft.name, alt: draft.alt, state: draft.state || null, basis: draft.basis === "unit" ? "perUnit" : "per100", per: draft.basis === "ml" ? "ml" : "g", kcal: draft.kcal, protein: draft.protein, carbs: draft.carbs, fat: draft.fat, gramsPerUnit: draft.gpu } as CustomInput;
    const r = editCustom(list, item.id, input, Date.now());
    if (!r.ok) {
      setErr(r.error === "name" ? tr("ใส่ชื่อก่อน", "Enter a name") : r.error === "kcal" ? tr("ใส่แคลอรี่ (kcal)", "Enter the calories (kcal)") : r.error === "duplicate" ? tr("มีชื่อและสถานะนี้อยู่แล้ว", "That name and state already exist") : tr("ตัวเลขไม่ถูกต้อง", "A number isn't valid"));
      return;
    }
    onChange(r.list);
    onClose();
  }

  return (
    <div className="space-y-3" data-testid="ai-custom-edit">
      <input className="field !min-h-[44px]" value={draft.name} onChange={(e) => set({ name: e.target.value, alt: renameAlt(draft.alt, draft.name, e.target.value) })} aria-label={tr("ชื่อ", "Name")} />
      {draft.name.trim() && <OtherNameField name={draft.name} alt={draft.alt} onChange={(alt) => set({ alt })} />}
      <div className="grid grid-cols-2 gap-2">
        <select className="field !min-h-[44px]" value={draft.basis} onChange={(e) => set({ basis: e.target.value as Draft["basis"] })} aria-label={tr("ค่าต่อ", "Values are per")}>
          <option value="g">{tr("ต่อ 100 กรัม", "Per 100 g")}</option>
          <option value="ml">{tr("ต่อ 100 มล.", "Per 100 ml")}</option>
          <option value="unit">{tr("ต่อ 1 หน่วย", "Per 1 unit")}</option>
        </select>
        <select className="field !min-h-[44px]" value={draft.state} onChange={(e) => set({ state: e.target.value as FoodState | "" })} aria-label={tr("สถานะ", "State")}>
          <option value="">{tr("ไม่ระบุสถานะ", "No state")}</option>
          {(Object.keys(STATE_LABEL) as FoodState[]).map((k) => (
            <option key={k} value={k}>{STATE_LABEL[k][lang]}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ["kcal", "kcal"],
            ["protein", tr("โปรตีน", "Protein")],
            ["carbs", tr("คาร์บ", "Carbs")],
            ["fat", tr("ไขมัน", "Fat")],
          ] as const
        ).map(([k, l]) => (
          <div key={k}>
            <span className="mb-1 block text-[12px] text-muted">{l}</span>
            <NumberField className="field num !min-h-[44px] !px-2" value={draft[k]} onChange={(n) => set({ [k]: n })} placeholder={k === "kcal" ? undefined : tr("ไม่ทราบ", "?")} aria-label={l} />
          </div>
        ))}
      </div>
      <div>
        <span className="mb-1 block text-[12px] text-muted">{tr("น้ำหนักของ 1 หน่วย (กรัม) — ไม่บังคับ", "Weight of 1 unit (g) — optional")}</span>
        <NumberField className="field num !min-h-[44px]" value={draft.gpu} onChange={(n) => set({ gpu: n })} aria-label={tr("น้ำหนักต่อหน่วย", "Weight per unit")} />
      </div>
      {err && <p className="text-[13px] text-danger" role="alert">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-soft !min-h-[44px] flex-1" onClick={onClose}>{tr("ยกเลิก", "Cancel")}</button>
        <button type="button" className="btn-primary !min-h-[44px] flex-1" onClick={save} data-testid="ai-custom-save">{tr("บันทึก", "Save")}</button>
      </div>
      <div className="pt-1 text-center">
        {confirmDel ? (
          <div className="flex items-center justify-center gap-2 text-[14px]">
            <button type="button" className="min-h-[44px] px-3 text-danger" onClick={() => { onChange(deleteCustom(list, item.id)); onForget(item); onClose(); }} data-testid="ai-custom-delete-yes">{tr("ลบเลย", "Delete")}</button>
            <button type="button" className="min-h-[44px] px-3 text-muted" onClick={() => setConfirmDel(false)}>{tr("ไม่ลบ", "Keep")}</button>
          </div>
        ) : (
          <button type="button" className="min-h-[44px] px-3 text-[14px] text-muted" onClick={() => setConfirmDel(true)} data-testid="ai-custom-delete">{tr("ลบวัตถุดิบนี้", "Delete this ingredient")}</button>
        )}
      </div>
    </div>
  );
}
