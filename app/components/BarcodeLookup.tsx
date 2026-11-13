"use client";
// Type a barcode → look it up in Open Food Facts (phone cache first) → choose grams eaten.

import { useState } from "react";
import { aiFetch } from "../lib/aiFetch";
import { normalizeOffProduct, type OffProduct } from "../lib/food/openFoodFacts";
import { getOffProduct, putOffProduct } from "../lib/food/offStore";
import { cleanBarcode, servingGrams, type Food } from "../lib/food/provider";
import { useLang } from "../lib/lang";
import { fmtG, fmtKcal } from "../lib/nutrition";
import { OffAttribution } from "./OffAttribution";
import { NumberField } from "./ui";

export function BarcodeLookup({ onPick, onManual }: { onPick: (food: Food, grams: number) => void; onManual: () => void }) {
  const { tr, lang } = useLang();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | null>(100);

  function show(f: Food) {
    setFood(f);
    setGrams(servingGrams(f.servingSize) ?? 100);
  }

  async function lookup() {
    setError(null);
    setNotFound(false);
    setFood(null);
    const clean = cleanBarcode(code);
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

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-4">
        <label className="label" htmlFor="barcode">
          {tr("ตัวเลขใต้บาร์โค้ด", "The numbers under the barcode")}
        </label>
        <input
          id="barcode"
          className="field num tracking-wider"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="8850000000000"
          data-testid="barcode-input"
        />
        <button className="btn-primary w-full" onClick={lookup} disabled={busy || !code.trim()}>
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
            <div className="mb-1 text-[13px] text-muted">{tr("ต่อ 100 กรัม", "Per 100 g")}</div>
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
          {food.kcal == null && (
            <p className="rounded-2xl bg-warn px-4 py-3 text-[14px] text-warn-ink">
              {tr("สินค้านี้ไม่มีข้อมูลแคลอรี่ ตรวจกับฉลากแล้วแก้ในหน้าถัดไปนะ", "This product has no calorie info. Check the label and fix it on the next page.")}
            </p>
          )}
          <div>
            <label className="label" htmlFor="grams">
              {tr("กินไปกี่กรัม", "How many grams did you eat?")}
            </label>
            <NumberField id="grams" value={grams} onChange={setGrams} />
          </div>
          <button className="btn-primary w-full" disabled={!(grams && grams > 0)} onClick={() => grams && onPick(food, grams)}>
            {tr("ต่อไป", "Next")}
          </button>
          <OffAttribution />
        </div>
      )}

      <button className="btn-soft w-full" onClick={onManual}>
        {tr("กรอกเองแทน", "Enter it myself instead")}
      </button>
    </div>
  );
}
