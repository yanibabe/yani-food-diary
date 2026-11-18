"use client";
// Round 47: "My ingredients" — the foods she saved ("Save for future use"), in plain sight, with Edit and Delete.
// The edit form is the shared CustomIngredientList (same one as the search's "Manage" fold).

import { useMemo, useState } from "react";
import { useLang } from "../lib/lang";
import { forgetPickEverywhere, loadCustom, loadPrefs, saveCustom, savePrefs, type CustomIngredient } from "../lib/customIngredients";
import { filterMine, sortMine } from "../lib/myIngredients";
import { CustomIngredientList } from "./CustomIngredientList";
import { CreateIngredientForm } from "./CreateIngredientForm";
import { Icon } from "./Icon";
import { Sheet } from "./ui";

export function MyIngredients() {
  const { tr } = useLang();
  const [custom, setCustom] = useState<CustomIngredient[]>(() => loadCustom());
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const sorted = useMemo(() => sortMine(custom), [custom]);
  const shown = useMemo(() => filterMine(sorted, query), [sorted, query]);

  function change(list: CustomIngredient[]) {
    setCustom(list);
    saveCustom(list);
  }
  // Deleting a saved food also forgets the "usual pick" that pointed at it (same as the Manage fold).
  function forget(c: CustomIngredient) {
    savePrefs(forgetPickEverywhere(loadPrefs(), { kind: "custom", id: c.id, name: c.name }));
  }

  const addBtn = (main: boolean) => (
    <button type="button" className={`${main ? "btn-primary" : "btn-soft"} !min-h-[48px] w-full`} onClick={() => setAdding(true)} data-testid="my-ingredients-add">
      {tr("+ เพิ่มวัตถุดิบของฉัน", "+ Add my ingredient")}
    </button>
  );
  const sheet = (
    <Sheet open={adding} onClose={() => setAdding(false)} title={tr("เพิ่มวัตถุดิบของฉัน", "Add my ingredient")} keyboardSafe>
      <CreateIngredientForm
        list={custom}
        onCancel={() => setAdding(false)}
        onCreated={(next) => {
          change(next);
          setQuery("");
          setAdding(false);
        }}
      />
    </Sheet>
  );

  if (custom.length === 0) {
    return (
      <div className="space-y-3">
      <div className="card p-6 text-center" data-testid="my-ingredients-empty">
        <p className="text-[17px]">{tr("ยังไม่มีวัตถุดิบของฉัน", "No saved ingredients yet")}</p>
        <p className="mt-1 text-[15px] text-muted">
          {tr(
            "เวลาสร้างวัตถุดิบเอง (ในช่องค้นหา กด “+ สร้างวัตถุดิบเอง”) แล้วกด “บันทึกไว้ใช้ครั้งหน้า” มันจะมาอยู่ที่นี่ ให้ค้นเจอและแก้ได้",
            "When you add your own food (in search, tap “+ Add custom ingredient”) and tap “Save for future use”, it shows up here so you can find, edit or delete it.",
          )}
        </p>
        <div className="mt-4">{addBtn(true)}</div>
      </div>
      {sheet}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="my-ingredients">
      {addBtn(false)}
      <div className="relative">
        <Icon name="magnifying-glass" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          className="w-full rounded-full border border-white/90 bg-white/70 py-3 pl-12 pr-4 text-[16px] outline-none placeholder:text-muted"
          placeholder={tr("ค้นหาวัตถุดิบของฉัน", "Search my ingredients")}
          aria-label={tr("ค้นหาวัตถุดิบของฉัน", "Search my ingredients")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          data-testid="my-ingredients-search"
        />
      </div>
      <div className="card space-y-2 p-3">
        <CustomIngredientList custom={custom} shown={shown} onCustom={change} onForgetCustom={forget} />
        {shown.length === 0 && <p className="px-1 py-3 text-center text-[14px] text-muted">{tr("ไม่เจอ ลองคำอื่น", "Nothing found — try other words")}</p>}
      </div>
      {sheet}
    </div>
  );
}
