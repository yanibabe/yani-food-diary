"use client";
// Round 35: two buttons on each recipe ingredient — scan the barcode, or photos of the product (Round 38: any side, many photos) —
// so she doesn't have to type the numbers. Reuses the same barcode lookup (phone cache → Open Food Facts),
// the live camera, her saved label fixes, and the label-reading AI.

import { useEffect, useRef, useState } from "react";
import { aiFetch } from "../lib/aiFetch";
import { scanBarcodePhoto, warmUpBarcodeReader } from "../lib/barcodeScan";
import { compressImage } from "../lib/photos";
import { normalizeOffProduct, type OffProduct } from "../lib/food/openFoodFacts";
import { getOffProduct, putOffProduct } from "../lib/food/offStore";
import { cleanBarcode, type Food } from "../lib/food/provider";
import { applyLabelFix, findFix } from "../lib/food/labelFix";
import { readFixes } from "../lib/food/labelFixStore";
import { ingredientFromFood, ingredientFromPack, type PackResult } from "../lib/food/toIngredient";
import { useLang } from "../lib/lang";
import type { Ingredient } from "../lib/types";
import { LiveBarcodeScanner } from "./LiveBarcodeScanner";
import { Icon } from "./Icon";
import { WaitPopup } from "./ui";

type Busy = null | "barcodePhoto" | "barcode" | "label";
const MAX_PHOTOS = 4;

export function IngredientScan({ ing, onPatch }: { ing: Ingredient; onPatch: (p: Partial<Ingredient>) => void }) {
  const { tr, lang } = useLang();
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const barcodePhotoRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  // Always fill against the newest typing, not the card as it was when the scan began.
  const ingRef = useRef(ing);
  useEffect(() => {
    ingRef.current = ing;
  }, [ing]);

  const badImage = tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one.");
  const serverSaid = (status: number) => `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${status}`;

  /** Barcode → product. Phone cache first, then Open Food Facts. Her label fix wins if she saved one. */
  async function lookUpBarcode(raw: string) {
    const code = cleanBarcode(raw);
    if (!code) return setMsg({ tone: "warn", text: tr("อ่านบาร์โค้ดไม่ถูก ลองอีกครั้ง", "That barcode didn't read right. Try again.") });
    setBusy("barcode");
    setMsg(null);
    try {
      let food: Food | null = null;
      const saved = await getOffProduct(code);
      if (saved) food = normalizeOffProduct(saved.code, saved.product);
      else {
        const res = await aiFetch("/api/food/barcode", { code, lang }, lang);
        const data = (await res.json().catch(() => null)) as { found?: boolean; code?: string; product?: OffProduct; message?: string } | null;
        if (!res.ok || !data) return setMsg({ tone: "warn", text: data?.message ?? serverSaid(res.status) });
        if (data.found && data.product && data.code) {
          await putOffProduct(data.code, data.product);
          food = normalizeOffProduct(data.code, data.product);
        }
      }
      if (!food)
        return setMsg({
          tone: "warn",
          text: tr("ไม่พบสินค้านี้ในฐานข้อมูล — ถ่ายรูปฉลากแทนได้เลย", "This product isn't in the database — photo the label instead"),
        });
      const fix = findFix(readFixes(), food.sourceId);
      const shown = fix ? applyLabelFix(food, fix) : food;
      const patch = ingredientFromFood(ingRef.current, shown);
      if (!patch)
        return setMsg({
          tone: "warn",
          text: tr("สินค้านี้ไม่มีข้อมูลแคลอรี่ — ถ่ายรูปฉลากแทนได้เลย", "This product has no calorie info — photo the label instead"),
        });
      onPatch(patch);
      setMsg({
        tone: "ok",
        text: tr(`เจอแล้ว: ${shown.name ?? "สินค้า"} — เช็กกับบนซองนะ`, `Found: ${shown.name ?? "product"} — check it matches the pack`),
      });
    } catch (e) {
      setMsg({ tone: "warn", text: `${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  }

  /** Photo of the barcode → free reader on the phone first; if it can't, the AI reads the digits. */
  async function fromBarcodePhoto(file: File | undefined) {
    if (!file) return;
    setBusy("barcodePhoto");
    setMsg(null);
    let found: string | null = null;
    try {
      try {
        found = await scanBarcodePhoto(file);
      } catch (e) {
        console.warn("[barcode] free reader failed", e);
      }
      if (!found) {
        const image = await compressImage(file, 1600, 0.85, badImage);
        const res = await aiFetch("/api/food/barcode-photo", { image, lang }, lang);
        const data = (await res.json().catch(() => null)) as { code?: string | null; message?: string } | null;
        if (!res.ok || !data) {
          setBusy(null);
          return setMsg({ tone: "warn", text: data?.message ?? serverSaid(res.status) });
        }
        found = data.code ?? null;
      }
    } catch (e) {
      setBusy(null);
      return setMsg({ tone: "warn", text: `${tr("อ่านรูปไม่ได้", "Couldn't read the photo")}: ${e instanceof Error ? e.message : String(e)}` });
    }
    if (!found) {
      setBusy(null);
      return setMsg({
        tone: "warn",
        text: tr("อ่านบาร์โค้ดในรูปไม่ออก ลองถ่ายใหม่ใกล้ ๆ หรือถ่ายรูปฉลากแทน", "Couldn't read the barcode. Try closer, or photo the label instead."),
      });
    }
    await lookUpBarcode(found);
  }

  /** Round 38: photos of the product (any side) waiting to be read together. */
  function addPhotos(files: File[]) {
    if (!files.length) return;
    // Copy the list now: the picker's list empties when the input is reset.
    const room = MAX_PHOTOS - photos.length;
    const picked = files.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setMsg(files.length > room ? { tone: "warn", text: tr(`ใส่ได้สูงสุด ${MAX_PHOTOS} รูป`, `Up to ${MAX_PHOTOS} photos`) } : null);
    setPhotos((old) => [...old, ...picked]);
  }
  function clearPhotos() {
    setPhotos((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
  }
  function removePhoto(i: number) {
    setPhotos((old) => {
      URL.revokeObjectURL(old[i].url);
      return old.filter((_, j) => j !== i);
    });
  }

  /** All photos → the AI reads them as ONE product. Label numbers win; else average values (estimate). */
  async function readPhotos() {
    if (!photos.length) return;
    setBusy("label");
    setMsg(null);
    try {
      const images: string[] = [];
      for (const p of photos) images.push(await compressImage(p.file, 1600, 0.85, badImage));
      const res = await aiFetch("/api/food/pack-photos", { images, lang }, lang);
      const data = (await res.json().catch(() => null)) as (PackResult & { message?: string }) | null;
      if (!res.ok || !data) return setMsg({ tone: "warn", text: data?.message ?? serverSaid(res.status) });
      const { patch, kind } = ingredientFromPack(ingRef.current, data);
      if (Object.keys(patch).length) onPatch(patch);
      clearPhotos();
      const noName = !ingRef.current.name.trim() && !patch.name;
      const texts = {
        label: tr("อ่านตัวเลขจากฉลากแล้ว — เช็กกับบนซองนะ", "Read the label numbers — check they match the pack"),
        average: tr(
          "ในรูปไม่มีตารางโภชนาการ — ใช้ค่าเฉลี่ยของอาหารนี้แทน (ค่าประมาณ) ถ้ามีรูปฉลากด้านหลัง เพิ่มเข้ามาได้เลย",
          "No nutrition table in the photos — using typical values for this food (an estimate). Add a photo of the label if you have one.",
        ),
        nameOnly: tr(
          "เก็บชื่อและขนาดไว้แล้ว แต่ยังหาค่าสารอาหารไม่ได้ — ลองเพิ่มรูปฉลาก หรือกด “ให้ AI หาค่าสารอาหาร”",
          "Kept the name and size, but no nutrition yet — add a label photo, or tap “Let the AI look up the nutrition”.",
        ),
        nothing: tr("อ่านอะไรในรูปไม่ออก ลองถ่ายให้เห็นชื่อสินค้าหรือฉลากชัด ๆ", "Couldn't read anything. Try a sharper photo of the name or label."),
      };
      setMsg({
        tone: kind === "label" || kind === "average" ? "ok" : "warn",
        text: texts[kind] + (noName && kind !== "nothing" ? tr(" — ใส่ชื่อวัตถุดิบด้วยนะ", " — please add the ingredient's name") : ""),
      });
    } catch (e) {
      setMsg({ tone: "warn", text: `${tr("อ่านรูปไม่ได้", "Couldn't read the photo")}: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  }

  const pill = "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full border border-white/80 bg-white/60 px-3 text-[14px] disabled:opacity-60";

  return (
    <div className="space-y-2" data-testid="ingredient-scan">
      <div className="flex gap-2">
        <button
          type="button"
          className={pill}
          disabled={busy !== null}
          onClick={() => {
            warmUpBarcodeReader();
            setMsg(null);
            setLive(true);
          }}
          data-testid="ing-scan-barcode"
        >
          <Icon name="barcode" className="h-[18px] w-[18px]" />
          {busy === "barcode" || busy === "barcodePhoto" ? tr("กำลังหา…", "Looking…") : tr("สแกนบาร์โค้ด", "Scan barcode")}
        </button>
        <button type="button" className={pill} disabled={busy !== null} onClick={() => labelRef.current?.click()} data-testid="ing-scan-label">
          <Icon name="camera" className="h-[18px] w-[18px]" />
          {busy === "label" ? tr("กำลังอ่าน…", "Reading…") : tr("รูปสินค้า", "Product photo")}
        </button>
      </div>
      {photos.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-white/50 p-2" data-testid="ing-photo-tray">
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative h-16 w-16 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white"
                  onClick={() => removePhoto(i)}
                  aria-label={tr("เอารูปนี้ออก", "Remove this photo")}
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-ink/25 text-muted"
                onClick={() => labelRef.current?.click()}
                aria-label={tr("เพิ่มรูป", "Add photo")}
                data-testid="ing-photo-add"
              >
                <Icon name="plus" className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="px-1 text-[12px] text-muted">
            {tr("ใส่ได้หลายรูปของสินค้าชิ้นเดียวกัน เช่น ด้านหน้า ด้านหลัง ฉลาก", "Add photos of the same product: front, back, label")}
          </p>
          <div className="flex gap-2">
            <button type="button" className={pill} onClick={clearPhotos} disabled={busy !== null}>
              {tr("ยกเลิก", "Cancel")}
            </button>
            <button
              type="button"
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-full bg-olive px-3 text-[14px] font-medium text-white disabled:opacity-60"
              onClick={() => void readPhotos()}
              disabled={busy !== null}
              data-testid="ing-photo-read"
            >
              {tr(`อ่าน ${photos.length} รูป`, `Read ${photos.length} photo${photos.length > 1 ? "s" : ""}`)}
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className={`rounded-xl px-3 py-2 text-[13px] ${msg.tone === "ok" ? "bg-[#e3ecd6] text-ink" : "bg-warn text-warn-ink"}`} role="status" data-testid="ing-scan-msg">
          {msg.text}
        </p>
      )}
      <input
        ref={barcodePhotoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void fromBarcodePhoto(f);
        }}
        data-testid="ing-barcode-photo-input"
      />
      <input
        ref={labelRef}
        type="file"
        accept="image/*"
        hidden
        multiple
        onChange={(e) => {
          addPhotos(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        data-testid="ing-label-photo-input"
      />
      <WaitPopup
        text={
          busy === "barcodePhoto"
            ? tr("กำลังอ่านบาร์โค้ดในรูป…", "Reading the barcode in the photo…")
            : busy === "barcode"
              ? tr("กำลังหาสินค้า…", "Looking up the product…")
              : busy === "label"
                ? tr(`กำลังอ่านรูป${photos.length > 1 ? ` ${photos.length} รูป` : ""}…`, "Reading the photos…")
                : null
        }
      />
      {live && (
        <LiveBarcodeScanner
          onFound={(code) => {
            setLive(false);
            void lookUpBarcode(code);
          }}
          onClose={() => setLive(false)}
          onUsePhoto={() => {
            setLive(false);
            barcodePhotoRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
