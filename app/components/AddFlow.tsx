"use client";
import { aiDairy } from "../lib/dairy";
import { aiFetch } from "../lib/aiFetch";
import { claimEarlyPicture, rememberVisual, startEarlyDraw } from "../lib/mealPicClient";
import { useEffect, useRef, useState } from "react";
import { IngredientSearch } from "./AddIngredientSheet";
import { BarcodeLookup } from "./BarcodeLookup";
import { SaveAsMine } from "./SaveAsMine";
import { MealReview, type MealDraft } from "./MealReview";
import { altFor } from "../lib/names";
import { useAiStatus, WaitPopup } from "./ui";
import { guessSlot } from "../lib/date";
import { useLang } from "../lib/lang";
import { blankItem, cleanBox, cleanNumber, newId, pickMacros, sumMacros } from "../lib/nutrition";
import { joinMissing } from "../lib/provenance";
import { ANALYZE_PHOTO_QUALITY, ANALYZE_PHOTO_SIDE, boxesForPhotoCount, MAX_MEAL_PHOTOS } from "../lib/mealPhotos";
import { compressImage, savePhoto, shrinkDataUrl } from "../lib/photos";
import { useStore } from "../lib/store";
import { foodToItem } from "../lib/food/toItem";
import { provFromAi } from "../lib/provenance";
import { cleanBufferPct, startBuffer } from "../lib/calorieBuffer";
import type { Food } from "../lib/food/provider";
import { ingredientToItem } from "../lib/searchFood";
import { addCustom, loadCustom, saveCustom, type CustomIngredient } from "../lib/customIngredients";
import { customInputFromItem, findSameName, itemFromCustom } from "../lib/saveCustomFromItem";
import { UNITS, type FoodItem, type Ingredient, type IngredientUnit } from "../lib/types";
import { Icon } from "./Icon";
import Link from "next/link";
import { buildAddUrl } from "../lib/addSheet";
import { takeHandoff } from "../lib/sheetHandoff";

export type AddMode = "photo" | "text" | "manual" | "barcode" | "search";

/** Round 53: everything /add/[mode] does, as one piece. The route renders it with `embedded` off (links, bookmarks and
 *  the other tiles work as before); Today renders it as a full-screen layer with `embedded` on (no route change). */
export type AddFlowProps = {
  mode: AddMode;
  /** The day the meal is saved to (already resolved). */
  date: string;
  /** The `date` as it sits in the link (null = today), for the links this page makes. */
  dateParam: string | null;
  /** Cleaned typed words (fills the note box / the search). */
  prefill: string;
  /** She tapped "Let AI calculate": start the check right away (text mode). */
  auto?: boolean;
  /** Route only: pick the chosen food up from sessionStorage. */
  fromSheet?: boolean;
  /** Route only: open "my own food" with the typed name. */
  create?: boolean;
  /** Layer only: the chosen food, passed in memory. */
  handoff?: Ingredient | null;
  /** Round 54: a ready-made item (an AI estimate from the "ask before eating" chat). Goes straight to the review; nothing is saved until she saves there. */
  initialItem?: FoodItem | null;
  /** In the Today layer: no router, the layer closes itself. */
  embedded?: boolean;
  /** Round 64: switch to another way of adding (e.g. barcode not found → take a photo). */
  onSwitchMode?: (m: "photo" | "manual", opts?: { barcode?: string }) => void;
  /** Round 66: the barcode that was not found; with a photo meal, she can ask us to remember it for next time. */
  barcode?: string;
  /** Header back button. */
  onBack: () => void;
  /** Review "Cancel". */
  onCancel: () => void;
  /** After a successful save. */
  onSaved: () => void;
};

export function AddFlow({ mode, date, dateParam, prefill, auto = false, fromSheet = false, create = false, handoff = null, initialItem = null, embedded = false, onSwitchMode, barcode, onBack, onCancel, onSaved }: AddFlowProps) {
  const { upsertEntry, goals } = useStore();
  const ai = useAiStatus();
  const { tr, lang } = useLang();
  const defaultUnit = tr("จาน", "plate");

  // Layer: the chosen food is already here, so the very first frame is the review (nothing is saved yet).
  const [handoffItem] = useState<FoodItem | null>(() => (initialItem ? initialItem : handoff ? ingredientToItem(handoff, newId("it"), lang, cleanBufferPct(goals.calorieBuffer)) : null));
  const autoStart = mode === "text" && auto && !!prefill;

  const [photos, setPhotos] = useState<string[]>([]);
  const photo = photos[0] ?? null; // the cover
  const [note, setNote] = useState(mode === "text" ? prefill : "");
  // While the automatic check runs we show ONLY the waiting message (no second text box); it comes back if the check fails.
  const [quiet, setQuiet] = useState(autoStart);
  const [step, setStep] = useState<"input" | "loading" | "review">(mode === "manual" || handoffItem ? "review" : autoStart ? "loading" : "input");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MealDraft>(() => {
    const first = blankItem(defaultUnit);
    return { title: handoffItem?.name ?? "", ...(handoffItem?.alt ? { alt: handoffItem.alt } : {}), slot: guessSlot(), items: mode === "manual" ? [first] : handoffItem ? [handoffItem] : [] };
  });
  const [question, setQuestion] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const [rememberBarcode, setRememberBarcode] = useState(true);
  const [customId, setCustomId] = useState<string | null>(null); // Round 45: the item made by "+ Add custom ingredient"
  const [startEdit, setStartEdit] = useState<string | null>(mode === "manual" ? draft.items[0]?.id ?? null : null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const savingRef = useRef(false);
  const visualRef = useRef<string | null>(null);
  const earlyTitleRef = useRef<string | null>(null); // Round 68: the title the early picture was started under
  const aiReady = !!ai && (ai.configured || ai.mock);

  // Round 47: the Add food sheet hands over ONE chosen food. We pick it up once and go straight to the review.
  const waitForHandoff = mode === "search" && fromSheet;
  const [waitingHandoff, setWaitingHandoff] = useState(waitForHandoff);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // (next tick: the page paints its quiet blank state first, then moves on)
    queueMicrotask(() => {
    if (waitForHandoff) {
      let store: Storage | null = null;
      try {
        store = window.sessionStorage;
      } catch {
        store = null;
      }
      const ing = takeHandoff(store, Date.now());
      const item = ing ? ingredientToItem(ing, newId("it"), lang, cleanBufferPct(goals.calorieBuffer)) : null;
      if (item) {
        setDraft((d) => ({ ...d, title: item.name, alt: item.alt, items: [item] }));
        setStartEdit(null);
        setStep("review");
      }
      // No / old / broken hand-over: just show the normal search page (nothing is lost).
      setWaitingHandoff(false);
    } else if (mode === "search" && create && prefill) {
      createCustomFood(prefill);
    } else if (autoStart) {
      // She tapped "Let AI calculate": that tap is the go-ahead. Take the switch out of the link so a refresh does not ask again.
      if (!embedded) {
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete("auto");
          window.history.replaceState(window.history.state, "", u.toString());
        } catch {
          /* fine */
        }
      }
      void analyze();
    }
    });
    // Runs once on arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Round 68: a smaller copy goes to the AI (faster); the saved photo keeps its size.
      const sendPhotos = mode === "photo" ? await Promise.all(photos.map((p) => shrinkDataUrl(p, ANALYZE_PHOTO_SIDE, ANALYZE_PHOTO_QUALITY, false).catch(() => p))) : [];
      const res = await aiFetch("/api/analyze", { images: sendPhotos, text: note, lang }, lang);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        setQuiet(false);
        setStep("input");
        return;
      }
      const r = data.result as { title: string; title_th?: string; title_en?: string; question: string | null; visual?: string | null; items: (Omit<FoodItem, "id"> & { name_th?: string; name_en?: string })[] };
      // Round 67: how the AI saw the meal, used later to draw its picture (photo meals only).
      visualRef.current = mode === "photo" && typeof r.visual === "string" ? r.visual : null;
      const pct = cleanBufferPct(goals.calorieBuffer);
      const items: FoodItem[] = r.items.map((a): FoodItem => startBuffer({
        id: newId("it"),
        name: a.name,
        // Round 79: the same name in the other language, from the same AI call (missing = filled in later).
        ...(altFor(a.name, { th: a.name_th, en: a.name_en }) ? { alt: altFor(a.name, { th: a.name_th, en: a.name_en }) } : {}),
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
        // Round 69: numbers the server looked up in the food table come with their own `prov` (database) + `ref` (USDA id).
        prov: a.prov ?? provFromAi({ fromLabel: a.fromLabel === true, userAmount: (a as { userAmount?: boolean }).userAmount === true, estimated: Boolean(a.estimated), kind: a.kind }),
        ...(a.prov && a.ref ? { ref: a.ref } : {}),
        ...(a.prov && a.missing?.length ? { missing: a.missing } : {}),
        // Round 40: her optional buffer (kcal only) for AI guesses; 0% by default. The AI's own kcal is kept.
      }, pct));
      // Boxes belong to one photo: with 2+ photos they are dropped (1 photo = same as before).
      const title = r.title || tr("อาหาร", "Meal");
      const titleAlt = r.title ? altFor(title, { th: r.title_th, en: r.title_en }) : undefined;
      setDraft({ title, ...(titleAlt ? { alt: titleAlt } : {}), slot: draft.slot, items: boxesForPhotoCount(items, photos.length) });
      // Round 68: start drawing the picture now, while she checks the result (photo: from the AI's `visual`; text: the server writes one).
      earlyTitleRef.current = title;
      startEarlyDraw(title, items, visualRef.current);
      setQuestion(r.question);
      setMock(Boolean(data.mock));
      setStep("review");
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
      setQuiet(false);
      setStep("input");
    }
  }

  function pickBarcode(food: Food, grams: number) {
    const item = { ...foodToItem(food, grams, newId("it"), tr("สินค้า", "Product")) };
    item.dairy = aiDairy(item.name, undefined);
    setDraft((d) => ({ ...d, title: item.name, alt: item.alt, items: [item] }));
    setStartEdit(null);
    setStep("review");
  }

  // Round 44: one searched food → the normal review screen (nothing is saved until she saves there).
  function pickSearched(ing: Ingredient) {
    const item = ingredientToItem(ing, newId("it"), lang, cleanBufferPct(goals.calorieBuffer));
    if (!item) return;
    setDraft((d) => ({ ...d, title: item.name, alt: item.alt, items: [item] }));
    setStartEdit(null);
    setStep("review");
  }

  // Round 66: a barcode she asked us to remember → straight to the review with that food (nothing is saved until she saves).
  function pickMine(c: CustomIngredient) {
    const item = itemFromCustom(c, { id: newId("it"), amount: 100, unit: "g" }, lang);
    if (!item) return;
    setDraft((d) => ({ ...d, title: item.name, alt: item.alt, items: [item] }));
    setStartEdit(null);
    setStep("review");
  }

  /** The whole photographed product as ONE food: a single item stays as it is; several are added up as "1 plate" under the meal's name. */
  function oneFood(d: MealDraft): FoodItem {
    if (d.items.length === 1) return d.items[0];
    const m = sumMacros(d.items.map(pickMacros));
    const gap = joinMissing(...d.items.map((i) => i.missing));
    return { ...d.items[0], id: newId("it"), name: d.title.trim() || d.items[0].name, amount: 1, unit: defaultUnit, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, ...(gap.length ? { missing: gap } : { missing: undefined }) };
  }

  /** She ticked "remember this barcode": keep the food as one of her ingredients, with the barcode on it. Never blocks the save. */
  function rememberProduct(item: FoodItem, code: string) {
    try {
      const base = customInputFromItem(item);
      if (!base) return;
      const list = loadCustom();
      const unit = base.basis === "perUnit" && item.unit in UNITS ? (item.unit as IngredientUnit) : null;
      const r = addCustom(list, { ...base, barcode: code, unit }, Date.now());
      if (r.ok) saveCustom(r.list);
      else if (r.error === "duplicate") {
        const ex = findSameName(list, item.name);
        if (ex && !ex.barcode) saveCustom(list.map((c) => (c.id === ex.id ? { ...c, barcode: code } : c)));
      }
    } catch {
      /* remembering is a bonus: the meal is already saved */
    }
  }

  /** "+ Add custom ingredient": the same manual editor, with the typed name already in. */
  function createCustomFood(name: string) {
    // Round 45: numbers she leaves empty stay unknown (not a real 0), so a saved copy keeps them unknown too.
    const first: FoodItem = { ...blankItem(defaultUnit), name: name.trim(), missing: ["protein", "carbs", "fat"] };
    setCustomId(first.id);
    setDraft((d) => ({ ...d, title: first.name, alt: first.alt, items: [first] }));
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
    if (savingRef.current) return; // a second tap must not save the meal twice
    savingRef.current = true;
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
    rememberVisual(d.title, visualRef.current);
    claimEarlyPicture(earlyTitleRef.current, d.title, d.items);
    upsertEntry({
      id: newId("en"),
      date,
      slot: d.slot,
      title: d.title,
      ...(d.alt ? { alt: d.alt } : {}),
      items: d.items,
      // "Search food" is a diary entry she made by hand: it uses the existing "manual" kind (no new saved kind).
      source: mode === "search" ? "manual" : mode,
      photoId,
      ...(saved.length > 1 ? { extraPhotoIds: saved.slice(1) } : {}),
      recipe: null,
      createdAt: now,
      updatedAt: now,
    });
    if (mode === "photo" && barcode && rememberBarcode && d.items.length >= 1) rememberProduct(oneFood(d), barcode);
    onSaved();
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
      <header className={`mb-4 flex items-center gap-3 ${embedded ? "relative z-[61]" : ""}`}>
        <button className="grid h-11 w-11 place-items-center rounded-full bg-paper" onClick={onBack} aria-label={tr("กลับ", "Back")}>
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-semibold">{step === "review" ? tr("ตรวจผล", "Check the result") : heading}</h1>
      </header>

      {step === "input" && mode === "barcode" && <BarcodeLookup
          onPick={pickBarcode}
          onManual={goManual}
          onPickMine={pickMine}
          onUsePhotoAi={onSwitchMode ? (code) => onSwitchMode("photo", code ? { barcode: code } : undefined) : undefined}
        />}

      {step === "input" && mode === "search" && !waitingHandoff && (
        <IngredientSearch
          food
          initialQuery={prefill}
          onAdd={pickSearched}
          onCreateCustom={createCustomFood}
          footer={(typed) =>
            typed.length >= 2 ? (
              <p className="px-1 text-[13px]">
                <Link href={buildAddUrl("text", dateParam, typed)} className="inline-flex min-h-[44px] items-center text-olive-dark underline-offset-2" data-testid="ai-whole-dish">
                  {tr("ให้ AI ดูทั้งจาน", "Let AI look at the whole dish")}
                </Link>
              </p>
            ) : null
          }
        />
      )}

      {(step === "input" || step === "loading") && !(quiet && step === "loading") && mode !== "barcode" && mode !== "search" && (
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
          onCancel={onCancel}
          startEditingId={startEdit}
          belowPhoto={
            mode === "photo" && barcode ? (
              <label className="mb-3 flex items-center gap-2.5 rounded-2xl bg-white/60 px-3 py-2.5 text-[14px] text-muted" data-testid="remember-barcode">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#2b2724]" checked={rememberBarcode} onChange={(e) => setRememberBarcode(e.target.checked)} />
                <span>{tr("จำบาร์โค้ดนี้ไว้ ครั้งหน้าสแกนแล้วขึ้นเลย", "Remember this barcode, so the next scan opens it")}</span>
              </label>
            ) : undefined
          }
          editorExtra={mode === "search" && customId ? (it, replace) => (it.id === customId ? <SaveAsMine item={it} replace={replace} /> : null) : undefined}
        />
      )}
    </main>
  );
}
