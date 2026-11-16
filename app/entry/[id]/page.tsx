"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MealReview } from "../../components/MealReview";
import { useAiStatus } from "../../components/ui";
import { deletePhoto, getPhoto } from "../../lib/photos";
import { photoStillUsed } from "../../lib/repeat";
import { useLang } from "../../lib/lang";
import { useStore } from "../../lib/store";
import { Icon } from "../../components/Icon";

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, entries, upsertEntry, deleteEntry } = useStore();
  const ai = useAiStatus();
  const { tr } = useLang();
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
  const photoLoaded = !photoId || loaded?.id === photoId;
  const photo = photoId && loaded?.id === photoId ? loaded.src : null;

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
            `จากสูตร “${entry.recipe.recipeName}” — แก้ตรงนี้มีผลกับมื้อนี้เท่านั้น สูตรต้นฉบับไม่เปลี่ยน`,
            `From the recipe “${entry.recipe.recipeName}” — changes here only affect this meal. The recipe itself stays the same.`,
          )}
        </p>
      )}
      <MealReview
        entrySource={entry.source}
        photo={photo}
        initial={{ title: entry.title, slot: entry.slot, items: entry.items }}
        chatEnabled={!!ai && (ai.configured || ai.mock)}
        chatDisabledReason={tr("ยังไม่ได้ตั้งค่า AI (OpenRouter) — แตะรายการเพื่อแก้เองได้", "The AI (OpenRouter) is not set up — tap an item to edit it yourself")}
        saveLabel={tr("บันทึกการแก้ไข", "Save changes")}
        onSave={(d) => {
          upsertEntry({ ...entry, title: d.title, slot: d.slot, items: d.items, updatedAt: Date.now() });
          router.push(`/?date=${entry.date}`);
        }}
        onCancel={() => router.push(`/?date=${entry.date}`)}
        onDelete={() => {
          if (entry.photoId && !photoStillUsed(entries, entry.photoId, entry.id)) deletePhoto(entry.photoId);
          deleteEntry(entry.id);
          router.push(`/?date=${entry.date}`);
        }}
      />
    </main>
  );
}
