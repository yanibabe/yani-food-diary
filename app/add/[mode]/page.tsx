"use client";
import { aiFetch } from "../../lib/aiFetch";
import { Suspense, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MealReview, type MealDraft } from "../../components/MealReview";
import { useAiStatus } from "../../components/ui";
import { guessSlot, thaiDateKey } from "../../lib/date";
import { useLang } from "../../lib/lang";
import { blankItem, cleanBox, cleanNumber, newId } from "../../lib/nutrition";
import { compressImage, savePhoto } from "../../lib/photos";
import { useStore } from "../../lib/store";
import type { FoodItem } from "../../lib/types";

type Mode = "photo" | "text" | "manual";

function AddInner() {
  const params = useParams<{ mode: string }>();
  const mode: Mode = params.mode === "text" ? "text" : params.mode === "manual" ? "manual" : "photo";
  const search = useSearchParams();
  const date = search.get("date") || thaiDateKey();
  const router = useRouter();
  const { upsertEntry } = useStore();
  const ai = useAiStatus();
  const { tr, lang } = useLang();
  const defaultUnit = tr("จาน", "plate");

  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"input" | "loading" | "review">(mode === "manual" ? "review" : "input");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MealDraft>(() => {
    const first = blankItem(defaultUnit);
    return { title: "", slot: guessSlot(), items: mode === "manual" ? [first] : [] };
  });
  const [question, setQuestion] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [startEdit, setStartEdit] = useState<string | null>(mode === "manual" ? draft.items[0]?.id ?? null : null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const aiReady = !!ai && (ai.configured || ai.mock);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      setPhoto(await compressImage(f, 1280, 0.8, tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one.")));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function analyze() {
    setError(null);
    setStep("loading");
    try {
      const res = await aiFetch("/api/analyze", { image: mode === "photo" ? photo : null, text: note, lang }, lang);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        setStep("input");
        return;
      }
      const r = data.result as { title: string; question: string | null; items: Omit<FoodItem, "id">[] };
      const items: FoodItem[] = r.items.map((a) => ({
        id: newId("it"),
        name: a.name,
        amount: cleanNumber(a.amount),
        unit: a.unit,
        kcal: cleanNumber(a.kcal),
        protein: cleanNumber(a.protein),
        carbs: cleanNumber(a.carbs),
        fat: cleanNumber(a.fat),
        estimated: Boolean(a.estimated),
        kind: a.kind === "extra" ? "extra" : "food",
        note: a.note ?? null,
        box: mode === "photo" ? cleanBox(a.box) : null,
      }));
      setDraft({ title: r.title || tr("อาหาร", "Meal"), slot: draft.slot, items });
      setQuestion(r.question);
      setMock(Boolean(data.mock));
      setStep("review");
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
      setStep("input");
    }
  }

  function goManual() {
    const first = blankItem(defaultUnit);
    setDraft((d) => ({ ...d, items: [first] }));
    setStartEdit(first.id);
    setStep("review");
  }

  async function save(d: MealDraft) {
    let photoId: string | null = null;
    if (photo && mode === "photo") {
      photoId = newId("ph");
      try {
        await savePhoto(photoId, photo);
      } catch {
        photoId = null; // still save the meal even if the photo can't be stored
      }
    }
    const now = Date.now();
    upsertEntry({
      id: newId("en"),
      date,
      slot: d.slot,
      title: d.title,
      items: d.items,
      source: mode,
      photoId,
      recipe: null,
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/?date=${date}`);
  }

  const heading =
    mode === "photo" ? tr("ถ่ายรูปอาหาร", "Food photo") : mode === "text" ? tr("พิมพ์ให้ AI ช่วย", "Type it, AI helps") : tr("กรอกเอง", "Enter it myself");

  return (
    <main className="page">
      <header className="mb-4 flex items-center gap-3">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => router.back()} aria-label={tr("กลับ", "Back")}>
          ‹
        </button>
        <h1 className="text-[22px] font-semibold">{step === "review" ? tr("ตรวจผล", "Check the result") : heading}</h1>
      </header>

      {step === "input" && (
        <div className="space-y-5">
          {mode === "photo" && (
            <div className="card overflow-hidden">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={tr("รูปที่เลือก", "Chosen photo")} className="block max-h-[60dvh] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-cream text-[64px]" aria-hidden>
                  📷
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 p-4">
                <button className="btn-primary" onClick={() => cameraRef.current?.click()}>
                  {photo ? tr("ถ่ายใหม่", "Retake") : tr("เปิดกล้อง", "Open camera")}
                </button>
                <button className="btn-soft" onClick={() => galleryRef.current?.click()}>
                  {tr("เลือกรูป", "Choose photo")}
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid="camera-input" />
              <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid="gallery-input" />
            </div>
          )}

          <div className="card p-4">
            <label className="label" htmlFor="note">
              {mode === "photo" ? tr("อธิบายเพิ่มก่อนวิเคราะห์ (ไม่บังคับ)", "Add a note before checking (optional)") : tr("กินอะไรไปบ้าง", "What did you eat?")}
            </label>
            <textarea
              id="note"
              className="field min-h-[110px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "photo"
                  ? tr("เช่น ไก่กินครึ่งชิ้น ผัดน้ำมัน 1 ช้อนโต๊ะ", "e.g. ate half the chicken, fried with 1 tbsp oil")
                  : tr("เช่น ข้าวกะเพราหมูสับไข่ดาว 1 จาน ข้าวครึ่งเดียว", "e.g. 1 plate basil pork with fried egg, only half the rice")
              }
            />
          </div>

          {ai && !aiReady && (
            <div className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink">
              {tr(
                "ยังไม่ได้ตั้งค่า AI (OpenRouter) บนเซิร์ฟเวอร์ จึงวิเคราะห์ด้วย AI ไม่ได้ตอนนี้ — กรอกเองได้เลย",
                "The AI (OpenRouter) is not set up on the server, so it can't check food right now — you can enter it yourself",
              )}
            </div>
          )}
          {error && (
            <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[15px] text-danger" role="alert" data-testid="ai-error">
              {tr("วิเคราะห์ไม่สำเร็จ", "Couldn't check it")}: {error}
            </div>
          )}

          <button
            className="btn-primary w-full"
            onClick={analyze}
            disabled={mode === "photo" ? !photo : !note.trim()}
          >
            {tr("วิเคราะห์", "Check with AI")}
          </button>
          <button className="btn-soft w-full" onClick={goManual}>
            {tr("กรอกเองแทน", "Enter it myself instead")}
          </button>
          <p className="text-center text-[13px] text-muted">
            {mode === "photo"
              ? tr("รูปจะถูกส่งไปวิเคราะห์เมื่อกด “วิเคราะห์” เท่านั้น", "The photo is only sent when you tap “Check with AI”")
              : tr("ข้อความจะถูกส่งไปวิเคราะห์เมื่อกด “วิเคราะห์” เท่านั้น", "Your text is only sent when you tap “Check with AI”")}
          </p>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-olive-soft border-t-olive" />
          <p className="text-[18px]">{tr("กำลังวิเคราะห์อาหาร…", "Checking your food…")}</p>
          <p className="text-[14px] text-muted">{tr("อาจใช้เวลาสักครู่", "This may take a moment")}</p>
          <p className="mx-6 rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" data-testid="stay-note">
            {tr(
              "อย่าปิดหน้านี้หรือสลับไปแอปอื่นนะ ถ้าปิดไป อาจต้องเริ่มใหม่",
              "Please keep this page open and don't switch apps. If you close it, you may need to start again.",
            )}
          </p>
        </div>
      )}

      {step === "review" && (
        <MealReview
          photo={mode === "photo" ? photo : null}
          initial={draft}
          mockBadge={mock}
          marginNote={mode !== "manual"}
          firstQuestion={question}
          chatEnabled={aiReady}
          chatDisabledReason={tr("ยังไม่ได้ตั้งค่า AI (OpenRouter) — แตะรายการเพื่อแก้เองได้", "The AI (OpenRouter) is not set up — tap an item to edit it yourself")}
          onSave={save}
          onCancel={() => router.push(`/?date=${date}`)}
          startEditingId={startEdit}
        />
      )}
    </main>
  );
}

export default function AddPage() {
  return (
    <Suspense>
      <AddInner />
    </Suspense>
  );
}
