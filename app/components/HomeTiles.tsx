"use client";
// Round 60: one slim row of three small tiles under "Add food": Water, This week, Share day.
// Before, the water card and the week chart sat between Add food and the meals (long scroll) and Share was last.
// The full cards still exist: tapping Water opens the water card, tapping This week opens the chart, in a sheet.

import { useState, type ReactNode } from "react";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
import { fmtKcal } from "../lib/nutrition";
import { calorieWeek } from "../lib/week";
import { GLASSES_MAX, glassesOn, waterGoal } from "../lib/water";
import type { Entry } from "../lib/types";
import { Sheet } from "./ui";
import { WaterCard } from "./WaterCard";
import { WeekKcalChart } from "./WeekKcalChart";

const TILE = "relative flex min-h-[84px] w-full flex-col items-start justify-between rounded-[22px] border border-white/90 bg-white/60 px-3 py-2.5 text-left active:scale-[0.98]";

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
  /** The Share tile (null on a day with no meals). */
  share: ReactNode;
}) {
  const { tr } = useLang();
  const { waterLogs, setWater, goals } = useStore();
  const [panel, setPanel] = useState<"water" | "week" | null>(null);
  const glasses = glassesOn(waterLogs, date);
  const goal = waterGoal(goals.waterGoal);
  const week = calorieWeek(entries, date, today, target);

  return (
    <>
      <div className={`grid gap-2 ${share ? "grid-cols-3" : "grid-cols-2"}`} data-testid="home-tiles">
        <div className="relative" data-testid="home-tile-water">
          <button className={TILE} onClick={() => setPanel("water")} aria-label={tr("ดื่มน้ำ เปิดดูทั้งหมด", "Water, open all")}>
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
            className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-water-soft text-[20px] leading-none text-water-ink active:scale-90 disabled:opacity-40"
            onClick={() => setWater(date, glasses + 1)}
            disabled={glasses >= GLASSES_MAX}
            aria-label={tr("เพิ่มน้ำ 1 แก้ว", "Add 1 glass of water")}
            data-testid="home-water-plus"
          >
            +
          </button>
        </div>
        <button className={TILE} onClick={() => setPanel("week")} data-testid="home-tile-week" aria-label={tr("แคลอรีสัปดาห์นี้ เปิดดูกราฟ", "Calories this week, open chart")}>
          <span className="text-[14px] text-muted">{tr("สัปดาห์นี้", "This week")}</span>
          <span>
            <span className="num block text-[26px] leading-none" data-testid="home-week-avg">
              {week.avg != null ? fmtKcal(week.avg) : "–"}
            </span>
            <span className="text-[12px] text-muted">{tr("เฉลี่ย kcal/วัน", "avg kcal a day")}</span>
          </span>
        </button>
        {share}
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
        </div>
      </Sheet>
    </>
  );
}
