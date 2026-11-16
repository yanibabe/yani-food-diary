"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Badge, KcalBig, MacroCards, MissingNote, NumberField, ProvenanceBadge, Sheet, StoredPhoto, PotIcon, potTone } from "../../components/ui";
import { guessSlot, thaiDateKey } from "../../lib/date";
import { fmtAmount, fmtG, fmtKcal, newId } from "../../lib/nutrition";
import { ingredientMacros, mealFromRecipe, totalsForRecipe } from "../../lib/recipe";
import { dairyIngredients, looksDairy, warnDairy } from "../../lib/dairy";
import { useLang } from "../../lib/lang";
import { useStore } from "../../lib/store";
import { SLOT_LABEL, SLOTS, UNIT_LABEL, type Ingredient, type MealSlot, type Recipe } from "../../lib/types";
import { Icon } from "../../components/Icon";

function LogSheet({ recipe, open, onClose, date }: { recipe: Recipe; open: boolean; onClose: () => void; date: string }) {
  const { upsertEntry } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<"servings" | "grams">("servings");
  const [value, setValue] = useState<number | null>(1);
  const [slot, setSlot] = useState<MealSlot>(guessSlot());
  const [tweak, setTweak] = useState(false);
  const [ings, setIngs] = useState<Ingredient[]>(recipe.ingredients);
  const { tr, lang } = useLang();

  const meal = useMemo(
    () => mealFromRecipe(ings, recipe.servings, recipe.cookedWeight, mode, value ?? 0),
    [ings, recipe.servings, recipe.cookedWeight, mode, value],
  );
  const changed = ings.some((i, k) => i.amount !== recipe.ingredients[k]?.amount);
  const hasEstimate = ings.some((i) => {
    const r = ingredientMacros(i);
    return r.ok && r.prov.verification === "estimated";
  });

  function confirm() {
    if (!meal || !value) return;
    const now = Date.now();
    upsertEntry({
      id: newId("en"),
      date,
      slot,
      title: recipe.name,
      source: "recipe",
      photoId: null,
      items: [
        {
          id: newId("it"),
          name: recipe.name,
          amount: value,
          unit: mode === "servings" ? tr("เสิร์ฟ", "serving") : tr("กรัม", "g"),
          ...meal.macros,
          estimated: hasEstimate,
          // Round 39: worked out from the recipe; as sure as its least sure ingredient.
          prov: meal.prov,
          ...(meal.missing.length ? { missing: meal.missing } : {}),
          kind: "food",
          note: changed ? tr("ปรับวัตถุดิบเฉพาะมื้อนี้", "Ingredients changed for this meal only") : null,
          box: null,
          dairy: looksDairy(recipe.name) || dairyIngredients(ings.filter((i) => i.amount > 0)).length > 0,
          dairySource: dairyIngredients(ings.filter((i) => i.amount > 0)).map((i) => i.name).join(", ") || null,
        },
      ],
      recipe: {
        recipeId: recipe.id,
        recipeName: recipe.name,
        mode,
        servings: mode === "servings" ? value : null,
        grams: mode === "grams" ? value : null,
        ingredients: ings.map((i) => ({ ...i })),
        recipeServings: recipe.servings,
        recipeCookedWeight: recipe.cookedWeight,
      },
      createdAt: now,
      updatedAt: now,
    });
    router.push(date === thaiDateKey() ? "/" : `/?date=${date}`);
  }

  return (
    <Sheet open={open} onClose={onClose} title={tr("บันทึกว่ากิน", "I ate this")}>
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`min-h-[48px] rounded-2xl font-medium ${mode === "servings" ? "bg-olive text-white" : "bg-cream"}`}
            onClick={() => { setMode("servings"); setValue(1); }}
          >
            {tr("กี่เสิร์ฟ", "Servings")}
          </button>
          <button
            className={`min-h-[48px] rounded-2xl font-medium ${mode === "grams" ? "bg-olive text-white" : "bg-cream"} disabled:opacity-40`}
            disabled={!recipe.cookedWeight}
            onClick={() => { setMode("grams"); setValue(null); }}
          >
            {tr("กี่กรัม", "Grams")}
          </button>
        </div>
        {!recipe.cookedWeight && <p className="-mt-2 text-[13px] text-muted">{tr("ใส่ “น้ำหนักรวมหลังปรุง” ในสูตร เพื่อบันทึกเป็นกรัมได้", "Add the “total cooked weight” to the recipe to log in grams")}</p>}

        <div>
          <label className="label" htmlFor="log-value">
            {mode === "servings"
              ? tr(`กินกี่เสิร์ฟ (สูตรนี้มี ${fmtAmount(recipe.servings)} เสิร์ฟ)`, `How many servings? (this recipe makes ${fmtAmount(recipe.servings)})`)
              : tr(`กินกี่กรัม (ทั้งหมด ${fmtAmount(recipe.cookedWeight ?? 0)} g)`, `How many grams? (${fmtAmount(recipe.cookedWeight ?? 0)} g in total)`)}
          </label>
          <NumberField id="log-value" value={value} onChange={setValue} />
          {mode === "servings" && (
            <div className="mt-2 flex gap-2">
              {[0.5, 1, 1.5, 2].map((v) => (
                <button key={v} className={`h-10 flex-1 rounded-xl text-[15px] ${value === v ? "bg-olive-soft font-semibold text-olive-dark" : "bg-cream"}`} onClick={() => setValue(v)}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map((s) => (
            <button key={s} onClick={() => setSlot(s)} className={`min-h-[44px] rounded-2xl text-[15px] font-medium ${slot === s ? "bg-olive text-white" : "bg-cream"}`}>
              {SLOT_LABEL[s][lang]}
            </button>
          ))}
        </div>

        <button className="w-full rounded-2xl bg-cream px-4 py-3 text-left text-[15px]" onClick={() => setTweak((t) => !t)} aria-expanded={tweak}>
          {tweak ? "▾" : "▸"} {tr("ปรับวัตถุดิบเฉพาะมื้อนี้", "Change ingredients for this meal only")}{" "}
          {changed && <Badge tone="olive">{tr("ปรับแล้ว", "Changed")}</Badge>}
        </button>
        {tweak && (
          <div className="space-y-2">
            <p className="text-[13px] text-muted">{tr("ปริมาณ “ทั้งหม้อ” ที่ใช้จริงครั้งนี้ — สูตรต้นฉบับไม่เปลี่ยน", "Amounts for the “whole pot” you really used this time — the recipe itself stays the same")}</p>
            {ings.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{i.name}</span>
                <NumberField
                  className="field num !w-24 text-right"
                  value={i.amount}
                  onChange={(n) => setIngs((p) => p.map((x) => (x.id === i.id ? { ...x, amount: n ?? 0 } : x)))}
                  aria-label={`${tr("ปริมาณ", "Amount")} ${i.name}`}
                />
                <span className="w-12 text-[14px] text-muted">{UNIT_LABEL[i.unit][lang]}</span>
              </div>
            ))}
            {changed && (
              <button className="text-[14px] text-olive-dark underline" onClick={() => setIngs(recipe.ingredients)}>
                {tr("กลับไปใช้ตามสูตร", "Back to the recipe amounts")}
              </button>
            )}
          </div>
        )}

        <div className="rounded-[22px] bg-kcal p-4 text-center">
          {meal ? (
            <>
              <div className="num text-[40px] font-bold leading-none" data-testid="log-preview-kcal">{fmtKcal(meal.macros.kcal)}</div>
              <div className="text-[14px] text-muted">
                kcal · P {fmtG(meal.macros.protein)} · C {fmtG(meal.macros.carbs)} · F {fmtG(meal.macros.fat)} g
              </div>
              <div className="mt-1 text-[13px] text-muted">= {fmtAmount(meal.fraction * 100)}% {tr("ของทั้งสูตร", "of the whole recipe")}</div>
            </>
          ) : (
            <div className="text-[15px] text-muted">{tr("ใส่ปริมาณ หรือแก้ข้อมูลวัตถุดิบให้ครบก่อน", "Enter an amount, or finish the ingredient details first")}</div>
          )}
        </div>

        <button className="btn-primary w-full" disabled={!meal} onClick={confirm}>{tr("บันทึกลงไดอารี", "Save to my diary")}</button>
      </div>
    </Sheet>
  );
}

function RecipeInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const date = useSearchParams().get("date") || thaiDateKey();
  const { ready, recipes, deleteRecipe, goals } = useStore();
  const recipe = recipes.find((r) => r.id === id);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { tr, lang } = useLang();

  if (!ready) return <main className="page" />;
  if (!recipe)
    return (
      <main className="page pt-20 text-center">
        <p>{tr("ไม่พบสูตรนี้", "This recipe wasn't found")}</p>
        <Link href="/recipes" className="btn-soft mt-4">{tr("กลับ", "Back")}</Link>
      </main>
    );
  const t = totalsForRecipe(recipe, lang);
  const avoidDairy = warnDairy(goals);
  const milky = avoidDairy ? dairyIngredients(recipe.ingredients) : [];

  return (
    <main className="page !pt-0 space-y-5">
      <div className="relative -mx-4">
        {recipe.coverPhotoId ? (
          <StoredPhoto id={recipe.coverPhotoId} className="aspect-[4/3] w-full object-cover" alt={recipe.name} />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center text-ink" style={{ background: potTone(recipe.id) }} aria-hidden>
            <PotIcon className="h-20 w-20 opacity-50" strokeWidth={1} />
          </div>
        )}
        <button
          className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-paper/95 shadow"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          onClick={() => router.push("/recipes")}
          aria-label={tr("กลับ", "Back")}
        >
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-1 text-center">
        <h1 className="text-[28px] font-bold">{recipe.name}</h1>
        <p className="text-[15px] text-muted">
          {fmtAmount(recipe.servings)} {tr("เสิร์ฟ", "servings")}
          {recipe.cookedWeight ? ` · ${tr("หลังปรุง", "cooked")} ${fmtAmount(recipe.cookedWeight)} g` : ""}
          {t.perServingGrams ? ` · ${tr("เสิร์ฟละ", "per serving")} ~${Math.round(t.perServingGrams)} g` : ""}
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <KcalBig kcal={t.perServing.kcal} label={tr("ต่อเสิร์ฟ", "Per serving")} />
        <MacroCards m={t.perServing} />
        <p className="text-center text-[14px] text-muted">
          {tr("ทั้งสูตร", "Whole recipe")} <span className="num font-semibold text-ink">{fmtKcal(t.total.kcal)}</span> kcal · P {fmtG(t.total.protein)} · C {fmtG(t.total.carbs)} · F {fmtG(t.total.fat)} g
        </p>
        {t.hasEstimate && <p className="text-center"><Badge>{tr("มีบางวัตถุดิบใช้ค่าประมาณ", "Some ingredients use estimates")}</Badge></p>}
        <MissingNote missing={t.missing} className="text-center" />
        {!t.complete && (
          <p className="rounded-xl bg-warn px-3 py-2 text-center text-[14px] text-warn-ink">{tr("ข้อมูลวัตถุดิบยังไม่ครบ — กด “แก้สูตร”", "Some ingredient details are missing — tap “Edit recipe”")}</p>
        )}
      </section>

      {milky.length > 0 && (
        <div className="rounded-[22px] bg-warn px-4 py-3 text-warn-ink" role="note" data-testid="dairy-warning">
          <p className="font-semibold">🥛 {tr("สูตรนี้มีนม", "This recipe has milk")}</p>
          <p className="text-[15px]">{milky.map((i) => i.name).join(" · ")}</p>
        </div>
      )}

      <button className="btn-primary w-full !min-h-[58px] text-[19px]" onClick={() => setLogOpen(true)} disabled={!t.complete}>
        {tr("บันทึกว่ากิน", "I ate this")}
      </button>

      <section>
        <h2 className="mb-2 px-1 text-[19px] font-semibold">{tr("วัตถุดิบ", "Ingredients")}</h2>
        <div className="hscroll -mx-4 px-4">
          {recipe.ingredients.map((i) => {
            const r = ingredientMacros(i, lang);
            return (
              <div key={i.id} className="card w-[150px] overflow-hidden" data-testid="ingredient-tile">
                <div className="p-3">
                  <div className="truncate font-semibold">{i.name}</div>
                  <div className="text-[14px] text-muted">{fmtAmount(i.amount)} {UNIT_LABEL[i.unit][lang]}</div>
                  <div className="num mt-1 text-[15px] font-semibold">{r.ok ? `${fmtKcal(r.macros.kcal)} kcal` : "–"}</div>
                  {r.ok && <div className="mt-1"><ProvenanceBadge prov={r.prov} /></div>}
                  {avoidDairy && looksDairy(i.name) && <div className="mt-1"><Badge>🥛 {tr("นม", "Milk")}</Badge></div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-[19px] font-semibold">{tr("วิธีทำ", "How to make it")}</h2>
          <div className="hscroll -mx-4 px-4">
            {recipe.steps.map((s, k) => (
              <div key={k} className="card w-[240px] p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-olive text-white">{k + 1}</div>
                <p className="text-[15px] leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <Link href={`/recipes/${recipe.id}/edit`} className="btn-soft flex-1">{tr("แก้สูตร", "Edit recipe")}</Link>
        {confirmDel ? (
          <button className="btn-primary flex-1 !bg-danger" onClick={() => { deleteRecipe(recipe.id); router.replace("/recipes"); }}>
            {tr("ยืนยันลบสูตร", "Yes, delete recipe")}
          </button>
        ) : (
          <button className="btn-soft flex-1 !bg-[#f6e1dc] !text-danger" onClick={() => setConfirmDel(true)}>{tr("ลบสูตร", "Delete recipe")}</button>
        )}
      </div>
      <p className="text-center text-[13px] text-muted">{tr("ลบสูตรแล้ว มื้อที่เคยบันทึกไว้ยังอยู่ครบ", "Deleting a recipe keeps every meal you already logged")}</p>

      {logOpen && <LogSheet recipe={recipe} open={logOpen} onClose={() => setLogOpen(false)} date={date} />}
    </main>
  );
}

export default function RecipePage() {
  return (
    <Suspense>
      <RecipeInner />
    </Suspense>
  );
}
