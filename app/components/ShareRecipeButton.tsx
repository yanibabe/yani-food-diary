"use client";
// Round 78: the round share button at the top-right of a recipe. Uploads a copy of the recipe
// (plus its cover) to the private online shelf, then opens the iPhone share sheet with the link.

import { useEffect, useRef, useState } from "react";
import { useLang } from "../lib/lang";
import { usePicSrc, useMealPic } from "../lib/mealPicClient";
import { getPhoto, shrinkDataUrl } from "../lib/photos";
import { MAX_COVER_BYTES, shareText, toSharePayload } from "../lib/shareRecipe";
import { useStore } from "../lib/store";
import type { Recipe } from "../lib/types";
import { Icon } from "./Icon";

/** Size in bytes of the picture inside a "data:…;base64," text. */
function dataUrlBytes(d: string): number {
  const b64 = d.slice(d.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
}

/** Max 900 px on the long side, JPEG ~0.8; smaller again if it is still over the limit. */
async function coverForShare(src: string): Promise<string> {
  let out = await shrinkDataUrl(src, 900, 0.8, false);
  if (dataUrlBytes(out) > MAX_COVER_BYTES) out = await shrinkDataUrl(src, 700, 0.6, false);
  if (dataUrlBytes(out) > MAX_COVER_BYTES) out = await shrinkDataUrl(src, 500, 0.5, false);
  return out;
}

export function ShareRecipeButton({ recipe }: { recipe: Recipe }) {
  const { tr, lang } = useLang();
  const { goals } = useStore();
  const { pic } = useMealPic(recipe.name);
  const picSrc = usePicSrc(pic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The phone only allows the share sheet right after a tap. If the upload took too long, the link waits here for one more tap.
  const [pending, setPending] = useState<string | null>(null);
  const uploaded = useRef<{ key: number; url: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = recipe.name;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function say(msg: string) {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }

  async function send(url: string): Promise<"shared" | "copied" | "wait" | "cancelled"> {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, text: shareText(name), url });
        return "shared";
      } catch (e) {
        const n = e instanceof Error ? e.name : "";
        if (n === "AbortError") return "cancelled";
        if (n === "NotAllowedError") return "wait";
        // any other problem: fall through to copying the link
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "wait";
    }
  }

  async function onShare() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      let url = uploaded.current?.key === recipe.updatedAt ? uploaded.current.url : null;
      if (!url) {
        // The cover: the picture shown at the top (AI picture or her own photo), else her cover photo.
        let src: string | null = picSrc ?? null;
        if (!src && recipe.coverPhotoId) src = await getPhoto(recipe.coverPhotoId);
        const cover = src ? await coverForShare(src).catch(() => null) : null;
        const from = goals.profile?.name?.trim() || "เพื่อน";
        const res = await fetch("/api/share/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe: toSharePayload(recipe), ...(cover ? { cover } : {}), from }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || typeof data?.url !== "string") throw new Error(data?.message ?? `HTTP ${res.status}`);
        url = data.url as string;
        uploaded.current = { key: recipe.updatedAt, url };
      }
      const r = await send(url);
      if (r === "copied") say(tr("คัดลอกลิงก์แล้ว", "Link copied"));
      else if (r === "wait") setPending(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendPending() {
    const url = pending;
    if (!url) return;
    const r = await send(url);
    if (r === "copied") say(tr("คัดลอกลิงก์แล้ว", "Link copied"));
    if (r !== "wait") setPending(null);
    else say(url);
  }

  return (
    <>
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-full bg-paper/95 shadow disabled:opacity-60"
        onClick={onShare}
        disabled={busy}
        aria-label={tr("ส่งสูตรให้เพื่อน", "Send this recipe")}
        aria-busy={busy}
        data-testid="share-recipe"
      >
        {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-olive-soft border-t-ink" aria-hidden /> : <Icon name="export" className="h-5 w-5" />}
      </button>

      {(error || pending || toast) && (
        <div className="fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[440px] flex-col gap-2" lang={lang}>
          {error && (
            <div className="flex items-start gap-3 rounded-[22px] bg-warn px-4 py-3 text-[14px] text-warn-ink shadow-lg" role="alert" data-testid="share-error">
              <span className="min-w-0 flex-1 break-words">{tr("ส่งสูตรไม่สำเร็จ", "Couldn't share")}: {error}</span>
              <button className="shrink-0 font-semibold" onClick={() => setError(null)}>{tr("ปิด", "Close")}</button>
            </div>
          )}
          {pending && (
            <div className="flex items-center gap-3 rounded-[22px] bg-ink px-4 py-3 text-paper shadow-lg" role="status" data-testid="share-ready">
              <span className="min-w-0 flex-1 text-[15px]">{tr("ลิงก์พร้อมแล้ว", "The link is ready")}</span>
              <button className="shrink-0 rounded-full bg-paper/15 px-4 py-2 text-[15px] font-semibold" onClick={sendPending}>{tr("เลือกแอปที่จะส่ง", "Choose an app")}</button>
              <button className="shrink-0 text-[15px]" onClick={() => setPending(null)} aria-label={tr("ปิด", "Close")}>×</button>
            </div>
          )}
          {toast && <div className="rounded-[22px] bg-ink px-4 py-3 text-center text-[15px] text-paper shadow-lg break-all" role="status" data-testid="share-toast">{toast}</div>}
        </div>
      )}
    </>
  );
}
