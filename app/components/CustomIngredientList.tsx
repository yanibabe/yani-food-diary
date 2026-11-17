"use client";
// Round 47: her saved custom ingredients — the list with Edit / Delete. Shared by the search's "Manage" fold
// and the "My ingredients" view on the recipes page (one place for the edit form, not two copies).

import { useState } from "react";
import { useLang } from "../lib/lang";
import { fmtKcal } from "../lib/nutrition";
import { STATE_LABEL } from "../lib/foodRef";
import { deleteCustom, editCustom, type CustomIngredient, type CustomInput } from "../lib/customIngredients";
import { basisLabel, macroText } from "../lib/myIngredients";
import type { FoodState } from "../lib/types";
import { NumberField } from "./ui";

const stamp = () => Date.now();

type Draft = { name: string; state: FoodState | ""; basis: "g" | "ml" | "unit"; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; gpu: number | null };

const draftOf = (c: CustomIngredient): Draft => ({ name: c.name, state: c.state ?? "", basis: c.basis === "perUnit" ? "unit" : c.per, kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat, gpu: c.gramsPerUnit });

function inputOf(d: Draft, old: CustomIngredient): CustomInput {
  return { ...old, name: d.name, state: d.state || null, basis: d.basis === "unit" ? "perUnit" : "per100", per: d.basis === "ml" ? "ml" : "g", kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, gramsPerUnit: d.gpu };
}

/**
 * `custom` is the full saved list (edits and deletes are made on it); `shown` (optional) is the part to display,
 * e.g. after a filter. `onCustom` gets the new full list. `onForgetCustom` runs after a delete (forget usual picks).
 */
export function CustomIngredientList({
  custom,
  shown,
  onCustom,
  onForgetCustom,
}: {
  custom: CustomIngredient[];
  shown?: CustomIngredient[];
  onCustom: (l: CustomIngredient[]) => void;
  onForgetCustom: (c: CustomIngredient) => void;
}) {
  const { tr, lang } = useLang();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function startEdit(c: CustomIngredient) {
    setEditing(c.id);
    setDraft(draftOf(c));
    setErr(null);
    setConfirmDel(null);
  }
  function saveEdit(c: CustomIngredient) {
    if (!draft) return;
    const r = editCustom(custom, c.id, inputOf(draft, c), stamp());
    if (!r.ok) {
      setErr(
        r.error === "name" ? tr("ใส่ชื่อก่อน", "Enter a name") : r.error === "kcal" ? tr("ใส่แคลอรี่ (kcal)", "Enter the calories (kcal)") : r.error === "duplicate" ? tr("มีชื่อและสถานะนี้อยู่แล้ว", "That name and state already exist") : tr("ตัวเลขไม่ถูกต้อง", "A number isn't valid"),
      );
      return;
    }
    onCustom(r.list);
    setEditing(null);
    setDraft(null);
  }

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
    {(shown ?? custom).map((c) => (
      <div key={c.id} className="rounded-xl bg-white/70 p-3" data-testid="ai-custom-item">
        {editing === c.id && draft ? (
          <div className="space-y-2" data-testid="ai-custom-edit">
            <input className="field !min-h-[44px]" value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-label={tr("ชื่อ", "Name")} />
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
              <button type="button" className="btn-soft !min-h-[44px] flex-1" onClick={() => setEditing(null)}>{tr("ยกเลิก", "Cancel")}</button>
              <button type="button" className="btn-primary !min-h-[44px] flex-1" onClick={() => saveEdit(c)} data-testid="ai-custom-save">{tr("บันทึก", "Save")}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[14px]">
              <p className="truncate font-medium">{c.name}{c.state ? ` · ${STATE_LABEL[c.state][lang]}` : ""}</p>
              <p className="text-[12px] text-muted">
                <span className="num">{fmtKcal(c.kcal)} kcal</span> {basisLabel(c, lang)} · {macroText(c)}
              </p>
            </div>
            {confirmDel === c.id ? (
              <div className="flex shrink-0 items-center gap-1 text-[14px]">
                <button type="button" className="min-h-[40px] px-2 font-medium text-danger" onClick={() => { onCustom(deleteCustom(custom, c.id)); onForgetCustom(c); setConfirmDel(null); }} data-testid="ai-custom-delete-yes">{tr("ลบเลย", "Delete")}</button>
                <button type="button" className="min-h-[40px] px-2 text-muted" onClick={() => setConfirmDel(null)}>{tr("ไม่ลบ", "Keep")}</button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-1 text-[14px]">
                <button type="button" className="min-h-[40px] px-2 font-medium text-olive-dark" onClick={() => startEdit(c)} data-testid="ai-custom-edit-btn">{tr("แก้", "Edit")}</button>
                <button type="button" className="min-h-[40px] px-2 text-danger" onClick={() => setConfirmDel(c.id)} data-testid="ai-custom-delete">{tr("ลบ", "Delete")}</button>
              </div>
            )}
          </div>
        )}
      </div>
    ))}
    </>
  );
}
