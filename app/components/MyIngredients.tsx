"use client";
// Round 47: "My ingredients" — the foods she saved ("Save for future use"), in plain sight, with as a calm list like the recipes. Round 66: the + and search live in the page header; tapping a row opens the edit sheet.

import { useEffect, useMemo, useState } from "react";
import { useLang } from "../lib/lang";
import { addCustom, forgetPickEverywhere, loadCustom, loadPrefs, saveCustom, savePrefs, type CustomIngredient } from "../lib/customIngredients";
import { basisLabel, filterMine, sortMine } from "../lib/myIngredients";
import { IngredientEditForm } from "./IngredientEditForm";
import { CreateIngredientForm } from "./CreateIngredientForm";
import { AddIngredientSheet } from "./AddIngredientSheet";
import { customInputFromIngredient, findSameName } from "../lib/saveCustomFromItem";
import { ingredientToItem } from "../lib/searchFood";
import { newId } from "../lib/nutrition";
import type { Ingredient } from "../lib/types";
import { Icon } from "./Icon";
import { potTone, Sheet } from "./ui";
import { STATE_LABEL } from "../lib/foodRef";
import { fmtKcal } from "../lib/nutrition";

/** Same soft coloured tile as the recipes (PotTile), but with a leaf: it is an ingredient, not a pot. */
function LeafTile({ id, size, radius }: { id: string; size: number; radius: number }) {
  return (
    <div className="grid shrink-0 place-items-center text-ink" style={{ width: size, height: size, borderRadius: radius, background: potTone(id) }} aria-hidden>
      <Icon name="leaf" className="h-[55%] w-[55%] opacity-60" />
    </div>
  );
}

export function MyIngredients({ query, searching, onSearching, onQueryClear }: { query: string; searching: boolean; onSearching: (v: boolean) => void; onQueryClear: () => void }) {
  const { tr, lang, dn } = useLang();
  const [custom, setCustom] = useState<CustomIngredient[]>(() => loadCustom());
  const [editId, setEditId] = useState<string | null>(null);
  /** Round 65: the "+" opens the same ingredient search the recipes use; picking one saves it here, per 100 g (or per unit). */
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
    onSearching(false);
    if (!item) {
      // The numbers for this pick are not known yet (e.g. the search could not work them out).
      setNote(tr("ยังไม่มีตัวเลขของวัตถุดิบนี้ ลองเลือกตัวอื่น หรือสร้างเอง", "No numbers for this one yet. Try another, or create your own."));
      return;
    }
    const base = customInputFromIngredient(ing, lang);
    if (!base) {
      setNote(tr("ยังไม่มีตัวเลขของวัตถุดิบนี้ ลองเลือกตัวอื่น หรือสร้างเอง", "No numbers for this one yet. Try another, or create your own."));
      return;
    }
    // Keep what the search knows about the unit (e.g. 1 egg ≈ 50 g), so the saved food also works in grams in a recipe.
    const r = addCustom(custom, { ...base, unit: base.basis === "perUnit" ? ing.unit : null, gramsPerUnit: ing.gramsPerUnit ?? null, gPerMl: ing.gPerMl ?? null }, Date.now());
    if (r.ok) {
      change(r.list);
      onQueryClear();
      setNote(tr(`เพิ่ม “${dn(r.item.name, r.item.alt)}” แล้ว`, `Added “${dn(r.item.name, r.item.alt)}”`));
    } else if (r.error === "duplicate") {
      const name = findSameName(custom, item.name)?.name ?? item.name;
      setNote(tr(`“${name}” มีอยู่แล้วในวัตถุดิบของฉัน`, `“${name}” is already in My ingredients`));
    } else {
      setNote(tr("เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't add it. Please try again."));
    }
  }

  const editing = custom.find((c) => c.id === editId) ?? null;
  const sheet = (
    <>
      <AddIngredientSheet
        open={searching}
        onClose={() => onSearching(false)}
        onAdd={picked}
        onCreateCustom={(name) => {
          onSearching(false);
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
            onQueryClear();
            setCreating(null);
          }}
        />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditId(null)} title={editing ? dn(editing.name, editing.alt) : ""} keyboardSafe>
        {editing && <IngredientEditForm key={editing.id} item={editing} list={custom} onChange={change} onForget={forget} onClose={() => setEditId(null)} />}
      </Sheet>
    </>
  );
  const noteLine = note && (
    <p className="glass px-3 py-2 text-center text-[15px]" role="status" data-testid="my-ingredients-note">
      {note}
    </p>
  );

  if (custom.length === 0) {
    return (
      <div className="space-y-3">
        {noteLine}
        <div className="card p-6 text-center" data-testid="my-ingredients-empty">
          <div className="mx-auto w-fit">
            <LeafTile id="empty-ingredients" size={56} radius={18} />
          </div>
          <p className="mt-3 text-[17px]">{tr("ยังไม่มีวัตถุดิบของฉัน", "No saved ingredients yet")}</p>
          <p className="text-[15px] text-muted">
            {tr("กด + มุมขวาบนเพื่อเพิ่ม หรือกดแว่นขยายเพื่อค้นหา", "Tap the + at the top right to add one, or the magnifier to search.")}
          </p>
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="my-ingredients">
      {noteLine}
      {shown.length === 0 ? (
        <p className="px-1 py-6 text-center text-[15px] text-muted">{tr("ไม่เจอ ลองคำอื่น", "Nothing found — try other words")}</p>
      ) : (
        <section className="card overflow-hidden">
          <div className="px-4 py-3.5">
            <span className="block text-[17px]">{tr("วัตถุดิบ", "Ingredients")}</span>
            <span className="block text-[13px] text-muted">
              {shown.length} {tr("รายการ", shown.length === 1 ? "ingredient" : "ingredients")}
            </span>
          </div>
          <div className="px-4 pb-1">
            {shown.map((c) => (
              <button key={c.id} type="button" className="flex w-full items-center gap-3 border-t border-line py-2.5 text-left active:opacity-70" onClick={() => setEditId(c.id)} data-testid="ai-custom-item">
                <LeafTile id={c.id} size={38} radius={11} />
                <span className="min-w-0 flex-1 truncate text-[16px] font-normal">
                  {dn(c.name, c.alt)}
                  {c.state && <span className="text-muted"> · {STATE_LABEL[c.state][lang]}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className="num text-[17px]">{fmtKcal(c.kcal)}</span> <span className="text-[11px] text-muted">kcal</span>
                  <span className="block text-[11px] text-muted">{basisLabel(c, lang)}</span>
                </span>
                <Icon name="caret-right" className="h-3.5 w-3.5 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </section>
      )}
      {sheet}
    </div>
  );
}
