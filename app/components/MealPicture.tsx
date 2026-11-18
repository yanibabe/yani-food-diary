"use client";
// Round 67: the AI-drawn picture of a meal — a small thumbnail for Today rows, and the big picture
// (with "draw again" / "my photo" controls) at the top of the meal page.

import { useState } from "react";
import { useLang } from "../lib/lang";
import { drawPicture, useMealPic, chooseOwnPhoto, usePicSrc } from "../lib/mealPicClient";
import type { FoodItem } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./ui";

/** Today rows: the picture in a rounded square. Shimmer while drawing; `fallback` (the icon tile) if none. */
export function MealThumb({ title, className, fallback }: { title: string; className: string; fallback: React.ReactNode }) {
  const { pic, drawing } = useMealPic(title);
  const src = usePicSrc(pic);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${className} object-cover`} data-testid="meal-thumb" />;
  }
  if (drawing || src === undefined) return <span className={`${className} pic-shimmer`} aria-hidden data-testid="meal-thumb-drawing" />;
  return <>{fallback}</>;
}

/** The big picture + small controls at the top of the meal page. `photos` = her real photos (cover first). */
export function MealPicHeader({ title, items, photos }: { title: string; items: FoodItem[]; photos: string[] }) {
  const { tr } = useLang();
  const { pic, drawing } = useMealPic(title);
  const src = usePicSrc(pic);
  const [sheet, setSheet] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const busy = drawing;

  async function draw(withHint: string) {
    setError(null);
    setSheet(false);
    const h = withHint.trim();
    // A correction means "describe it again"; without one, the saved description is reused.
    const r = await drawPicture({ title, items, hint: h || undefined, visual: !h && pic && !pic.own ? pic.visual || undefined : undefined, manual: true });
    if (!r.ok && r.message) setError(r.message);
    else setHint("");
  }

  async function ownPhoto() {
    setError(null);
    const r = await chooseOwnPhoto(title, photos[0]);
    if (!r.ok && r.message) setError(r.message);
  }

  return (
    <div className="space-y-3" data-testid="meal-picture">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="aspect-square w-full rounded-[28px] object-cover" data-testid="meal-picture-img" />
      ) : busy || src === undefined ? (
        <div className="pic-shimmer grid aspect-square w-full place-items-center rounded-[28px]" role="status" data-testid="meal-picture-drawing">
          <span className="text-[15px] text-muted">{tr("กำลังวาดรูป…", "Drawing the picture…")}</span>
        </div>
      ) : null}

      {!src && !busy && src !== undefined && (
        <button className="btn-soft w-full" onClick={() => draw("")} data-testid="draw-this-dish">
          <Icon name="sparkle" className="h-5 w-5" /> {tr("วาดรูปเมนูนี้", "Draw this dish")}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {photos.length > 0 && (
          <button className="flex items-center gap-2 rounded-full bg-white/70 py-1 pl-1 pr-3 text-[14px] active:opacity-60" onClick={() => setViewing(true)} data-testid="my-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]} alt="" className="h-9 w-9 rounded-full object-cover" />
            {tr("รูปจริง", "My photo")}
          </button>
        )}
        {(src || pic) && (
          <button className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/70 px-3 text-[14px] active:opacity-60 disabled:opacity-50" disabled={busy} onClick={() => setSheet(true)} data-testid="draw-again">
            <Icon name="arrows-clockwise" className="h-4 w-4" /> {tr("วาดใหม่", "Draw again")}
          </button>
        )}
        {photos.length > 0 && !pic?.own && (
          <button className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/70 px-3 text-[14px] active:opacity-60 disabled:opacity-50" disabled={busy} onClick={ownPhoto} data-testid="use-my-photo">
            <Icon name="camera" className="h-4 w-4" /> {tr("ใช้รูปที่ถ่ายเอง", "Use my photo")}
          </button>
        )}
      </div>
      {error && <p className="rounded-2xl bg-warn px-4 py-2.5 text-[14px] text-warn-ink" role="alert">{error}</p>}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={tr("วาดรูปใหม่", "Draw it again")} keyboardSafe>
        <div className="space-y-4 pb-4">
          <label className="block">
            <span className="label">{tr("บอกให้ AI วาดตามนี้ (ไม่ต้องใส่ก็ได้)", "Tell the AI what to change (optional)")}</span>
            <input className="field" value={hint} onChange={(e) => setHint(e.target.value)} placeholder={tr("เช่น ใส่หอมแดงด้วย ไม่มีมะนาว", "e.g. add shallots, no lime")} maxLength={200} data-testid="draw-hint" />
          </label>
          <button className="btn-primary w-full" onClick={() => draw(hint)} data-testid="draw-go">
            <Icon name="sparkle" className="h-5 w-5" /> {tr("วาดเลย", "Draw")}
          </button>
        </div>
      </Sheet>

      {viewing && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink/90" role="dialog" aria-modal="true" aria-label={tr("รูปจริง", "My photo")} data-testid="photo-viewer">
          <div className="flex justify-end p-3">
            <button className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white" onClick={() => setViewing(false)} aria-label={tr("ปิด", "Close")}>
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-6">
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt={tr("รูปอาหาร", "Food photo")} className="mx-auto max-h-[85dvh] w-full rounded-2xl object-contain" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
