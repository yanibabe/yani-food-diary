"use client";
// Today page: kcal per day for the week that holds the day she is looking at.
// Bars Mon → Sun, a dashed line for her daily target, and the average.
// Tap a bar → that day.

import { useMemo } from "react";
import { fmtKcal } from "../lib/nutrition";
import { useLang } from "../lib/lang";
import { calorieWeek } from "../lib/week";
import type { Entry } from "../lib/types";

function dayParts(key: string, lang: "th" | "en") {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const loc = lang === "en" ? "en-GB" : "th-TH";
  return {
    weekday: new Intl.DateTimeFormat(loc, { timeZone: "UTC", weekday: "narrow" }).format(dt),
    short: new Intl.DateTimeFormat(loc, { timeZone: "UTC", day: "numeric", month: "short" }).format(dt),
  };
}

const BAR_AREA = 130; // px of height for the tallest bar

export function WeekKcalChart({ entries, date, today, target, onPick }: { entries: Entry[]; date: string; today: string; target: number; onPick: (d: string) => void }) {
  const { tr, lang } = useLang();
  const w = useMemo(() => calorieWeek(entries, date, today, target), [entries, date, today, target]);
  const top = Math.max(target * 1.2, ...w.days.map((d) => d.kcal));
  const h = (k: number) => (k / top) * BAR_AREA;
  const diff = w.avg != null ? w.avg - target : null;

  return (
    <section className="card space-y-4 p-5" data-testid="week-kcal">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-[17px] font-semibold">{tr("แคลอรีสัปดาห์นี้", "Calories this week")}</h2>
          <p className="text-[13px] text-muted">
            {dayParts(w.start, lang).short} – {dayParts(w.end, lang).short}
          </p>
        </div>
        <div className="text-right">
          <div className="num text-[24px] font-bold leading-none" data-testid="week-kcal-avg">
            {w.avg != null ? fmtKcal(w.avg) : "–"}
          </div>
          <div className="text-[12px] text-muted">{tr("เฉลี่ย kcal/วัน", "avg kcal a day")}</div>
        </div>
      </div>

      <div className="relative" style={{ height: BAR_AREA + 40 }}>
        {/* the daily target line */}
        <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-olive" style={{ bottom: 22 + h(target) }}>
          <span className="num absolute -top-[18px] right-0 rounded bg-paper px-1 text-[11px] text-olive-dark">
            {tr("เป้า", "goal")} {fmtKcal(target)}
          </span>
        </div>
        <div className="absolute inset-0 grid grid-cols-7 items-end gap-1.5">
          {w.days.map((d) => {
            const p = dayParts(d.date, lang);
            const sel = d.date === date;
            const over = d.kcal > target;
            const color = over ? (sel ? "bg-[#f48aa0]" : "bg-pink") : sel ? "bg-ink" : "bg-yellow-deep";
            return (
              <button
                key={d.date}
                onClick={() => onPick(d.date)}
                disabled={d.future}
                className="flex h-full flex-col items-center justify-end gap-1 disabled:opacity-40"
                aria-label={`${p.short}: ${d.logged ? `${fmtKcal(d.kcal)} kcal` : tr("ยังไม่บันทึก", "nothing logged")}`}
                data-testid="week-kcal-bar"
              >
                <span className="num relative z-10 rounded bg-paper/85 px-0.5 text-[10px] text-muted">{d.logged ? (d.kcal >= 1000 ? `${(d.kcal / 1000).toFixed(1)}k` : Math.round(d.kcal)) : ""}</span>
                {d.logged ? (
                  <span className={`w-full rounded-t-lg ${color}`} style={{ height: Math.max(4, h(d.kcal)) }} />
                ) : (
                  <span className="h-[4px] w-full rounded-full bg-cream" />
                )}
                <span className={`flex h-[18px] items-center text-[12px] ${sel ? "rounded-full bg-ink px-1.5 font-semibold text-paper" : d.date === today ? "font-semibold text-ink" : "text-muted"}`}>
                  {p.weekday}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[13px] text-muted" data-testid="week-kcal-note">
        {w.loggedDays === 0
          ? tr("ยังไม่มีมื้อที่บันทึกในสัปดาห์นี้", "No meals logged this week yet")
          : `${tr(`บันทึก ${w.loggedDays} วัน`, `${w.loggedDays} ${w.loggedDays === 1 ? "day" : "days"} logged`)} · ${
              diff != null && Math.abs(diff) < 1
                ? tr("ตรงเป้าพอดี", "right on target")
                : diff != null && diff < 0
                  ? tr(`ต่ำกว่าเป้า ${fmtKcal(-diff)} kcal/วัน`, `${fmtKcal(-diff)} kcal/day under target`)
                  : tr(`เกินเป้า ${fmtKcal(diff ?? 0)} kcal/วัน`, `${fmtKcal(diff ?? 0)} kcal/day over target`)
            }${w.overDays > 0 ? ` · ${tr(`เกินเป้า ${w.overDays} วัน`, `over on ${w.overDays} ${w.overDays === 1 ? "day" : "days"}`)}` : ""}`}
      </p>
      <p className="text-[12px] text-muted">{tr("ค่าเฉลี่ยนับเฉพาะวันที่บันทึกมื้ออาหาร", "The average only counts days with meals logged")}</p>
    </section>
  );
}
