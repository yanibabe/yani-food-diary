"use client";
// Round 45: inside the manual item editor on the Search food page: "Save as my ingredient".
// Same store as the recipe page's "Save for future use". Her typed numbers are never "verified".

import { useState } from "react";
import { useLang } from "../lib/lang";
import { displayUnit } from "../lib/unitNames";
import { loadCustom, saveCustom } from "../lib/customIngredients";
import { customInputFromItem, itemBasis, itemFromCustom, saveItemAsCustom } from "../lib/saveCustomFromItem";
import type { FoodItem } from "../lib/types";

type State = { sig: string; kind: "saved" | "duplicate" | "bad" | "used"; existingId?: string };

export function SaveAsMine({ item, replace }: { item: FoodItem; replace: (it: FoodItem) => void }) {
  const { tr, lang } = useLang();
  const [state, setState] = useState<State | null>(null);
  // Anything typed after saving (name, amount, numbers) makes the saved copy out of date → the button comes back.
  const sig = JSON.stringify([item.name, item.amount, item.unit, item.kcal, item.protein, item.carbs, item.fat, item.missing ?? []]);
  const now = state && state.sig === sig ? state : null;
  const basis = itemBasis(item);
  const perWhat = basis === "g" ? tr("ต่อ 100 กรัม", "per 100 g") : basis === "ml" ? tr("ต่อ 100 มล.", "per 100 ml") : tr(`ต่อ 1 ${displayUnit(item.unit, "th") || "หน่วย"}`, `per 1 ${displayUnit(item.unit, "en") || "unit"}`);

  function save() {
    const r = saveItemAsCustom(loadCustom(), item, Date.now());
    if (r.ok) {
      saveCustom(r.list);
      setState({ sig, kind: "saved" });
    } else if (r.error === "duplicate") setState({ sig, kind: "duplicate", existingId: r.existing.id });
    else setState({ sig, kind: "bad" });
  }
  function useExisting() {
    const c = loadCustom().find((x) => x.id === now?.existingId);
    const it = c ? itemFromCustom(c, item, lang) : null;
    if (it) {
      replace(it);
      setState(null);
    } else setState({ sig, kind: "bad" });
  }

  if (!item.name.trim() || !customInputFromItem(item)) return null;
  return (
    <div className="space-y-1 rounded-2xl bg-cream px-4 py-2" data-testid="save-as-mine">
      <button type="button" className="min-h-[44px] text-[15px] font-medium text-olive-dark disabled:text-muted" onClick={save} disabled={now?.kind === "saved"} data-testid="save-as-mine-btn">
        {now?.kind === "saved" ? tr("✓ บันทึกเป็นวัตถุดิบของฉันแล้ว", "✓ Saved to my ingredients") : tr("บันทึกเป็นวัตถุดิบของฉัน", "Save as my ingredient")}
      </button>
      {!now && <p className="text-[12px] text-muted">{tr(`จะบันทึกตัวเลขข้างบนเป็นค่า${perWhat} ครั้งหน้าค้นชื่อนี้ก็เจอ`, `Saves the numbers above as ${perWhat}. Search this name next time and it is there.`)}</p>}
      {now?.kind === "saved" && <p className="text-[12px] text-muted" data-testid="save-as-mine-ok">{tr("ครั้งหน้าค้นชื่อนี้ก็เจอ (แก้/ลบได้ใน “จัดการ”)", "Next time, searching this name finds it (edit or delete in “Manage”)")}</p>}
      {now?.kind === "duplicate" && (
        <div className="space-y-1" data-testid="save-as-mine-dup">
          <p className="text-[13px] text-warn-ink">{tr("มีวัตถุดิบชื่อนี้ของฉันอยู่แล้ว", "You already have an ingredient with this name.")}</p>
          <button type="button" className="min-h-[44px] text-[14px] font-medium text-olive-dark" onClick={useExisting} data-testid="save-as-mine-use">
            {tr("ใช้อันที่มีอยู่แล้ว", "Use the one I already have")}
          </button>
          <p className="text-[12px] text-muted">{tr("หรือเปลี่ยนชื่อก่อนบันทึก / แก้ใน “จัดการ” ในช่องค้นหา", "Or change the name first / edit it in “Manage” on the search page")}</p>
        </div>
      )}
      {now?.kind === "bad" && <p className="text-[12px] text-warn-ink">{tr("บันทึกไม่ได้ ตรวจชื่อ ปริมาณ และแคลอรี่อีกครั้ง", "Couldn't save. Check the name, amount and calories.")}</p>}
    </div>
  );
}
