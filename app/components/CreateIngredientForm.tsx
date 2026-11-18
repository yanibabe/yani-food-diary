"use client";
// Round 64: form to add her own ingredient with her own numbers (used in a Sheet on the My ingredients screen).

import { useState } from "react";
import { useLang } from "../lib/lang";
import { STATE_LABEL } from "../lib/foodRef";
import type { CustomIngredient } from "../lib/customIngredients";
import { createErrorText, createFromDraft, emptyDraft, type CreateDraft } from "../lib/createIngredientForm";
import type { FoodState } from "../lib/types";
import { NumberField } from "./ui";

export function CreateIngredientForm({ list, onCreated, onCancel, initialName = "" }: { list: CustomIngredient[]; onCreated: (next: CustomIngredient[]) => void; onCancel: () => void; initialName?: string }) {
  const { tr, lang } = useLang();
  const [d, setD] = useState<CreateDraft>(() => ({ ...emptyDraft(), name: initialName }));
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<CreateDraft>) => setD((x) => ({ ...x, ...p }));

  function save() {
    const r = createFromDraft(list, d, Date.now());
    if (!r.ok) {
      setErr(createErrorText(r.error, tr));
      return;
    }
    onCreated(r.list);
  }

  return (
    <div className="space-y-3" data-testid="create-ingredient-form">
      <div>
        <span className="mb-1 block text-[13px] text-muted">{tr("ชื่อ (จำเป็น)", "Name (required)")}</span>
        <input className="field !min-h-[44px]" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={tr("เช่น น้ำพริกแม่บ้าน", "e.g. Mum's chilli paste")} aria-label={tr("ชื่อ", "Name")} autoComplete="off" data-testid="create-ingredient-name" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-[13px] text-muted">{tr("ค่าต่อ", "Values are per")}</span>
          <select className="field !min-h-[44px]" value={d.basis} onChange={(e) => set({ basis: e.target.value as CreateDraft["basis"] })} aria-label={tr("ค่าต่อ", "Values are per")}>
            <option value="g">{tr("ต่อ 100 กรัม", "Per 100 g")}</option>
            <option value="ml">{tr("ต่อ 100 มล.", "Per 100 ml")}</option>
            <option value="unit">{tr("ต่อ 1 หน่วย", "Per 1 unit")}</option>
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[13px] text-muted">{tr("สถานะ", "State")}</span>
          <select className="field !min-h-[44px]" value={d.state} onChange={(e) => set({ state: e.target.value as FoodState | "" })} aria-label={tr("สถานะ", "State")}>
            <option value="">{tr("ไม่ระบุสถานะ", "No state")}</option>
            {(Object.keys(STATE_LABEL) as FoodState[]).map((k) => (
              <option key={k} value={k}>{STATE_LABEL[k][lang]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["kcal", tr("แคลอรี่ kcal (จำเป็น)", "Calories kcal (required)")],
            ["protein", tr("โปรตีน (ก.)", "Protein (g)")],
            ["carbs", tr("คาร์บ (ก.)", "Carbs (g)")],
            ["fat", tr("ไขมัน (ก.)", "Fat (g)")],
          ] as const
        ).map(([k, l]) => (
          <div key={k}>
            <span className="mb-1 block text-[13px] text-muted">{l}</span>
            <NumberField className="field num !min-h-[44px]" value={d[k]} onChange={(n) => set({ [k]: n })} placeholder={k === "kcal" ? undefined : tr("ไม่ทราบ", "unknown")} aria-label={l} data-testid={`create-ingredient-${k}`} />
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted">{tr("ช่องที่ไม่รู้ เว้นว่างได้ — จะนับเป็น “ไม่ทราบ” ไม่ใช่ 0 ตัวเลขทั้งหมดเป็นของคุณเอง", "Leave anything you don't know empty — it counts as “unknown”, not 0. These numbers are your own.")}</p>
      <div>
        <span className="mb-1 block text-[13px] text-muted">{tr("น้ำหนักของ 1 หน่วย (กรัม) — ไม่บังคับ", "Weight of 1 unit (g) — optional")}</span>
        <NumberField className="field num !min-h-[44px]" value={d.gpu} onChange={(n) => set({ gpu: n })} aria-label={tr("น้ำหนักต่อหน่วย", "Weight per unit")} />
      </div>
      {err && <p className="text-[14px] text-danger" role="alert" data-testid="create-ingredient-error">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-soft !min-h-[44px] flex-1" onClick={onCancel}>{tr("ยกเลิก", "Cancel")}</button>
        <button type="button" className="btn-primary !min-h-[44px] flex-1" onClick={save} data-testid="create-ingredient-save">{tr("บันทึก", "Save")}</button>
      </div>
    </div>
  );
}
