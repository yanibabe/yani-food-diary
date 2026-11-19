"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MealReview } from "../../components/MealReview";
import { useAiStatus } from "../../components/ui";
import { deletePhoto, getPhoto } from "../../lib/photos";
import { photoStillUsed } from "../../lib/repeat";
import { entryPhotoIds } from "../../lib/mealPhotos";
import { useLang } from "../../lib/lang";
import { useStore } from "../../lib/store";
import { Icon } from "../../components/Icon";
import { MealPicHeader } from "../../components/MealPicture";
import { useMealPic } from "../../lib/mealPicClient";

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, entries, upsertEntry, deleteEntry } = useStore();
  const ai = useAiStatus();
  const { tr, dn } = useLang();
  const entry = entries.find((e) => e.id === id);
  const photoId = entry?.photoId ?? null;
  const [loaded, setLoaded] = useState<{ id: string; src: string | null } | null>(null);

  useEffect(() => {
    if (!photoId) return;
    let live = true;
    getPhoto(photoId).then((src) => live && setLoaded({ id: photoId, src }));
    return () => {
      live = false;
    };
  }, [photoId]);
  // Round 43: extra photos (after the cover). Older meals have none.
  const extraKey = (entry?.extraPhotoIds ?? []).join(",");
  const [extras, setExtras] = useState<{ key: string; srcs: string[] } | null>(null);
  useEffect(() => {
    if (!extraKey) return;
    let live = true;
    Promise.all(extraKey.split(",").map((x) => getPhoto(x))).then((r) => live && setExtras({ key: extraKey, srcs: r.filter((x): x is string => !!x) }));
    return () => {
      live = false;
    };
  }, [extraKey]);
  const extraSrcs = extraKey && extras?.key === extraKey ? extras.srcs : [];
  const photoLoaded = !photoId || loaded?.id === photoId;
  const photo = photoId && loaded?.id === photoId ? loaded.src : null;
  // Round 67: once the meal has an AI picture (or one is being drawn), her real photo moves behind the "My photo" thumbnail.
  const picState = useMealPic(entry?.title ?? "");
  const hasPicture = !!picState.pic || picState.drawing;
  const realPhotos = [photo, ...extraSrcs].filter((x): x is string => !!x);

  if (!ready || (entry && !photoLoaded)) return <main className="page" />;
  if (!entry)
    return (
      <main className="page space-y-4 text-center">
        <p className="pt-20">{tr("ไม่พบรายการนี้", "This meal wasn't found")}</p>
        <button className="btn-soft" onClick={() => router.push("/")}>{tr("กลับหน้าวันนี้", "Back to Today")}</button>
      </main>
    );

  return (
    <main className="page">
      <header className="mb-4 flex items-center gap-3">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-paper" onClick={() => router.back()} aria-label={tr("กลับ", "Back")}>
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-semibold">{tr("แก้มื้อนี้", "Edit this meal")}</h1>
      </header>
      {entry.recipe && (
        <p className="mb-4 rounded-2xl bg-olive-soft px-4 py-3 text-[14px] text-olive-dark">
          {tr(
            `จากสูตร “${dn(entry.recipe.recipeName, entry.recipe.alt)}” — แก้ตรงนี้มีผลกับมื้อนี้เท่านั้น สูตรต้นฉบับไม่เปลี่ยน`,
            `From the recipe “${dn(entry.recipe.recipeName, entry.recipe.alt)}” — changes here only affect this meal. The recipe itself stays the same.`,
          )}
        </p>
      )}
      <MealReview
        topSlot={<MealPicHeader title={entry.title} items={entry.items} photos={realPhotos} />}
        belowPhoto={
          extraSrcs.length > 0 ? (
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" data-testid="extra-photos" aria-label={tr("รูปอื่น ๆ ของมื้อนี้", "More photos of this meal")}>
          {extraSrcs.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={tr("รูปอาหาร", "Food photo")} className="h-28 w-28 shrink-0 snap-start rounded-2xl object-cover" />
          ))}
            </div>
          ) : null
        }
        entrySource={entry.source}
        photo={hasPicture ? null : photo}
        initial={{ title: entry.title, alt: entry.alt, slot: entry.slot, items: entry.items }}
        chatEnabled={!!ai && (ai.configured || ai.mock)}
        chatDisabledReason={tr("ยังไม่ได้ตั้งค่า AI (OpenRouter) — แตะรายการเพื่อแก้เองได้", "The AI (OpenRouter) is not set up — tap an item to edit it yourself")}
        saveLabel={tr("บันทึกการแก้ไข", "Save changes")}
        onSave={(d) => {
          const { alt: _drop, ...base } = entry;
          void _drop;
          upsertEntry({ ...base, title: d.title, ...(d.alt ? { alt: d.alt } : {}), slot: d.slot, items: d.items, updatedAt: Date.now() });
          router.push(`/?date=${entry.date}`);
        }}
        onCancel={() => router.push(`/?date=${entry.date}`)}
        onDelete={() => {
          for (const pid of entryPhotoIds(entry)) if (!photoStillUsed(entries, pid, entry.id)) deletePhoto(pid);
          deleteEntry(entry.id);
          router.push(`/?date=${entry.date}`);
        }}
      />
    </main>
  );
}
