"use client";
// Round 47: "My ingredients" — the foods she saved ("Save for future use"), in plain sight, with Edit and Delete.
// The edit form is the shared CustomIngredientList (same one as the search's "Manage" fold).

import { useEffect, useMemo, useState } from "react";
import { useLang } from "../lib/lang";
import { addCustom, forgetPickEverywhere, loadCustom, loadPrefs, saveCustom, savePrefs, type CustomIngredient } from "../lib/customIngredients";
import { filterMine, sortMine } from "../lib/myIngredients";
import { CustomIngredientList } from "./CustomIngredientList";
import { CreateIngredientForm } from "./CreateIngredientForm";
import { AddIngredientSheet } from "./AddIngredientSheet";
import { customInputFromItem, findSameName } from "../lib/saveCustomFromItem";
import { ingredientToItem } from "../lib/searchFood";
import { newId } from "../lib/nutrition";
import type { Ingredient } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./ui";

export function MyIngredients() {
  const { tr, lang } = useLang();
  const [custom, setCustom] = useState<CustomIngredient[]>(() => loadCustom());
  const [query, setQuery] = useState("");
  /** Round 65: the "+" opens the same ingredient search the recipes use; picking one saves it here, per 100 g (or per unit). */
  const [searching, setSearching] = useState(false);
  /** The words she typed when she chose "create my own" in that search (null = the form is closed). */
  const [creating, setCreating] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);
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

  function picked(ing: Ingredient) {
    const item = ingredientToItem(ing, newId("it"), lang, 0);
    setSearching(false);
    if (!item) {
      // The numbers for this pick are not known yet (e.g. the search could not work them out).
      setNote(tr("ยังไม่มีตัวเลขของวัตถุดิบนี้ ลองเลือกตัวอื่น หรือสร้างเอง", "No numbers for this one yet. Try another, or create your own."));
      return;
    }
    const base = customInputFromItem(item);
    if (!base) {
      setNote(tr("ยังไม่มีตัวเลขของวัตถุดิบนี้ ลองเลือกตัวอื่น หรือสร้างเอง", "No numbers for this one yet. Try another, or create your own."));
      return;
    }
    // Keep what the search knows about the unit (e.g. 1 egg ≈ 50 g), so the saved food also works in grams in a recipe.
    const r = addCustom(custom, { ...base, unit: base.basis === "perUnit" ? ing.unit : null, gramsPerUnit: ing.gramsPerUnit ?? null, gPerMl: ing.gPerMl ?? null }, Date.now());
    if (r.ok) {
      change(r.list);
      setQuery("");
      setNote(tr(`เพิ่ม “${r.item.name}” แล้ว`, `Added “${r.item.name}”`));
    } else if (r.error === "duplicate") {
      const name = findSameName(custom, item.name)?.name ?? item.name;
      setNote(tr(`“${name}” มีอยู่แล้วในวัตถุดิบของฉัน`, `“${name}” is already in My ingredients`));
    } else {
      setNote(tr("เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't add it. Please try again."));
    }
  }

  const addBtn = (main: boolean) => (
    <button type="button" className={`${main ? "btn-primary" : "btn-soft"} !min-h-[48px] w-full`} onClick={() => setSearching(true)} data-testid="my-ingredients-add">
      {tr("+ เพิ่มวัตถุดิบของฉัน", "+ Add my ingredient")}
    </button>
  );
  const sheet = (
    <>
      <AddIngredientSheet
        open={searching}
        onClose={() => setSearching(false)}
        onAdd={picked}
        onCreateCustom={(name) => {
          setSearching(false);
          setCreating(name);
        }}
      />
      <Sheet open={creating !== null} onClose={() => setCreating(null)} title={tr("สร้างวัตถุดิบเอง", "Create my own ingredient")} keyboardSafe>
        <CreateIngredientForm
          list={custom}
          initialName={creating ?? ""}
          onCancel={() => setCreating(null)}
          onCreated={(next) => {
            change(next);
            setQuery("");
            setCreating(null);
          }}
        />
      </Sheet>
      {note && (
        <p className="glass px-3 py-2 text-center text-[15px]" role="status" data-testid="my-ingredients-note">
          {note}
        </p>
      )}
    </>
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
