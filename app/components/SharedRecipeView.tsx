"use client";
// Round 78: the "short letter" a friend sees after opening a shared recipe link (design B).
// Saving makes their OWN copy in their own "My recipes" — later edits by the sender never reach it.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../lib/lang";
import { fmtAmount, fmtG, fmtKcal, newId } from "../lib/nutrition";
import { hasMealPic, chooseOwnPhoto } from "../lib/mealPicClient";
import { savePhoto } from "../lib/photos";
import { findSavedShare, recipeFromShare, type StoredShare } from "../lib/shareRecipe";
import { useStore } from "../lib/store";
import { UNIT_LABEL, type Macros } from "../lib/types";

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(b);
  });
}

export function SharedRecipeView({ shareId, share, coverUrl, perServing }: { shareId: string; share: StoredShare; coverUrl: string | null; perServing: Macros | null }) {
  const { tr, lang, dn } = useLang();
  const router = useRouter();
  const { recipes, upsertRecipe } = useStore();
  const [showIng, setShowIng] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = findSavedShare(recipes, shareId);
  const r = share.recipe;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function say(msg: string, then?: () => void) {
    setToast(msg);
    timer.current = setTimeout(() => {
      setToast(null);
      then?.();
    }, 1100);
  }

  async function save() {
    setError(null);
    if (saved) return say(tr("บันทึกไว้แล้ว", "Already saved"), () => router.push(`/recipes/${saved}`));
    setBusy(true);
    try {
      let coverPhotoId: string | null = null;
      let coverData: string | null = null;
      if (coverUrl) {
        try {
          const res = await fetch(coverUrl);
          if (res.ok) coverData = await blobToDataUrl(await res.blob());
        } catch {
          /* no picture is fine — the recipe still saves */
        }
      }
      if (coverData) {
        coverPhotoId = newId("ph");
        await savePhoto(coverPhotoId, coverData);
        // The dish picture at the top of the recipe: use theirs unless this phone already has one for this dish.
        if (!hasMealPic(r.name)) await chooseOwnPhoto(r.name, coverData);
      }
      const recipe = recipeFromShare(share, shareId, coverPhotoId, Date.now(), newId);
      upsertRecipe(recipe);
      say(tr("บันทึกแล้ว ✓", "Saved ✓"), () => router.push(`/recipes/${recipe.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page flex min-h-dvh flex-col justify-center gap-4 !pb-10">
      <div className="text-center text-[34px]" aria-hidden>💌</div>
      <p className="text-center text-[15px] text-muted" data-testid="share-from">
        {tr(`${share.from} ส่งสูตรให้คุณ`, `${share.from} sent you a recipe`)}
      </p>

      <section className="glass p-3 text-center">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={dn(r.name, r.alt)} className="mb-3 aspect-[1.3] w-full rounded-[20px] object-cover" data-testid="share-cover" />
        )}
        <h1 className="text-[20px] font-medium" data-testid="share-name">{dn(r.name, r.alt)}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {perServing ? `${fmtKcal(perServing.kcal)} kcal · ${tr("โปรตีน", "protein")} ${fmtG(perServing.protein)} g · ` : ""}
          {r.ingredients.length} {tr("วัตถุดิบ", "ingredients")}
        </p>
        {perServing && <p className="text-[12px] text-muted">{tr("ต่อเสิร์ฟ", "per serving")} · {fmtAmount(r.servings)} {tr("เสิร์ฟ", "servings")}</p>}
      </section>

      <button className="btn-primary w-full" onClick={save} disabled={busy} data-testid="share-save">
        {saved ? tr("บันทึกไว้แล้ว · เปิดดู", "Already saved · open it") : busy ? tr("กำลังบันทึก…", "Saving…") : tr("บันทึกเข้าสูตรของฉัน", "Save to my recipes")}
      </button>
      <button className="btn-soft w-full" onClick={() => setShowIng((v) => !v)} aria-expanded={showIng} data-testid="share-ingredients-toggle">
        {tr("ดูวัตถุดิบก่อน", "See the ingredients first")}
      </button>

      {showIng && (
        <section className="glass px-4 py-2" data-testid="share-ingredients">
          {r.ingredients.map((i, k) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-2 text-[15px] last:border-0">
              <span className="min-w-0 truncate">{dn(i.name, i.alt)}</span>
              <span className="shrink-0 text-muted">{fmtAmount(i.amount)} {UNIT_LABEL[i.unit][lang]}</span>
            </div>
          ))}
        </section>
      )}

      {error && <p className="rounded-xl bg-warn px-3 py-2 text-center text-[14px] text-warn-ink" role="alert">{error}</p>}
      <p className="text-center text-[12px] leading-relaxed text-muted">{tr("ได้สำเนาของตัวเอง แก้ได้ ไม่กระทบสูตรของ", "You get your own copy to edit — it never changes")} {share.from}</p>

      {toast && (
        <div className="fixed inset-x-4 bottom-[calc(40px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[440px] rounded-[22px] bg-ink px-4 py-3 text-center text-[15px] text-paper shadow-lg" role="status" data-testid="share-toast">
          {toast}
        </div>
      )}
    </main>
  );
}
