"use client";
// Round 42: "Search first". A bottom sheet with ONE search box, a list of suggestions, quantity + unit, and "Add".
// Every source (her own foods, usual picks, reference foods, USDA, AI) sits behind the one box.
// Nothing is picked for her. Missing numbers are shown as "?", never 0. Her own numbers are never "verified".

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { aiFetch } from "../lib/aiFetch";
import { useLang } from "../lib/lang";
import { fmtG, fmtKcal } from "../lib/nutrition";
import { normalizeName, STATE_LABEL, stateInName } from "../lib/foodRef";
import { ingredientMacros } from "../lib/recipe";
import { PASSCODE_HEADER, PASSCODE_KEY, passcodeHeaderValue } from "../lib/passcode";
import {
  addCustom,
  forgetPick,
  forgetPickEverywhere,
  loadCustom,
  loadPrefs,
  recordPick,
  saveCustom,
  savePrefs,
  type CustomIngredient,
  type CustomInput,
  type IngredientPrefPick,
} from "../lib/customIngredients";
import {
  askAi,
  mergeSuggestions,
  splitResults,
  pickOf,
  quoteIngredient,
  searchLocal,
  shouldAskUsda,
  showAiRow,
  stateQuestion,
  suggestedUnits,
  type AiAnswer,
  type Suggestion,
} from "../lib/ingredientSearch";
import { createUsdaSearcher, type UsdaStatus } from "../lib/ingredientUsda";
import { DIFFERENCE_LABEL } from "../lib/food/usdaMatch";
import { DATA_TYPE_LABEL } from "../lib/food/usdaNutrients";
import { UNIT_GROUPS, UNITS, unitKind, type Ingredient, type IngredientUnit, type Macros } from "../lib/types";
import { Badge, MissingNote, NumberField, ProvenanceBadge, Sheet } from "./ui";
import { UsdaAttribution, useUsdaReady } from "./UsdaPicker";
import { Icon } from "./Icon";
import { CustomIngredientList } from "./CustomIngredientList";

const stamp = () => Date.now();

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const readOnline = () => navigator.onLine !== false;

function readCode(): string | null {
  try {
    return localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** kcal + P/C/F, unknown ones as "?" (never 0). */
function MacroLine({ m, missing }: { m: Macros; missing: string[] }) {
  const g = (k: "protein" | "carbs" | "fat") => (missing.includes(k) ? "?" : fmtG(m[k]));
  return (
    <span className="text-muted">
      P {g("protein")} · C {g("carbs")} · F {g("fat")}
    </span>
  );
}

export function AddIngredientSheet({
  open,
  onClose,
  onAdd,
  onCreateCustom,
}: {
  open: boolean;
  onClose: () => void;
  /** The finished ingredient (numbers already filled). */
  onAdd: (ing: Ingredient) => void;
  /** "+ create my own": the page opens the manual editor with this name. */
  onCreateCustom: (name: string) => void;
}) {
  if (!open) return null;
  return <IngredientSheetInner onClose={onClose} onAdd={onAdd} onCreateCustom={onCreateCustom} />;
}

/** Round 49: the search box lives in the sheet's fixed header; only the results scroll below it. */
function IngredientSheetInner({ onClose, onAdd, onCreateCustom }: { onClose: () => void; onAdd: (ing: Ingredient) => void; onCreateCustom: (name: string) => void }) {
  const { tr } = useLang();
  const [text, setText] = useState("");
  return (
    <Sheet
      open
      onClose={onClose}
      keyboardSafe
      title={tr("เพิ่มวัตถุดิบ", "Add ingredient")}
      header={
        <div className="relative">
          <Icon name="magnifying-glass" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            className="field !pl-11 !bg-white/95"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr("ค้นหาวัตถุดิบ เช่น ไข่, egg, ข้าวสวย", "Search an ingredient, e.g. egg, ไข่, rice")}
            aria-label={tr("ค้นหาวัตถุดิบ", "Search ingredient")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            data-testid="ai-search"
            autoFocus
          />
        </div>
      }
    >
      <IngredientSearch query={text} onClose={onClose} onAdd={onAdd} onCreateCustom={onCreateCustom} />
    </Sheet>
  );
}

/**
 * The search-first body. Used inside the recipe's sheet, and (Round 44) on the full "Search food" page
 * (`food` = the words say "food", not "ingredient"; `onClose` is not needed there).
 */
export function IngredientSearch({
  onClose,
  onAdd,
  onCreateCustom,
  food = false,
  initialQuery = "",
  footer,
  query: controlledQuery,
  topSlot,
  compact = false,
}: {
  onClose?: () => void;
  onAdd: (ing: Ingredient) => void;
  onCreateCustom: (name: string) => void;
  food?: boolean;
  /** Round 46: words to search for right away (from the Add food sheet). */
  initialQuery?: string;
  /** Round 46: one quiet extra line at the bottom, given the words typed so far. */
  footer?: (query: string) => ReactNode;
  /** Round 47: the words come from a box outside (the Add food sheet). Then this part shows no box of its own. */
  query?: string;
  /** Round 47: one pinned row right under the box (the "let AI calculate" row). While it is there, the small "AI estimate" row stays hidden: one AI button at a time. */
  topSlot?: ReactNode;
  /** Round 47: in the Add food sheet — no "Manage" fold (that lives on the recipes page). */
  compact?: boolean;
}) {
  const { tr, lang } = useLang();
  const online = useSyncExternalStore(subscribeOnline, readOnline, () => true);
  const usdaReady = useUsdaReady();

  const [ownQuery, setOwnQuery] = useState(initialQuery);
  const query = controlledQuery ?? ownQuery;
  const [custom, setCustom] = useState<CustomIngredient[]>(() => loadCustom());
  const [prefs, setPrefs] = useState<IngredientPrefPick[]>(() => loadPrefs());
  const [sel, setSel] = useState<Suggestion | null>(null);
  // New words → the open row closes (done while drawing, so there is no flash of a stale row).
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setSel(null);
  }
  const [amount, setAmount] = useState<number | null>(null);
  const [unit, setUnit] = useState<IngredientUnit>("g");
  const [gpu, setGpu] = useState<number | null>(null);
  const [dens, setDens] = useState<number | null>(null);
  const [noPass, setNoPass] = useState(false);
  const [usda, setUsda] = useState<{ key: string; status: UsdaStatus; rows: Suggestion[] } | null>(null);
  const [ai, setAi] = useState<{ key: string; row: Suggestion | null; msg: string | null; busy: boolean } | null>(null);

  const searcher = useMemo(
    () =>
      createUsdaSearcher({
        storage: session(),
        getHeaders: () => {
          const c = readCode();
          const h: Record<string, string> = {};
          if (c) h[PASSCODE_HEADER] = passcodeHeaderValue(c);
          return h;
        },
        // The server decides about the passcode; a refusal shows up as status "no-passcode".
        hasPasscode: () => true,
        online: readOnline,
      }),
    [],
  );

  const q = query.trim();
  const qKey = normalizeName(q);
  const local = useMemo(() => searchLocal(q, { lang, custom, prefs }), [q, lang, custom, prefs]);
  const gate = shouldAskUsda(q, local, { online, hasPasscode: !noPass });
  const usdaWanted = usdaReady && gate.run;

  // Ask USDA a moment after she stops typing (the searcher waits 500 ms and remembers answers).
  useEffect(() => {
    if (!usdaWanted) return;
    let live = true;
    void searcher.searchDebounced(q, lang).then((out) => {
      if (!live || out.status === "superseded") return;
      if (out.status === "no-passcode") setNoPass(true);
      setUsda({ key: qKey, status: out.status, rows: out.results });
    });
    return () => {
      live = false;
    };
  }, [usdaWanted, q, qKey, lang, searcher]);

  const usdaHere = usda && usda.key === qKey ? usda : null;
  const usdaLoading = usdaWanted && !usdaHere;
  const aiHere = ai && ai.key === qKey ? ai : null;

  const rows = useMemo(() => {
    const merged = mergeSuggestions(local.items, usdaWanted && usdaHere ? usdaHere.rows : [], 16);
    return aiHere?.row ? [...merged, aiHere.row] : merged;
  }, [local.items, usdaWanted, usdaHere, aiHere]);
  const [showOther, setShowOther] = useState<string | null>(null);
  const split = useMemo(() => splitResults(rows), [rows]);
  const otherOpen = showOther === qKey;
  const shown = otherOpen ? rows : split.main;
  const hasUsdaRow = shown.some((r) => r.kind === "usda");
  const offerAi = !topSlot && q.length >= 2 && !usdaLoading && !aiHere?.row && showAiRow(q, rows);

  function pick(s: Suggestion) {
    if (sel?.id === s.id) return;
    const u = suggestedUnits(s);
    setSel(s);
    setUnit(u.default);
    setAmount(null);
    setGpu(null);
    setDens(null);
    // USDA: fetch its household measures (cup, spoon…). If that fails the numbers from the list are still USDA's own.
    if (s.source.kind === "usda") {
      void searcher.detail(s).then((r) => setSel((cur) => (cur && cur.id === s.id ? r.suggestion : cur)));
    }
  }

  async function estimate() {
    if (aiHere?.busy) return;
    setAi({ key: qKey, row: null, msg: null, busy: true });
    const out = await askAi(
      q,
      async (name) => {
        const r = await aiFetch("/api/ingredient", { name, lang }, lang);
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message ?? "error");
        return (data?.result ?? null) as AiAnswer | null;
      },
      readOnline(),
    );
    if (out.status === "ok") setAi({ key: qKey, row: out.suggestion, msg: null, busy: false });
    else {
      const msg =
        out.status === "offline"
          ? tr("ออฟไลน์ — AI ใช้ไม่ได้ตอนนี้", "Offline — the AI can't be used right now")
          : out.status === "unknown"
            ? tr("AI ไม่รู้จักชื่อนี้ — สร้างวัตถุดิบเองได้", "The AI doesn't know this one — you can add your own")
            : tr("AI หาค่าไม่ได้ ลองอีกครั้ง", "The AI couldn't look it up. Try again.");
      setAi({ key: qKey, row: null, msg, busy: false });
    }
  }

  /** "Passcode needed": ask for it now (the same box the AI uses), then search again. */
  async function unlock() {
    const r = await aiFetch("/api/food/usda", { action: "search", name: q, lang }, lang);
    if (r.ok) {
      setNoPass(false);
      setUsda(null);
    }
  }

  // ---- the numbers for the chosen row ----
  const amountN = amount && amount > 0 ? amount : 0;
  const quote = useMemo(() => {
    if (!sel || !amountN) return null;
    const base = quoteIngredient(sel, amountN, unit, lang);
    if (base.result.ok) return base;
    // The math asked a question ("weight of one piece?", "density?"): use her answer, then ask the math again.
    const ingredient = { ...base.ingredient, gramsPerUnit: base.ingredient.gramsPerUnit ?? gpu, gPerMl: base.ingredient.gPerMl ?? (dens && dens > 0 ? dens / UNITS[unit].factor : null) };
    return { ingredient, result: ingredientMacros(ingredient, lang) };
  }, [sel, amountN, unit, lang, gpu, dens]);

  const res = quote?.result ?? null;
  const askGpu = !!res && !res.ok && res.reason === "need-weight-per-unit";
  const askDens = !!res && !res.ok && res.reason === "need-density";
  const units = sel ? suggestedUnits(sel).units : [];
  const unitWord = UNITS[unit][lang];

  function add() {
    if (!sel || !quote || !quote.result.ok) return;
    if (q) {
      const next = recordPick(prefs, q, pickOf(sel), stamp());
      setPrefs(next);
      savePrefs(next);
    }
    onAdd(quote.ingredient);
    onClose?.();
  }

  // ---- manage (custom ingredients + usual picks) ----
  function changeCustom(list: CustomIngredient[]) {
    setCustom(list);
    saveCustom(list);
  }
  function changePrefs(list: IngredientPrefPick[]) {
    setPrefs(list);
    savePrefs(list);
  }

  const showEmptyHeading = !q && rows.length > 0;
  const noMatch = !!q && rows.length === 0 && !usdaLoading;

  return (
    <div className="space-y-3 pb-5" data-testid="add-ingredient-sheet">
      {controlledQuery === undefined && (
      <div className="relative -mx-1 px-1 pb-1 pt-1">
        <Icon name="magnifying-glass" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          className="field !pl-11 !bg-white/95"
          value={query}
          onChange={(e) => setOwnQuery(e.target.value)}
          placeholder={food ? tr("ค้นหาอาหาร เช่น ไข่, egg, ข้าวสวย", "Search a food, e.g. egg, ไข่, rice") : tr("ค้นหาวัตถุดิบ เช่น ไข่, egg, ข้าวสวย", "Search an ingredient, e.g. egg, ไข่, rice")}
          aria-label={food ? tr("ค้นหาอาหาร", "Search food") : tr("ค้นหาวัตถุดิบ", "Search ingredient")}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          data-testid="ai-search"
          autoFocus
        />
      </div>
      )}

      {topSlot}

      {showEmptyHeading && <p className="px-1 text-[13px] text-muted">{tr("ของฉัน และที่ใช้ล่าสุด", "Yours and recent")}</p>}

      {shown.length > 0 && (
        <ul className="space-y-2" data-testid="ai-results">
          {shown.map((s) => {
            const on = sel?.id === s.id;
            return (
              <li key={s.id}>
                {on ? (
                  <div className="space-y-3 rounded-2xl border border-ink/30 bg-white/90 p-3" data-testid="ai-selected" data-id={s.id}>
                    <RowHead s={s} lang={lang} />
                    {stateQuestion(q, s) && s.stateLabel && stateInName(q) && (
                      <p className="rounded-xl bg-warn px-3 py-2 text-[13px] text-warn-ink" data-testid="ai-state-note">
                        {tr(
                          `คุณพิมพ์ว่า${STATE_LABEL[stateInName(q)!].th} แต่อันนี้เป็นค่า${s.stateLabel.th} — ค่าต่างกันมาก เลือกให้ตรงนะ`,
                          `You typed ${STATE_LABEL[stateInName(q)!].en} but this one is ${s.stateLabel.en} — the numbers differ a lot. Make sure it fits.`,
                        )}
                      </p>
                    )}
                    {s.kind === "ai" && (
                      <p className="text-[13px] text-muted" data-testid="ai-estimate-note">
                        {tr("ประมาณโดย AI — ไม่ใช่ค่าที่ตรวจสอบแล้ว แก้ได้ในการ์ดวัตถุดิบ", "Estimated by the AI — not verified. You can fix it on the ingredient card.")}
                      </p>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <NumberField value={amount} onChange={setAmount} placeholder={tr("ปริมาณ", "Amount")} aria-label={tr("ปริมาณ", "Amount")} data-testid="ai-amount" autoFocus />
                      <select className="field !w-auto max-w-[150px]" value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)} aria-label={tr("หน่วย", "Unit")} data-testid="ai-unit">
                        <optgroup label={tr("แนะนำ", "Suggested")}>
                          {units.map((u) => (
                            <option key={u} value={u}>{UNITS[u][lang]}</option>
                          ))}
                        </optgroup>
                        {UNIT_GROUPS.map((g) => {
                          const rest = (Object.keys(UNITS) as IngredientUnit[]).filter((u) => UNITS[u].kind === g.kind && !units.includes(u));
                          return rest.length ? (
                            <optgroup key={g.kind} label={g.label[lang]}>
                              {rest.map((u) => (
                                <option key={u} value={u}>{UNITS[u][lang]}</option>
                              ))}
                            </optgroup>
                          ) : null;
                        })}
                      </select>
                    </div>

                    {askGpu && (
                      <div data-testid="ai-ask-gpu">
                        <label className="label">{tr(`น้ำหนักของ 1 ${unitKind(unit) === "count" ? unitWord : tr("ชิ้น", "piece")} (กรัม)`, `Weight of 1 ${unitKind(unit) === "count" ? unitWord : "piece"} (g)`)}</label>
                        <NumberField value={gpu} onChange={setGpu} placeholder={tr("เช่น 50", "e.g. 50")} aria-label={tr("น้ำหนักต่อหน่วย", "Weight per unit")} />
                        {s.source.kind === "usda" && !!s.source.usda.portions?.length && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {s.source.usda.portions.map((p) => (
                              <button key={p.label} type="button" className="min-h-[44px] rounded-full border border-white/80 bg-white/70 px-3 text-[13px]" onClick={() => setGpu(p.grams)}>
                                {p.label} = {fmtG(p.grams)} {tr("ก.", "g")}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {askDens && (
                      <div data-testid="ai-ask-density">
                        <label className="label">{tr(`น้ำหนักของ 1 ${unitWord} (กรัม)`, `Weight of 1 ${unitWord} (g)`)}</label>
                        <NumberField value={dens} onChange={setDens} placeholder={tr("เช่น 13", "e.g. 13")} aria-label={tr("น้ำหนักต่อหน่วยตวง", "Weight per measure")} />
                      </div>
                    )}

                    <div className="min-h-[24px] text-[14px]" data-testid="ai-quote" aria-live="polite">
                      {!amountN ? (
                        <span className="text-muted">{tr("ใส่ปริมาณเพื่อดูพลังงาน", "Enter an amount to see the calories")}</span>
                      ) : res?.ok ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="num font-semibold">{fmtKcal(res.macros.kcal)} kcal</span>
                          <MacroLine m={res.macros} missing={res.missing} />
                        </span>
                      ) : res ? (
                        <span className="text-warn-ink">{askGpu || askDens ? tr("ใส่น้ำหนักด้านบนเพื่อคำนวณ", "Enter the weight above to work it out") : res.message}</span>
                      ) : null}
                      {res?.ok && <MissingNote missing={res.missing} className="mt-1" />}
                    </div>

                    <details className="text-[13px]" data-testid="ai-details">
                      <summary className="min-h-[44px] cursor-pointer py-1.5 text-muted">{tr("รายละเอียดสารอาหาร", "Nutrition details")}</summary>
                      <div className="space-y-1.5 pb-1 text-muted">
                        {s.per100 && (
                          <p>
                            {s.basis === "perUnit" ? tr("ต่อ 1 หน่วย", "Per 1 unit") : tr(`ต่อ 100 ${s.per === "ml" ? "มล." : "ก."}`, `Per 100 ${s.per}`)}:{" "}
                            <span className="num text-ink">{fmtKcal(s.per100.kcal)} kcal</span>{" "}
                            <MacroLine m={s.per100} missing={s.missing} />
                          </p>
                        )}
                        {res?.ok && (
                          <p className="flex flex-wrap items-center gap-1.5">
                            <ProvenanceBadge prov={res.prov} />
                            {res.refName && res.refName !== "AI" && <span>{res.refName}</span>}
                          </p>
                        )}
                        {s.source.kind === "usda" && (
                          <p>
                            USDA: <span className="text-ink">{s.source.usda.description}</span>
                            {s.source.usda.brand ? ` · ${s.source.usda.brand}` : ""} · {DATA_TYPE_LABEL[s.source.usda.dataType][lang]}
                          </p>
                        )}
                        {s.kind === "custom" && <p>{tr("ตัวเลขที่คุณพิมพ์เอง — ยังไม่ได้ตรวจสอบ", "Numbers you typed yourself — not verified")}</p>}
                        {s.kind === "ai" && <p>{tr("ค่าประมาณจาก AI", "Estimated by the AI")}</p>}
                        {s.source.kind === "ref" && <p>{tr("ค่าทั่วไปของอาหารนี้ในแอป", "Typical values for this food, built into the app")}</p>}
                      </div>
                    </details>

                    <button type="button" className="btn-primary w-full" disabled={!res?.ok} onClick={add} data-testid="ai-add">
                      {tr("เพิ่ม", "Add")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 text-left"
                    data-testid="ai-row"
                    data-id={s.id}
                    data-kind={s.kind}
                  >
                    <RowHead s={s} lang={lang} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {split.other.length > 0 && (
        <button type="button" className="min-h-[44px] px-1 text-[14px] text-muted underline decoration-ink/20 underline-offset-4" onClick={() => setShowOther(otherOpen ? null : qKey)} aria-expanded={otherOpen} data-testid="ai-other-toggle">
          {otherOpen ? tr("ซ่อนผลใกล้เคียงอื่น", "Hide other results") : tr(`ดูผลใกล้เคียงอื่น (${split.other.length})`, `Show other results (${split.other.length})`)}
        </button>
      )}

      {/* quiet one-line states */}
      <div className="space-y-1 px-1 text-[13px] text-muted" data-testid="ai-status">
        {usdaLoading && (
          <p data-testid="ai-loading">
            <Icon name="sparkle" className="mr-1 inline-block h-4 w-4 align-[-3px]" />
            {tr("กำลังค้นหาเพิ่มใน USDA…", "Searching USDA too…")}
          </p>
        )}
        {q.length >= 2 && !online && <p data-testid="ai-offline">{tr("ออฟไลน์ — แสดงเฉพาะที่มีในเครื่อง", "Offline — showing only what is on this phone")}</p>}
        {usdaWanted && noPass && (
          <p data-testid="ai-nopass">
            <button type="button" className="min-h-[44px] font-medium text-olive-dark" onClick={() => void unlock()}>
              {tr("ใส่รหัสผ่านเพื่อค้นใน USDA", "Enter the passcode to search USDA")}
            </button>
          </p>
        )}
        {usdaHere && (usdaHere.status === "error" || usdaHere.status === "busy") && <p data-testid="ai-usda-down">{tr("ค้น USDA ไม่ได้ตอนนี้ — แสดงเฉพาะที่มีในเครื่อง", "USDA isn't answering right now — showing only what is on this phone")}</p>}
        {noMatch && <p data-testid="ai-nomatch">{tr("ไม่พบ — ลองคำอื่น หรือสร้างวัตถุดิบเอง", "Nothing found — try other words, or add your own")}</p>}
        {aiHere?.msg && <p className="text-warn-ink" data-testid="ai-msg">{aiHere.msg}</p>}
      </div>

      {offerAi && (
        <button type="button" className="flex min-h-[44px] w-full items-center gap-2 rounded-2xl border border-dashed border-ink/25 px-3 text-left text-[14px] text-olive-dark" onClick={() => void estimate()} disabled={aiHere?.busy} data-testid="ai-ask">
          <Icon name="sparkle" className="h-4 w-4 shrink-0" />
          <span>{aiHere?.busy ? tr("AI กำลังประมาณค่า…", "The AI is estimating…") : tr("ไม่เจอ? ให้ AI ประมาณแคลอรี (เป็นค่าประมาณ)", "Not found? Let AI estimate (it is an estimate)")}</span>
        </button>
      )}

      {hasUsdaRow && <UsdaAttribution />}

      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <button type="button" className="min-h-[44px] text-[15px] font-medium text-olive-dark" onClick={() => onCreateCustom(q)} data-testid="ai-create-custom">
          {tr("+ สร้างวัตถุดิบเอง", "+ Add custom ingredient")}
        </button>
      </div>

      {footer?.(q)}

      {!compact && <ManageFold custom={custom} prefs={prefs} onCustom={changeCustom} onPrefs={changePrefs} onForgetCustom={(c) => changePrefs(forgetPickEverywhere(prefs, { kind: "custom", id: c.id, name: c.name }))} />}
    </div>
  );
}

/** One row (or the head of the open row): name, state, kcal per 100. Provenance is NOT shown here. */
function RowHead({ s, lang }: { s: Suggestion; lang: "th" | "en" }) {
  const { tr, dn } = useLang();
  const per = s.basis === "perUnit" ? tr("ต่อ 1 หน่วย", "per 1 unit") : `/100 ${s.per === "ml" ? tr("มล.", "ml") : tr("ก.", "g")}`;
  return (
    <span className="block">
      <span className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-medium leading-snug">{s.custom ? dn(s.name, s.custom.alt) : s.name}</span>
        {s.kind === "custom" && <Badge tone="olive">{tr("ของฉัน", "Mine")}</Badge>}
        {s.kind === "preferred" && <Badge tone="olive">{tr("ใช้บ่อย", "Usual")}</Badge>}
        {s.kind === "ai" && <Badge>{tr("ประมาณ", "Estimate")}</Badge>}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
        {s.stateLabel && <Badge tone="muted">{s.stateLabel[lang]}</Badge>}
        {s.conflict && !s.differences?.includes("state") && <Badge>{tr("สถานะไม่ตรงกับที่พิมพ์", "State differs from what you typed")}</Badge>}
        {s.differences?.map((d) => (
          <Badge key={d}>{DIFFERENCE_LABEL[d][lang]}</Badge>
        ))}
        {s.per100 && (
          <span className="text-muted">
            <span className="num font-semibold text-ink">{fmtKcal(s.per100.kcal)} kcal</span> {per}
          </span>
        )}
        {s.detail && <span className="text-[12px] text-muted">{s.detail}</span>}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Manage: edit / delete her saved custom ingredients, forget a usual pick
// ---------------------------------------------------------------------------

function ManageFold({
  custom,
  prefs,
  onCustom,
  onPrefs,
  onForgetCustom,
}: {
  custom: CustomIngredient[];
  prefs: IngredientPrefPick[];
  onCustom: (l: CustomIngredient[]) => void;
  onPrefs: (l: IngredientPrefPick[]) => void;
  onForgetCustom: (c: CustomIngredient) => void;
}) {
  const { tr, dn } = useLang();
  const sortedPrefs = useMemo(() => [...prefs].sort((a, b) => b.lastUsed - a.lastUsed), [prefs]);

  return (
    <details className="rounded-2xl bg-cream/70 px-3" data-testid="ai-manage">
      <summary className="min-h-[44px] cursor-pointer py-3 text-[14px] text-muted">{tr("จัดการ", "Manage")}</summary>
      <div className="space-y-4 pb-3">
        <div className="space-y-2">
          <p className="text-[13px] font-medium">{tr("วัตถุดิบของฉัน", "My ingredients")}</p>
          {custom.length === 0 && <p className="text-[13px] text-muted">{tr("ยังไม่มี — สร้างวัตถุดิบเองแล้วกด “บันทึกไว้ใช้ครั้งหน้า”", "None yet — add your own and tap “Save for future use”")}</p>}
          <CustomIngredientList custom={custom} onCustom={onCustom} onForgetCustom={onForgetCustom} />
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium">{tr("ตัวเลือกที่ใช้บ่อย", "Usual picks")}</p>
          {sortedPrefs.length === 0 && <p className="text-[13px] text-muted">{tr("ยังไม่มี — จะจำให้เมื่อคุณเพิ่มวัตถุดิบ", "None yet — they are remembered when you add ingredients")}</p>}
          {sortedPrefs.map((p) => (
            <div key={`${p.queryKey}|${p.pick.kind}|${p.pick.name}`} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-1.5" data-testid="ai-pref-item">
              <p className="min-w-0 truncate text-[14px]">
                “{p.queryKey}” <span className="text-muted">→ {dn(p.pick.name)}</span>
              </p>
              <button type="button" className="min-h-[44px] shrink-0 px-2 text-[14px] text-muted" onClick={() => onPrefs(forgetPick(prefs, p.queryKey, p.pick))} data-testid="ai-pref-forget">
                {tr("ลืมตัวเลือกนี้", "Forget")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

/** Used by the recipe page: save a typed ingredient so the search finds it next time. */
export function saveTypedAsCustom(input: CustomInput): { ok: true } | { ok: false; error: "name" | "kcal" | "number" | "duplicate" } {
  const r = addCustom(loadCustom(), input, stamp());
  if (!r.ok) return r;
  saveCustom(r.list);
  return { ok: true };
}
