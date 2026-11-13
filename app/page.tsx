"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MacroCards, Sheet, StoredPhoto } from "./components/ui";
import { BackupReminder } from "./components/BackupReminder";
import { WeekKcalChart } from "./components/WeekKcalChart";
import { WaterCard } from "./components/WaterCard";
import { guessSlot, shiftDateKey, shortDayLabel, thaiDateKey, thaiDateLabel } from "./lib/date";
import { copyMeal, recentMeals, searchMeals } from "./lib/repeat";
import { macroTargets, proteinTargetG } from "./lib/energy";
import { fmtKcal, pickMacros, sumMacros } from "./lib/nutrition";
import { useLang } from "./lib/lang";
import { useStore } from "./lib/store";
import { SLOT_LABEL, SLOTS, type Entry } from "./lib/types";

const SLOT_COLORS = ["var(--yellow-deep)", "#8cc9b2", "#7fb2ea", "#f09aab"];

function Ring({ eaten, target }: { eaten: number; target: number }) {
  const r = 86;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, eaten / Math.max(1, target));
  const over = eaten > target;
  return (
    <svg viewBox="0 0 200 200" className="h-[210px] w-[210px]" aria-hidden>
      <circle cx="100" cy="100" r={r} fill="none" stroke="var(--cream)" strokeWidth="16" />
      {p > 0 && <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={over ? "var(--pink)" : "var(--yellow-deep)"}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform="rotate(-90 100 100)"
      />}
    </svg>
  );
}

function TodayInner() {
  const { ready, entries, goals, saveError, upsertEntry, deleteEntry } = useStore();
  const search = useSearchParams();
  const router = useRouter();
  const today = thaiDateKey();
  const date = search.get("date") || today;
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<Entry | null>(null);
  const [againView, setAgainView] = useState(false);
  const [againQuery, setAgainQuery] = useState("");
  const { tr, lang } = useLang();

  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt), [entries, date]);
  const total = useMemo(() => sumMacros(dayEntries.flatMap((e) => e.items.map(pickMacros))), [dayEntries]);
  const target = goals.targetKcal;
  const left = target - total.kcal;
  const go = (d: string) => router.replace(d === today ? "/" : `/?date=${d}`);
  const q = date === today ? "" : `?date=${date}`;
  const recent = useMemo(() => recentMeals(entries), [entries]);
  const found = useMemo(() => searchMeals(recent, againQuery), [recent, againQuery]);
  const openAdd = () => {
    setAgainView(false);
    setAgainQuery("");
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
      <header className="flex items-center justify-between">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => go(shiftDateKey(date, -1))} aria-label={tr("วันก่อนหน้า", "Previous day")}>
          ‹
        </button>
        <div className="text-center">
          {goals.profile?.name && date === today && (
            <p className="text-[15px] text-muted" data-testid="greeting">{tr("สวัสดี", "Hi")} {goals.profile.name}</p>
          )}
          <h1 className="text-[26px] font-bold">{date === today ? tr("วันนี้", "Today") : tr("ย้อนดู", "Looking back")}</h1>
          <p className="text-[14px] text-muted">{thaiDateLabel(date, lang)}</p>
        </div>
        <button
          className="h-11 w-11 rounded-full bg-paper text-[20px] disabled:opacity-30"
          onClick={() => go(shiftDateKey(date, 1))}
          disabled={date >= today}
          aria-label={tr("วันถัดไป", "Next day")}
        >
          ›
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
            <span className="num text-[54px] leading-none" data-testid="eaten-kcal">
              {ready ? fmtKcal(total.kcal) : "–"}
            </span>
            <span className="mt-1 text-[15px] text-muted">
              {tr("จาก", "of")} <span className="num font-semibold text-ink" data-testid="target-kcal">{fmtKcal(target)}</span> kcal
            </span>
          </div>
        </div>
        <p className={`mt-2 text-[17px] font-medium ${left < 0 ? "text-warn-ink" : "text-olive-dark"}`}>
          {left >= 0
            ? tr(`เหลืออีก ${fmtKcal(left)} kcal`, `${fmtKcal(left)} kcal left`)
            : tr(`เกินเป้า ${fmtKcal(-left)} kcal`, `${fmtKcal(-left)} kcal over target`)}
        </p>
        <div className="mt-4 w-full">
          <MacroCards m={total} targets={macroTargets(target, proteinTargetG(goals.profile))} />
        </div>
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
              <h2 className="flex items-center gap-2 text-[19px] font-semibold">
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

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={tr("เพิ่มอาหาร", "Add food")}>
        {againView ? (
          <div className="pb-4" data-testid="eat-again">
            <button className="mb-3 flex items-center gap-1 px-1 text-[16px] font-medium text-olive-dark" onClick={() => setAgainView(false)} data-testid="eat-again-back">
              ‹ {tr("กลับ", "Back")}
            </button>
            <h3 className="px-1 pb-1 text-[18px] font-semibold">🔁 {tr("กินซ้ำ", "Eat again")}</h3>
            <p className="px-1 pb-3 text-[13px] text-muted">
              {tr("แตะครั้งเดียว บันทึกเลย · ไม่ต้องใช้ AI", "One tap to log it · no AI needed")}
            </p>
            <input
              type="search"
              className="mb-3 w-full rounded-full bg-cream px-5 py-3 text-[16px] outline-none placeholder:text-muted"
              placeholder={tr("🔍 ค้นหาชื่ออาหาร", "🔍 Search food name")}
              value={againQuery}
              onChange={(ev) => setAgainQuery(ev.target.value)}
              data-testid="eat-again-search"
            />
            {found.length === 0 ? (
              <p className="px-1 py-6 text-center text-[15px] text-muted">{tr("ไม่เจอเมนูนี้", "No meal found")}</p>
            ) : (
              <ul className="divide-y divide-line rounded-[22px] bg-cream px-3">
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
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper text-[20px]" aria-hidden>
                          {sourceIcon(e)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium">{e.title}</span>
                        <span className="block text-[13px] text-muted">
                          {tr("กินล่าสุด", "Last eaten")} {shortDayLabel(e.date, today, lang)} · <span className="num">{fmtKcal(sumMacros(e.items.map(pickMacros)).kcal)}</span> kcal
                        </span>
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive text-[20px] leading-none text-paper" aria-hidden>
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3 pb-3">
          {[
            { href: `/add/photo${q}`, bg: "bg-yellow", icon: "📷", label: tr("ถ่ายรูป", "Take a photo") },
            { href: `/add/text${q}`, bg: "bg-sky", icon: "💬", label: tr("พิมพ์ให้ AI ช่วย", "Type it, AI helps") },
            { href: `/recipes${q}`, bg: "bg-mint", icon: "📖", label: tr("เลือกสูตรของฉัน", "From my recipes") },
            { href: `/add/manual${q}`, bg: "bg-pink", icon: "✏️", label: tr("กรอกเอง", "Enter it myself") },
            { href: `/add/barcode${q}`, bg: "bg-cream", icon: "🏷️", label: tr("บาร์โค้ด", "Barcode") },
          ].map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] ${o.bg} text-[17px] font-medium active:scale-[0.98]`}
            >
              <span className="text-[34px]" aria-hidden>{o.icon}</span>
              {o.label}
            </Link>
          ))}
          {recent.length > 0 && (
            <button
              className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] bg-cream text-[17px] font-medium active:scale-[0.98]"
              onClick={() => setAgainView(true)}
              data-testid="eat-again-tile"
            >
              <span className="text-[34px]" aria-hidden>🔁</span>
              {tr("กินซ้ำ", "Eat again")}
            </button>
          )}
        </div>
        )}
      </Sheet>
    </main>
  );
}

function sourceIcon(e: Entry): string {
  return e.source === "recipe" ? "📖" : e.source === "photo" ? "📷" : e.source === "text" ? "💬" : e.source === "barcode" ? "🏷️" : "✏️";
}

function EntryRow({ e }: { e: Entry }) {
  const m = sumMacros(e.items.map(pickMacros));
  return (
    <li>
      <Link href={`/entry/${e.id}`} className="flex items-center gap-3 px-1 py-3" data-testid="entry-row">
        {e.photoId ? (
          <StoredPhoto id={e.photoId} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cream text-[24px]" aria-hidden>
            {sourceIcon(e)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{e.title}</div>
          <div className="truncate text-[14px] text-muted">
            P {Math.round(m.protein)} · C {Math.round(m.carbs)} · F {Math.round(m.fat)} g
          </div>
        </div>
        <div className="num text-[20px] font-semibold">
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
