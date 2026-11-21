"use client";
// Two compact cards under "Add food": Water and Share report.
// Water: tap the card for the full water card, or "+" to add a glass at once.
// Share report: the daily nutrition report for the date being viewed is the primary action (one tap opens its preview).
// Day / Week is chosen in ONE place, inside the share preview.

import { useState, type ReactNode } from "react";
import { useLang } from "../lib/lang";
import { useBackClose } from "../lib/useBackClose";
import { useStore } from "../lib/store";
import { fmtKcal, pickMacros, sumMacros } from "../lib/nutrition";
import { shortDayLabel } from "../lib/date";
import { GLASSES_MAX, glassesOn, waterGoal } from "../lib/water";
import type { Entry } from "../lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./ui";
import { WaterCard } from "./WaterCard";

const TILE = "relative flex h-full min-h-[96px] w-full flex-col items-start justify-between rounded-[22px] border border-white/90 bg-white/60 px-3.5 py-3 text-left active:scale-[0.98]";

/** What the page gives us to open the share dialog from here: which tab to start on (null = closed) and how to close it. */
export type ShareControl = { range: "day" | "week" | null; onClose: () => void };

export function HomeTiles({
  date,
  today,
  entries,
  share,
}: {
  date: string;
  today: string;
  entries: Entry[];
  /** Draws the share dialog (null on a week with no meals at all). It has no button of its own: it is opened from the week sheet. */
  share: ((ctl: ShareControl) => ReactNode) | null;
}) {
  const { tr, lang } = useLang();
  const { waterLogs, setWater, goals } = useStore();
  const [panel, setPanel] = useState<"water" | null>(null);
  const [shareRange, setShareRange] = useState<"day" | "week" | null>(null);
  // One history step covers the sheets (water, share), so Back closes whichever is open.
  useBackClose(panel !== null || shareRange !== null, () => {
    setPanel(null);
    setShareRange(null);
  });
  const glasses = glassesOn(waterLogs, date);
  const goal = waterGoal(goals.waterGoal);
  const dayList = entries.filter((e) => e.date === date);
  const dayHasMeals = dayList.length > 0;
  const dayKcal = sumMacros(dayList.flatMap((e) => e.items.map(pickMacros))).kcal;
  // The tile opens the report for the viewed date; if that day has nothing logged, the week report (the day report would be empty).
  const openShare = () => {
    if (!share) return;
    setPanel(null);
    setShareRange(dayHasMeals ? "day" : "week");
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
          className={`${TILE} ${share ? "" : "opacity-60"}`}
          onClick={openShare}
          disabled={!share}
          data-testid="home-tile-share"
          aria-label={
            !share
              ? tr("แชร์รายงานโภชนาการ ยังไม่มีมื้อที่บันทึก", "Share nutrition report, nothing logged yet")
              : dayHasMeals
                ? tr(`แชร์รายงานโภชนาการ ${shortDayLabel(date, today, "th")} ${fmtKcal(dayKcal)} kcal`, `Share nutrition report, ${shortDayLabel(date, today, "en")}, ${fmtKcal(dayKcal)} kcal`)
                : tr("แชร์รายงานโภชนาการรายสัปดาห์ (วันนี้ยังไม่มีบันทึก)", "Share the weekly nutrition report (nothing logged on this day)")
          }
        >
          <span className="flex w-full items-center gap-1.5 text-[14px] text-muted">
            <Icon name="export" className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{tr("แชร์รายงาน", "Share report")}</span>
          </span>
          <span>
            <span className="num block text-[26px] leading-none" data-testid="home-share-kcal">
              {share && dayHasMeals ? fmtKcal(dayKcal) : "–"}
            </span>
            <span className="text-[12px] text-muted" data-testid="home-share-sub">
              {!share
                ? tr("บันทึกมื้อแรกก่อน", "Log a meal first")
                : dayHasMeals
                  ? `kcal · ${shortDayLabel(date, today, lang)}`
                  : tr("ไม่มีบันทึก · แชร์สัปดาห์", "Nothing logged · week report")}
            </span>
          </span>
        </button>
      </div>

      <Sheet open={panel === "water"} onClose={() => setPanel(null)} title={tr("ดื่มน้ำ", "Water")}>
        <div className="pb-4">
          <WaterCard date={date} />
        </div>
      </Sheet>
      {share?.({ range: shareRange, onClose: () => setShareRange(null) })}
    </>
  );
}
