"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiFetch } from "../../../lib/aiFetch";
import { useParams, useRouter } from "next/navigation";
import { Badge, EnergyHint, MissingNote, NumberField, ProvenanceBadge, StoredPhoto } from "../../../components/ui";
import { fmtG, fmtKcal, newId } from "../../../lib/nutrition";
import { compressImage, savePhoto } from "../../../lib/photos";
import { ingredientMacros, recipeTotals } from "../../../lib/recipe";
import { matchRef, STATE_LABEL } from "../../../lib/foodRef";
import type { LabelInfo } from "../../../lib/types";
import { useLang } from "../../../lib/lang";
import { editMainBox, nameBoxes, type NameAlt } from "../../../lib/names";
import { OtherNameField } from "../../../components/OtherNameField";
import { useStore } from "../../../lib/store";
import { PIECE_LIKE, RECIPE_CATEGORIES, UNIT_GROUPS, UNITS, unitKind, type Ingredient, type IngredientUnit, type Recipe, type RecipeCategory } from "../../../lib/types";
import { Icon } from "../../../components/Icon";
import { IngredientScan } from "../../../components/IngredientScan";
import { UsdaPicker, useUsdaReady } from "../../../components/UsdaPicker";
import { toSnap } from "../../../lib/food/usdaNutrients";
import { AddIngredientSheet, saveTypedAsCustom } from "../../../components/AddIngredientSheet";

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

/** Round 42: keep a typed ingredient for next time. It then shows first in the search. Her numbers stay "typed by you". */
function SaveCustomRow({ ing }: { ing: Ingredient }) {
  const { tr } = useLang();
  const [state, setState] = useState<"idle" | "saved" | "duplicate" | "bad">("idle");
  const l = ing.label;
  if (!l || l.via !== "typed" || !ing.name.trim()) return null;
  const miss = l.missing ?? [];
  const perVolume = unitKind(ing.unit) === "volume";
  function save() {
    if (!l) return;
    const r = saveTypedAsCustom({
      name: ing.name,
      basis: l.basis,
      per: l.per ?? (perVolume ? "ml" : "g"),
      kcal: l.kcal,
      protein: miss.includes("protein") ? null : l.protein,
      carbs: miss.includes("carbs") ? null : l.carbs,
      fat: miss.includes("fat") ? null : l.fat,
      gramsPerUnit: ing.gramsPerUnit,
      gPerMl: ing.gPerMl ?? null,
      unit: ing.unit,
    });
    setState(r.ok ? "saved" : r.error === "duplicate" ? "duplicate" : "bad");
  }
  return (
    <div className="space-y-1" data-testid="save-custom">
      <button type="button" className="min-h-[44px] text-[14px] font-medium text-olive-dark disabled:text-muted" onClick={save} disabled={state === "saved"} data-testid="save-custom-btn">
        {state === "saved" ? tr("✓ บันทึกไว้แล้ว", "✓ Saved") : tr("บันทึกไว้ใช้ครั้งหน้า", "Save for future use")}
      </button>
      {state === "saved" && <p className="text-[12px] text-muted">{tr("ครั้งหน้าค้นหาชื่อนี้ก็เจอ (แก้/ลบได้ใน “จัดการ”)", "Next time, searching this name finds it (edit or delete in “Manage”)")}</p>}
      {state === "duplicate" && <p className="text-[12px] text-warn-ink">{tr("มีชื่อนี้บันทึกไว้แล้ว — แก้ได้ใน “จัดการ” ในช่องค้นหา", "This name is already saved — edit it in “Manage” in the search sheet")}</p>}
      {state === "bad" && <p className="text-[12px] text-warn-ink">{tr("ตัวเลขยังไม่ครบ ตรวจแคลอรี่อีกครั้ง", "A number is missing. Check the calories.")}</p>}
    </div>
  );
}

function IngredientCard({
  ing,
  onChange,
  onPatch,
  onRemove,
}: {
  ing: Ingredient;
  onChange: (i: Ingredient) => void;
  /** Change a few fields later (after the AI answers), without losing newer typing. */
  onPatch: (p: Partial<Ingredient>) => void;
  onRemove: () => void;
}) {
  const set = (p: Partial<Ingredient>) => onChange({ ...ing, ...p });
  const { tr, lang } = useLang();
  const res = ingredientMacros(ing, lang);
  const [looking, setLooking] = useState<string | null>(null); // the name being looked up
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const trimmed = ing.name.trim();
  const hasAi = !!ing.aiRef && ing.aiRef.name === trimmed;
  const hasPick = !!ing.refPick && ing.refPick.name === trimmed;
  // Round 41: a USDA food she confirmed for this name.
  const usdaReady = useUsdaReady();
  const usdaOn = !!ing.usda && ing.usda.name === trimmed;
  const [showUsda, setShowUsda] = useState(false);
  /** Round 39: a clear reference food, or an unclear name she must choose for → no automatic AI lookup. */
  const refKnown = () => matchRef(trimmed).kind !== "none";

  async function lookUp(forUnit: IngredientUnit = ing.unit) {
    const name = ing.name.trim();
    if (!name || ing.label || looking === name) return;
    setLooking(name);
    setAiMsg(null);
    try {
      // Counted unit → AI gives the weight of one; volume unit → AI gives grams per ml.
      const unit = unitKind(forUnit) !== "mass" ? forUnit : undefined;
      const r = await aiFetch("/api/ingredient", { name, lang, unit }, lang);
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setAiMsg(data?.message ?? tr("AI หาค่าไม่ได้ ลองอีกครั้ง", "The AI couldn't look it up. Try again."));
      } else if (!data?.result) {
        setAiMsg(tr("AI ไม่รู้จักวัตถุดิบนี้ — กรอกค่าจากฉลากได้", "The AI doesn't know this ingredient — add the label values"));
      } else {
        const x = data.result;
        onPatch({ aiRef: { name, per100: { kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat }, unitG: x.unitG, gPerMl: x.gPerMl, unitFor: x.unitFor ?? null, state: x.state ?? null }, refPick: null });
      }
    } catch {
      setAiMsg(tr("เชื่อมต่อไม่ได้ ลองอีกครั้ง", "No connection. Try again."));
    } finally {
      setLooking(null);
    }
  }
  const ambiguous = !res.ok && res.reason === "ambiguous";
  // Round 42: one quiet "Advanced" fold holds the AI + USDA lookups (nothing was removed).
  const showAiBtn = !ing.label && !hasAi && !usdaOn && !looking && !!trimmed;
  const showUsdaBtn = usdaReady && !ing.label && !usdaOn && !showUsda && !looking && !!trimmed;
  const hasAdvanced = showAiBtn || showUsdaBtn;
  const isCount = unitKind(ing.unit) === "count";
  /** Does the AI's "weight of one" already fit this unit? */
  const aiFitsUnit = (u: IngredientUnit) =>
    !!ing.aiRef && ing.aiRef.name === trimmed && (ing.aiRef.unitFor ? ing.aiRef.unitFor === u : PIECE_LIKE.includes(u));
  function changeUnit(u: IngredientUnit) {
    set({ unit: u });
    // New counted unit (e.g. กลีบ, กระป๋อง): ask the AI how much ONE of it weighs.
    if (unitKind(u) === "count" && !ing.label && !ing.gramsPerUnit && trimmed && !aiFitsUnit(u) && !refKnown()) void lookUp(u);
    // Round 39: spoons/cups of an AI-looked-up food with no density yet → ask the AI for grams per ml.
    if (unitKind(u) === "volume" && !ing.label && !ing.gPerMl && trimmed && hasAi && !ing.aiRef?.gPerMl) void lookUp(u);
  }
  const needsGpu =
    (ing.label?.basis === "per100" && isCount) ||
    (ing.label?.basis === "perUnit" && !isCount) ||
    (!ing.label && isCount);
  const unitWord = isCount ? UNITS[ing.unit][lang] : tr("ชิ้น", "piece");
  const isVolume = unitKind(ing.unit) === "volume";
  // Round 39: weight of 1 spoon / cup / ml, when the app can't know it (never assumes 1 g/ml).
  const needsDensity = (!res.ok && res.reason === "need-density") || (isVolume && !!ing.gPerMl);
  const volFactor = UNITS[ing.unit].factor;
  /** She changed a label number → the label is her own typing now. */
  const setLabel = (p: Partial<LabelInfo>) => set({ label: { ...ing.label!, ...p, via: "typed" } });

  return (
    <div className="card space-y-3 p-4" data-testid="ingredient-card" data-ing={ing.id}>
      <IngredientScan ing={ing} onPatch={onPatch} />
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <input className="field" value={nameBoxes(ing.name, ing.alt, lang).main} onChange={(e) => { set(editMainBox(ing.name, ing.alt, lang, e.target.value)); setAiMsg(null); }} onBlur={() => { if (!hasAi && !hasPick && !usdaOn && !refKnown()) void lookUp(); }} placeholder={tr("ชื่อวัตถุดิบ เช่น ไข่ไก่", "Ingredient, e.g. egg")} aria-label={tr("ชื่อวัตถุดิบ", "Ingredient name")} />
          {ing.name.trim() && <OtherNameField key={ing.id} name={ing.name} alt={ing.alt} onChange={(r) => set(r)} />}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <NumberField value={ing.amount || null} onChange={(n) => set({ amount: n ?? 0 })} placeholder={tr("ปริมาณ", "Amount")} aria-label={tr("ปริมาณ", "Amount")} />
            <select className="field !w-auto max-w-[150px]" value={ing.unit} onChange={(e) => changeUnit(e.target.value as IngredientUnit)} aria-label={tr("หน่วย", "Unit")}>
              {UNIT_GROUPS.map((g) => (
                <optgroup key={g.kind} label={g.label[lang]}>
                  {(Object.keys(UNITS) as IngredientUnit[])
                    .filter((u) => UNITS[u].kind === g.kind)
                    .map((u) => (
                      <option key={u} value={u}>{UNITS[u][lang]}</option>
                    ))}
                </optgroup>
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
            set({ label: e.target.checked ? { basis: "per100", kcal: 0, protein: 0, carbs: 0, fat: 0, via: "typed" } : null })
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
                aria-pressed={ing.label!.basis === b}
                className={`min-h-[44px] rounded-xl text-[15px] font-medium ${ing.label!.basis === b ? "bg-olive text-white" : "bg-paper"}`}
              >
                {b === "per100" ? tr("ต่อ 100 กรัม/มล.", "Per 100 g/ml") : isCount ? tr(`ต่อ 1 ${unitWord}`, `Per 1 ${unitWord}`) : tr("ต่อ 1 หน่วย (ชิ้น/ซอง)", "Per 1 unit (piece/sachet)")}
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
                  value={k !== "kcal" && ing.label!.missing?.includes(k) ? null : ing.label![k]}
                  onChange={(n) => {
                    const missing = (ing.label!.missing ?? []).filter((x) => x !== k);
                    setLabel({ [k]: n ?? 0, missing: missing.length ? missing : undefined });
                  }}
                  placeholder={k !== "kcal" && ing.label!.missing?.includes(k) ? tr("ไม่ทราบ", "?") : undefined}
                  aria-label={`${tr("ฉลาก", "Label")} ${l}`}
                />
              </div>
            ))}
          </div>
          {ing.label.basis === "per100" && isVolume && (
            // Round 39: is the label per 100 g or per 100 ml? It matters for spoons and cups.
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tr("ฉลากเป็นค่าต่อ", "The label is per")} data-testid="label-per">
              {(["ml", "g"] as const).map((p) => {
                const on = (ing.label!.per ?? "ml") === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ label: { ...ing.label!, per: p } })}
                    className={`min-h-[44px] rounded-xl text-[14px] ${on ? "bg-ink text-white" : "bg-paper"}`}
                  >
                    {p === "ml" ? tr("ฉลากต่อ 100 มล.", "Label per 100 ml") : tr("ฉลากต่อ 100 กรัม", "Label per 100 g")}
                  </button>
                );
              })}
            </div>
          )}
          <EnergyHint m={ing.label} missing={ing.label.missing} />
          <SaveCustomRow ing={ing} />
        </div>
      )}

      {!res.ok && res.reason === "ambiguous" && !looking && (
        // Round 39: an unclear name is never picked by itself — she chooses.
        <div className="space-y-2 rounded-2xl bg-cream p-3" data-testid="ref-choices">
          <p className="text-[14px] text-warn-ink">{res.message}</p>
          <div className="flex flex-wrap gap-2">
            {res.options?.map((f) => (
              <button
                key={f.key}
                type="button"
                className="min-h-[44px] rounded-full border border-white/80 bg-white/70 px-3 text-[14px]"
                onClick={() => onPatch({ refPick: { name: trimmed, key: f.key } })}
                data-testid="ref-choice"
              >
                {f.label[lang]}
                {f.state ? <span className="ml-1 text-muted">· {STATE_LABEL[f.state][lang]}</span> : null}
                <span className="ml-1 num text-muted">{fmtKcal(f.per100.kcal)}/100 g</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showUsda && trimmed && (
        <UsdaPicker
          name={trimmed}
          mode="ingredient"
          onClose={() => setShowUsda(false)}
          onPick={(food) => {
            const snap = toSnap(food);
            if (!snap) return;
            // Only what she confirmed. Her name, amount, unit, label and earlier picks are kept as they are.
            onPatch({ usda: { ...snap, name: trimmed, portions: food.portions, gPerMl: food.gPerMl } });
            setShowUsda(false);
          }}
        />
      )}

      {usdaOn && !ing.label && !showUsda && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" data-testid="usda-chosen">
          <span className="text-muted">USDA: <span className="text-ink">{ing.usda!.description}</span></span>
          <button type="button" className="min-h-[44px] font-medium text-olive-dark" onClick={() => setShowUsda(true)}>{tr("เปลี่ยน", "Change")}</button>
          <button type="button" className="min-h-[44px] text-muted" onClick={() => onPatch({ usda: null })} data-testid="usda-remove">{tr("เลิกใช้ USDA", "Stop using USDA")}</button>
        </div>
      )}

      {needsDensity && (
        <div>
          <label className="label">{tr(`น้ำหนักต่อ 1 ${UNITS[ing.unit][lang]} (กรัม)`, `Weight of 1 ${UNITS[ing.unit][lang]} (g)`)}</label>
          <NumberField
            value={ing.gPerMl ? Math.round(ing.gPerMl * volFactor * 100) / 100 : null}
            onChange={(n) => set({ gPerMl: n && n > 0 ? n / volFactor : null })}
            placeholder={tr("เช่น 13", "e.g. 13")}
            aria-label={tr("น้ำหนักต่อหน่วยตวง", "Weight per measure")}
          />
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
          {usdaOn && !ing.label && !!ing.usda!.portions?.length && (
            // Round 41: USDA's own household weights, as quick choices (she still picks).
            <div className="mt-2 flex flex-wrap gap-2">
              {ing.usda!.portions!.map((p) => (
                <button key={p.label} type="button" className="min-h-[44px] rounded-full border border-white/80 bg-white/70 px-3 text-[13px]" onClick={() => set({ gramsPerUnit: p.grams })}>
                  USDA {p.label} = {fmtG(p.grams)} {tr("ก.", "g")}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="text-[14px]">
          {looking && !ing.label ? (
            <span className="text-muted"><Icon name="sparkle" className="mr-1 inline-block h-4 w-4 align-[-3px]" />{tr("AI กำลังหาค่าสารอาหาร…", "The AI is looking up the nutrition…")}</span>
          ) : res.ok ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="num font-semibold">{fmtKcal(res.macros.kcal)} kcal</span>
              <span className="text-muted">P {fmtG(res.macros.protein)} · C {fmtG(res.macros.carbs)} · F {fmtG(res.macros.fat)}</span>
              <ProvenanceBadge prov={res.prov} />
              {res.state && <Badge tone="muted">{STATE_LABEL[res.state][lang]}</Badge>}
              {res.source === "estimate" && res.refName !== "AI" && <span className="text-[12px] text-muted">({res.refName})</span>}
            </span>
          ) : res.reason === "ambiguous" && !aiMsg ? null : (
            <span className="text-warn-ink">{aiMsg ?? res.message}</span>
          )}
          {res.ok && <MissingNote missing={res.missing} className="mt-1" />}
          {hasAi && !ing.label && !hasPick && !usdaOn && !looking && (
            <span className="mt-1 block text-[12px] text-muted">
              {tr(
                `ต่อ 100 กรัม: ${fmtKcal(ing.aiRef!.per100.kcal)} kcal · ${ing.aiRef!.state ? `ค่า${STATE_LABEL[ing.aiRef!.state].th}` : "ค่าทั่วไป"} ไม่ใช่ค่าจากฉลาก`,
                `Per 100 g: ${fmtKcal(ing.aiRef!.per100.kcal)} kcal · typical ${ing.aiRef!.state ? `${STATE_LABEL[ing.aiRef!.state].en} ` : ""}values, not from a label`,
              )}
            </span>
          )}
          {hasAdvanced && (
            // Round 42: the AI and USDA lookups are still here, but tucked away so the main flow stays calm.
            <details className="mt-1" data-testid="advanced-fold">
              <summary className="min-h-[44px] cursor-pointer py-1.5 text-[14px] text-muted">{tr("ตัวเลือกขั้นสูง", "Advanced")}</summary>
              <div className="flex flex-col items-start pb-1">
                {showAiBtn && (
                  <button type="button" className="min-h-[44px] text-[14px] font-medium text-olive-dark" onClick={() => void lookUp()} data-testid="ai-lookup">
                    <Icon name="sparkle" className="mr-1 inline-block h-4 w-4 align-[-3px]" />{ambiguous ? tr("ไม่ใช่ทั้งหมด — ให้ AI หา", "None of these — ask the AI") : tr("ให้ AI หาค่าสารอาหาร", "Let the AI look up the nutrition")}
                  </button>
                )}
                {showUsdaBtn && (
                  <button type="button" className="min-h-[44px] text-[14px] font-medium text-olive-dark" onClick={() => setShowUsda(true)} data-testid="usda-open">
                    {tr("ค้นหาค่าใน USDA", "Look it up in USDA")}
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
        <button className="min-h-[44px] min-w-[44px] shrink-0 px-2 py-2 text-[14px] text-danger" onClick={onRemove}>{tr("ลบ", "Delete")}</button>
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
  const [nameAlt, setNameAlt] = useState<NameAlt | undefined>(initial?.alt);
  const [servings, setServings] = useState<number | null>(initial?.servings ?? 1);
  const [cooked, setCooked] = useState<number | null>(initial?.cookedWeight ?? null);
  const [ings, setIngs] = useState<Ingredient[]>(initial?.ingredients ?? []);
  const [sheet, setSheet] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [cover, setCover] = useState<string | null>(initial?.coverPhotoId ?? null);
  const [category, setCategory] = useState<RecipeCategory | null>(initial?.category ?? null);
  const [err, setErr] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const { tr, lang } = useLang();

  // Bring a new manual card into view.
  useEffect(() => {
    if (!focusId) return;
    document.querySelector(`[data-ing="${focusId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId]);

  /** Blank leftovers (old empty cards) are dropped when something real is added. */
  const withoutBlanks = (list: Ingredient[]) => list.filter((x) => x.name.trim() || x.amount || x.label);

  const totals = useMemo(() => recipeTotals(ings, servings ?? 1, cooked, lang), [ings, servings, cooked, lang]);

  function save() {
    const clean = ings.filter((i) => i.name.trim());
    if (!name.trim()) return setErr(tr("ใส่ชื่อเมนูก่อน", "Enter the dish name first"));
    if (!(servings && servings > 0)) return setErr(tr("จำนวนเสิร์ฟต้องมากกว่า 0", "Servings must be more than 0"));
    if (clean.length === 0) return setErr(tr("ใส่วัตถุดิบอย่างน้อย 1 อย่าง", "Add at least 1 ingredient"));
    if (!category) return setErr(tr("เลือกหมวดของเมนูก่อน", "Pick a category first"));
    const now = Date.now();
    onSave({
      id: initial?.id ?? newId("rc"),
      name: name.trim(),
      ...(nameAlt && (nameAlt.manual || nameAlt.src === name) ? { alt: { ...nameAlt, src: name.trim() } } : {}),
      servings,
      cookedWeight: cooked && cooked > 0 ? cooked : null,
      ingredients: clean,
      steps: steps.map((s) => s.trim()).filter(Boolean),
      coverPhotoId: cover,
      category,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return (
    <main className="page space-y-5">
      <header className="flex items-center gap-3">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-paper" onClick={onCancel} aria-label={tr("กลับ", "Back")}><Icon name="caret-left" className="h-5 w-5" /></button>
        <h1 className="text-[22px] font-semibold">{initial ? tr("แก้สูตร", "Edit recipe") : tr("สูตรใหม่", "New recipe")}</h1>
      </header>

      <button
        onClick={() => coverRef.current?.click()}
        className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[26px] bg-olive-soft text-olive-dark"
      >
        {cover ? (
          <StoredPhoto id={cover} className="h-full w-full object-cover" alt={tr("รูปปก", "Cover photo")} />
        ) : (
          <span className="text-[16px]">{tr("+ เพิ่มรูปปก (ไม่บังคับ)", "+ Add a cover photo (optional)")}</span>
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
          <input id="rc-name" className="field" value={nameBoxes(name, nameAlt, lang).main} onChange={(e) => { const r = editMainBox(name, nameAlt, lang, e.target.value); setNameAlt(r.alt); setName(r.name); }} placeholder={tr("เช่น ไข่เจียวแหนม", "e.g. omelet with naem")} />
          {name.trim() && <OtherNameField id="rc-name-other" name={name} alt={nameAlt} onChange={(r) => { setName(r.name); setNameAlt(r.alt); }} />}
        </div>
        <div>
          <span className="label">{tr("หมวด", "Category")}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("หมวด", "Category")} data-testid="category-picker">
            {RECIPE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={category === c.key}
                onClick={() => setCategory(c.key)}
                className={`min-h-[44px] rounded-full border px-4 text-[14px] ${category === c.key ? "border-ink bg-ink text-white" : "border-white/80 bg-white/60"}`}
              >
                {c.label[lang]}
              </button>
            ))}
          </div>
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
          {tr(
            "ของที่มีซอง สแกนบาร์โค้ดหรือถ่ายรูปสินค้าได้เลย (หลายรูปก็ได้) ไม่ต้องพิมพ์ ถ้าไม่มีฉลาก AI จะใช้ค่าเฉลี่ยของอาหารนั้นให้เอง",
            "Packed things: scan the barcode or photo the product (several photos are fine) — no typing. Without a label, the AI uses typical values for that food.",
          )}
        </p>
        {ings.map((ing) => (
          <IngredientCard
            key={ing.id}
            ing={ing}
            onChange={(n) => setIngs((p) => p.map((x) => (x.id === n.id ? n : x)))}
            onPatch={(patch) => setIngs((p) => p.map((x) => (x.id === ing.id ? { ...x, ...patch } : x)))}
            onRemove={() => setIngs((p) => p.filter((x) => x.id !== ing.id))}
          />
        ))}
        <button className="btn-soft w-full" onClick={() => setSheet(true)} data-testid="add-ingredient">+ {tr("เพิ่มวัตถุดิบ", "Add ingredient")}</button>
        <AddIngredientSheet
          open={sheet}
          onClose={() => setSheet(false)}
          onAdd={(ing) => {
            setIngs((p) => [...withoutBlanks(p), ing]);
            setFocusId(ing.id);
          }}
          onCreateCustom={(typed) => {
            // The existing manual editor, with the typed name and the "label numbers" box already open (unknown = left empty).
            const card: Ingredient = { ...blankIngredient(), name: typed, label: { basis: "per100", kcal: 0, protein: 0, carbs: 0, fat: 0, via: "typed", missing: ["protein", "carbs", "fat"] } };
            setIngs((p) => [...withoutBlanks(p), card]);
            setFocusId(card.id);
            setSheet(false);
          }}
        />
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
            <button className="mt-2 flex min-h-[44px] min-w-[44px] items-center justify-center px-2 py-2 text-danger" onClick={() => setSteps((p) => p.filter((_, j) => j !== k))} aria-label={tr("ลบขั้นตอน", "Delete step")}><Icon name="x" className="h-5 w-5" /></button>
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
