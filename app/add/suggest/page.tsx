"use client";
// "🤔 What can I eat with what's left": AI food ideas that fit today's kcal left.
// Tap an idea → the normal check sheet opens, so she can adjust before saving.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MealReview, type MealDraft } from "../../components/MealReview";
import { Badge, useAiStatus } from "../../components/ui";
import { aiFetch } from "../../lib/aiFetch";
import { aiDairy } from "../../lib/dairy";
import { guessSlot, thaiDateKey, thaiHour } from "../../lib/date";
import { macroTargets, proteinTargetG } from "../../lib/energy";
import { useLang } from "../../lib/lang";
import { fmtKcal, newId, pickMacros, sumMacros } from "../../lib/nutrition";
import { totalsForRecipe } from "../../lib/recipe";
import { useStore } from "../../lib/store";
import type { Idea, Place, RecipeOption } from "../../lib/suggest";
import type { Entry } from "../../lib/types";

const PLACE: Record<Place, { icon: string; th: string; en: string; bg: string }> = {
  "7-eleven": { icon: "🏪", th: "เซเว่น", en: "7-Eleven", bg: "bg-mint" },
  delivery: { icon: "🛵", th: "สั่งเดลิเวอรี่", en: "Delivery", bg: "bg-sky" },
  home: { icon: "🍳", th: "ทำเองที่บ้าน", en: "Cook at home", bg: "bg-yellow" },
  recipe: { icon: "📖", th: "สูตรของฉัน", en: "My recipe", bg: "bg-pink" },
};

function SuggestInner() {
  const router = useRouter();
  const { ready, entries, goals, recipes, upsertEntry } = useStore();
  const { tr, lang } = useLang();
  const ai = useAiStatus();
  const aiReady = !!ai && (ai.configured || ai.mock);
  const today = thaiDateKey();

  const [step, setStep] = useState<"loading" | "ideas" | "review">("loading");
  const [ideas, setIdeas] = useState<Idea[]>([]);
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

  const ask = useCallback(async () => {
    setError(null);
    setStep("loading");
    try {
      const res = await aiFetch(
        "/api/suggest",
        {
          kcalLeft: left,
          proteinLeft,
          slot: guessSlot(),
          hour: thaiHour(),
          recipes: recipeOptions,
          eatenToday: todays.map((e) => e.title),
          avoidDairy: goals.avoidDairy === true,
          lang,
        },
        lang,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        setIdeas([]);
      } else {
        setIdeas(data.result.ideas as Idea[]);
        setLight(Boolean(data.result.light));
        setMock(Boolean(data.mock));
      }
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
    }
    setStep("ideas");
  }, [left, proteinLeft, recipeOptions, todays, goals.avoidDairy, lang, tr]);

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
            margin: idea.margin,
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
      items: d.items,
      source: recipe ? "recipe" : "text",
      photoId: null,
      recipe: recipe
        ? {
            recipeId: recipe.id,
            recipeName: recipe.name,
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
          <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => setStep("ideas")} aria-label={tr("กลับ", "Back")}>
            ‹
          </button>
          <h1 className="text-[22px] font-semibold">{tr("ตรวจก่อนบันทึก", "Check before saving")}</h1>
        </header>
        <MealReview
          photo={null}
          initial={picked.draft}
          mockBadge={mock}
          marginNote={picked.idea.margin}
          chatEnabled={aiReady}
          chatDisabledReason={tr("ยังไม่ได้ตั้งค่า AI (OpenRouter) — แตะรายการเพื่อแก้เองได้", "The AI (OpenRouter) is not set up — tap an item to edit it yourself")}
          onSave={save}
          onCancel={() => setStep("ideas")}
        />
      </main>
    );
  }

  return (
    <main className="page space-y-4">
      <header className="flex items-center gap-3">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => router.push("/")} aria-label={tr("กลับ", "Back")}>
          ‹
        </button>
        <h1 className="text-[22px] font-semibold">🤔 {tr("กินอะไรดี", "What can I eat?")}</h1>
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

      {step === "loading" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="suggest-loading">
          <span className="animate-bounce text-[44px]" aria-hidden>🤔</span>
          <p className="text-[18px]">{tr("กำลังคิดเมนูให้…", "Thinking of ideas…")}</p>
          <p className="text-[14px] text-muted">{tr("รอสักครู่นะ", "Just a moment")}</p>
        </div>
      )}

      {step === "ideas" && (
        <>
          {light && !error && (
            <p className="rounded-2xl bg-olive-soft px-4 py-3 text-[15px] text-olive-dark" data-testid="suggest-light">
              {left >= 0
                ? tr("ใกล้ถึงเป้าแล้ว เก่งมาก 🌱 ถ้ายังหิว ลองของเบา ๆ ที่อิ่มท้องดูนะ", "You're almost at your target, well done 🌱 If you're still hungry, try something light and filling.")
                : tr("ไม่เป็นไรเลยนะ วันนี้กินเยอะหน่อยก็ได้ 💛 ถ้ายังหิว ลองของเบา ๆ ที่อิ่มท้องดู", "That's totally okay 💛 Some days we eat more. If you're still hungry, try something light and filling.")}
            </p>
          )}

          {error && (
            <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[15px] text-danger" role="alert">
              {error}
            </div>
          )}

          {!error && ideas.length === 0 && (
            <p className="py-6 text-center text-[15px] text-muted">{tr("ยังหาเมนูที่พอดีไม่เจอ ลองขอใหม่อีกครั้งนะ", "No ideas fit right now. Try asking again.")}</p>
          )}

          {mock && <Badge>{tr("AI จำลอง", "Test AI")}</Badge>}

          <ul className="space-y-3" data-testid="suggest-list">
            {ideas.map((i) => {
              const p = PLACE[i.place];
              return (
                <li key={i.name}>
                  <button className="card flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]" onClick={() => pick(i)} data-testid="suggest-idea">
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${p.bg} text-[26px]`} aria-hidden>
                      {p.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold leading-snug">{i.name}</span>
                      <span className="block text-[13px] text-muted">
                        {lang === "en" ? p.en : p.th}
                        {i.why ? ` · ${i.why}` : ""}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-olive-dark">
                        {tr("โปรตีน", "Protein")} <span className="num font-semibold">{Math.round(i.protein)}</span> g
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block text-[20px] font-semibold">{fmtKcal(i.kcal)}</span>
                      <span className="block text-[12px] text-muted">kcal</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="px-1 text-[13px] text-muted">
            {tr("แตะเมนูเพื่อดูและแก้ก่อนบันทึก · ตัวเลขเป็นค่าประมาณ", "Tap an idea to check and adjust it before saving · numbers are estimates")}
          </p>

          <button className="btn-soft w-full" onClick={() => void ask()} data-testid="suggest-again">
            🔄 {tr("ขอไอเดียใหม่", "New ideas")}
          </button>
        </>
      )}
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
