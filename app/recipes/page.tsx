"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StoredPhoto } from "../components/ui";
import { fmtKcal } from "../lib/nutrition";
import { totalsForRecipe } from "../lib/recipe";
import { useStore } from "../lib/store";

function RecipesInner() {
  const { ready, recipes } = useStore();
  const date = useSearchParams().get("date");
  const q = date ? `?date=${date}` : "";
  const list = [...recipes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <main className="page space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold">สูตรของฉัน</h1>
        <Link href="/recipes/new/edit" className="btn-primary !min-h-[46px]">+ สูตรใหม่</Link>
      </header>
      {ready && list.length === 0 && (
        <div className="card p-6 text-center">
          <div className="text-[48px]" aria-hidden>🍳</div>
          <p className="mt-2 text-[17px]">ยังไม่มีสูตร</p>
          <p className="text-[15px] text-muted">บันทึกเมนูที่ทำกินเอง แล้วกด “บันทึกว่ากิน” ได้ทุกครั้ง</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {list.map((r) => {
          const t = totalsForRecipe(r);
          return (
            <Link key={r.id} href={`/recipes/${r.id}${q}`} className="card overflow-hidden active:scale-[0.99]" data-testid="recipe-card">
              <div className="aspect-[4/3] bg-olive-soft">
                {r.coverPhotoId ? (
                  <StoredPhoto id={r.coverPhotoId} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[42px]" aria-hidden>🍲</div>
                )}
              </div>
              <div className="p-3">
                <div className="truncate font-semibold">{r.name}</div>
                <div className="text-[14px] text-muted">
                  {t.complete ? (
                    <>
                      <span className="num font-semibold text-ink">{fmtKcal(t.perServing.kcal)}</span> kcal/เสิร์ฟ
                    </>
                  ) : (
                    "ข้อมูลยังไม่ครบ"
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
