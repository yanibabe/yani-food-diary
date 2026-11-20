"use client";
// Round 41: find a food in USDA FoodData Central and let her CONFIRM it. Nothing is picked by itself.
// Steps: search (her name → English words) → list (what differs is shown) → tap one → details → confirm.
// Loading, no match, error + try again, a box to change the search words, and packaged (branded) products.

import { useEffect, useState } from "react";
import { aiFetch } from "../lib/aiFetch";
import { useLang } from "../lib/lang";
import { fmtG, fmtKcal } from "../lib/nutrition";
import { DATA_TYPE_LABEL, type UsdaFood } from "../lib/food/usdaNutrients";
import { DIFFERENCE_LABEL, attrTags, type RankedFood } from "../lib/food/usdaMatch";
import { Badge, NumberField } from "./ui";
import { Icon } from "./Icon";

let statusCache: Promise<boolean> | null = null;
/** Is USDA set up on the server? (Only true/false — the key never reaches the phone.) */
export function useUsdaReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    statusCache ??= fetch("/api/status")
      .then((r) => r.json())
      .then((s) => s?.usda === true)
      .catch(() => false);
    let live = true;
    void statusCache.then((v) => live && setReady(v));
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

type Result = RankedFood & { close: boolean };
type Phase = { k: "loading" } | { k: "list"; results: Result[]; query: string } | { k: "error"; message: string } | { k: "detail"; food: UsdaFood | null; from: Result } ;

export function UsdaAttribution() {
  const { tr } = useLang();
  return (
    <p className="text-center text-[12px] text-muted" data-testid="usda-attribution">
      <a href="https://fdc.nal.usda.gov" target="_blank" rel="noopener noreferrer" className="underline">
        {tr("ข้อมูล: USDA FoodData Central", "Data: USDA FoodData Central")}
      </a>
    </p>
  );
}

function Per100({ f }: { f: Pick<UsdaFood, "nutrients" | "per"> }) {
  const { tr } = useLang();
  const n = f.nutrients;
  const g = (v: number | null) => (v == null ? "?" : fmtG(v));
  return (
    <span className="text-[13px] text-muted">
      <span className="num font-semibold text-ink">{n.kcal == null ? "?" : fmtKcal(n.kcal)} kcal</span>
      {" "}/100 {f.per === "ml" ? tr("มล.", "ml") : tr("ก.", "g")} · P {g(n.protein)} · C {g(n.carbs)} · F {g(n.fat)}
    </span>
  );
}

/**
 * mode "ingredient": confirm → onPick(food).
 * mode "item": she also confirms how many grams she ate → onPick(food, grams).
 */
export function UsdaPicker({
  name,
  mode,
  startAmount,
  onPick,
  onClose,
}: {
  name: string;
  mode: "ingredient" | "item";
  /** item mode: grams to start with (when her amount is already in g / ml). */
  startAmount?: number | null;
  onPick: (food: UsdaFood, amount?: number) => void;
  onClose: () => void;
}) {
  const { tr, lang } = useLang();
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [query, setQuery] = useState("");
  const [branded, setBranded] = useState(false);
  const [amount, setAmount] = useState<number | null>(startAmount && startAmount > 0 ? startAmount : null);
  const [nonce, setNonce] = useState(0);

  async function post(body: Record<string, unknown>) {
    const r = await aiFetch("/api/food/usda", { ...body, lang }, lang);
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.message ?? tr("ค้นหา USDA ไม่ได้ ลองอีกครั้ง", "Couldn't search USDA. Try again."));
    return data;
  }

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show "searching…" as each new search starts
    setPhase({ k: "loading" });
    post({ action: "search", name, query: query || undefined, branded })
      .then((d) => {
        if (!live) return;
        if (!query && d?.query) setQuery(d.query);
        setPhase({ k: "list", results: Array.isArray(d?.results) ? d.results : [], query: d?.query ?? "" });
      })
      .catch((e) => live && setPhase({ k: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
    // query is read on purpose only when a search is started (nonce / branded), not on every key press
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, branded, nonce]);

  function open(r: Result) {
    setPhase({ k: "detail", food: null, from: r });
    post({ action: "detail", fdcId: r.fdcId })
      .then((d) => setPhase({ k: "detail", food: d?.food ?? r, from: r }))
      // Details failed → the search result's numbers are still USDA's own; only the household measures are missing.
      .catch(() => setPhase({ k: "detail", food: r, from: r }));
  }

  const backToList = () => setNonce((n) => n + 1);

  return (
    <div className="space-y-3 rounded-2xl bg-cream p-3" data-testid="usda-picker">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">{tr("ค้นหาใน USDA", "Search USDA")}</p>
        <button type="button" className="min-h-[44px] px-2 text-[14px] text-muted" onClick={onClose}>{tr("ปิด", "Close")}</button>
      </div>

      {phase.k !== "detail" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setNonce((n) => n + 1);
          }}
        >
          <input
            className="field !min-h-[44px] flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("คำค้นภาษาอังกฤษ เช่น chicken breast raw", "English words, e.g. chicken breast raw")}
            aria-label={tr("คำค้น USDA", "USDA search words")}
            data-testid="usda-query"
          />
          <button type="submit" className="btn-soft !min-h-[44px] !px-4">{tr("ค้นหา", "Search")}</button>
        </form>
      )}

      {phase.k === "loading" && (
        <p className="text-[14px] text-muted" data-testid="usda-loading"><Icon name="sparkle" className="mr-1 inline-block h-4 w-4 align-[-3px]" />{tr("กำลังค้นหาใน USDA…", "Searching USDA…")}</p>
      )}

      {phase.k === "error" && (
        <div className="space-y-2" data-testid="usda-error">
          <p className="text-[14px] text-warn-ink">{phase.message}</p>
          <p className="text-[13px] text-muted">{tr("ใช้ค่าจาก AI หรือพิมพ์เองต่อได้เลย", "You can carry on with the AI value or type your own")}</p>
          <button type="button" className="btn-soft !min-h-[44px] w-full" onClick={backToList}>{tr("ลองอีกครั้ง", "Try again")}</button>
        </div>
      )}

      {phase.k === "list" && phase.results.length === 0 && (
        <div className="space-y-1" data-testid="usda-empty">
          <p className="text-[14px] text-warn-ink">{phase.query ? tr("ไม่พบใน USDA — ลองเปลี่ยนคำค้นด้านบน", "Nothing found in USDA — try other words above") : tr("ยังแปลชื่อนี้ไม่ได้ — พิมพ์คำค้นภาษาอังกฤษด้านบน", "Couldn't translate this name — type English words above")}</p>
        </div>
      )}

      {phase.k === "list" && phase.results.length > 0 && (
        <>
          <p className="text-[13px] text-muted">{tr("เลือกอันที่ตรงกับที่กินจริง (ดิบ/สุก วิธีปรุง ส่วน หนัง)", "Pick the one that matches what you ate (raw/cooked, cooking, cut, skin)")}</p>
          <ul className="space-y-2" data-testid="usda-results">
            {phase.results.map((r) => {
              const tags = attrTags(r.attrs);
              const usable = r.nutrients.kcal != null;
              return (
                <li key={r.fdcId}>
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => open(r)}
                    className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-2 text-left disabled:opacity-50"
                    data-testid="usda-result"
                    data-fdc={r.fdcId}
                  >
                    <span className="block text-[14px] font-medium leading-snug">{r.description}</span>
                    {r.brand && <span className="block text-[12px] text-muted">{r.brand}</span>}
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {r.close && <Badge tone="olive">{tr("ใกล้เคียงที่สุด", "Closest match")}</Badge>}
                      {tags.map((t) => (
                        <Badge key={t.en} tone="muted">{t[lang]}</Badge>
                      ))}
                      {r.differences.map((d) => (
                        <Badge key={d}>{DIFFERENCE_LABEL[d][lang]}</Badge>
                      ))}
                      {!usable && <Badge>{tr("ไม่มีค่าพลังงาน", "No energy value")}</Badge>}
                    </span>
                    <span className="mt-1 block"><Per100 f={r} /> <span className="text-[12px] text-muted">· {DATA_TYPE_LABEL[r.dataType][lang]}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {phase.k !== "detail" && (
        <button type="button" className="min-h-[44px] text-[14px] font-medium text-olive-dark" onClick={() => setBranded((b) => !b)} data-testid="usda-branded">
          {branded ? tr("← กลับไปค้นวัตถุดิบทั่วไป", "← Back to generic foods") : tr("เป็นสินค้าแบรนด์ (ของแพ็คสำเร็จ)? ค้นสินค้าแบรนด์", "A packaged product? Search branded foods")}
        </button>
      )}

      {phase.k === "detail" && (
        <div className="space-y-2" data-testid="usda-confirm">
          <p className="text-[15px] font-medium leading-snug">{phase.from.description}</p>
          {phase.from.brand && <p className="text-[12px] text-muted">{phase.from.brand}</p>}
          <div className="flex flex-wrap gap-1">
            {attrTags(phase.from.attrs).map((t) => (
              <Badge key={t.en} tone="muted">{t[lang]}</Badge>
            ))}
            {phase.from.differences.map((d) => (
              <Badge key={d}>{DIFFERENCE_LABEL[d][lang]}</Badge>
            ))}
          </div>
          {phase.food ? <Per100 f={phase.food} /> : <p className="text-[13px] text-muted">{tr("กำลังโหลดรายละเอียด…", "Loading details…")}</p>}
          {phase.food && (["protein", "carbs", "fat"] as const).some((k) => phase.food!.nutrients[k] == null) && (
            <p className="text-[13px] text-muted">{tr("USDA ไม่มีค่าบางตัว (แสดงเป็น ?) — จะนับเป็น “ไม่ทราบ” ไม่ใช่ 0", "USDA has no value for some nutrients (shown as ?) — counted as unknown, not 0")}</p>
          )}
          {phase.from.differences.length > 0 && (
            <p className="rounded-xl bg-warn px-3 py-2 text-[13px] text-warn-ink">{tr("อันนี้ไม่ตรงกับชื่อที่คุณใส่ทั้งหมด — แน่ใจนะว่าใช่?", "This doesn't fully match the name you typed — are you sure it's right?")}</p>
          )}
          {mode === "item" && phase.food && (
            <div className="space-y-2">
              <label className="label">{phase.food.per === "ml" ? tr("กินไปกี่มล.", "How many ml you had") : tr("กินไปกี่กรัม", "How many grams you ate")}</label>
              <NumberField value={amount} onChange={setAmount} placeholder={tr("เช่น 150", "e.g. 150")} aria-label={tr("ปริมาณที่กิน", "Amount eaten")} />
              {phase.food.portions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {phase.food.portions.map((p) => (
                    <button key={p.label} type="button" className="min-h-[44px] rounded-full border border-white/80 bg-white/70 px-3 text-[13px]" onClick={() => setAmount(p.grams)}>
                      {p.label} = {fmtG(p.grams)} {tr("ก.", "g")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-soft flex-1" onClick={backToList} data-testid="usda-other">{tr("เลือกอันอื่น", "Pick another")}</button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!phase.food || phase.food.nutrients.kcal == null || (mode === "item" && !(amount && amount > 0))}
              onClick={() => phase.food && onPick(phase.food, mode === "item" ? (amount ?? undefined) : undefined)}
              data-testid="usda-use"
            >
              {tr("ใช้อันนี้", "Use this")}
            </button>
          </div>
        </div>
      )}
      <UsdaAttribution />
    </div>
  );
}
