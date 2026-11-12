"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MacroCards, Sheet, StoredPhoto } from "./components/ui";
import { shiftDateKey, thaiDateKey, thaiDateLabel } from "./lib/date";
import { macroTargets, proteinTargetG } from "./lib/energy";
import { fmtKcal, pickMacros, sumMacros } from "./lib/nutrition";
import { useStore } from "./lib/store";
import { SLOT_LABEL, SLOTS, type Entry } from "./lib/types";

function Ring({ eaten, target }: { eaten: number; target: number }) {
  const r = 86;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, eaten / Math.max(1, target));
  const over = eaten > target;
  return (
    <svg viewBox="0 0 200 200" className="h-[210px] w-[210px]" aria-hidden>
      <circle cx="100" cy="100" r={r} fill="none" stroke="var(--olive-soft)" strokeWidth="16" />
      {p > 0 && <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={over ? "var(--warn-ink)" : "var(--olive)"}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform="rotate(-90 100 100)"
      />}
    </svg>
  );
}

function TodayInner() {
  const { ready, entries, goals, saveError } = useStore();
  const search = useSearchParams();
  const router = useRouter();
  const today = thaiDateKey();
  const date = search.get("date") || today;
  const [addOpen, setAddOpen] = useState(false);

  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt), [entries, date]);
  const total = useMemo(() => sumMacros(dayEntries.flatMap((e) => e.items.map(pickMacros))), [dayEntries]);
  const target = goals.targetKcal;
  const left = target - total.kcal;
  const go = (d: string) => router.replace(d === today ? "/" : `/?date=${d}`);
  const q = date === today ? "" : `?date=${date}`;

  return (
    <main className="page space-y-5">
      <header className="flex items-center justify-between">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => go(shiftDateKey(date, -1))} aria-label="วันก่อนหน้า">
          ‹
        </button>
        <div className="text-center">
          {goals.profile?.name && date === today && (
            <p className="text-[15px] text-olive-dark" data-testid="greeting">สวัสดี {goals.profile.name} 🌿</p>
          )}
          <h1 className="text-[24px] font-bold">{date === today ? "วันนี้" : "ย้อนดู"}</h1>
          <p className="text-[14px] text-muted">{thaiDateLabel(date)}</p>
        </div>
        <button
          className="h-11 w-11 rounded-full bg-paper text-[20px] disabled:opacity-30"
          onClick={() => go(shiftDateKey(date, 1))}
          disabled={date >= today}
          aria-label="วันถัดไป"
        >
          ›
        </button>
      </header>

      {saveError && (
        <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
          บันทึกลงเครื่องไม่สำเร็จ: {saveError}
        </div>
      )}

      <section className="card flex flex-col items-center px-5 pb-5 pt-6">
        <div className="relative">
          <Ring eaten={ready ? total.kcal : 0} target={target} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-[52px] font-bold leading-none" data-testid="eaten-kcal">
              {ready ? fmtKcal(total.kcal) : "–"}
            </span>
            <span className="mt-1 text-[15px] text-muted">
              จาก <span className="num font-semibold text-ink" data-testid="target-kcal">{fmtKcal(target)}</span> kcal
            </span>
          </div>
        </div>
        <p className={`mt-2 text-[17px] font-medium ${left < 0 ? "text-warn-ink" : "text-olive-dark"}`}>
          {left >= 0 ? `เหลืออีก ${fmtKcal(left)} kcal` : `เกินเป้า ${fmtKcal(-left)} kcal`}
        </p>
        <div className="mt-4 w-full">
          <MacroCards m={total} targets={macroTargets(target, proteinTargetG(goals.profile))} />
        </div>
      </section>

      <button className="btn-primary w-full !min-h-[58px] text-[19px]" onClick={() => setAddOpen(true)}>
        + เพิ่มอาหาร
      </button>

      {SLOTS.map((slot) => {
        const list = dayEntries.filter((e) => e.slot === slot);
        const kcal = sumMacros(list.flatMap((e) => e.items.map(pickMacros))).kcal;
        return (
          <section key={slot} className="card p-4" data-testid={`slot-${slot}`}>
            <div className="mb-1 flex items-baseline justify-between px-1">
              <h2 className="text-[19px] font-semibold">{SLOT_LABEL[slot]}</h2>
              <span className="num text-[15px] text-muted">{fmtKcal(kcal)} kcal</span>
            </div>
            {list.length === 0 ? (
              <p className="px-1 py-2 text-[15px] text-muted">ยังไม่มีรายการ</p>
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

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="เพิ่มอาหาร">
        <div className="grid grid-cols-2 gap-3 pb-3">
          {[
            { href: `/add/photo${q}`, icon: "📷", label: "ถ่ายรูป" },
            { href: `/add/text${q}`, icon: "💬", label: "พิมพ์ให้ AI ช่วย" },
            { href: `/recipes${q}`, icon: "📖", label: "เลือกสูตรของฉัน" },
            { href: `/add/manual${q}`, icon: "✏️", label: "กรอกเอง" },
          ].map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] bg-cream text-[17px] font-medium active:scale-[0.98]"
            >
              <span className="text-[34px]" aria-hidden>{o.icon}</span>
              {o.label}
            </Link>
          ))}
        </div>
      </Sheet>
    </main>
  );
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
            {e.source === "recipe" ? "📖" : e.source === "text" ? "💬" : "✏️"}
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
