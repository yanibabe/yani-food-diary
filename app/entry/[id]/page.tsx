"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MealReview } from "../../components/MealReview";
import { useAiStatus } from "../../components/ui";
import { deletePhoto, getPhoto } from "../../lib/photos";
import { useStore } from "../../lib/store";

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, entries, upsertEntry, deleteEntry } = useStore();
  const ai = useAiStatus();
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
        <p className="pt-20">ไม่พบรายการนี้</p>
        <button className="btn-soft" onClick={() => router.push("/")}>กลับหน้าวันนี้</button>
      </main>
    );

  return (
    <main className="page">
      <header className="mb-4 flex items-center gap-3">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => router.back()} aria-label="กลับ">
          ‹
        </button>
        <h1 className="text-[22px] font-semibold">แก้มื้อนี้</h1>
      </header>
      {entry.recipe && (
        <p className="mb-4 rounded-2xl bg-olive-soft px-4 py-3 text-[14px] text-olive-dark">
          จากสูตร “{entry.recipe.recipeName}” — แก้ตรงนี้มีผลกับมื้อนี้เท่านั้น สูตรต้นฉบับไม่เปลี่ยน
        </p>
      )}
      <MealReview
        photo={photo}
        initial={{ title: entry.title, slot: entry.slot, items: entry.items }}
        chatEnabled={!!ai && (ai.configured || ai.mock)}
        chatDisabledReason="ยังไม่ได้ตั้งค่า Claude API — แตะรายการเพื่อแก้เองได้"
        saveLabel="บันทึกการแก้ไข"
        onSave={(d) => {
          upsertEntry({ ...entry, title: d.title, slot: d.slot, items: d.items, updatedAt: Date.now() });
          router.push(`/?date=${entry.date}`);
        }}
        onCancel={() => router.push(`/?date=${entry.date}`)}
        onDelete={() => {
          if (entry.photoId) deletePhoto(entry.photoId);
          deleteEntry(entry.id);
          router.push(`/?date=${entry.date}`);
        }}
      />
    </main>
  );
}
