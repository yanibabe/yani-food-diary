"use client";
import { aiDairy } from "../../lib/dairy";
import { aiFetch } from "../../lib/aiFetch";
import { Suspense, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { IngredientSearch } from "../../components/AddIngredientSheet";
import { BarcodeLookup } from "../../components/BarcodeLookup";
import { SaveAsMine } from "../../components/SaveAsMine";
import { MealReview, type MealDraft } from "../../components/MealReview";
import { useAiStatus, WaitPopup } from "../../components/ui";
import { guessSlot, thaiDateKey } from "../../lib/date";
import { useLang } from "../../lib/lang";
import { blankItem, cleanBox, cleanNumber, newId } from "../../lib/nutrition";
import { boxesForPhotoCount, MAX_MEAL_PHOTOS } from "../../lib/mealPhotos";
import { compressImage, savePhoto } from "../../lib/photos";
import { useStore } from "../../lib/store";
import { foodToItem } from "../../lib/food/toItem";
import { provFromAi } from "../../lib/provenance";
import { cleanBufferPct, startBuffer } from "../../lib/calorieBuffer";
import type { Food } from "../../lib/food/provider";
import { ingredientToItem } from "../../lib/searchFood";
import type { FoodItem, Ingredient } from "../../lib/types";
import { Icon } from "../../components/Icon";

type Mode = "photo" | "text" | "manual" | "barcode" | "search";

function AddInner() {
  const params = useParams<{ mode: string }>();
  const mode: Mode =
    params.mode === "text" ? "text" : params.mode === "manual" ? "manual" : params.mode === "barcode" ? "barcode" : params.mode === "search" ? "search" : "photo";
  const search = useSearchParams();
  const date = search.get("date") || thaiDateKey();
  const router = useRouter();
  const { upsertEntry, goals } = useStore();
  const ai = useAiStatus();
  const { tr, lang } = useLang();
  const defaultUnit = tr("จาน", "plate");

  const [photos, setPhotos] = useState<string[]>([]);
  const photo = photos[0] ?? null; // the cover
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"input" | "loading" | "review">(mode === "manual" ? "review" : "input");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MealDraft>(() => {
    const first = blankItem(defaultUnit);
    return { title: "", slot: guessSlot(), items: mode === "manual" ? [first] : [] };
  });
  const [question, setQuestion] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [customId, setCustomId] = useState<string | null>(null); // Round 45: the item made by "+ Add custom ingredient"
  const [startEdit, setStartEdit] = useState<string | null>(mode === "manual" ? draft.items[0]?.id ?? null : null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const aiReady = !!ai && (ai.configured || ai.mock);

  /** Camera adds one picture; the album can add several. Up to 4 in all. */
  async function onFiles(list: FileList | null) {
    const files = list ? Array.from(list) : []; // copy now: the list empties when the input is reset
    if (!files.length) return;
    setError(null);
    const room = MAX_MEAL_PHOTOS - photos.length;
    const take = files.slice(0, Math.max(0, room));
    if (files.length > take.length) setError(tr(`ใส่ได้สูงสุด ${MAX_MEAL_PHOTOS} รูป`, `Up to ${MAX_MEAL_PHOTOS} photos`));
    try {
      const msg = tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one.");
      const done: string[] = [];
      for (const f of take) done.push(await compressImage(f, 1280, 0.8, msg));
      setPhotos((old) => [...old, ...done].slice(0, MAX_MEAL_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function analyze() {
    setError(null);
    setStep("loading");
    try {
      const res = await aiFetch("/api/analyze", { images: mode === "photo" ? photos : [], text: note, lang }, lang);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        setStep("input");
        return;
      }
      const r = data.result as { title: string; question: string | null; items: Omit<FoodItem, "id">[] };
      const pct = cleanBufferPct(goals.calorieBuffer);
      const items: FoodItem[] = r.items.map((a): FoodItem => startBuffer({
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
        dairy: aiDairy(a.name, a.dairy),
        dairySource: a.dairySource ?? null,
        fromLabel: a.fromLabel === true,
        // Round 39: where these numbers came from (an AI guess, or a printed label the AI read).
        prov: provFromAi({ fromLabel: a.fromLabel === true, userAmount: (a as { userAmount?: boolean }).userAmount === true, estimated: Boolean(a.estimated), kind: a.kind }),
        // Round 40: her optional buffer (kcal only) for AI guesses; 0% by default. The AI's own kcal is kept.
      }, pct));
      // Boxes belong to one photo: with 2+ photos they are dropped (1 photo = same as before).
      setDraft({ title: r.title || tr("อาหาร", "Meal"), slot: draft.slot, items: boxesForPhotoCount(items, photos.length) });
      setQuestion(r.question);
      setMock(Boolean(data.mock));
      setStep("review");
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
      setStep("input");
    }
  }

  function pickBarcode(food: Food, grams: number) {
    const item = { ...foodToItem(food, grams, newId("it"), tr("สินค้า", "Product")) };
    item.dairy = aiDairy(item.name, undefined);
    setDraft((d) => ({ ...d, title: item.name, items: [item] }));
    setStartEdit(null);
    setStep("review");
  }

  // Round 44: one searched food → the normal review screen (nothing is saved until she saves there).
  function pickSearched(ing: Ingredient) {
    const item = ingredientToItem(ing, newId("it"), lang, cleanBufferPct(goals.calorieBuffer));
    if (!item) return;
    setDraft((d) => ({ ...d, title: item.name, items: [item] }));
    setStartEdit(null);
    setStep("review");
  }

  /** "+ Add custom ingredient": the same manual editor, with the typed name already in. */
  function createCustomFood(name: string) {
    // Round 45: numbers she leaves empty stay unknown (not a real 0), so a saved copy keeps them unknown too.
    const first: FoodItem = { ...blankItem(defaultUnit), name: name.trim(), missing: ["protein", "carbs", "fat"] };
    setCustomId(first.id);
    setDraft((d) => ({ ...d, title: first.name, items: [first] }));
    setStartEdit(first.id);
    setStep("review");
  }

  function goManual() {
    const first = blankItem(defaultUnit);
    setDraft((d) => ({ ...d, items: [first] }));
    setStartEdit(first.id);
    setStep("review");
  }

  async function save(d: MealDraft) {
    // Save every photo; the first is the cover (photoId), the rest are extras.
    const saved: string[] = [];
    if (mode === "photo") {
      for (const p of photos) {
        const id = newId("ph");
        try {
          await savePhoto(id, p);
          saved.push(id);
        } catch {
          /* still save the meal even if a photo can't be stored */
        }
      }
    }
    const photoId = saved[0] ?? null;
    const now = Date.now();
    upsertEntry({
      id: newId("en"),
      date,
      slot: d.slot,
      title: d.title,
      items: d.items,
      // "Search food" is a diary entry she made by hand: it uses the existing "manual" kind (no new saved kind).
      source: mode === "search" ? "manual" : mode,
      photoId,
      ...(saved.length > 1 ? { extraPhotoIds: saved.slice(1) } : {}),
      recipe: null,
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/?date=${date}`);
  }

  const heading =
    mode === "photo"
      ? tr("ถ่ายรูปอาหาร", "Food photo")
      : mode === "text"
        ? tr("พิมพ์ให้ AI ช่วย", "Type it, AI helps")
        : mode === "barcode"
          ? tr("บาร์โค้ด", "Barcode")
          : mode === "search"
            ? tr("ค้นหาอาหาร", "Search food")
            : tr("กรอกเอง", "Enter it myself");

  return (
    <main className="page">
      <header className="mb-4 flex items-center gap-3">
        <button className="grid h-11 w-11 place-items-center rounded-full bg-paper" onClick={() => router.back()} aria-label={tr("กลับ", "Back")}>
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-semibold">{step === "review" ? tr("ตรวจผล", "Check the result") : heading}</h1>
      </header>

      {step === "input" && mode === "barcode" && <BarcodeLookup onPick={pickBarcode} onManual={goManual} />}

      {step === "input" && mode === "search" && <IngredientSearch food onAdd={pickSearched} onCreateCustom={createCustomFood} />}

      {(step === "input" || step === "loading") && mode !== "barcode" && mode !== "search" && (
        <div className="space-y-5">
          {mode === "photo" && (
            <div className="card overflow-hidden">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={tr("รูปที่เลือก", "Chosen photo")} className="block max-h-[60dvh] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-cream text-muted" aria-hidden>
                  <Icon name="camera" className="h-16 w-16" />
                </div>
              )}
              {photos.length > 0 && (
                <div className="px-4 pt-4" data-testid="photo-tray">
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={`${i}-${p.length}`} className="relative h-16 w-16 overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt="" className="h-full w-full object-cover" />
                        {i === 0 && photos.length > 1 && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-center text-[10px] text-white">{tr("หน้าปก", "Cover")}</span>
                        )}
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white"
                          onClick={() => setPhotos((old) => old.filter((_, j) => j !== i))}
                          aria-label={tr("เอารูปนี้ออก", "Remove this photo")}
                          data-testid="photo-remove"
                        >
                          <Icon name="x" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-muted">
                    {tr(`ใส่ได้สูงสุด ${MAX_MEAL_PHOTOS} รูปของมื้อเดียวกัน — รูปแรกเป็นหน้าปก`, `Up to ${MAX_MEAL_PHOTOS} photos of the same meal — the first is the cover`)}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 p-4">
                <button className="btn-primary" onClick={() => cameraRef.current?.click()} disabled={photos.length >= MAX_MEAL_PHOTOS}>
                  {photos.length ? tr("ถ่ายเพิ่ม", "Add a photo") : tr("เปิดกล้อง", "Open camera")}
                </button>
                <button className="btn-soft" onClick={() => galleryRef.current?.click()} disabled={photos.length >= MAX_MEAL_PHOTOS}>
                  {tr("เลือกรูป", "Choose photos")}
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} data-testid="camera-input" />
              <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} data-testid="gallery-input" />
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
            disabled={mode === "photo" ? photos.length === 0 : !note.trim()}
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

      <WaitPopup
        text={
          step === "loading"
            ? mode === "photo"
              ? tr("กำลังอ่านรูปอาหาร…", "Reading your food photo…")
              : tr("กำลังวิเคราะห์อาหาร…", "Checking your food…")
            : null
        }
        note={tr("อย่าปิดหน้านี้หรือสลับไปแอปอื่นนะ", "Please keep this page open and don't switch apps.")}
      />

      {step === "review" && (
        <MealReview
          entrySource={mode === "search" ? "manual" : mode}
          photo={mode === "photo" ? photo : null}
          initial={draft}
          mockBadge={mock}
          firstQuestion={question}
          chatEnabled={aiReady}
          chatDisabledReason={tr("ยังไม่ได้ตั้งค่า AI (OpenRouter) — แตะรายการเพื่อแก้เองได้", "The AI (OpenRouter) is not set up — tap an item to edit it yourself")}
          onSave={save}
          onCancel={() => router.push(`/?date=${date}`)}
          startEditingId={startEdit}
          editorExtra={mode === "search" && customId ? (it, replace) => (it.id === customId ? <SaveAsMine item={it} replace={replace} /> : null) : undefined}
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
