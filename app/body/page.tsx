"use client";
// Body: log weight and steps on any day, see a simple weight line,
// steps bars, and a weekly summary (average, change, progress to target).
// Steps can be typed or read from a screenshot by the AI.

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NumberField, Sheet, useAiStatus } from "../components/ui";
import { lastDays, summary, validSteps, validWeight, type BodyLog } from "../lib/body";
import { shiftDateKey, thaiDateKey, thaiDateLabel } from "../lib/date";
import { useLang } from "../lib/lang";
import { compressImage } from "../lib/photos";
import { fillProfile } from "../lib/profile";
import { useStore } from "../lib/store";

const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtSteps = (n: number) => Math.round(n).toLocaleString("en-US");

function shortDate(key: string, lang: "th" | "en") {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

function BodyInner() {
  const { bodyLogs, setBody, goals, saveError } = useStore();
  const { tr, lang } = useLang();
  const router = useRouter();
  const search = useSearchParams();
  const today = thaiDateKey();
  const date = search.get("date") || today;
  const go = (d: string) => router.replace(d === today ? "/body" : `/body?date=${d}`, { scroll: false });

  const p = fillProfile(goals.profile);
  const s = useMemo(() => summary(bodyLogs, today, p?.weightKg ?? null, p?.targetWeightKg ?? null), [bodyLogs, today, p?.weightKg, p?.targetWeightKg]);
  const dayLog = bodyLogs.find((l) => l.date === date) ?? null;

  const [flash, setFlash] = useState<string | null>(null);
  const say = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(null), 2500);
  };

  return (
    <main className="page space-y-5">
      <header className="flex items-center justify-between">
        <button className="h-11 w-11 rounded-full bg-paper text-[20px]" onClick={() => go(shiftDateKey(date, -1))} aria-label={tr("วันก่อนหน้า", "Previous day")}>
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-[24px] font-bold">{tr("น้ำหนัก & ก้าว", "Weight & steps")}</h1>
          <p className="text-[14px] text-muted" data-testid="body-date">
            {date === today ? `${tr("วันนี้", "Today")} · ` : ""}
            {thaiDateLabel(date, lang)}
          </p>
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
      {flash && (
        <p className="rounded-xl bg-olive-soft px-3 py-2 text-center text-[15px] text-olive-dark" role="status">
          {flash}
        </p>
      )}

      <WeightCard
        key={`w-${date}-${dayLog?.weightKg ?? ""}`}
        value={dayLog?.weightKg ?? null}
        onSave={(kg) => {
          setBody(date, { weightKg: kg });
          say(kg == null ? tr("ลบน้ำหนักแล้ว", "Weight removed") : tr("บันทึกน้ำหนักแล้ว", "Weight saved"));
        }}
      />
      <StepsCard
        key={`s-${date}-${dayLog?.steps ?? ""}`}
        date={date}
        value={dayLog?.steps ?? null}
        onSave={(d, n) => {
          setBody(d, { steps: n });
          if (d !== date) go(d);
          say(n == null ? tr("ลบจำนวนก้าวแล้ว", "Steps removed") : tr("บันทึกจำนวนก้าวแล้ว", "Steps saved"));
        }}
      />

      <WeekCard s={s} />
      <WeightChart logs={bodyLogs} today={today} target={s.target} selected={date} onPick={go} />
      <StepsChart logs={bodyLogs} today={today} selected={date} onPick={go} />
    </main>
  );
}

function WeightCard({ value, onSave }: { value: number | null; onSave: (kg: number | null) => void }) {
  const { tr } = useLang();
  const [kg, setKg] = useState<number | null>(value);
  const changed = kg !== value;
  const bad = kg != null && !validWeight(kg);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-[17px] font-semibold">⚖️ {tr("น้ำหนัก", "Weight")}</h2>
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
    </section>
  );
}

type Read = { steps: number | null; date: string | null; note: string | null; mock: boolean };

function StepsCard({ date, value, onSave }: { date: string; value: number | null; onSave: (date: string, n: number | null) => void }) {
  const { tr, lang } = useLang();
  const ai = useAiStatus();
  const aiReady = !!ai && (ai.configured || ai.mock);
  const [n, setN] = useState<number | null>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const changed = n !== value;
  const bad = n != null && !validSteps(n);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      // Bigger than food photos, so small numbers on the screen stay sharp.
      const image = await compressImage(f, 1600, 0.85, tr("อ่านรูปไม่ได้ ลองเลือกรูปอื่น", "Couldn't read this picture. Try another one."));
      const res = await fetch("/api/steps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, lang }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        return;
      }
      setRead({ ...data.result, mock: Boolean(data.mock) });
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-[17px] font-semibold">👣 {tr("จำนวนก้าว", "Steps")}</h2>
      <div className="flex items-center gap-2">
        <NumberField value={n} onChange={(v) => setN(v == null ? null : Math.round(v))} placeholder="0" aria-label={tr("จำนวนก้าว", "Steps")} className="field num flex-1 text-[22px]" data-testid="steps-input" />
        <span className="text-[16px] text-muted">{tr("ก้าว", "steps")}</span>
      </div>
      {bad && <p className="text-[14px] text-danger">{tr("ตัวเลขนี้ดูไม่ถูกต้อง", "This number doesn't look right")}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!changed || bad || n == null} onClick={() => onSave(date, n)} data-testid="steps-save">
          {tr("บันทึก", "Save")}
        </button>
        {value != null && (
          <button className="btn-soft" onClick={() => onSave(date, null)}>
            {tr("ลบ", "Remove")}
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="steps-file" />
      <button className="btn-soft w-full" disabled={busy || !aiReady} onClick={() => fileRef.current?.click()} data-testid="steps-screenshot">
        {busy ? tr("AI กำลังอ่านตัวเลข…", "The AI is reading the number…") : `📸 ${tr("อ่านจากภาพหน้าจอ", "Read from a screenshot")}`}
      </button>
      {busy && <p className="text-center text-[13px] text-muted">{tr("อย่าเพิ่งปิดหน้านี้หรือสลับแอปนะ", "Please keep this page open and don't switch apps")}</p>}
      {!busy && (
        <p className="text-[13px] text-muted">
          {ai && !aiReady
            ? tr("AI ยังไม่พร้อม พิมพ์ตัวเลขเองได้เลย", "The AI isn't set up. You can type the number yourself.")
            : tr("แคปหน้าจอของวันเดียวจากแอปสุขภาพ ที่เห็นตัวเลขก้าวชัด ๆ", "Screenshot ONE day in your Health app, with the step number easy to see")}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-[#f6e1dc] px-3 py-2 text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}

      <Sheet open={!!read} onClose={() => setRead(null)} title={tr("AI อ่านได้", "The AI read")}>
        {read && (
          <ReadConfirm
            read={read}
            fallbackDate={date}
            onCancel={() => setRead(null)}
            onSave={(d, steps) => {
              setRead(null);
              onSave(d, steps);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

function ReadConfirm({ read, fallbackDate, onSave, onCancel }: { read: Read; fallbackDate: string; onSave: (d: string, n: number) => void; onCancel: () => void }) {
  const { tr, lang } = useLang();
  const today = thaiDateKey();
  const [n, setN] = useState<number | null>(read.steps);
  const [d, setD] = useState(read.date ?? fallbackDate);
  const ok = validSteps(n) && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today;
  return (
    <div className="space-y-4 pb-4" data-testid="steps-confirm">
      {read.mock && <p className="text-center text-[13px] text-warn-ink">{tr("AI จำลอง (ทดสอบ)", "Pretend AI (test)")}</p>}
      {read.steps == null && (
        <p className="rounded-xl bg-warn px-3 py-2 text-[14px] text-warn-ink">{tr("AI หาตัวเลขก้าวในรูปไม่เจอ พิมพ์เองได้เลย", "The AI couldn't find a step number. You can type it.")}</p>
      )}
      {read.note && <p className="text-[14px] text-muted">{read.note}</p>}
      <label className="block space-y-1">
        <span className="label">{tr("จำนวนก้าว", "Steps")}</span>
        <NumberField value={n} onChange={(v) => setN(v == null ? null : Math.round(v))} className="field num text-[28px] font-bold" data-testid="confirm-steps" />
      </label>
      <label className="block space-y-1">
        <span className="label">{tr("ของวันที่", "For the day")}</span>
        <input type="date" className="field" value={d} max={today} onChange={(e) => setD(e.target.value)} data-testid="confirm-date" />
        <span className="text-[13px] text-muted">
          {read.date ? tr("AI อ่านวันที่จากรูป ตรวจอีกทีนะ", "The AI read the day from the picture. Please check it.") : tr("รูปไม่บอกวันที่ ใช้วันที่เลือกอยู่", "The picture shows no day, so it uses the day you're on.")}
          {/^\d{4}-\d{2}-\d{2}$/.test(d) && ` · ${thaiDateLabel(d, lang)}`}
        </span>
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!ok} onClick={() => ok && onSave(d, n as number)} data-testid="confirm-save">
          {tr("บันทึก", "Save")}
        </button>
        <button className="btn-soft" onClick={onCancel}>
          {tr("ยกเลิก", "Cancel")}
        </button>
      </div>
    </div>
  );
}

function WeekCard({ s }: { s: ReturnType<typeof summary> }) {
  const { tr, lang } = useLang();
  const ch = s.change;
  // Moving toward the target is good news; with no target, just show the number.
  const goodWay = s.target != null && s.startWeight != null && ch != null ? Math.sign(ch) === Math.sign(s.target - s.startWeight) : null;
  return (
    <section className="card space-y-4 p-5" data-testid="week-card">
      <div>
        <h2 className="text-[17px] font-semibold">{tr("สัปดาห์นี้", "This week")}</h2>
        <p className="text-[13px] text-muted">
          {shortDate(s.thisWeek.start, lang)} – {shortDate(s.thisWeek.end, lang)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[20px] bg-olive-soft px-3 py-3">
          <div className="text-[13px] text-olive-dark">{tr("น้ำหนักเฉลี่ย", "Average weight")}</div>
          <div className="num mt-1 text-[26px] font-bold leading-none text-olive-dark" data-testid="week-avg">
            {s.thisWeek.avgWeight != null ? fmtKg(s.thisWeek.avgWeight) : "–"}
            <span className="ml-1 text-[14px] font-semibold">{tr("กก.", "kg")}</span>
          </div>
          <div className="mt-1 text-[12px] text-olive-dark opacity-80">
            {s.thisWeek.weightDays} {tr("วันที่ชั่ง", s.thisWeek.weightDays === 1 ? "day weighed" : "days weighed")}
          </div>
        </div>
        <div className={`rounded-[20px] px-3 py-3 ${goodWay === false ? "bg-warn" : "bg-fat"}`}>
          <div className={`text-[13px] ${goodWay === false ? "text-warn-ink" : "text-fat-ink"}`}>{tr("เทียบสัปดาห์ก่อน", "vs last week")}</div>
          <div className={`num mt-1 text-[26px] font-bold leading-none ${goodWay === false ? "text-warn-ink" : "text-fat-ink"}`} data-testid="week-change">
            {ch == null ? "–" : `${ch > 0 ? "+" : ch < 0 ? "−" : "±"}${fmtKg(Math.abs(ch))}`}
            <span className="ml-1 text-[14px] font-semibold">{tr("กก.", "kg")}</span>
          </div>
          <div className={`mt-1 text-[12px] opacity-80 ${goodWay === false ? "text-warn-ink" : "text-fat-ink"}`}>
            {ch == null
              ? tr("ต้องมีน้ำหนักทั้ง 2 สัปดาห์", "Needs a weight in both weeks")
              : `${tr("สัปดาห์ก่อน", "Last week")} ${fmtKg(s.lastWeek.avgWeight as number)}`}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] bg-carbs px-3 py-3 text-carbs-ink">
        <div className="text-[13px]">{tr("ก้าวเฉลี่ยต่อวัน", "Average steps a day")}</div>
        <div className="num mt-1 text-[26px] font-bold leading-none" data-testid="week-steps">
          {s.thisWeek.avgSteps != null ? fmtSteps(s.thisWeek.avgSteps) : "–"}
        </div>
        <div className="mt-1 text-[12px] opacity-80">
          {tr("รวม", "Total")} {fmtSteps(s.thisWeek.totalSteps)} · {s.thisWeek.stepDays} {tr("วันที่บันทึก", s.thisWeek.stepDays === 1 ? "day logged" : "days logged")}
          {s.lastWeek.avgSteps != null && ` · ${tr("สัปดาห์ก่อน", "last week")} ${fmtSteps(s.lastWeek.avgSteps)}`}
        </div>
      </div>

      {s.target != null ? (
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
      ) : (
        <p className="text-[13px] text-muted">{tr("ตั้งน้ำหนักเป้าหมายได้ที่หน้าโปรไฟล์", "You can set a target weight on the Profile page")}</p>
      )}
      <p className="text-[12px] text-muted">
        {tr("น้ำหนักขึ้นลงวันละ 0.5–1 กก. เป็นเรื่องปกติ (น้ำ อาหาร) ดูค่าเฉลี่ยรายสัปดาห์จะเห็นภาพจริงกว่า", "Weight goes up and down 0.5–1 kg a day (water, food). The weekly average shows the real trend better.")}
      </p>
    </section>
  );
}

const RANGES = [14, 30, 90] as const;

function WeightChart({ logs, today, target, selected, onPick }: { logs: BodyLog[]; today: string; target: number | null; selected: string; onPick: (d: string) => void }) {
  const { tr, lang } = useLang();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const series = lastDays(logs, today, days);
  const pts = series.map((x, i) => ({ i, date: x.date, w: x.log?.weightKg })).filter((x): x is { i: number; date: string; w: number } => validWeight(x.w ?? null));

  const W = 340;
  const H = 180;
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
    <section className="card space-y-3 p-5" data-testid="weight-chart">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{tr("น้ำหนักรายวัน", "Weight by day")}</h2>
        <div className="flex gap-1 rounded-xl bg-cream p-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)} aria-pressed={days === r} className={`min-h-[32px] rounded-lg px-2.5 text-[13px] font-medium ${days === r ? "bg-olive text-white" : "text-muted"}`}>
              {r === 90 ? tr("3 เดือน", "3 mo") : `${r} ${tr("วัน", "d")}`}
            </button>
          ))}
        </div>
      </div>
      {pts.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted">{tr("ยังไม่มีน้ำหนักในช่วงนี้", "No weight logged in this time yet")}</p>
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
            <text x={W - padR} y={target < lo ? H - padB - 4 : padT + 10} textAnchor="end" fontSize="11" fill="var(--olive-dark)">
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
    </section>
  );
}

function StepsChart({ logs, today, selected, onPick }: { logs: BodyLog[]; today: string; selected: string; onPick: (d: string) => void }) {
  const { tr, lang } = useLang();
  const series = lastDays(logs, today, 7);
  const max = Math.max(1000, ...series.map((s) => s.log?.steps ?? 0));
  const any = series.some((s) => validSteps(s.log?.steps ?? null));
  return (
    <section className="card space-y-3 p-5" data-testid="steps-chart">
      <h2 className="text-[17px] font-semibold">{tr("ก้าว 7 วันล่าสุด", "Steps, last 7 days")}</h2>
      {!any ? (
        <p className="py-6 text-center text-[14px] text-muted">{tr("ยังไม่มีจำนวนก้าวใน 7 วันนี้", "No steps logged in the last 7 days")}</p>
      ) : (
        <div className="grid h-[150px] grid-cols-7 items-end gap-1.5">
          {series.map((s) => {
            const n = s.log?.steps ?? null;
            const h = n != null ? Math.max(4, (n / max) * 110) : 0;
            const [yy, mm, dd] = s.date.split("-").map(Number);
            const wd = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { timeZone: "UTC", weekday: "narrow" }).format(new Date(Date.UTC(yy, mm - 1, dd, 12)));
            return (
              <button key={s.date} onClick={() => onPick(s.date)} className="flex h-full flex-col items-center justify-end gap-1" aria-label={`${shortDate(s.date, lang)}: ${n != null ? fmtSteps(n) : "–"}`}>
                <span className="num text-[10px] text-muted">{n != null ? (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n) : ""}</span>
                <span className={`w-full rounded-t-lg ${s.date === selected ? "bg-carbs-ink" : "bg-carbs"}`} style={{ height: h }} />
                <span className={`text-[12px] ${s.date === selected ? "font-semibold text-ink" : "text-muted"}`}>{wd}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function BodyPage() {
  return (
    <Suspense>
      <BodyInner />
    </Suspense>
  );
}
