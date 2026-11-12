"use client";
import { useMemo, useState } from "react";
import { NumberField } from "../components/ui";
import {
  ACTIVITY_LEVELS,
  DAILY_LABEL,
  EXERCISE_LABEL,
  GOAL_LABEL,
  estimateEnergy,
  macroTargets,
} from "../lib/energy";
import { fmtKcal } from "../lib/nutrition";
import { useStore } from "../lib/store";
import type { DailyActivity, ExerciseFreq, Goals, Profile, Sex, WeightGoal } from "../lib/types";

const EMPTY: Profile = {
  age: 0,
  heightCm: 0,
  weightKg: 0,
  sex: "female",
  daily: "sitting",
  exercise: "none",
  goal: "maintain",
  pregnant: false,
  breastfeeding: false,
};

function Choice<T extends string>({
  value,
  options,
  onChange,
  cols = 1,
}: {
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={`min-h-[48px] rounded-2xl px-4 text-left text-[16px] ${value === k ? "bg-olive font-medium text-white" : "bg-cream"}`}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}

export default function GoalsPage() {
  const { ready, goals } = useStore();
  if (!ready) return <main className="page" />;
  return <GoalsForm goals={goals} />;
}

function GoalsForm({ goals }: { goals: Goals }) {
  const { setGoals } = useStore();
  const [manual, setManual] = useState<number | null>(goals.targetKcal);
  const [p, setP] = useState<Profile>(goals.profile ?? EMPTY);
  const [skip, setSkip] = useState(goals.skippedEstimate);
  const [saved, setSaved] = useState<string | null>(null);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  // Keep the manual box in sync when the target changes from the calculator.
  const [lastTarget, setLastTarget] = useState(goals.targetKcal);
  if (goals.targetKcal !== lastTarget) {
    setLastTarget(goals.targetKcal);
    setManual(goals.targetKcal);
  }

  const filled = p.age > 0 && p.heightCm > 0 && p.weightKg > 0;
  const result = useMemo(() => (filled ? estimateEnergy(p) : null), [p, filled]);
  const profileChanged = JSON.stringify(p) !== JSON.stringify(goals.profile);
  const isNew = result?.ok && (result.suggested !== goals.targetKcal || profileChanged);
  const mt = macroTargets(goals.targetKcal);

  function flash(t: string) {
    setSaved(t);
    setTimeout(() => setSaved(null), 2500);
  }

  return (
    <main className="page space-y-5">
      <h1 className="text-[26px] font-bold">เป้าหมายของฉัน</h1>

      <section className="card space-y-4 p-5">
        <div className="text-center">
          <div className="text-[14px] text-muted">เป้าต่อวันที่ใช้อยู่</div>
          <div className="num text-[56px] font-bold leading-none" data-testid="goal-target">{fmtKcal(goals.targetKcal)}</div>
          <div className="text-[15px] text-muted">
            kcal/วัน ·{" "}
            {goals.targetSource === "manual" ? "ตั้งเอง" : goals.targetSource === "calc" ? "จากการคำนวณ" : "ค่าเริ่มต้น"}
          </div>
          {goals.maintenanceKcal != null && (
            <div className="mt-1 text-[14px] text-muted">
              ประมาณการรักษาน้ำหนัก ≈ <span className="num font-semibold text-ink">{fmtKcal(goals.maintenanceKcal)}</span> kcal/วัน
            </div>
          )}
          <div className="mt-2 text-[13px] text-muted">
            การ์ดสารอาหารใช้สัดส่วนทั่วไป P20/C50/F30 → โปรตีน {Math.round(mt.protein)} g · คาร์บ {Math.round(mt.carbs)} g · ไขมัน {Math.round(mt.fat)} g
          </div>
        </div>
        <div>
          <label className="label" htmlFor="manual-kcal">แก้เป้าเอง (kcal/วัน)</label>
          <div className="flex gap-2">
            <NumberField id="manual-kcal" value={manual} onChange={setManual} />
            <button
              className="btn-primary shrink-0"
              disabled={!(manual && manual >= 500 && manual <= 6000) || manual === goals.targetKcal}
              onClick={() => {
                setGoals({ ...goals, targetKcal: Math.round(manual!), targetSource: "manual" });
                flash("บันทึกเป้าแล้ว");
              }}
            >
              บันทึก
            </button>
          </div>
          {manual != null && (manual < 500 || manual > 6000) && (
            <p className="mt-1 text-[13px] text-warn-ink">ใส่ค่าระหว่าง 500–6,000 kcal</p>
          )}
        </div>
        {saved && <p className="rounded-xl bg-olive-soft px-3 py-2 text-center text-[15px] text-olive-dark" role="status">{saved}</p>}
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-semibold">ประเมินพลังงานต่อวัน</h2>
          <button
            className="text-[15px] text-olive-dark underline"
            onClick={() => {
              const next = !skip;
              setSkip(next);
              setGoals({ ...goals, skippedEstimate: next });
            }}
          >
            {skip ? "ประเมินให้ฉัน" : "ข้ามการประเมิน"}
          </button>
        </div>

        {skip ? (
          <p className="text-[15px] text-muted">ข้ามไว้แล้ว — ใช้เป้าที่ตั้งเองด้านบนได้เลย</p>
        ) : (
          <>
            <p className="text-[14px] text-muted">สำหรับผู้ใหญ่ อายุ 18 ปีขึ้นไป</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label" htmlFor="age">อายุ (ปี)</label>
                <NumberField id="age" value={p.age || null} onChange={(n) => set({ age: n ?? 0 })} />
              </div>
              <div>
                <label className="label" htmlFor="height">ส่วนสูง (ซม.)</label>
                <NumberField id="height" value={p.heightCm || null} onChange={(n) => set({ heightCm: n ?? 0 })} />
              </div>
              <div>
                <label className="label" htmlFor="weight">น้ำหนัก (กก.)</label>
                <NumberField id="weight" value={p.weightKg || null} onChange={(n) => set({ weightKg: n ?? 0 })} />
              </div>
            </div>

            <div>
              <span className="label">เพศที่ใช้ในสมการ</span>
              <Choice<Sex> value={p.sex} options={{ female: "หญิง", male: "ชาย" }} onChange={(v) => set({ sex: v })} cols={2} />
              <p className="mt-1 text-[13px] text-muted">สมการมีค่าคงที่ต่างกันสำหรับสองแบบนี้ เลือกแบบที่ใกล้ร่างกายคุณที่สุด</p>
            </div>

            <div className="space-y-2">
              <label className="flex min-h-[44px] items-center gap-3 rounded-2xl bg-cream px-4">
                <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={p.pregnant} onChange={(e) => set({ pregnant: e.target.checked })} />
                ตอนนี้ตั้งครรภ์
              </label>
              <label className="flex min-h-[44px] items-center gap-3 rounded-2xl bg-cream px-4">
                <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={p.breastfeeding} onChange={(e) => set({ breastfeeding: e.target.checked })} />
                ตอนนี้ให้นมลูก
              </label>
            </div>

            <div>
              <span className="label">ชีวิตประจำวัน (ไม่นับออกกำลังกาย)</span>
              <Choice<DailyActivity> value={p.daily} options={DAILY_LABEL} onChange={(v) => set({ daily: v })} />
            </div>
            <div>
              <span className="label">ออกกำลังกายบ่อยแค่ไหน</span>
              <Choice<ExerciseFreq> value={p.exercise} options={EXERCISE_LABEL} onChange={(v) => set({ exercise: v })} />
            </div>
            <div>
              <span className="label">เป้าหมายด้านน้ำหนัก</span>
              <Choice<WeightGoal> value={p.goal} options={GOAL_LABEL} onChange={(v) => set({ goal: v })} />
            </div>

            {result && !result.ok && (
              <p className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">{result.message}</p>
            )}

            {result?.ok && (
              <div className="space-y-3 rounded-[22px] bg-olive-soft p-4" data-testid="energy-proposal">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl bg-paper p-3">
                    <div className="text-[13px] text-muted">รักษาน้ำหนัก ≈</div>
                    <div className="num text-[28px] font-bold">{fmtKcal(result.maintenance)}</div>
                    <div className="text-[13px] text-muted">kcal/วัน</div>
                  </div>
                  <div className="rounded-2xl bg-paper p-3">
                    <div className="text-[13px] text-muted">เป้าที่แนะนำ</div>
                    <div className="num text-[28px] font-bold">{fmtKcal(result.suggested)}</div>
                    <div className="text-[13px] text-muted">kcal/วัน</div>
                  </div>
                </div>
                <p className="text-[15px]">
                  ระดับกิจกรรมที่ใช้: <b>{result.level.label}</b> (×{result.level.factor}) — {result.level.description}
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-[14px] text-ink/80">
                  {result.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {isNew ? (
                  <div className="flex gap-2">
                    <button
                      className="btn-primary flex-1"
                      onClick={() => {
                        setGoals({
                          ...goals,
                          targetKcal: result.suggested,
                          targetSource: "calc",
                          profile: p,
                          maintenanceKcal: result.maintenance,
                          skippedEstimate: false,
                        });
                        flash("เปลี่ยนเป้าเป็นค่าที่คำนวณแล้ว");
                      }}
                    >
                      ใช้ {fmtKcal(result.suggested)} kcal เป็นเป้า
                    </button>
                    <button className="btn-soft" onClick={() => setP(goals.profile ?? EMPTY)}>ยังไม่ใช้</button>
                  </div>
                ) : (
                  <p className="text-center text-[14px] text-olive-dark">เป้าที่ใช้อยู่ตรงกับผลคำนวณนี้แล้ว</p>
                )}
                <p className="text-[13px] text-muted">เป้าที่ใช้อยู่จะเปลี่ยนเมื่อกดยืนยันเท่านั้น</p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card space-y-2 p-5 text-[14px] text-ink/80">
        <h2 className="text-[17px] font-semibold text-ink">วิธีคำนวณและแหล่งอ้างอิง</h2>
        <p><b>1. พลังงานขณะพัก (BMR)</b> — สมการ Mifflin–St Jeor: หญิง 10×กก. + 6.25×ซม. − 5×อายุ − 161 · ชาย … + 5<br />
          Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241–247.</p>
        <p><b>2. ระดับกิจกรรม</b> — รวมคำตอบเรื่องชีวิตประจำวันกับการออกกำลังกาย แล้วเลือกตัวคูณมาตรฐานที่ใกล้ที่สุด:{" "}
          {ACTIVITY_LEVELS.map((l) => `${l.label} ×${l.factor}`).join(" · ")}<br />
          แนวคิดระดับกิจกรรม (PAL): FAO/WHO/UNU, Human Energy Requirements, 2004.</p>
        <p><b>3. เป้าน้ำหนัก</b> — ประมาณ 7,700 kcal ≈ 1 กก. (ค่าประมาณทั่วไป แต่ละคนต่างกัน): ลด 0.5 กก./สัปดาห์ ≈ −550 kcal/วัน</p>
        <p><b>4. ขั้นต่ำเพื่อความปลอดภัย</b> — ไม่แนะนำต่ำกว่า 1,200 (หญิง) / 1,500 (ชาย) kcal/วัน หากไม่มีแพทย์ดูแล · NIH/NHLBI Clinical Guidelines on Overweight and Obesity in Adults, 1998.</p>
        <p className="text-muted">เป็นค่าประมาณเพื่อช่วยวางแผน ไม่ใช่คำแนะนำทางการแพทย์ ไม่ใช้กับผู้ที่อายุต่ำกว่า 18 ปี ตั้งครรภ์ หรือให้นม</p>
      </section>
    </main>
  );
}
