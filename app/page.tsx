"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MacroCards, MacroTipLine, Sheet, StoredPhoto } from "./components/ui";
import { BackupReminder } from "./components/BackupReminder";
import { WeekKcalChart } from "./components/WeekKcalChart";
import { WaterCard } from "./components/WaterCard";
import { ShareDayButton } from "./components/ShareDayButton";
import { CharacterPicture } from "./components/Character";
import { guessSlot, shiftDateKey, shortDayLabel, thaiDateKey, thaiDateLabel } from "./lib/date";
import { buildAddUrlWith, buildReviewUrl, cleanPrefill, showWholeDishRow } from "./lib/addSheet";
import { putHandoff } from "./lib/sheetHandoff";
import { IngredientSearch } from "./components/AddIngredientSheet";
import type { Ingredient } from "./lib/types";
import { copyMeal, recentMeals, searchMeals } from "./lib/repeat";
import { macroTargets, proteinTargetG } from "./lib/energy";
import { fmtKcal, pickMacros, sumMacros } from "./lib/nutrition";
import { isEstimated, joinMissing } from "./lib/provenance";
import { useLang } from "./lib/lang";
import { useStore } from "./lib/store";
import { glassesOn, waterGoal } from "./lib/water";
import { SLOT_LABEL, SLOTS, type Entry } from "./lib/types";
import { Icon, type IconName } from "./components/Icon";

const SLOT_COLORS = ["var(--protein-dot)", "var(--fat-dot)", "var(--carbs-dot)", "var(--water)"];

/** Thin line icons for the "Add food" choices (calm look, no emoji). */
const ADD_ICONS: Record<string, IconName> = {
  photo: "camera",
  text: "chat-text",
  recipes: "book-open",
  manual: "pencil-simple",
  barcode: "barcode",
  search: "magnifying-glass",
  again: "arrows-clockwise",
};

function AddIcon({ name }: { name: string }) {
  return (
    <Icon name={ADD_ICONS[name]} className="h-8 w-8" />
  );
}

function Ring({ eaten, target }: { eaten: number; target: number }) {
  const r = 86;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, eaten / Math.max(1, target));
  const over = eaten > target;
  return (
    <svg viewBox="0 0 200 200" className="h-[210px] w-[210px]" aria-hidden>
      <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(43,39,36,0.08)" strokeWidth="5" />
      {p > 0 && <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={over ? "var(--over)" : "var(--ink)"}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform="rotate(-90 100 100)"
      />}
    </svg>
  );
}

function TodayInner() {
  const { ready, entries, goals, saveError, upsertEntry, deleteEntry, waterLogs } = useStore();
  const search = useSearchParams();
  const router = useRouter();
  const today = thaiDateKey();
  const date = search.get("date") || today;
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<Entry | null>(null);
  const [againView, setAgainView] = useState(false);
  const [againQuery, setAgainQuery] = useState("");
  const [addText, setAddText] = useState("");
  const { tr, lang } = useLang();

  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt), [entries, date]);
  const total = useMemo(() => sumMacros(dayEntries.flatMap((e) => e.items.map(pickMacros))), [dayEntries]);
  const target = goals.targetKcal;
  const mTargets = macroTargets(target, proteinTargetG(goals.profile));
  const left = target - total.kcal;
  const go = (d: string) => router.replace(d === today ? "/" : `/?date=${d}`);
  const q = date === today ? "" : `?date=${date}`;
  const recent = useMemo(() => recentMeals(entries), [entries]);
  const found = useMemo(() => searchMeals(recent, againQuery), [recent, againQuery]);
  const typed = cleanPrefill(addText);
  const dateParam = date === today ? null : date;
  // The ONE hand-over: the chosen food (with its amount) goes to the review page; nothing is saved yet.
  const handOver = (ing: Ingredient) => {
    let store: Storage | null = null;
    try {
      store = window.sessionStorage;
    } catch {
      store = null;
    }
    setAddOpen(false);
    if (putHandoff(store, ing, Date.now())) router.push(buildReviewUrl(dateParam));
    else router.push(buildAddUrlWith("search", dateParam, ing.name, {}));
  };
  const openAdd = () => {
    setAgainView(false);
    setAgainQuery("");
    setAddText("");
    setAddOpen(true);
  };

  // "Eat again": copy the meal to the day on screen. Today → meal slot from the time now; past day → its old slot.
  const eatAgain = (e: Entry) => {
    const copy = copyMeal(e, date, date === today ? guessSlot() : e.slot);
    upsertEntry(copy);
    setAdded(copy);
    setAddOpen(false);
  };
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 6000);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <main className="page space-y-5">
      {date === today && (
        // Yani's own brand character: small, fixed, her black lines only (her pick "A").
        <div className="-mb-2 flex justify-center" data-testid="character">
          <CharacterPicture size={44} />
        </div>
      )}
      <header className="flex items-center justify-between">
        <button className="glass grid h-11 w-11 place-items-center !rounded-full" onClick={() => go(shiftDateKey(date, -1))} aria-label={tr("วันก่อนหน้า", "Previous day")}>
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h1 className="text-[26px] font-medium">{date === today ? tr("วันนี้", "Today") : tr("ย้อนดู", "Looking back")}</h1>
          <p className="text-[14px] text-muted">{thaiDateLabel(date, lang)}</p>
        </div>
        <button
          className="glass grid h-11 w-11 place-items-center !rounded-full disabled:opacity-30"
          onClick={() => go(shiftDateKey(date, 1))}
          disabled={date >= today}
          aria-label={tr("วันถัดไป", "Next day")}
        >
          <Icon name="caret-right" className="h-5 w-5" />
        </button>
      </header>

      {saveError && (
        <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
          {tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save on this phone")}: {saveError}
        </div>
      )}

      {ready && date === today && <BackupReminder entries={entries} />}

      <section className="card flex flex-col items-center px-5 pb-5 pt-6">
        <div className="relative">
          <Ring eaten={ready ? total.kcal : 0} target={target} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-[58px] leading-none" data-testid="eaten-kcal">
              {ready ? fmtKcal(total.kcal) : "–"}
            </span>
            <span className="mt-1 text-[15px] text-muted">
              {tr("จาก", "of")} <span className="num text-ink" data-testid="target-kcal">{fmtKcal(target)}</span> kcal
            </span>
          </div>
        </div>
        <p className={`mt-2 text-[16px] ${left < 0 ? "text-warn-ink" : "text-muted"}`}>
          {left >= 0
            ? tr(`เหลืออีก ${fmtKcal(left)} kcal`, `${fmtKcal(left)} kcal left`)
            : tr(`เกินเป้า ${fmtKcal(-left)} kcal`, `${fmtKcal(-left)} kcal over target`)}
        </p>
        {ready && date === today && (
          <Link
            href="/add/suggest"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/90 bg-white/60 px-4 text-[15px] active:scale-[0.98]"
            data-testid="suggest-button"
          >
            {tr("เหลือเท่านี้ กินอะไรดี", "What can I eat with what's left?")}
          </Link>
        )}
        <div className="mt-4 w-full">
          <MacroCards m={total} targets={mTargets} showSplit />
        </div>
        {ready && (
          <div className="mt-2.5 w-full">
            <MacroTipLine m={total} targets={mTargets} kcalTarget={target} />
          </div>
        )}
      </section>

      <button className="btn-primary w-full !min-h-[58px] text-[19px]" onClick={openAdd}>
        + {tr("เพิ่มอาหาร", "Add food")}
      </button>

      {ready && <WaterCard date={date} />}

      {ready && <WeekKcalChart entries={entries} date={date} today={today} target={target} onPick={go} />}

      {SLOTS.map((slot, i) => {
        const list = dayEntries.filter((e) => e.slot === slot);
        const kcal = sumMacros(list.flatMap((e) => e.items.map(pickMacros))).kcal;
        return (
          <section key={slot} className="card p-4" data-testid={`slot-${slot}`}>
            <div className="mb-1 flex items-baseline justify-between px-1">
              <h2 className="flex items-center gap-2 text-[18px] font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SLOT_COLORS[i % SLOT_COLORS.length] }} aria-hidden />
                {SLOT_LABEL[slot][lang]}
              </h2>
              <span className="num text-[15px] text-muted">{fmtKcal(kcal)} kcal</span>
            </div>
            {list.length === 0 ? (
              <p className="px-1 py-2 text-[15px] text-muted">{tr("ยังไม่มีรายการ", "Nothing yet")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((e) => (
                  <EntryRow key={e.id} e={e} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {ready && dayEntries.length > 0 && (
        <ShareDayButton
          entries={entries}
          date={date}
          target={target}
          name={goals.profile?.name ?? ""}
          macroTargets={macroTargets(target, proteinTargetG(goals.profile))}
          water={{ glasses: glassesOn(waterLogs, date), goal: waterGoal(goals.waterGoal) }}
        />
      )}

      {added && (
        <div
          className="fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[440px] items-center gap-3 rounded-[22px] bg-ink px-4 py-3 text-paper shadow-lg"
          role="status"
          data-testid="eat-again-toast"
        >
          <span className="min-w-0 flex-1 text-[15px]">
            ✓ {tr("เพิ่ม", "Added")} <b className="font-semibold">{added.title}</b> {tr("ใน", "to")} {SLOT_LABEL[added.slot][lang]}
          </span>
          <button
            className="shrink-0 rounded-full bg-paper/15 px-4 py-2 text-[15px] font-semibold"
            onClick={() => {
              deleteEntry(added.id);
              setAdded(null);
            }}
            data-testid="eat-again-undo"
          >
            {tr("เลิกทำ", "Undo")}
          </button>
        </div>
      )}


      <Sheet open={addOpen} keyboardSafe onClose={() => setAddOpen(false)} title={tr("เพิ่มอาหาร", "Add food")}>
        {againView ? (
          <div className="pb-4" data-testid="eat-again">
            <button className="mb-3 flex items-center gap-1 px-1 text-[16px] font-medium text-olive-dark" onClick={() => setAgainView(false)} data-testid="eat-again-back">
              <Icon name="caret-left" className="h-4 w-4" /> {tr("กลับ", "Back")}
            </button>
            <h3 className="px-1 pb-1 text-[18px] font-medium">{tr("กินซ้ำ", "Eat again")}</h3>
            <p className="px-1 pb-3 text-[13px] text-muted">
              {tr("แตะครั้งเดียว บันทึกเลย · ไม่ต้องใช้ AI", "One tap to log it · no AI needed")}
            </p>
            <input
              type="search"
              className="mb-3 w-full rounded-full border border-white/90 bg-white/70 px-5 py-3 text-[16px] outline-none placeholder:text-muted"
              placeholder={tr("ค้นหาชื่ออาหาร", "Search food name")}
              value={againQuery}
              onChange={(ev) => setAgainQuery(ev.target.value)}
              data-testid="eat-again-search"
            />
            {found.length === 0 ? (
              <p className="px-1 py-6 text-center text-[15px] text-muted">{tr("ไม่เจอเมนูนี้", "No meal found")}</p>
            ) : (
              <ul className="divide-y divide-line rounded-[22px] border border-white/90 bg-white/55 px-3">
                {found.map((e) => (
                  <li key={e.id}>
                    <button
                      className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-60"
                      onClick={() => eatAgain(e)}
                      data-testid="eat-again-item"
                    >
                      {e.photoId ? (
                        <StoredPhoto id={e.photoId} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-muted" aria-hidden>
                          <SourceIcon e={e} small />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium">{e.title}</span>
                        <span className="block text-[13px] text-muted">
                          {tr("กินล่าสุด", "Last eaten")} {shortDayLabel(e.date, today, lang)} · <span className="num">{fmtKcal(sumMacros(e.items.map(pickMacros)).kcal)}</span> kcal
                        </span>
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[20px] font-light leading-none text-paper" aria-hidden>
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div className="pb-3" data-testid="add-sheet-search-first">
          <form
            className="sticky top-0 z-10 -mx-1 mb-3 px-1 pb-1 pt-1"
            onSubmit={(ev) => {
              // No page jump: the results are already live below. Enter just tucks the keyboard away.
              ev.preventDefault();
              (document.activeElement as HTMLElement | null)?.blur?.();
            }}
          >
            <div className="relative">
              <Icon name="magnifying-glass" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                className="w-full rounded-full border border-white/90 bg-white/95 py-3.5 pl-12 pr-12 text-[16px] outline-none placeholder:text-muted"
                placeholder={tr("ค้นหาหรือพิมพ์ว่ากินอะไร", "Search or type what you ate")}
                aria-label={tr("ค้นหาหรือพิมพ์ว่ากินอะไร", "Search or type what you ate")}
                value={addText}
                onChange={(ev) => setAddText(ev.target.value)}
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                data-testid="add-search-input"
              />
              {addText && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted active:opacity-60"
                  onClick={() => setAddText("")}
                  aria-label={tr("ล้าง", "Clear")}
                  data-testid="add-search-clear"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
          {typed ? (
            <IngredientSearch
              food
              compact
              query={typed}
              onAdd={handOver}
              onCreateCustom={(name) => {
                setAddOpen(false);
                router.push(buildAddUrlWith("search", dateParam, name, { create: true }));
              }}
              topSlot={
                showWholeDishRow(typed) ? (
                  <Link
                    href={buildAddUrlWith("text", dateParam, typed, { auto: true })}
                    onClick={() => setAddOpen(false)}
                    className="flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border border-ink/20 bg-white/80 px-4 py-2 text-left text-[15px] active:scale-[0.99]"
                    data-testid="ai-whole-dish-pinned"
                  >
                    <Icon name="sparkle" className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 break-words">
                      {tr("ให้ AI คำนวณ", "Let AI calculate")} “{typed}”
                    </span>
                    <Icon name="caret-right" className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                ) : null
              }
            />
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: `/add/photo${q}`, icon: "photo", label: tr("ถ่ายรูป", "Take a photo") },
              { href: `/add/barcode${q}`, icon: "barcode", label: tr("บาร์โค้ด", "Barcode") },
            ].map((o) => (
              <Link
                key={o.href}
                href={o.href}
                className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] border border-white/90 bg-white/60 text-[16px] active:scale-[0.98]"
              >
                <AddIcon name={o.icon} />
                {o.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[14px] text-muted" data-testid="add-sheet-links">
            {recent.length > 0 && (
              <button className="min-h-[44px] underline-offset-2 active:opacity-60" onClick={() => setAgainView(true)} data-testid="eat-again-tile">
                {tr("กินซ้ำ", "Eat again")}
              </button>
            )}
            <Link href={`/recipes${q}`} className="flex min-h-[44px] items-center underline-offset-2 active:opacity-60">
              {tr("สูตรของฉัน", "My recipes")}
            </Link>
            <Link href={`/add/manual${q}`} className="flex min-h-[44px] items-center underline-offset-2 active:opacity-60">
              {tr("กรอกเอง", "Enter it myself")}
            </Link>
          </div>
          </>
          )}
        </div>
        )}
      </Sheet>
    </main>
  );
}

function SourceIcon({ e, small }: { e: Entry; small?: boolean }) {
  const name = e.source === "recipe" ? "recipes" : e.source === "photo" ? "photo" : e.source === "text" ? "text" : e.source === "barcode" ? "barcode" : "manual";
  return (
    <Icon name={ADD_ICONS[name]} className={small ? "h-5 w-5" : "h-6 w-6"} />
  );
}

function EntryRow({ e }: { e: Entry }) {
  const m = sumMacros(e.items.map(pickMacros));
  // Round 39: "~" = some numbers are estimates; "?" = a nutrient is unknown for some item.
  const approx = e.items.some((i) => isEstimated(i, e));
  const gap = joinMissing(...e.items.map((i) => i.missing));
  const q = (k: "protein" | "carbs" | "fat") => (gap.includes(k) ? "?" : "");
  return (
    <li>
      <Link href={`/entry/${e.id}`} className="flex items-center gap-3 px-1 py-3" data-testid="entry-row">
        {e.photoId ? (
          <StoredPhoto id={e.photoId} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-muted" aria-hidden>
            <SourceIcon e={e} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{e.title}</div>
          <div className="truncate text-[14px] text-muted">
            P {Math.round(m.protein)}{q("protein")} · C {Math.round(m.carbs)}{q("carbs")} · F {Math.round(m.fat)}{q("fat")} g
          </div>
        </div>
        <div className="num text-[20px]" data-approx={approx ? "yes" : "no"}>
          {approx && <span className="text-muted" aria-label="approx">~</span>}
          {fmtKcal(m.kcal)}
          <span className="ml-0.5 text-[12px] font-normal text-muted">kcal</span>
        </div>
      </Link>
    </li>
  );
}

export default function TodayPage() {
  return (
    <Suspense>
      <TodayInner />
    </Suspense>
  );
}
