"use client";
// Weight on the Profile page (Round 24). One card: log a weight for any day,
// see progress to the target weight, this week vs last week, and a small line chart.
// Steps were removed (the iPhone already counts them). Old step numbers stay in the saved data and backups.

import { useMemo, useState } from "react";
import { NumberField } from "./ui";
import { lastDays, summary, validWeight, type BodyLog } from "../lib/body";
import { thaiDateKey } from "../lib/date";
import { useLang } from "../lib/lang";
import { fillProfile } from "../lib/profile";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";

const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function shortDate(key: string, lang: "th" | "en") {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

export function WeightCard() {
  const { bodyLogs, setBody, goals } = useStore();
  const { tr } = useLang();
  const today = thaiDateKey();
  const [date, setDate] = useState(today);
  const p = fillProfile(goals.profile);
  const s = useMemo(() => summary(bodyLogs, today, p?.weightKg ?? null, p?.targetWeightKg ?? null), [bodyLogs, today, p?.weightKg, p?.targetWeightKg]);
  const dayValue = bodyLogs.find((l) => l.date === date)?.weightKg ?? null;
  const [flash, setFlash] = useState<string | null>(null);
  const say = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(null), 2500);
  };

  return (
    <section className="card space-y-4 p-5" data-testid="weight-card">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Icon name="scales" className="h-5 w-5" /> {tr("น้ำหนัก", "Weight")}</h2>
      <WeightEntry
        key={`${date}-${dayValue ?? ""}`}
        date={date}
        today={today}
        onDate={setDate}
        value={dayValue}
        onSave={(kg) => {
          setBody(date, { weightKg: kg });
          say(kg == null ? tr("ลบน้ำหนักแล้ว", "Weight removed") : tr("บันทึกน้ำหนักแล้ว", "Weight saved"));
        }}
      />
      {flash && (
        <p className="rounded-xl bg-olive-soft px-3 py-2 text-center text-[15px] text-olive-dark" role="status">
          {flash}
        </p>
      )}
      <Progress s={s} />
      <Week s={s} />
      <WeightChart logs={bodyLogs} today={today} target={s.target} selected={date} onPick={setDate} />
      <p className="text-[12px] text-muted">
        {tr("น้ำหนักขึ้นลงวันละ 0.5–1 กก. เป็นเรื่องปกติ (น้ำ อาหาร) ดูค่าเฉลี่ยรายสัปดาห์จะเห็นภาพจริงกว่า", "Weight goes up and down 0.5–1 kg a day (water, food). The weekly average shows the real trend better.")}
      </p>
    </section>
  );
}

function WeightEntry({ date, today, onDate, value, onSave }: { date: string; today: string; onDate: (d: string) => void; value: number | null; onSave: (kg: number | null) => void }) {
  const { tr } = useLang();
  const [kg, setKg] = useState<number | null>(value);
  const changed = kg !== value;
  const bad = kg != null && !validWeight(kg);
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-2 text-[14px] text-muted">
        <span className="whitespace-nowrap">{date === today ? tr("ของวันนี้", "For today") : tr("ของวันที่", "For the day")}</span>
        <input
          type="date"
          className="field !min-h-[44px] w-auto !py-1 text-[15px] text-ink"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onDate(e.target.value > today ? today : e.target.value)}
          data-testid="weight-date"
        />
      </label>
      <div className="flex items-center gap-2">
        <NumberField value={kg} onChange={setKg} placeholder="0.0" aria-label={tr("น้ำหนัก (กก.)", "Weight (kg)")} className="field num flex-1 text-[22px]" data-testid="weight-input" />
        <span className="text-[16px] text-muted">{tr("กก.", "kg")}</span>
      </div>
      {bad && <p className="text-[14px] text-danger">{tr("ใส่น้ำหนักระหว่าง 20–300 กก.", "Enter a weight between 20 and 300 kg")}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!changed || bad || kg == null} onClick={() => onSave(kg)} data-testid="weight-save">
          {tr("บันทึก", "Save")}
        </button>
        {value != null && (
          <button className="btn-soft" onClick={() => onSave(null)}>
            {tr("ลบ", "Remove")}
          </button>
        )}
      </div>
    </div>
  );
}

function Progress({ s }: { s: ReturnType<typeof summary> }) {
  const { tr } = useLang();
  if (s.target == null) return <p className="text-[13px] text-muted">{tr("ตั้งน้ำหนักเป้าหมายได้ที่ “แก้ข้อมูล” ด้านล่าง", "You can set a target weight with “Edit” below")}</p>;
  return (
    <div className="space-y-2" data-testid="goal-progress">
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="font-medium">
          {tr("เป้าหมาย", "Goal")} {fmtKg(s.target)} {tr("กก.", "kg")}
        </span>
        {s.toGo != null && (
          <span className="text-muted">
            {s.toGo < 0.05 ? tr("ถึงเป้าแล้ว 🎉", "You're there 🎉") : `${tr("อีก", "")} ${fmtKg(s.toGo)} ${tr("กก.", "kg to go")}`}
          </span>
        )}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-cream">
        <div className="h-full rounded-full bg-olive" style={{ width: `${Math.round((s.progress ?? 0) * 100)}%` }} />
      </div>
      <p className="text-[13px] text-muted">
        {s.latest && s.startWeight != null
          ? `${tr("เริ่ม", "Started")} ${fmtKg(s.startWeight)} → ${tr("ล่าสุด", "now")} ${fmtKg(s.latest.weightKg)} ${tr("กก.", "kg")} · ${Math.round((s.progress ?? 0) * 100)}%`
          : tr("ชั่งน้ำหนักครั้งแรก แล้วจะเห็นความคืบหน้า", "Log your first weight to see your progress")}
      </p>
    </div>
  );
}

function Week({ s }: { s: ReturnType<typeof summary> }) {
  const { tr } = useLang();
  const ch = s.change;
  // Moving toward the target is good news; with no target, just show the number.
  const goodWay = s.target != null && s.startWeight != null && ch != null ? Math.sign(ch) === Math.sign(s.target - s.startWeight) : null;
  return (
    <div className="grid grid-cols-2 gap-2.5" data-testid="week-card">
      <div className="rounded-[20px] bg-olive-soft px-3 py-3">
        <div className="text-[13px] text-olive-dark">{tr("เฉลี่ยสัปดาห์นี้", "This week's average")}</div>
        <div className="num mt-1 text-[24px] font-bold leading-none text-olive-dark" data-testid="week-avg">
          {s.thisWeek.avgWeight != null ? fmtKg(s.thisWeek.avgWeight) : "–"}
          <span className="ml-1 text-[13px] font-semibold">{tr("กก.", "kg")}</span>
        </div>
        <div className="mt-1 text-[12px] text-olive-dark opacity-80">
          {s.thisWeek.weightDays} {tr("วันที่ชั่ง", s.thisWeek.weightDays === 1 ? "day weighed" : "days weighed")}
        </div>
      </div>
      <div className={`rounded-[20px] px-3 py-3 ${goodWay === false ? "bg-warn text-warn-ink" : "bg-fat text-fat-ink"}`}>
        <div className="text-[13px]">{tr("เทียบสัปดาห์ก่อน", "vs last week")}</div>
        <div className="num mt-1 text-[24px] font-bold leading-none" data-testid="week-change">
          {ch == null ? "–" : `${ch > 0 ? "+" : ch < 0 ? "−" : "±"}${fmtKg(Math.abs(ch))}`}
          <span className="ml-1 text-[13px] font-semibold">{tr("กก.", "kg")}</span>
        </div>
        <div className="mt-1 text-[12px] opacity-80">
          {ch == null ? tr("ต้องมีน้ำหนักทั้ง 2 สัปดาห์", "Needs a weight in both weeks") : `${tr("สัปดาห์ก่อน", "Last week")} ${fmtKg(s.lastWeek.avgWeight as number)}`}
        </div>
      </div>
    </div>
  );
}

const RANGES = [30, 90] as const;

function WeightChart({ logs, today, target, selected, onPick }: { logs: BodyLog[]; today: string; target: number | null; selected: string; onPick: (d: string) => void }) {
  const { tr, lang } = useLang();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const series = lastDays(logs, today, days);
  const pts = series.map((x, i) => ({ i, date: x.date, w: x.log?.weightKg })).filter((x): x is { i: number; date: string; w: number } => validWeight(x.w ?? null));

  const W = 340;
  const H = 160;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  // Zoom in on her own weights. The goal line only shows when it is close by,
  // otherwise a small note says which way it is.
  const vals = pts.map((p) => p.w);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2;
    lo = mid - 1;
    hi = mid + 1;
  }
  lo = Math.floor(lo - 0.3);
  hi = Math.ceil(hi + 0.3);
  const x = (i: number) => padL + (i / Math.max(1, days - 1)) * (W - padL - padR);
  const y = (w: number) => padT + (1 - (w - lo) / (hi - lo)) * (H - padT - padB);
  const path = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.w).toFixed(1)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  const selIdx = series.findIndex((s) => s.date === selected);

  return (
    <div className="space-y-2" data-testid="weight-chart">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{tr("กราฟน้ำหนัก", "Weight chart")}</h3>
        <div className="flex gap-1 rounded-xl bg-cream p-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)} aria-pressed={days === r} className={`hit44 relative min-h-[32px] rounded-lg px-2.5 text-[13px] font-medium ${days === r ? "bg-olive text-white" : "text-muted"}`}>
              {r === 90 ? tr("3 เดือน", "3 mo") : `${r} ${tr("วัน", "d")}`}
            </button>
          ))}
        </div>
      </div>
      {pts.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-muted">{tr("ยังไม่มีน้ำหนักในช่วงนี้", "No weight logged in this time yet")}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("กราฟน้ำหนัก", "Weight chart")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {Math.round(t * 10) / 10}
              </text>
            </g>
          ))}
          {target != null && target >= lo && target <= hi && (
            <g>
              <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="var(--olive)" strokeDasharray="4 4" strokeWidth="1.5" />
              <text x={W - padR} y={y(target) - 4} textAnchor="end" fontSize="11" fill="var(--olive-dark)">
                {tr("เป้า", "goal")} {target}
              </text>
            </g>
          )}
          {target != null && (target < lo || target > hi) && (
            <text x={padL + 4} y={target < lo ? H - padB - 4 : padT + 10} textAnchor="start" fontSize="11" fill="var(--olive-dark)">
              {tr("เป้า", "goal")} {target} {target < lo ? "↓" : "↑"}
            </text>
          )}
          {selIdx >= 0 && <line x1={x(selIdx)} x2={x(selIdx)} y1={padT} y2={H - padB} stroke="var(--olive-soft)" strokeWidth="6" />}
          <path d={path} fill="none" stroke="var(--olive-dark)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p) => (
            <circle key={p.date} cx={x(p.i)} cy={y(p.w)} r={days > 30 ? 2.5 : 4} fill="var(--paper)" stroke="var(--olive-dark)" strokeWidth="2" onClick={() => onPick(p.date)} style={{ cursor: "pointer" }}>
              <title>
                {shortDate(p.date, lang)}: {fmtKg(p.w)}
              </title>
            </circle>
          ))}
          <text x={padL} y={H - 6} fontSize="11" fill="var(--muted)">
            {shortDate(series[0].date, lang)}
          </text>
          <text x={W - padR} y={H - 6} textAnchor="end" fontSize="11" fill="var(--muted)">
            {tr("วันนี้", "today")}
          </text>
        </svg>
      )}
    </div>
  );
}
