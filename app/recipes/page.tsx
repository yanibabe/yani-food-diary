"use client";
import { Suspense } from "react";
import { Blob } from "../components/Blob";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StoredPhoto } from "../components/ui";
import { useLang } from "../lib/lang";
import { fmtKcal } from "../lib/nutrition";
import { totalsForRecipe } from "../lib/recipe";
import { useStore } from "../lib/store";

function RecipesInner() {
  const { ready, recipes } = useStore();
  const { tr, lang } = useLang();
  const date = useSearchParams().get("date");
  const q = date ? `?date=${date}` : "";
  const list = [...recipes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <main className="page space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold">{tr("สูตรของฉัน", "My recipes")}</h1>
        <Link href="/recipes/new/edit" className="btn-primary !min-h-[46px]">+ {tr("สูตรใหม่", "New recipe")}</Link>
      </header>
      {ready && list.length === 0 && (
        <div className="card p-6 text-center">
          <div className="flex items-end justify-center gap-1" aria-hidden>
            <Blob color="var(--mint)" size={56} shape={2} look={2} />
            <Blob color="var(--pink)" size={42} shape={1} look={-2} />
          </div>
          <p className="mt-2 text-[17px]">{tr("ยังไม่มีสูตร", "No recipes yet")}</p>
          <p className="text-[15px] text-muted">
            {tr("บันทึกเมนูที่ทำกินเอง แล้วกด “บันทึกว่ากิน” ได้ทุกครั้ง", "Save dishes you cook yourself, then tap “I ate this” any time")}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {list.map((r, i) => {
          const t = totalsForRecipe(r, lang);
          return (
            <Link key={r.id} href={`/recipes/${r.id}${q}`} className="card overflow-hidden active:scale-[0.99]" data-testid="recipe-card">
              <div className="aspect-[4/3] bg-cream">
                {r.coverPhotoId ? (
                  <StoredPhoto id={r.coverPhotoId} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Blob color={["var(--mint)", "var(--pink)", "var(--sky)", "var(--yellow)"][i % 4]} size={68} shape={(i % 3) as 0 | 1 | 2} />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="truncate font-semibold">{r.name}</div>
                <div className="text-[14px] text-muted">
                  {t.complete ? (
                    <>
                      <span className="num font-semibold text-ink">{fmtKcal(t.perServing.kcal)}</span> {tr("kcal/เสิร์ฟ", "kcal/serving")}
                    </>
                  ) : (
                    tr("ข้อมูลยังไม่ครบ", "Missing some details")
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

export default function RecipesPage() {
  return (
    <Suspense>
      <RecipesInner />
    </Suspense>
  );
}
