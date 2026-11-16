"use client";
// Live camera, photo or typed barcode → look it up in Open Food Facts (phone cache first) → choose grams eaten.

import { useEffect, useRef, useState } from "react";
import { aiFetch } from "../lib/aiFetch";
import { scanBarcodePhoto, warmUpBarcodeReader } from "../lib/barcodeScan";
import { compressImage } from "../lib/photos";
import { normalizeOffProduct, type OffProduct } from "../lib/food/openFoodFacts";
import { getOffProduct, putOffProduct } from "../lib/food/offStore";
import { cleanBarcode, servingGrams, servingIsLiquid, type Food } from "../lib/food/provider";
import { useLang } from "../lib/lang";
import { fmtG, fmtKcal } from "../lib/nutrition";
import { applyLabelFix, findFix, fixIsValid, removeFix, upsertFix, type LabelFix } from "../lib/food/labelFix";
import { readFixes, writeFixes } from "../lib/food/labelFixStore";
import { LiveBarcodeScanner } from "./LiveBarcodeScanner";
import { OffAttribution } from "./OffAttribution";
import { NumberField, WaitPopup } from "./ui";
import { Icon } from "./Icon";

export function BarcodeLookup({ onPick, onManual }: { onPick: (food: Food, grams: number) => void; onManual: () => void }) {
  const { tr, lang } = useLang();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);
  const [reading, setReading] = useState(false);
  const [readByAi, setReadByAi] = useState(false);
  const [live, setLive] = useState(false);
  /** The database's own numbers (before her label fix), so she can go back to them. */
  const [original, setOriginal] = useState<Food | null>(null);
  const [fixed, setFixed] = useState<LabelFix | null>(null);
  const [readingLabel, setReadingLabel] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const [fixForm, setFixForm] = useState<{ servingG: number | null; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => warmUpBarcodeReader(), []);

  /** Photo → free reader on the phone first; if it can't, the AI reads the printed digits. */
  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotFound(false);
    setFood(null);
    setReadByAi(false);
    setReading(true);
    let found: string | null = null;
    let usedAi = false;
    try {
      try {
        found = await scanBarcodePhoto(file);
      } catch (e) {
        console.warn("[barcode] free reader failed", e);
      }
      if (!found) {
        usedAi = true;
        const image = await compressImage(file, 1600, 0.85, tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one."));
        const res = await aiFetch("/api/food/barcode-photo", { image, lang }, lang);
        const data = (await res.json().catch(() => null)) as { code?: string | null; message?: string } | null;
        if (!res.ok || !data) {
          setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
          return;
        }
        found = data.code ?? null;
      }
    } catch (e) {
      setError(`${tr("อ่านรูปไม่ได้", "Couldn't read the photo")}: ${e instanceof Error ? e.message : String(e)}`);
      return;
    } finally {
      setReading(false);
    }
    if (!found) {
      setError(
        tr(
          "อ่านบาร์โค้ดในรูปไม่ออก ลองถ่ายใหม่ใกล้ ๆ ให้ชัดและไม่เอียง หรือพิมพ์ตัวเลขเองด้านล่าง",
          "Couldn't read the barcode in this photo. Try again closer, sharp and straight, or type the numbers below.",
        ),
      );
      return;
    }
    setCode(found);
    setReadByAi(usedAi);
    await lookup(found);
  }

  /** The live camera read a code (twice the same, check digit OK) → look it up straight away. */
  function fromLive(found: string) {
    setLive(false);
    setReadByAi(false);
    setCode(found);
    lookup(found);
  }

  function startLive() {
    setError(null);
    setNotFound(false);
    setFood(null);
    setLive(true);
  }

  function show(f: Food) {
    setOriginal(f);
    setFixForm(null);
    const fix = findFix(readFixes(), f.sourceId);
    const shown = fix ? applyLabelFix(f, fix) : f;
    setFixed(fix);
    setFood(shown);
    setGrams(fix ? fix.servingG : (servingGrams(f.servingSize) ?? 100));
  }

  function openFixForm() {
    if (!food || !original) return;
    // Editing again → her saved numbers. First time → only the pack size; she types the rest from the
    // label (prefilled per-pack numbers would be for the database's pack size, which may be wrong).
    const saved = findFix(readFixes(), original.sourceId);
    setFixForm(
      saved
        ? { servingG: saved.servingG, kcal: saved.kcal, protein: saved.protein, carbs: saved.carbs, fat: saved.fat }
        : { servingG: servingGrams(food.servingSize) ?? grams ?? null, kcal: null, protein: null, carbs: null, fat: null },
    );
  }

  /** Save her label numbers for this barcode on the phone; used every time she scans it again. */
  function saveFix() {
    if (!fixForm || fixForm.servingG == null || fixForm.kcal == null) return;
    keepFix({ ...fixForm, servingG: fixForm.servingG, kcal: fixForm.kcal, liquid: servingIsLiquid(food?.servingSize ?? original?.servingSize ?? null) });
  }

  /** Photo of the nutrition label → the AI reads the pack's numbers → saved as her fix for this barcode. */
  async function fromLabelPhoto(file: File | undefined) {
    if (!file || !original) return;
    setError(null);
    setReadingLabel(true);
    try {
      const image = await compressImage(file, 1600, 0.85, tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one."));
      const res = await aiFetch("/api/food/label-photo", { image, lang }, lang);
      const data = (await res.json().catch(() => null)) as {
        label?: { servingG: number; liquid: boolean; kcal: number; protein: number | null; carbs: number | null; fat: number | null } | null;
        message?: string;
      } | null;
      if (!res.ok || !data) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        return;
      }
      if (!data.label) {
        setError(
          tr(
            "อ่านตัวเลขบนฉลากไม่ออก ลองถ่ายใหม่ให้เห็นตารางโภชนาการชัด ๆ ไม่เอียง ไม่สะท้อนแสง",
            "Couldn't read the label. Try again with the nutrition table sharp, straight and without glare.",
          ),
        );
        return;
      }
      setFixForm(null);
      keepFix(data.label);
    } catch (e) {
      setError(`${tr("อ่านรูปไม่ได้", "Couldn't read the photo")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReadingLabel(false);
    }
  }

  function keepFix(v: Omit<LabelFix, "code" | "updatedAt">) {
    if (!original) return;
    const fix: LabelFix = { code: original.sourceId, ...v, updatedAt: Date.now() };
    if (!fixIsValid(fix)) return;
    const err = writeFixes(upsertFix(readFixes(), fix));
    if (err) {
      setError(`${tr("บันทึกไม่ได้", "Couldn't save")}: ${err}`);
      return;
    }
    setFood(applyLabelFix(original, fix));
    setGrams(fix.servingG);
    setFixed(fix);
    setFixForm(null);
  }

  function undoFix() {
    if (!original) return;
    const err = writeFixes(removeFix(readFixes(), original.sourceId));
    if (err) {
      setError(`${tr("บันทึกไม่ได้", "Couldn't save")}: ${err}`);
      return;
    }
    setFood(original);
    setGrams(servingGrams(original.servingSize) ?? 100);
    setFixed(null);
  }

  async function lookup(typed: string = code) {
    setError(null);
    setNotFound(false);
    setFood(null);
    const clean = cleanBarcode(typed);
    if (!clean) {
      setError(tr("บาร์โค้ดต้องเป็นตัวเลข 8–14 หลัก", "A barcode is 8–14 digits"));
      return;
    }
    setBusy(true);
    try {
      const saved = await getOffProduct(clean);
      if (saved) {
        show(normalizeOffProduct(saved.code, saved.product));
        return;
      }
      const res = await aiFetch("/api/food/barcode", { code: clean, lang }, lang);
      const data = (await res.json().catch(() => null)) as { found?: boolean; code?: string; product?: OffProduct; message?: string } | null;
      if (!res.ok || !data) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        return;
      }
      if (!data.found || !data.product || !data.code) {
        setNotFound(true);
        return;
      }
      await putOffProduct(data.code, data.product);
      show(normalizeOffProduct(data.code, data.product));
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const per = (v: number | null, unit: string) => (v == null ? "—" : `${unit === "kcal" ? fmtKcal(v) : fmtG(v)} ${unit}`);

  const liquid = servingIsLiquid(food?.servingSize ?? null);

  return (
    <div className="space-y-5">
      <WaitPopup
        text={
          reading
            ? tr("กำลังอ่านบาร์โค้ดในรูป…", "Reading the barcode in the photo…")
            : readingLabel
              ? tr("กำลังอ่านฉลาก…", "Reading the label…")
              : busy
                ? tr("กำลังหาสินค้า…", "Looking up the product…")
                : null
        }
      />
      <div className="card space-y-3 p-4">
        <button className="btn-primary w-full" onClick={startLive} disabled={busy || reading} data-testid="barcode-live">
          <Icon name="camera" className="mr-1.5 inline-block h-5 w-5 align-[-4px]" />{tr("สแกนด้วยกล้อง", "Scan with camera")}
        </button>
        <button className="btn-soft w-full" onClick={() => cameraRef.current?.click()} disabled={busy || reading} data-testid="barcode-photo">
          {reading ? tr("กำลังอ่านบาร์โค้ด…", "Reading the barcode…") : `🖼️ ${tr("ถ่าย/เลือกรูปบาร์โค้ดแทน", "Take or choose a photo instead")}`}
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // same photo can be picked again
            fromPhoto(f);
          }}
          data-testid="barcode-photo-input"
        />
        <p className="text-center text-[13px] text-muted">{tr("หรือพิมพ์ตัวเลขเอง", "or type the numbers")}</p>
        <label className="label" htmlFor="barcode">
          {tr("ตัวเลขใต้บาร์โค้ด", "The numbers under the barcode")}
        </label>
        <input
          id="barcode"
          className="field num tracking-wider"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/[^\d\s-]/g, ""));
            setReadByAi(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="8850000000000"
          data-testid="barcode-input"
        />
        <button className="btn-soft w-full" onClick={() => lookup()} disabled={busy || reading || !code.trim()}>
          {busy ? tr("กำลังค้นหา…", "Looking it up…") : tr("ค้นหา", "Look it up")}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[15px] text-danger" role="alert" data-testid="barcode-error">
          {error}
        </div>
      )}

      {notFound && (
        <div className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" data-testid="barcode-not-found">
          {tr("ไม่พบสินค้านี้ใน Open Food Facts — กรอกเองจากฉลากได้เลย", "This product isn't in Open Food Facts — you can enter it yourself from the label")}
        </div>
      )}

      {food && (
        <div className="card space-y-4 p-5" data-testid="barcode-product">
          <div className="text-center">
            <div className="text-[20px] font-semibold">{food.name ?? tr("ไม่มีชื่อสินค้า", "No product name")}</div>
            {food.brand && <div className="text-[14px] text-muted">{food.brand}</div>}
          </div>
          <div className="rounded-2xl bg-cream px-4 py-3 text-[15px]">
            <div className="mb-1 text-[13px] text-muted">{liquid ? tr("ต่อ 100 มล.", "Per 100 mL") : tr("ต่อ 100 กรัม", "Per 100 g")}</div>
            <div>
              {per(food.kcal, "kcal")} · {tr("โปรตีน", "Protein")} {per(food.protein, "g")} · {tr("คาร์บ", "Carbs")} {per(food.carbs, "g")} ·{" "}
              {tr("ไขมัน", "Fat")} {per(food.fat, "g")}
            </div>
            {food.servingSize && (
              <div className="mt-1 text-[13px] text-muted">
                {tr("1 หน่วยบริโภค", "1 serving")}: {food.servingSize}
              </div>
            )}
          </div>
          {fixed ? (
            <div className="rounded-2xl bg-[#e3ecd6] px-4 py-3 text-center text-[14px] text-ink" data-testid="label-fix-on">
              ✓ {tr("ใช้ตัวเลขตามฉลาก", "Using the label's numbers")}:{" "}
              <b className="num">
                {fixed.servingG} {fixed.liquid ? tr("มล.", "mL") : tr("ก.", "g")} = {fmtKcal(fixed.kcal)} kcal
              </b>
              <div className="text-[12px] text-muted">{tr("เช็กว่าตรงกับบนซองนะ", "Check it matches the pack")}</div>
              <div className="mt-1 flex justify-center gap-4 text-[13px]">
                <button className="underline" onClick={() => labelRef.current?.click()} disabled={readingLabel}>{tr("เปลี่ยนรูป", "Change photo")}</button>
                <button className="underline" onClick={openFixForm}>{tr("แก้เอง", "Edit")}</button>
                <button className="underline text-muted" onClick={undoFix} data-testid="label-fix-undo">{tr("ใช้ข้อมูลเดิม", "Use the original data")}</button>
              </div>
            </div>
          ) : (
            !fixForm && (
              <div className="space-y-2 text-center">
                <button className="btn-soft w-full" onClick={() => labelRef.current?.click()} disabled={readingLabel} data-testid="label-photo">
                  {readingLabel ? tr("กำลังอ่านฉลาก…", "Reading the label…") : <><Icon name="camera" className="mr-1.5 inline-block h-5 w-5 align-[-4px]" />{tr("ไม่ตรงกับซอง? ถ่าย/เลือกรูปฉลาก", "Doesn't match the pack? Take or choose a label photo")}</>}
                </button>
                <button className="text-[13px] text-muted underline" onClick={openFixForm} data-testid="label-fix-open">
                  {tr("หรือพิมพ์เอง", "or type it")}
                </button>
              </div>
            )
          )}
          <input
            ref={labelRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              fromLabelPhoto(f);
            }}
            data-testid="label-photo-input"
          />
          {fixForm && (
            <div className="space-y-3 rounded-2xl border border-line p-4" data-testid="label-fix-form">
              <p className="text-[14px] text-muted">
                {tr(
                  "กรอกตามที่เขียนบนซอง แอปจะจำไว้ ครั้งหน้าสแกนซองนี้จะใช้ตัวเลขของคุณ",
                  "Type what the pack says. The app remembers it for the next time you scan this pack.",
                )}
              </p>
              {(
                [
                  ["servingG", liquid ? tr("ขนาด 1 ซอง/ขวด (มล.)", "One pack / bottle (mL)") : tr("ขนาด 1 ซอง (กรัม)", "One pack (g)")],
                  ["kcal", tr("พลังงานต่อซอง (kcal)", "Calories per pack (kcal)")],
                  ["protein", tr("โปรตีนต่อซอง (g) — ไม่ใส่ก็ได้", "Protein per pack (g) — optional")],
                  ["carbs", tr("คาร์บต่อซอง (g) — ไม่ใส่ก็ได้", "Carbs per pack (g) — optional")],
                  ["fat", tr("ไขมันต่อซอง (g) — ไม่ใส่ก็ได้", "Fat per pack (g) — optional")],
                ] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <label className="label" htmlFor={`fix-${k}`}>
                    {label}
                  </label>
                  <NumberField id={`fix-${k}`} value={fixForm[k]} onChange={(n) => setFixForm({ ...fixForm, [k]: n })} />
                </div>
              ))}
              <div className="flex gap-3">
                <button className="btn-soft flex-1" onClick={() => setFixForm(null)}>
                  {tr("ยกเลิก", "Cancel")}
                </button>
                <button
                  className="btn-primary flex-1"
                  disabled={!(fixForm.servingG != null && fixForm.kcal != null && fixIsValid({ servingG: fixForm.servingG, kcal: fixForm.kcal }))}
                  onClick={saveFix}
                  data-testid="label-fix-save"
                >
                  {tr("บันทึก", "Save")}
                </button>
              </div>
            </div>
          )}
          {readByAi && (
            <p className="text-center text-[13px] text-muted" data-testid="barcode-read-by-ai">
              {tr("AI อ่านตัวเลขจากรูปให้ เช็กว่าตรงกับบนห่อนะ", "The AI read the numbers from your photo. Check they match the pack.")}
            </p>
          )}
          {food.kcal == null && (
            <p className="rounded-2xl bg-warn px-4 py-3 text-[14px] text-warn-ink">
              {tr("สินค้านี้ไม่มีข้อมูลแคลอรี่ ตรวจกับฉลากแล้วแก้ในหน้าถัดไปนะ", "This product has no calorie info. Check the label and fix it on the next page.")}
            </p>
          )}
          <div>
            <label className="label" htmlFor="grams">
              {liquid ? tr("ดื่มไปกี่ มล.", "How many mL did you drink?") : tr("กินไปกี่กรัม", "How many grams did you eat?")}
            </label>
            <NumberField id="grams" value={grams} onChange={setGrams} />
          </div>
          <button className="btn-primary w-full" disabled={!(grams && grams > 0)} onClick={() => grams && onPick(food, grams)}>
            {tr("ต่อไป", "Next")}
          </button>
          <OffAttribution />
        </div>
      )}

      {live && (
        <LiveBarcodeScanner
          onFound={fromLive}
          onClose={() => setLive(false)}
          onUsePhoto={() => {
            setLive(false);
            cameraRef.current?.click();
          }}
        />
      )}

      <button className="btn-soft w-full" onClick={onManual}>
        {tr("กรอกเองแทน", "Enter it myself instead")}
      </button>
    </div>
  );
}
