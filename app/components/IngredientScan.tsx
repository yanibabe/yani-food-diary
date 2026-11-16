"use client";
// Round 35: two buttons on each recipe ingredient — scan the barcode, or photo the nutrition label —
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
import { ingredientFromFood, ingredientFromLabel, type PackLabel } from "../lib/food/toIngredient";
import { useLang } from "../lib/lang";
import type { Ingredient } from "../lib/types";
import { LiveBarcodeScanner } from "./LiveBarcodeScanner";
import { Icon } from "./Icon";

type Busy = null | "barcode" | "label";

export function IngredientScan({ ing, onPatch }: { ing: Ingredient; onPatch: (p: Partial<Ingredient>) => void }) {
  const { tr, lang } = useLang();
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
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
    setBusy("barcode");
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

  /** Photo of the nutrition label → the AI reads the pack's numbers → filled in per 100 g. */
  async function fromLabelPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("label");
    setMsg(null);
    try {
      const image = await compressImage(file, 1600, 0.85, badImage);
      const res = await aiFetch("/api/food/label-photo", { image, lang }, lang);
      const data = (await res.json().catch(() => null)) as { label?: PackLabel | null; message?: string } | null;
      if (!res.ok || !data) return setMsg({ tone: "warn", text: data?.message ?? serverSaid(res.status) });
      const patch = data.label ? ingredientFromLabel(ingRef.current, data.label) : null;
      if (!patch)
        return setMsg({
          tone: "warn",
          text: tr(
            "อ่านตัวเลขบนฉลากไม่ออก ลองถ่ายใหม่ให้เห็นตารางโภชนาการชัด ๆ ไม่เอียง ไม่สะท้อนแสง",
            "Couldn't read the label. Try again with the nutrition table sharp, straight and without glare.",
          ),
        });
      onPatch(patch);
      const noName = !ingRef.current.name.trim();
      setMsg({
        tone: "ok",
        text: noName
          ? tr("อ่านฉลากแล้ว — ใส่ชื่อวัตถุดิบด้วยนะ", "Label read — please add the ingredient's name")
          : tr("อ่านฉลากแล้ว — เช็กกับบนซองนะ", "Label read — check it matches the pack"),
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
          {busy === "barcode" ? tr("กำลังหา…", "Looking…") : tr("สแกนบาร์โค้ด", "Scan barcode")}
        </button>
        <button type="button" className={pill} disabled={busy !== null} onClick={() => labelRef.current?.click()} data-testid="ing-scan-label">
          <Icon name="camera" className="h-[18px] w-[18px]" />
          {busy === "label" ? tr("กำลังอ่านฉลาก…", "Reading…") : tr("รูปฉลาก", "Label photo")}
        </button>
      </div>
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
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void fromLabelPhoto(f);
        }}
        data-testid="ing-label-photo-input"
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
