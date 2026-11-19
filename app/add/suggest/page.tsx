"use client";
// "What can I eat with what's left": food ideas in 3 groups that fit today's kcal left.
// 1) her own recipes (real numbers, no AI), 2) 7-Eleven, 3) menu ideas to cook (AI).
// Tap a recipe or 7-Eleven idea → the normal check sheet opens, so she can adjust before saving.
// Tap a menu idea → its recipe (ingredients + steps) first; she can search the name or log it.

import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MealReview, type MealDraft } from "../../components/MealReview";
import { Badge, useAiStatus } from "../../components/ui";
import { aiFetch } from "../../lib/aiFetch";
import { cleanBufferPct } from "../../lib/calorieBuffer";
import { aiDairy } from "../../lib/dairy";
import { guessSlot, thaiDateKey, thaiHour } from "../../lib/date";
import { macroTargets, proteinTargetG } from "../../lib/energy";
import { useLang } from "../../lib/lang";
import { fmtKcal, newId, pickMacros, sumMacros } from "../../lib/nutrition";
import { totalsForRecipe } from "../../lib/recipe";
import { useStore } from "../../lib/store";
import { recipeIdeas, type Idea, type RecipeOption } from "../../lib/suggest";
import type { Entry } from "../../lib/types";
import { Icon } from "../../components/Icon";

/** A web search for the dish name, so she can find other recipes or videos. */
const searchUrl = (name: string, lang: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${name} ${lang === "en" ? "recipe" : "สูตร"}`)}`;

function SuggestInner() {
  const router = useRouter();
  const { ready, entries, goals, recipes, upsertEntry } = useStore();
  const { tr, lang } = useLang();
  const ai = useAiStatus();
  const aiReady = !!ai && (ai.configured || ai.mock);
  const today = thaiDateKey();

  const [step, setStep] = useState<"ideas" | "cook" | "review">("ideas");
  const [loading, setLoading] = useState(true);
  const [seven, setSeven] = useState<Idea[]>([]);
  const [menu, setMenu] = useState<Idea[]>([]);
  const [cooking, setCooking] = useState<Idea | null>(null);
  const [light, setLight] = useState(false);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ idea: Idea; draft: MealDraft } | null>(null);

  const todays = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const eaten = useMemo(() => sumMacros(todays.flatMap((e) => e.items.map(pickMacros))), [todays]);
  const target = goals.targetKcal;
  const left = target - eaten.kcal;
  const proteinLeft = Math.max(0, macroTargets(target, proteinTargetG(goals.profile)).protein - eaten.protein);

  const recipeOptions = useMemo<RecipeOption[]>(
    () =>
      recipes.flatMap((r) => {
        const t = totalsForRecipe(r, lang);
        return t.complete && t.perServing.kcal > 0 ? [{ id: r.id, name: r.name, ...pickMacros(t.perServing) }] : [];
      }),
    [recipes, lang],
  );
  const mine = useMemo(() => recipeIdeas(recipeOptions, left), [recipeOptions, left]);

  const ask = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await aiFetch(
        "/api/suggest",
        {
          kcalLeft: left,
          proteinLeft,
          slot: guessSlot(),
          hour: thaiHour(),
          eatenToday: todays.map((e) => e.title),
          avoidDairy: goals.avoidDairy === true,
          lang,
          bufferPct: cleanBufferPct(goals.calorieBuffer),
        },
        lang,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        setSeven([]);
        setMenu([]);
      } else {
        setSeven((data.result.seven ?? []) as Idea[]);
        setMenu((data.result.menu ?? []) as Idea[]);
        setLight(Boolean(data.result.light));
        setMock(Boolean(data.mock));
      }
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  }, [left, proteinLeft, todays, goals.avoidDairy, goals.calorieBuffer, lang, tr]);

  // Ask once, as soon as her diary has loaded.
  const asked = useRef(false);
  useEffect(() => {
    if (!ready || asked.current) return;
    asked.current = true;
    void ask();
  }, [ready, ask]);

  function pick(idea: Idea) {
    setPicked({
      idea,
      draft: {
        title: idea.name,
        slot: guessSlot(),
        items: [
          {
            id: newId("it"),
            name: idea.name,
            amount: idea.amount > 0 ? idea.amount : 1,
            unit: idea.place === "recipe" ? tr("เสิร์ฟ", "serving") : idea.unit,
            kcal: idea.kcal,
            protein: idea.protein,
            carbs: idea.carbs,
            fat: idea.fat,
            estimated: idea.place !== "recipe",
            kind: "food",
            note: null,
            box: null,
            dairy: aiDairy(idea.name, undefined),
            dairySource: null,
            // Round 40: the AI's own kcal + the buffer % this idea was sized with (kcal only).
            ...(idea.aiKcal != null ? { aiKcal: idea.aiKcal, bufferPct: idea.bufferPct } : {}),
            // Round 39: her recipe → worked out from it; an AI idea → the AI's estimate.
            prov: idea.place === "recipe" ? { source: "recipe", verification: "unknown" } : { source: "ai", verification: "estimated", via: "suggest" },
          },
        ],
      },
    });
    setStep("review");
  }

  function save(d: MealDraft) {
    const recipe = picked?.idea.place === "recipe" ? recipes.find((r) => r.id === picked.idea.recipeId) : undefined;
    const now = Date.now();
    const entry: Entry = {
      id: newId("en"),
      date: today,
      slot: d.slot,
      title: d.title,
      ...(d.alt ? { alt: d.alt } : {}),
      items: d.items,
      source: recipe ? "recipe" : "text",
      photoId: null,
      recipe: recipe
        ? {
            recipeId: recipe.id,
            recipeName: recipe.name,
            ...(recipe.alt ? { alt: recipe.alt } : {}),
            mode: "servings",
            servings: d.items[0]?.amount ?? 1,
            grams: null,
            ingredients: recipe.ingredients.map((i) => ({ ...i })),
            recipeServings: recipe.servings,
            recipeCookedWeight: recipe.cookedWeight,
          }
        : null,
      createdAt: now,
      updatedAt: now,
    };
    upsertEntry(entry);
    router.push("/");
  }

  if (step === "review" && picked) {
    return (
      <main className="page">
        <header className="mb-4 flex items-center gap-3">
          <button className="grid h-11 w-11 place-items-center rounded-full bg-paper" onClick={() => setStep(picked.idea.place === "menu" ? "cook" : "ideas")} aria-label={tr("กลับ", "Back")}>
            <Icon name="caret-left" className="h-5 w-5" />
          </button>
          <h1 className="text-[22px] font-semibold">{tr("ตรวจก่อนบันทึก", "Check before saving")}</h1>
        </header>
        <MealReview
          photo={null}
          initial={picked.draft}
          mockBadge={mock}
          chatEnabled={aiReady}
          chatDisabledReason={tr("ยังไม่ได้ตั้งค่า AI (OpenRouter) — แตะรายการเพื่อแก้เองได้", "The AI (OpenRouter) is not set up — tap an item to edit it yourself")}
          onSave={save}
          onCancel={() => setStep(picked.idea.place === "menu" ? "cook" : "ideas")}
        />
      </main>
    );
  }

  if (step === "cook" && cooking) {
    const c = cooking;
    const macro = (label: string, v: number) => (
      <span className="flex-1 rounded-xl bg-cream px-2 py-2 text-center">
        <span className="num block text-[17px] font-semibold">{Math.round(v)}</span>
        <span className="block text-[12px] text-muted">{label} g</span>
      </span>
    );
    return (
      <main className="page space-y-4" data-testid="suggest-cook">
        <header className="flex items-center gap-3">
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper" onClick={() => setStep("ideas")} aria-label={tr("กลับ", "Back")}>
            <Icon name="caret-left" className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 text-[22px] font-semibold leading-snug">{c.name}</h1>
        </header>

        <section className="card px-5 py-4">
          <p className="text-center">
            <b className="num text-[28px]">{fmtKcal(c.kcal)}</b> <span className="text-muted">kcal · {tr("1 ที่", "1 serving")}</span>
          </p>
          <div className="mt-3 flex gap-2">
            {macro(tr("โปรตีน", "Protein"), c.protein)}
            {macro(tr("คาร์บ", "Carbs"), c.carbs)}
            {macro(tr("ไขมัน", "Fat"), c.fat)}
          </div>
        </section>

        <section>
          <h2 className="mb-1.5 px-1 text-[14px] font-semibold text-muted">{tr("วัตถุดิบ", "Ingredients")}</h2>
          <ul className="card overflow-hidden" data-testid="cook-ingredients">
            {c.ingredients.map((x, n) => (
              <li key={n} className="border-t border-line px-4 py-2.5 text-[16px] first:border-t-0">{x}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 px-1 text-[14px] font-semibold text-muted">{tr("วิธีทำ", "How to make it")}</h2>
          <ol className="card overflow-hidden" data-testid="cook-steps">
            {c.steps.map((x, n) => (
              <li key={n} className="flex gap-3 border-t border-line px-4 py-2.5 text-[16px] first:border-t-0">
                <span className="num shrink-0 font-semibold text-muted">{n + 1}.</span>
                <span>{x}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="px-1 text-[13px] text-muted">
          {c.bufferPct > 0 && c.aiKcal != null
            ? tr(
                `สูตรและแคลอรี่จาก AI เป็นค่าประมาณ (AI ~${Math.round(c.aiKcal)} kcal + เผื่อ ${c.bufferPct}% ตามที่ตั้งไว้ = ${Math.round(c.kcal)} kcal)`,
                `The recipe and kcal come from the AI and are estimates (AI ~${Math.round(c.aiKcal)} kcal + your ${c.bufferPct}% buffer = ${Math.round(c.kcal)} kcal)`,
              )
            : tr("สูตรและแคลอรี่จาก AI เป็นค่าประมาณ", "The recipe and kcal come from the AI and are estimates")}
        </p>

        <button className="btn-primary w-full" onClick={() => pick(c)} data-testid="cook-log">
          {tr("กินเมนูนี้ · บันทึก", "I ate this · Log it")}
        </button>
        <a className="btn-soft flex w-full" href={searchUrl(c.name, lang)} target="_blank" rel="noreferrer" data-testid="cook-search">
          {tr("ค้นหาสูตรอื่นของเมนูนี้", "Search other recipes for this")}
        </a>
      </main>
    );
  }

  const row = (i: Idea, sub: string) => (
    <li key={i.name} className="border-t border-line first:border-t-0">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-cream"
        onClick={() => {
          if (i.place === "menu") {
            setCooking(i);
            setStep("cook");
            window.scrollTo(0, 0);
          } else pick(i);
        }}
        data-testid="suggest-idea"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug">{i.name}</span>
          <span className="block text-[13px] text-muted">{sub}</span>
        </span>
        <span className="num shrink-0 text-[18px] font-semibold">
          {fmtKcal(i.kcal)} <span className="text-[12px] font-normal text-muted">kcal</span>
        </span>
      </button>
    </li>
  );
  const protein = (i: Idea) => `${tr("โปรตีน", "Protein")} ${Math.round(i.protein)} g`;
  const amount = (i: Idea) => (i.amount > 0 && i.unit ? `${i.amount} ${i.unit} · ` : "");

  const group = (id: string, dot: string, title: string, body: ReactNode) => (
    <section data-testid={`suggest-group-${id}`}>
      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[14px] font-semibold text-muted">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        {title}
      </h2>
      {body}
    </section>
  );
  const note = (text: string) => <p className="card px-4 py-3 text-[14px] text-muted">{text}</p>;
  const aiBody = (list: Idea[], sub: (i: Idea) => string, extra?: ReactNode) =>
    loading ? (
      note(tr("กำลังคิดเมนูให้…", "Thinking of ideas…"))
    ) : error ? (
      <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">{error}</p>
    ) : (
      <div className="card overflow-hidden">
        {list.length ? (
          <ul>{list.map((i) => row(i, sub(i)))}</ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-muted">{tr("ยังไม่มีเมนูที่พอดี ลองขอใหม่นะ", "Nothing fits right now. Try new ideas.")}</p>
        )}
        {extra}
      </div>
    );

  return (
    <main className="page space-y-5">
      <header className="flex items-center gap-3">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-paper" onClick={() => router.push("/")} aria-label={tr("กลับ", "Back")}>
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-semibold">{tr("กินอะไรดี", "What can I eat?")}</h1>
        {mock && <Badge>{tr("AI จำลอง", "Test AI")}</Badge>}
      </header>

      <section className="card px-5 py-4 text-center" data-testid="suggest-left">
        {left >= 0 ? (
          <p className="text-[17px]">
            {tr("วันนี้เหลืออีก", "You have")} <b className="num text-[22px]">{fmtKcal(left)}</b> kcal{tr("", " left today")}
          </p>
        ) : (
          <p className="text-[17px]">
            {tr("วันนี้เกินเป้ามา", "Today is")} <b className="num text-[22px]">{fmtKcal(-left)}</b> kcal{tr("", " over target")}
          </p>
        )}
        <p className="mt-1 text-[14px] text-muted">
          {tr("โปรตีนที่ยังขาด", "Protein still to go")} <span className="num font-semibold text-ink">{Math.round(proteinLeft)}</span> g
        </p>
      </section>

      {light && !loading && !error && (
        <p className="rounded-2xl bg-olive-soft px-4 py-3 text-[15px] text-olive-dark" data-testid="suggest-light">
          {left >= 0
            ? tr("ใกล้ถึงเป้าแล้ว เก่งมาก ถ้ายังหิว ลองของเบา ๆ ที่อิ่มท้องดูนะ", "You're almost at your target, well done. If you're still hungry, try something light and filling.")
            : tr("ไม่เป็นไรเลยนะ บางวันก็กินเยอะได้ ถ้ายังหิว ลองของเบา ๆ ที่อิ่มท้องดู", "That's totally okay. Some days we eat more. If you're still hungry, try something light and filling.")}
        </p>
      )}

      {group(
        "recipe",
        "bg-pink",
        tr("สูตรของฉัน", "My recipes"),
        mine.length ? (
          <ul className="card overflow-hidden">{mine.map((i) => row(i, `${tr("1 เสิร์ฟ", "1 serving")} · ${protein(i)}`))}</ul>
        ) : (
          note(
            recipeOptions.length
              ? tr("ยังไม่มีสูตรที่พอดีกับแคลที่เหลือ", "None of your recipes fit what's left")
              : tr("ยังไม่มีสูตร ไปเพิ่มได้ที่แท็บ สูตรของฉัน", "No recipes yet. Add some in the My recipes tab."),
          )
        ),
      )}

      {group("seven", "bg-mint", "7-Eleven", aiBody(seven, (i) => `${amount(i)}${protein(i)}`))}

      {group("menu", "bg-sky", tr("เมนูทำเอง", "Cook it yourself"), aiBody(menu, (i) => `${i.why ? `${i.why} · ` : ""}${protein(i)}`))}

      <p className="px-1 text-[13px] text-muted">
        {tr(
          "แตะเมนูทำเองเพื่อดูสูตร · แตะอย่างอื่นเพื่อตรวจและแก้ก่อนบันทึก · เลขจาก AI เป็นค่าประมาณ",
          "Tap a cook-it-yourself idea to see its recipe · tap others to check and adjust before saving · AI numbers are estimates",
        )}
      </p>

      <button className="btn-soft w-full" onClick={() => void ask()} disabled={loading} data-testid="suggest-again">
        {tr("ขอไอเดียใหม่", "New ideas")}
      </button>
    </main>
  );
}

export default function SuggestPage() {
  return (
    <Suspense>
      <SuggestInner />
    </Suspense>
  );
}
