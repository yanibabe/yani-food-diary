"use client";
// Water counter card on Today: one tap = one glass (250 ml).

import { useState } from "react";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
import { GLASS_ML, GLASSES_MAX, clampGoal, glassesOn, tapGlass, waterGoal, WATER_GOAL_MAX, WATER_GOAL_MIN } from "../lib/water";

function Glass({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 24 30" className="h-8 w-7" aria-hidden>
      <path d="M3 3h18l-2.2 23.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" fill={full ? "var(--water-soft)" : "none"} stroke={full ? "var(--water)" : "rgba(43,39,36,0.18)"} strokeWidth="1.5" strokeLinejoin="round" />
      {full && <path d="M5.2 10.5h13.6l-1.6 15.5a1 1 0 0 1-1 .9H7.8a1 1 0 0 1-1-.9z" fill="var(--water)" />}
    </svg>
  );
}

export function WaterCard({ date }: { date: string }) {
  const { waterLogs, setWater, goals, setGoals } = useStore();
  const { tr } = useLang();
  const [editGoal, setEditGoal] = useState(false);
  const glasses = glassesOn(waterLogs, date);
  const goal = waterGoal(goals.waterGoal);
  const slots = Math.max(goal, glasses);
  const left = goal - glasses;
  const ml = (glasses * GLASS_ML).toLocaleString("en-US");
  const changeGoal = (n: number) => setGoals({ ...goals, waterGoal: clampGoal(n) });

  return (
    <section className="card p-4" data-testid="water-card">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="flex items-center gap-2 text-[18px] font-medium">
          <span className="h-2.5 w-2.5 rounded-full bg-water" aria-hidden />
          {tr("ดื่มน้ำ", "Water")}
        </h2>
        <span className="text-[15px] text-muted">
          <span className="num text-[22px] text-water-ink" data-testid="water-count">{glasses}</span>
          <span className="num">/{goal}</span> {tr("แก้ว", "glasses")}
        </span>
      </div>
      <p className="px-1 text-[14px] text-muted" data-testid="water-note">
        <span className="num">{ml}</span> {tr("มล.", "ml")} ·{" "}
        {left > 0 ? tr(`อีก ${left} แก้ว`, `${left} more to go`) : <span className="font-medium text-water-ink">{tr("ครบเป้าแล้ว", "Goal reached")} ✓</span>}
      </p>

      <div className="mt-3 grid grid-cols-8 gap-y-2">
        {Array.from({ length: slots }, (_, i) => (
          <button
            key={i}
            className="flex h-11 items-center justify-center rounded-xl active:scale-90"
            onClick={() => setWater(date, tapGlass(glasses, i + 1))}
            aria-label={tr(`แก้วที่ ${i + 1}`, `Glass ${i + 1}`)}
            aria-pressed={i < glasses}
            data-testid="water-glass"
          >
            <Glass full={i < glasses} />
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-3">
        <button
          className="h-12 w-14 shrink-0 rounded-full border border-white/90 bg-white/60 text-[22px] text-water-ink disabled:opacity-30"
          onClick={() => setWater(date, glasses - 1)}
          disabled={glasses === 0}
          aria-label={tr("ลบ 1 แก้ว", "Remove 1 glass")}
          data-testid="water-minus"
        >
          −
        </button>
        <button
          className="h-12 flex-1 rounded-full border border-white/90 bg-water-soft text-[17px] text-water-ink active:scale-[0.98] disabled:opacity-40"
          onClick={() => setWater(date, glasses + 1)}
          disabled={glasses >= GLASSES_MAX}
          data-testid="water-plus"
        >
          + 1 {tr("แก้ว", "glass")} <span className="font-normal opacity-80">({GLASS_ML} {tr("มล.", "ml")})</span>
        </button>
      </div>

      {editGoal ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/55 px-3 py-2" data-testid="water-goal-edit">
          <span className="text-[15px]">{tr("เป้าต่อวัน", "Daily goal")}</span>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-full bg-white/80 text-[18px] disabled:opacity-30" onClick={() => changeGoal(goal - 1)} disabled={goal <= WATER_GOAL_MIN} aria-label={tr("ลดเป้า", "Lower goal")}>
              −
            </button>
            <span className="num w-[72px] text-center text-[16px] font-semibold" data-testid="water-goal">
              {goal} {tr("แก้ว", "glasses")}
            </span>
            <button className="h-9 w-9 rounded-full bg-white/80 text-[18px] disabled:opacity-30" onClick={() => changeGoal(goal + 1)} disabled={goal >= WATER_GOAL_MAX} aria-label={tr("เพิ่มเป้า", "Raise goal")}>
              +
            </button>
            <button className="ml-1 rounded-full px-3 py-2 text-[15px] font-medium text-olive-dark" onClick={() => setEditGoal(false)}>
              {tr("เสร็จ", "Done")}
            </button>
          </div>
        </div>
      ) : (
        <button className="mt-2 w-full px-1 py-1 text-center text-[13px] text-muted" onClick={() => setEditGoal(true)} data-testid="water-goal-open">
          {tr(`เป้า ${goal} แก้ว/วัน · แตะเพื่อเปลี่ยน`, `Goal ${goal} glasses a day · tap to change`)}
        </button>
      )}
    </section>
  );
}
