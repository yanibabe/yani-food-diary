"use client";
// Round 60 + Phase 2B step 4: two compact cards under "Add food": Water and This week.
// Water: tap the card for the full water card, or "+" to add a glass at once.
// This week: tap the card for the chart (same sheet as before). The Share action now lives in that sheet
// ("Share day" and "Share week"), so the card says "Share" and the Home row is two cards, not three.

import { useState, type ReactNode } from "react";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
import { fmtKcal } from "../lib/nutrition";
import { calorieWeek } from "../lib/week";
import { GLASSES_MAX, glassesOn, waterGoal } from "../lib/water";
import type { Entry } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./ui";
import { WaterCard } from "./WaterCard";
import { WeekKcalChart } from "./WeekKcalChart";

const TILE = "relative flex h-full min-h-[96px] w-full flex-col items-start justify-between rounded-[22px] border border-white/90 bg-white/60 px-3.5 py-3 text-left active:scale-[0.98]";

/** What the page gives us to open the share dialog from here: which tab to start on (null = closed) and how to close it. */
export type ShareControl = { range: "day" | "week" | null; onClose: () => void };

export function HomeTiles({
  date,
  today,
  entries,
  target,
  onPickDay,
  share,
}: {
  date: string;
  today: string;
  entries: Entry[];
  target: number;
  onPickDay: (d: string) => void;
  /** Draws the share dialog (null on a week with no meals at all). It has no button of its own: it is opened from the week sheet. */
  share: ((ctl: ShareControl) => ReactNode) | null;
}) {
  const { tr } = useLang();
  const { waterLogs, setWater, goals } = useStore();
  const [panel, setPanel] = useState<"water" | "week" | null>(null);
  const [shareRange, setShareRange] = useState<"day" | "week" | null>(null);
  const glasses = glassesOn(waterLogs, date);
  const goal = waterGoal(goals.waterGoal);
  const week = calorieWeek(entries, date, today, target);
  const dayHasMeals = entries.some((e) => e.date === date);
  // One sheet closes, the other opens (never one inside the other: a sheet's blur would trap the inner one).
  const openShare = (r: "day" | "week") => {
    setPanel(null);
    setShareRange(r);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5" data-testid="home-tiles">
        <div className="relative flex" data-testid="home-tile-water">
          <button className={TILE} onClick={() => setPanel("water")} aria-label={tr(`ดื่มน้ำ ${glasses} จาก ${goal} แก้ว เปิดดูทั้งหมด`, `Water, ${glasses} of ${goal} glasses, open all`)}>
            <span className="flex items-center gap-1.5 text-[14px] text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-water" aria-hidden />
              {tr("ดื่มน้ำ", "Water")}
            </span>
            <span className="num text-[26px] leading-none text-water-ink" data-testid="home-water-count">
              {glasses}
              <span className="text-[15px] text-muted">/{goal}</span>
            </span>
          </button>
          <button
            className="hit44 absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-water-soft text-[20px] leading-none text-water-ink active:scale-90 disabled:opacity-40"
            onClick={() => setWater(date, glasses + 1)}
            disabled={glasses >= GLASSES_MAX}
            aria-label={tr("เพิ่มน้ำ 1 แก้ว", "Add 1 glass of water")}
            data-testid="home-water-plus"
          >
            +
          </button>
        </div>
        <button
          className={TILE}
          onClick={() => setPanel("week")}
          data-testid="home-tile-week"
          aria-label={share ? tr("แคลอรีสัปดาห์นี้ เปิดดูกราฟและแชร์", "Calories this week, open chart and share") : tr("แคลอรีสัปดาห์นี้ เปิดดูกราฟ", "Calories this week, open chart")}
        >
          <span className="flex w-full items-center justify-between gap-1 text-[14px] text-muted">
            <span className="whitespace-nowrap">{tr("สัปดาห์นี้", "This week")}</span>
            {share && (
              <span className="flex items-center gap-1 text-[13px]" data-testid="home-week-share-label">
                <Icon name="export" className="h-4 w-4" />
                {/* on the narrowest phones (< 360 px) only the icon fits; the sheet itself spells out "Share day / Share week" */}
                <span className="max-[359px]:hidden">{tr("แชร์", "Share")}</span>
              </span>
            )}
          </span>
          <span>
            <span className="num block text-[26px] leading-none" data-testid="home-week-avg">
              {week.avg != null ? fmtKcal(week.avg) : "–"}
            </span>
            <span className="text-[12px] text-muted">{tr("เฉลี่ย kcal/วัน", "avg kcal a day")}</span>
          </span>
        </button>
      </div>

      <Sheet open={panel === "water"} onClose={() => setPanel(null)} title={tr("ดื่มน้ำ", "Water")}>
        <div className="pb-4">
          <WaterCard date={date} />
        </div>
      </Sheet>
      <Sheet open={panel === "week"} onClose={() => setPanel(null)} title={tr("แคลอรีสัปดาห์นี้", "Calories this week")}>
        <div className="pb-4">
          <WeekKcalChart
            entries={entries}
            date={date}
            today={today}
            target={target}
            onPick={(d) => {
              setPanel(null);
              onPickDay(d);
            }}
          />
          {share && (
            <div className={`mt-3 grid gap-2 ${dayHasMeals ? "grid-cols-2" : "grid-cols-1"}`} data-testid="week-share-row">
              {dayHasMeals && (
                <button className="btn-soft !min-h-[48px] gap-2" onClick={() => openShare("day")} data-testid="week-share-day">
                  <Icon name="export" className="h-5 w-5" />
                  {tr("แชร์วันนี้", "Share day")}
                </button>
              )}
              <button className="btn-soft !min-h-[48px] gap-2" onClick={() => openShare("week")} data-testid="week-share-week">
                <Icon name="export" className="h-5 w-5" />
                {tr("แชร์สัปดาห์", "Share week")}
              </button>
            </div>
          )}
        </div>
      </Sheet>
      {share?.({ range: shareRange, onClose: () => setShareRange(null) })}
    </>
  );
}
