"use client";
import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge, NumberField, StoredPhoto } from "../../../components/ui";
import { fmtG, fmtKcal, newId } from "../../../lib/nutrition";
import { compressImage, savePhoto } from "../../../lib/photos";
import { ingredientMacros, recipeTotals } from "../../../lib/recipe";
import { useLang } from "../../../lib/lang";
import { useStore } from "../../../lib/store";
import { UNIT_LABEL, type Ingredient, type IngredientUnit, type Recipe } from "../../../lib/types";

function blankIngredient(): Ingredient {
  return { id: newId("ing"), name: "", amount: 0, unit: "g", label: null, gramsPerUnit: null, photoId: null };
}

async function pickPhoto(file: File | undefined, maxSide: number, badImageMessage: string): Promise<string | null> {
  if (!file) return null;
  const data = await compressImage(file, maxSide, 0.8, badImageMessage);
  const id = newId("ph");
  await savePhoto(id, data);
  return id;
}

function IngredientCard({
  ing,
  onChange,
  onRemove,
}: {
  ing: Ingredient;
  onChange: (i: Ingredient) => void;
  onRemove: () => void;
}) {
  const set = (p: Partial<Ingredient>) => onChange({ ...ing, ...p });
  const { tr, lang } = useLang();
  const res = ingredientMacros(ing, lang);
  const isCount = ing.unit === "egg" || ing.unit === "piece";
  const needsGpu =
    (ing.label?.basis === "per100" && isCount) || (ing.label?.basis === "perUnit" && !isCount) || (!ing.label && isCount);
  const unitWord = isCount ? UNIT_LABEL[ing.unit][lang] : tr("ชิ้น", "piece");

  return (
    <div className="card space-y-3 p-4" data-testid="ingredient-card">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <input className="field" value={ing.name} onChange={(e) => set({ name: e.target.value })} placeholder={tr("ชื่อวัตถุดิบ เช่น ไข่ไก่", "Ingredient, e.g. egg")} aria-label={tr("ชื่อวัตถุดิบ", "Ingredient name")} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <NumberField value={ing.amount || null} onChange={(n) => set({ amount: n ?? 0 })} placeholder={tr("ปริมาณ", "Amount")} aria-label={tr("ปริมาณ", "Amount")} />
            <select className="field !w-auto" value={ing.unit} onChange={(e) => set({ unit: e.target.value as IngredientUnit })} aria-label={tr("หน่วย", "Unit")}>
              {(Object.keys(UNIT_LABEL) as IngredientUnit[]).map((u) => (
                <option key={u} value={u}>{UNIT_LABEL[u][lang]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <label className="flex min-h-[44px] items-center gap-3 rounded-2xl bg-cream px-4">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--olive)]"
          checked={!!ing.label}
          onChange={(e) =>
            set({ label: e.target.checked ? { basis: "per100", kcal: 0, protein: 0, carbs: 0, fat: 0 } : null })
          }
        />
        <span>{tr("มีค่าจากฉลากโภชนาการ", "I have the nutrition label")}</span>
      </label>

      {ing.label && (
        <div className="space-y-2 rounded-2xl bg-cream p-3">
          <div className="grid grid-cols-2 gap-2">
            {(["per100", "perUnit"] as const).map((b) => (
              <button
                key={b}
                onClick={() => set({ label: { ...ing.label!, basis: b } })}
                className={`min-h-[44px] rounded-xl text-[15px] font-medium ${ing.label!.basis === b ? "bg-olive text-white" : "bg-paper"}`}
              >
                {b === "per100" ? tr("ต่อ 100 กรัม/มล.", "Per 100 g/ml") : tr("ต่อ 1 หน่วย (ฟอง/ชิ้น)", "Per 1 unit (egg/piece)")}
              </button>
            ))}
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
                <NumberField
                  className="field num !min-h-[44px] !px-2"
                  value={ing.label![k]}
                  onChange={(n) => set({ label: { ...ing.label!, [k]: n ?? 0 } })}
                  aria-label={`${tr("ฉลาก", "Label")} ${l}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {needsGpu && (
        <div>
          <label className="label">{tr(`น้ำหนักต่อ 1 ${unitWord} (กรัม)`, `Weight of 1 ${unitWord} (g)`)}</label>
          <NumberField
            value={ing.gramsPerUnit}
            onChange={(n) => set({ gramsPerUnit: n })}
            placeholder={isCount ? tr("เช่น 50", "e.g. 50") : tr("เช่น 30", "e.g. 30")}
            aria-label={tr("น้ำหนักต่อหน่วย", "Weight per unit")}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px]">
          {res.ok ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="num font-semibold">{fmtKcal(res.macros.kcal)} kcal</span>
              <span className="text-muted">P {fmtG(res.macros.protein)} · C {fmtG(res.macros.carbs)} · F {fmtG(res.macros.fat)}</span>
              {res.source === "label" ? <Badge tone="olive">{tr("จากฉลาก", "From label")}</Badge> : <Badge>{tr("ค่าประมาณ", "Estimate")} ({res.refName})</Badge>}
            </span>
          ) : (
            <span className="text-warn-ink">{res.message}</span>
          )}
        </div>
        <button className="shrink-0 px-2 py-2 text-[14px] text-danger" onClick={onRemove}>{tr("ลบ", "Delete")}</button>
      </div>
    </div>
  );
}

export default function RecipeEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, recipes, upsertRecipe } = useStore();
  const existing = recipes.find((r) => r.id === id) ?? null;
  const { tr } = useLang();
  if (!ready) return <main className="page" />;
  if (id !== "new" && !existing)
    return (
      <main className="page pt-20 text-center">
        <p>{tr("ไม่พบสูตรนี้", "This recipe wasn't found")}</p>
      </main>
    );
  return <RecipeForm key={id} initial={existing} onSave={(r) => { upsertRecipe(r); router.replace(`/recipes/${r.id}`); }} onCancel={() => router.back()} />;
}

function RecipeForm({ initial, onSave, onCancel }: { initial: Recipe | null; onSave: (r: Recipe) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [servings, setServings] = useState<number | null>(initial?.servings ?? 1);
  const [cooked, setCooked] = useState<number | null>(initial?.cookedWeight ?? null);
  const [ings, setIngs] = useState<Ingredient[]>(initial?.ingredients ?? [blankIngredient()]);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [cover, setCover] = useState<string | null>(initial?.coverPhotoId ?? null);
  const [err, setErr] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const { tr, lang } = useLang();

  const totals = useMemo(() => recipeTotals(ings, servings ?? 1, cooked, lang), [ings, servings, cooked, lang]);

  function save() {
    const clean = ings.filter((i) => i.name.trim());
    if (!name.trim()) return setErr(tr("ใส่ชื่อเมนูก่อน", "Enter the dish name first"));
    if (!(servings && servings > 0)) return setErr(tr("จำนวนเสิร์ฟต้องมากกว่า 0", "Servings must be more than 0"));
    if (clean.length === 0) return setErr(tr("ใส่วัตถุดิบอย่างน้อย 1 อย่าง", "Add at least 1 ingredient"));
    const now = Date.now();
    onSave({
      id: initial?.id ?? newId("rc"),
      name: name.trim(),
      servings,
      cookedWeight: cooked && cooked > 0 ? cooked : null,
      ingredients: clean,
      steps: steps.map((s) => s.trim()).filter(Boolean),
      coverPhotoId: cover,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <main className="page space-y-5">
      <header className="flex items-center gap-3">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={onCancel} aria-label={tr("กลับ", "Back")}>‹</button>
        <h1 className="text-[22px] font-semibold">{initial ? tr("แก้สูตร", "Edit recipe") : tr("สูตรใหม่", "New recipe")}</h1>
      </header>

      <button
        onClick={() => coverRef.current?.click()}
        className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[26px] bg-olive-soft text-olive-dark"
      >
        {cover ? (
          <StoredPhoto id={cover} className="h-full w-full object-cover" alt={tr("รูปปก", "Cover photo")} />
        ) : (
          <span className="text-[16px]">📷 {tr("เพิ่มรูปปก (ไม่บังคับ)", "Add a cover photo (optional)")}</span>
        )}
      </button>
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const id = await pickPhoto(e.target.files?.[0], 1280, tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one.")).catch(() => null);
          if (id) setCover(id);
        }}
      />

      <div className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="rc-name">{tr("ชื่อเมนู", "Dish name")}</label>
          <input id="rc-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("เช่น ไข่เจียวแหนม", "e.g. omelet with naem")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="rc-serv">{tr("ทำได้กี่เสิร์ฟ", "Makes how many servings")}</label>
            <NumberField id="rc-serv" value={servings} onChange={setServings} />
          </div>
          <div>
            <label className="label" htmlFor="rc-cooked">{tr("น้ำหนักรวมหลังปรุง (g)", "Total cooked weight (g)")}</label>
            <NumberField id="rc-cooked" value={cooked} onChange={setCooked} placeholder={tr("ไม่บังคับ", "Optional")} />
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="px-1 text-[19px] font-semibold">{tr("วัตถุดิบ", "Ingredients")}</h2>
        <p className="px-1 text-[14px] text-muted">
          {tr("มีค่าจากฉลาก ใช้ค่าจากฉลากก่อน ถ้าไม่มี แอปใช้ค่าประมาณทั่วไป", "Label values are used first. Without a label, the app uses a common estimate.")}
        </p>
        {ings.map((ing) => (
          <IngredientCard
            key={ing.id}
            ing={ing}
            onChange={(n) => setIngs((p) => p.map((x) => (x.id === n.id ? n : x)))}
            onRemove={() => setIngs((p) => p.filter((x) => x.id !== ing.id))}
          />
        ))}
        <button className="btn-soft w-full" onClick={() => setIngs((p) => [...p, blankIngredient()])}>+ {tr("เพิ่มวัตถุดิบ", "Add ingredient")}</button>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 text-[19px] font-semibold">
          {tr("วิธีทำ", "How to make it")} <span className="text-[14px] font-normal text-muted">({tr("ไม่บังคับ", "optional")})</span>
        </h2>
        {steps.map((s, k) => (
          <div key={k} className="flex items-start gap-2">
            <span className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-olive text-[14px] text-white">{k + 1}</span>
            <textarea
              className="field min-h-[64px] flex-1"
              value={s}
              onChange={(e) => setSteps((p) => p.map((x, j) => (j === k ? e.target.value : x)))}
              aria-label={tr(`ขั้นตอนที่ ${k + 1}`, `Step ${k + 1}`)}
            />
            <button className="mt-2 px-2 py-2 text-danger" onClick={() => setSteps((p) => p.filter((_, j) => j !== k))} aria-label={tr("ลบขั้นตอน", "Delete step")}>×</button>
          </div>
        ))}
        <button className="btn-soft w-full" onClick={() => setSteps((p) => [...p, ""])}>+ {tr("เพิ่มขั้นตอน", "Add step")}</button>
      </section>

      <section className="card p-4" data-testid="recipe-totals">
        <h2 className="mb-2 text-[17px] font-semibold">{tr("สรุป", "Summary")}</h2>
        {totals.problems.length > 0 && (
          <p className="mb-2 rounded-xl bg-warn px-3 py-2 text-[14px] text-warn-ink">
            {tr(
              `ยังคำนวณได้ไม่ครบ ${totals.problems.length} รายการ — ดูข้อความใต้วัตถุดิบ`,
              `${totals.problems.length} ingredient(s) can't be worked out yet — see the note under each one`,
            )}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-kcal p-3">
            <div className="text-[13px] text-muted">{tr("ทั้งสูตร", "Whole recipe")}</div>
            <div className="num text-[28px] font-bold">{fmtKcal(totals.total.kcal)}</div>
            <div className="text-[13px] text-muted">kcal</div>
          </div>
          <div className="rounded-2xl bg-olive-soft p-3">
            <div className="text-[13px] text-muted">{tr("ต่อเสิร์ฟ", "Per serving")}</div>
            <div className="num text-[28px] font-bold">{fmtKcal(totals.perServing.kcal)}</div>
            <div className="text-[13px] text-muted">kcal</div>
          </div>
        </div>
      </section>

      {err && <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-danger" role="alert">{err}</p>}
      <div className="flex gap-3">
        <button className="btn-soft flex-1" onClick={onCancel}>{tr("ยกเลิก", "Cancel")}</button>
        <button className="btn-primary flex-[2]" onClick={save}>{tr("บันทึกสูตร", "Save recipe")}</button>
      </div>
    </main>
  );
}
