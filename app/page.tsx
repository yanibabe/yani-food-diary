"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MacroCards, MacroTipLine, Sheet } from "./components/ui";
import { BackupReminder } from "./components/BackupReminder";
import { HomeTiles } from "./components/HomeTiles";
import { ShareDayButton } from "./components/ShareDayButton";
import { guessSlot, shiftDateKey, shortDayLabel, thaiDateKey, thaiDateLabel } from "./lib/date";
import { buildAddUrlWith, cleanPrefill, showWholeDishRow } from "./lib/addSheet";
import { closeAddLayerAction, layerAfterPop, layerHistoryState, layerMode, openAddLayer, type AddLayer } from "./lib/addLayer";
import { AddFlow } from "./components/AddFlow";
import { dailyJarConfig } from "./lib/dailyJars";
import { weekRange } from "./lib/jar";

import { useReportOverlay } from "./lib/overlayFlag";
import { beginNav, endNav, IDLE_NAV, isPending, NAV_GIVE_UP_MS, type NavState } from "./lib/navGuard";
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
import { MealThumb } from "./components/MealPicture";
import { SwipeRow } from "./components/SwipeRow";
import { deletePhoto } from "./lib/photos";
import { entryPhotoIds } from "./lib/mealPhotos";
import { photoStillUsed } from "./lib/repeat";


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

function Ring({ eaten, target, size = 210, stroke = 5 }: { eaten: number; target: number; size?: number; stroke?: number }) {
  const r = 86;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, eaten / Math.max(1, target));
  const over = eaten > target;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden>
      <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(43,39,36,0.08)" strokeWidth={stroke} />
      {p > 0 && <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={over ? "var(--over)" : "var(--ink)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform="rotate(-90 100 100)"
      />}
    </svg>
  );
}

function TodayInner() {
  const { ready, entries, goals, saveError, upsertEntry, deleteEntry, waterLogs, bodyLogs } = useStore();
  const search = useSearchParams();
  const router = useRouter();
  const today = thaiDateKey();
  const date = search.get("date") || today;
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<Entry | null>(null);
  const [againView, setAgainView] = useState(false);
  const [againQuery, setAgainQuery] = useState("");
  const [addText, setAddText] = useState("");
  const { tr, lang, dn } = useLang();

  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt), [entries, date]);
  // Round 76: the week card can be shared even on a day with no meals yet, as long as the week has some.
  const weekHasMeals = useMemo(() => {
    const { start, end } = weekRange(date);
    return entries.some((e) => e.date >= start && e.date <= end);
  }, [entries, date]);
  const total = useMemo(() => sumMacros(dayEntries.flatMap((e) => e.items.map(pickMacros))), [dayEntries]);
  const target = goals.targetKcal;
  const mTargets = macroTargets(target, proteinTargetG(goals.profile, target));
  const left = target - total.kcal;
  const go = (d: string) => router.replace(d === today ? "/" : `/?date=${d}`);
  const q = date === today ? "" : `?date=${date}`;
  const recent = useMemo(() => recentMeals(entries), [entries]);
  const found = useMemo(() => searchMeals(recent, againQuery), [recent, againQuery]);
  const typed = cleanPrefill(addText);
  const dateParam = date === today ? null : date;
  // Round 49: leaving the sheet never closes it first (that flashed Today). The sheet stays up with a small
  // "Opening…" until the next page replaces this one. One trip at a time.
  const [nav, setNav] = useState<NavState>(IDLE_NAV);
  const pathname = usePathname();
  // Away from Today (the trip arrived): reset while drawing, so coming back shows Today with the sheet closed.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (pathname !== "/") {
      setNav(endNav());
      setAddOpen(false);
    }
  }
  useEffect(() => {
    if (nav.pending === null) return;
    const t = setTimeout(() => setNav(endNav()), NAV_GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [nav.pending]);
  /** Start a trip (one at a time). `go` runs the real navigation. */
  const leave = (key: string, go: () => void) => {
    const r = beginNav(nav, key);
    if (!r.go) return;
    setNav(r.state);
    try {
      go();
    } catch {
      setNav(endNav());
    }
  };
  const tap = (key: string, href: string) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    leave(key, () => router.push(href));
  };
  // The moment the sheet opens, warm up the pages it can lead to, so a tap switches at once (no waiting, no fade).
  useEffect(() => {
    if (!addOpen) return;
    for (const p of ["/add/text", "/add/search", "/recipes"]) {
      try {
        router.prefetch(`${p}${q}`);
      } catch {
        /* fine: it just loads on tap */
      }
    }
  }, [addOpen, q, router]);
  const opening = tr("กำลังเปิด…", "Opening…");
  const spin = <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden data-testid="nav-spinner" />;
  // Round 53: "Let AI calculate" and "pick a food → Add" open their next screen IN PLACE, as a full-screen layer on
  // top of Today (a state change: there at once, no page change). Back / swipe-back closes it (one history step).
  const [layer, setLayer] = useState<AddLayer>(null);
  const layerRef = useRef<AddLayer>(null);
  const scrollYRef = useRef(0);
  const openLayer = (next: NonNullable<AddLayer>) => {
    const r = openAddLayer(layerRef.current, next);
    if (!r.layer || layerRef.current !== null) return; // blank text, or a layer is already up (double tap)
    layerRef.current = r.layer; // closes the door on a second tap in the same frame
    scrollYRef.current = window.scrollY;
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (r.push) {
      try {
        window.history.pushState(layerHistoryState(), "", window.location.href);
      } catch {
        /* the layer still works; only Back would leave the page */
      }
    }
    setLayer(r.layer);
    setAddOpen(false); // same frame as the layer: Today never shows through
  };
  const closeLayer = () => {
    if (closeAddLayerAction(layerRef.current) === "none") return;
    window.history.back(); // the popstate below does the closing
  };
  useEffect(() => {
    if (layer === null) return;
    const onPop = () => {
      layerRef.current = layerAfterPop();
      setLayer(layerRef.current);
    };
    window.addEventListener("popstate", onPop);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // Today stays still under the layer
    const y = scrollYRef.current;
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = prevOverflow;
      if (window.scrollY !== y) window.scrollTo(0, y); // Today is where she left it
    };
  }, [layer]);
  useReportOverlay("today", addOpen || layer !== null); // Round 54: the floating chat button hides while the Add sheet / a layer is up
  const openAdd = () => {
    setAgainView(false);
    setAgainQuery("");
    setAddText("");
    setNav(endNav());
    setAddOpen(true);
  };

  // "Eat again": copy the meal to the day on screen. Today → meal slot from the time now; past day → its old slot.
  const eatAgain = (e: Entry) => {
    const copy = copyMeal(e, date, date === today ? guessSlot() : e.slot);
    upsertEntry(copy);
    setAdded(copy);
    setAddOpen(false);
  };
  // Swipe-to-delete with Undo: the photo is only deleted after the undo window closes.
  const [removed, setRemoved] = useState<Entry | null>(null);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  const photoJob = useRef<{ entry: Entry; timer: ReturnType<typeof setTimeout> } | null>(null);
  const finishPhotos = () => {
    const job = photoJob.current;
    if (!job) return;
    clearTimeout(job.timer);
    photoJob.current = null;
    for (const pid of entryPhotoIds(job.entry)) if (!photoStillUsed(entriesRef.current, pid, job.entry.id)) deletePhoto(pid);
  };
  const removeEntry = (e: Entry) => {
    finishPhotos();
    setAdded(null);
    deleteEntry(e.id);
    setRemoved(e);
    photoJob.current = { entry: e, timer: setTimeout(finishPhotos, 6000) };
  };
  const undoRemove = () => {
    const job = photoJob.current;
    if (job) clearTimeout(job.timer);
    photoJob.current = null;
    if (removed) upsertEntry(removed);
    setRemoved(null);
  };
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 6000);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <main className="page space-y-4">
      {/* space-y-4: the gap between sections equals the 16 px side margin (was 20), so Add food and the cards sit higher */}
      <header data-testid="home-header">
        <div className="flex items-center justify-between">
          <span className="text-[21px] font-light tracking-[0.14em]" data-testid="app-name">
            SnapCal
          </span>
          <div className="flex items-center gap-2">
            <button className="glass grid h-11 w-11 place-items-center !rounded-full" onClick={() => go(shiftDateKey(date, -1))} aria-label={tr("วันก่อนหน้า", "Previous day")}>
              <Icon name="caret-left" className="h-5 w-5" />
            </button>
            <button
              className="glass grid h-11 w-11 place-items-center !rounded-full disabled:opacity-30"
              onClick={() => go(shiftDateKey(date, 1))}
              disabled={date >= today}
              aria-label={tr("วันถัดไป", "Next day")}
            >
              <Icon name="caret-right" className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2" data-testid="home-date">
          <h1 className="text-[26px] font-light">{date === today ? tr("วันนี้", "Today") : tr("ย้อนดู", "Looking back")}</h1>
          <p className="text-[14px] text-muted">{thaiDateLabel(date, lang)}</p>
          {date !== today && (
            // Phase 2A: one tap back to today (before, the "next day" arrow had to be pressed again and again).
            <button
              className="glass ml-auto inline-flex min-h-[44px] items-center gap-1.5 !rounded-full px-4 text-[15px] active:opacity-70"
              onClick={() => go(today)}
              data-testid="back-to-today"
            >
              <Icon name="caret-right" className="h-4 w-4" />
              {tr("กลับมาวันนี้", "Back to today")}
            </button>
          )}
        </div>
      </header>

      {saveError && (
        <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
          {tr("บันทึกลงเครื่องไม่สำเร็จ", "Couldn't save on this phone")}: {saveError}
        </div>
      )}

      {ready && date === today && <BackupReminder entries={entries} />}

      {/* Phase 2B step 3: the same numbers, tighter. Ring (eaten) on the left; remaining + target beside it.
          The "what can I eat" pill sits right under, the three macro tiles (value, target/range, share %) and the tip follow. */}
      <section className="card px-4 pb-4 pt-4" data-testid="summary-card">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Ring eaten={ready ? total.kcal : 0} target={target} size={128} stroke={7} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[12px] leading-none text-muted">{tr("กินแล้ว", "Eaten")}</span>
              <span className="num mt-1 text-[32px] leading-none" data-testid="eaten-kcal">
                {ready ? fmtKcal(total.kcal) : "–"}
              </span>
              <span className="mt-1 text-[12px] leading-none text-muted">kcal</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-[14px] ${left < 0 ? "text-warn-ink" : "text-muted"}`}>
              {left >= 0 ? tr("เหลืออีก", "Left") : tr("เกินเป้า", "Over target")}
            </div>
            <div className={`flex flex-wrap items-baseline gap-x-1.5 ${left < 0 ? "text-warn-ink" : ""}`} data-testid="left-kcal">
              <span className="num text-[38px] leading-tight">{fmtKcal(Math.abs(left))}</span>
              <span className="text-[14px] text-muted">kcal</span>
            </div>
            <div className="mt-0.5 text-[14px] text-muted">
              {tr("เป้า", "Target")} <span className="num text-ink" data-testid="target-kcal">{fmtKcal(target)}</span> kcal
            </div>
          </div>
        </div>
        {ready && date === today && (
          <Link
            href="/add/suggest"
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-white/90 bg-white/60 px-4 text-[15px] active:scale-[0.98]"
            data-testid="suggest-button"
          >
            {tr("เหลือเท่านี้ กินอะไรดี", "What can I eat with what's left?")}
            <Icon name="caret-right" className="h-4 w-4 text-muted" />
          </Link>
        )}
        <div className="mt-3 w-full">
          {/* Round 75: back to the simple tiles (the jars felt cluttered); carbs/fat quietly show their good range. */}
          <MacroCards compact m={total} targets={mTargets} showSplit ranges={{ carbs: dailyJarConfig(target, mTargets.protein).c.range!, fat: dailyJarConfig(target, mTargets.protein).f.range! }} />
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

      {ready && (
        <HomeTiles
          date={date}
          today={today}
          entries={entries}
          target={target}
          onPickDay={go}
          share={
            dayEntries.length > 0 || weekHasMeals ? (ctl) => (
              <ShareDayButton
                controlled={ctl}
                dayHasMeals={dayEntries.length > 0}
                entries={entries}
                date={date}
                target={target}
                name={goals.profile?.name ?? ""}
                macroTargets={macroTargets(target, proteinTargetG(goals.profile, target))}
                water={{ glasses: glassesOn(waterLogs, date), goal: waterGoal(goals.waterGoal) }}
                weightKg={bodyLogs.find((l) => l.date === date)?.weightKg ?? null}
              />
            ) : null
          }
        />
      )}

      {/* Phase 2B step 2: the four meals sit in ONE glass card (same order, same names, same totals).
          A meal with nothing in it is one slim, labelled row. Entries keep tap-to-open and swipe-to-delete. */}
      {/* mb-24: room to scroll the last meal above the floating Ask-AI button, so it never covers a kcal number */}
      <section className="card mb-24 overflow-hidden" data-testid="meals-card">
        {SLOTS.map((slot, i) => {
          const list = dayEntries.filter((e) => e.slot === slot);
          const kcal = sumMacros(list.flatMap((e) => e.items.map(pickMacros))).kcal;
          return (
            <div key={slot} className={i > 0 ? "border-t border-line" : ""} data-testid={`slot-${slot}`}>
              <div className={`flex items-center justify-between gap-3 px-4 ${list.length === 0 ? "min-h-[52px]" : "pb-0.5 pt-3.5"}`}>
                <h2 className="flex items-center gap-2 text-[18px] font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SLOT_COLORS[i % SLOT_COLORS.length] }} aria-hidden />
                  {SLOT_LABEL[slot][lang]}
                </h2>
                {list.length === 0 ? (
                  <span className="text-[14px] text-muted">{tr("ยังไม่มีรายการ", "Nothing yet")}</span>
                ) : (
                  <span className="num text-[15px] text-muted">{fmtKcal(kcal)} kcal</span>
                )}
              </div>
              {list.length > 0 && (
                <ul className="divide-y divide-line px-3 pb-1">
                  {list.map((e) => (
                    <EntryRow key={e.id} e={e} onDelete={() => removeEntry(e)} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      {removed && (
        <div
          className="fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[440px] items-center gap-3 rounded-[22px] bg-ink px-4 py-3 text-paper shadow-lg"
          role="status"
          data-testid="removed-toast"
        >
          <span className="min-w-0 flex-1 truncate text-[15px]">
            {tr("ลบแล้ว", "Deleted")} · <b className="font-semibold">{dn(removed.title, removed.alt)}</b>
          </span>
          <button className="shrink-0 rounded-full bg-paper/15 px-4 py-2 text-[15px] font-semibold" onClick={undoRemove} data-testid="removed-undo">
            {tr("เลิกทำ", "Undo")}
          </button>
        </div>
      )}

      {added && !removed && (
        <div
          className="fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[440px] items-center gap-3 rounded-[22px] bg-ink px-4 py-3 text-paper shadow-lg"
          role="status"
          data-testid="eat-again-toast"
        >
          <span className="min-w-0 flex-1 text-[15px]">
            ✓ {tr("เพิ่ม", "Added")} <b className="font-semibold">{dn(added.title, added.alt)}</b> {tr("ใน", "to")} {SLOT_LABEL[added.slot][lang]}
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


      <Sheet
        open={addOpen}
        keyboardSafe
        onClose={() => setAddOpen(false)}
        title={tr("เพิ่มอาหาร", "Add food")}
        header={
          againView ? undefined : (
            <>
          <form
            
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
                  className="hit44 absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted active:opacity-60"
                  onClick={() => setAddText("")}
                  aria-label={tr("ล้าง", "Clear")}
                  data-testid="add-search-clear"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
              {isPending(nav, "create") && (
                <p className="mt-2 flex items-center gap-2 px-1 text-[14px] text-muted" role="status" data-testid="nav-opening">
                  {spin} {opening}
                </p>
              )}
            </>
          )
        }
      >
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
                      <MealThumb
                        title={e.title}
                        className="h-11 w-11 shrink-0 rounded-xl"
                        fallback={
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-muted" aria-hidden>
                            <SourceIcon e={e} small />
                          </span>
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium">{dn(e.title, e.alt)}</span>
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
          {typed ? (
            <IngredientSearch
              food
              compact
              query={typed}
              onAdd={(ing: Ingredient) => openLayer({ kind: "review", ing })}
              onCreateCustom={(name) => leave("create", () => router.push(buildAddUrlWith("search", dateParam, name, { create: true })))}
              topSlot={
                showWholeDishRow(typed) ? (
                  <Link
                    href={buildAddUrlWith("text", dateParam, typed, { auto: true })}
                    onClick={(ev) => {
                      ev.preventDefault();
                      openLayer({ kind: "ai", text: typed });
                    }}
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
              { href: `/add/photo${q}`, icon: "photo", kind: "photo" as const, label: tr("ถ่ายรูป", "Take a photo") },
              { href: `/add/barcode${q}`, icon: "barcode", kind: "barcode" as const, label: tr("บาร์โค้ด", "Barcode") },
            ].map((o) => (
              <Link
                key={o.href}
                href={o.href}
                onClick={(ev) => {
                  ev.preventDefault();
                  openLayer({ kind: o.kind }); // Round 58: in place, at once (the link still works if opened in a new tab)
                }}
                className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] border border-white/90 bg-white/60 text-[16px] active:scale-[0.98]"
              >
                <AddIcon name={o.icon} />
                {o.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[14px] text-muted" data-testid="add-sheet-links">
            {recent.length > 0 && (
              <button className="min-h-[44px] min-w-[44px] px-2 underline-offset-2 active:opacity-60" onClick={() => setAgainView(true)} data-testid="eat-again-tile">
                {tr("กินซ้ำ", "Eat again")}
              </button>
            )}
            <Link href={`/recipes${q}`} onClick={tap("recipes", `/recipes${q}`)} className="flex min-h-[44px] items-center gap-1.5 underline-offset-2 active:opacity-60">
              {isPending(nav, "recipes") ? <>{spin} {opening}</> : tr("สูตรของฉัน", "My recipes")}
            </Link>
            <Link
              href={`/add/manual${q}`}
              onClick={(ev) => {
                ev.preventDefault();
                openLayer({ kind: "manual" });
              }}
              className="flex min-h-[44px] items-center gap-1.5 underline-offset-2 active:opacity-60"
            >
              {tr("กรอกเอง", "Enter it myself")}
            </Link>
          </div>
          </>
          )}
        </div>
        )}
      </Sheet>

      {layer && (
        <div className="add-layer fixed inset-0 z-[70] overflow-y-auto overscroll-contain" data-testid="add-layer">
          <AddFlow
            key={layer.kind}
            embedded
            onSwitchMode={(m, o) => {
              // Round 64: e.g. barcode not found → take a photo instead, inside the same layer (still one history step).
              // Round 66: the barcode comes along, so she can ask us to remember it.
              const next: AddLayer = m === "photo" ? { kind: "photo", barcode: o?.barcode } : { kind: m };
              layerRef.current = next;
              setLayer(next);
            }}
            barcode={layer.kind === "photo" ? layer.barcode : undefined}
            mode={layerMode(layer)}
            date={date}
            dateParam={dateParam}
            prefill={layer.kind === "ai" ? layer.text : ""}
            auto={layer.kind === "ai"}
            handoff={layer.kind === "review" ? layer.ing : null}
            onBack={closeLayer}
            onCancel={closeLayer}
            onSaved={closeLayer}
          />
        </div>
      )}
    </main>
  );
}

function SourceIcon({ e, small }: { e: Entry; small?: boolean }) {
  const name = e.source === "recipe" ? "recipes" : e.source === "photo" ? "photo" : e.source === "text" ? "text" : e.source === "barcode" ? "barcode" : "manual";
  return (
    <Icon name={ADD_ICONS[name]} className={small ? "h-5 w-5" : "h-6 w-6"} />
  );
}

function EntryRow({ e, onDelete }: { e: Entry; onDelete: () => void }) {
  const { tr, dn } = useLang();
  const m = sumMacros(e.items.map(pickMacros));
  // Round 39: "~" = some numbers are estimates; "?" = a nutrient is unknown for some item.
  const approx = e.items.some((i) => isEstimated(i, e));
  const gap = joinMissing(...e.items.map((i) => i.missing));
  const q = (k: "protein" | "carbs" | "fat") => (gap.includes(k) ? "?" : "");
  return (
    <SwipeRow onDelete={onDelete} label={`${tr("ลบ", "Delete")} ${dn(e.title, e.alt)}`}>
      <Link href={`/entry/${e.id}`} className="flex items-center gap-3 px-1 py-2.5" data-testid="entry-row">
        <MealThumb
          title={e.title}
          className="h-12 w-12 shrink-0 rounded-2xl"
          fallback={
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-muted" aria-hidden>
              <SourceIcon e={e} />
            </span>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="break-words font-medium leading-snug">{dn(e.title, e.alt)}</div>
          <div className="text-[14px] leading-snug text-muted">
            {/* each group stays whole when the line wraps on a narrow phone ("F 30 g" never splits) */}
            <span className="whitespace-nowrap">P {Math.round(m.protein)}{q("protein")}</span> · <span className="whitespace-nowrap">C {Math.round(m.carbs)}{q("carbs")}</span> · <span className="whitespace-nowrap">F {Math.round(m.fat)}{q("fat")} g</span>
          </div>
        </div>
        <div className="num text-[20px]" data-approx={approx ? "yes" : "no"}>
          {approx && <span className="text-muted" aria-label="approx">~</span>}
          {fmtKcal(m.kcal)}
          <span className="ml-0.5 text-[12px] font-normal text-muted">kcal</span>
        </div>
      </Link>
    </SwipeRow>
  );
}

export default function TodayPage() {
  return (
    <Suspense>
      <TodayInner />
    </Suspense>
  );
}
