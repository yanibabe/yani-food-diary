"use client";
// Form pieces shared by first-run setup (/welcome) and the Profile page.

import { NumberField } from "./ui";
import { DAILY_LABEL, EXERCISE_LABEL, REASON_LABEL, UNIT_TH, usesWeightGoal, validateProfile, type WeightPlan } from "../lib/energy";
import { shiftDateKey, thaiDateKey, thaiDateLabel } from "../lib/date";
import type { DailyActivity, DurationUnit, ExerciseFreq, Profile, Reason, Sex } from "../lib/types";

export const kg = (n: number) => (Math.round(n * 10) / 10).toString();

export function Choice<T extends string>({
  value,
  options,
  onChange,
  cols = 1,
  big = false,
}: {
  value: T | undefined;
  options: Record<T, string>;
  onChange: (v: T) => void;
  cols?: number;
  big?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={`${big ? "min-h-[58px] text-[18px]" : "min-h-[48px] text-[16px]"} rounded-2xl px-4 text-left ${
            value === k ? "bg-olive font-medium text-white" : "bg-cream"
          }`}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}

type SetP = (patch: Partial<Profile>) => void;

export function NameField({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div>
      <label className="label" htmlFor="name">ชื่อ</label>
      <input
        id="name"
        className="field"
        value={p.name ?? ""}
        maxLength={30}
        autoComplete="given-name"
        placeholder="เช่น ยานี่"
        onChange={(e) => set({ name: e.target.value })}
      />
    </div>
  );
}

export function BodyFields({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

/** Problem with the body numbers, or null. Under 18 is allowed (no automatic suggestion later). */
export function bodyProblem(p: Profile): string | null {
  if (!(p.age >= 1 && p.age <= 100)) return "ใส่อายุ (1–100 ปี)";
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return "ใส่ส่วนสูง (120–230 ซม.)";
  if (!(p.weightKg >= 30 && p.weightKg <= 300)) return "ใส่น้ำหนัก (30–300 กก.)";
  return null;
}

/** Problem with the reason step, or null. Age is checked elsewhere. */
export function reasonProblem(p: Profile): string | null {
  if (!p.reason) return "เลือกเหตุผลหนึ่งข้อ";
  if (!usesWeightGoal(p.reason)) return null;
  if (!(p.targetWeightKg > 0)) return "ใส่น้ำหนักที่อยากเป็น";
  return validateProfile({ ...p, age: Math.max(18, p.age) });
}

export function ActivityFields({ p, set }: { p: Profile; set: SetP }) {
  return (
    <div className="space-y-4">
      <div>
        <span className="label">ชีวิตประจำวัน (ไม่นับออกกำลังกาย)</span>
        <Choice<DailyActivity> value={p.daily} options={DAILY_LABEL} onChange={(v) => set({ daily: v })} />
      </div>
      <div>
        <span className="label">ออกกำลังกายบ่อยแค่ไหน</span>
        <Choice<ExerciseFreq> value={p.exercise} options={EXERCISE_LABEL} onChange={(v) => set({ exercise: v })} />
      </div>
    </div>
  );
}

export function ReasonFields({ p, set, plan }: { p: Profile; set: SetP; plan: WeightPlan | null }) {
  return (
    <div className="space-y-4">
      <Choice<Reason>
        value={p.reason}
        options={REASON_LABEL}
        big
        onChange={(v) => {
          // Start lose/gain with a sensible target the right way round.
          const patch: Partial<Profile> = { reason: v };
          if (v === "lose" && !(p.targetWeightKg > 0 && p.targetWeightKg < p.weightKg)) patch.targetWeightKg = 0;
          if (v === "gain" && !(p.targetWeightKg > p.weightKg)) patch.targetWeightKg = 0;
          set(patch);
        }}
      />
      {p.reason === "muscle" && (
        <p className="rounded-2xl bg-paper px-4 py-3 text-[15px]">
          แอปจะเผื่อพลังงานเพิ่มเล็กน้อย (+10%) และตั้งเป้าโปรตีนประมาณ 1.6 g ต่อน้ำหนักตัว 1 กก.
        </p>
      )}
      {usesWeightGoal(p.reason) && p.reason && (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="target-weight">น้ำหนักที่อยากเป็น (กก.)</label>
            <NumberField id="target-weight" value={p.targetWeightKg || null} onChange={(n) => set({ targetWeightKg: n ?? 0 })} />
          </div>
          <div>
            <label className="label" htmlFor="duration">ภายในเวลา</label>
            <div className="flex gap-2">
              <NumberField id="duration" className="field num !w-24" value={p.duration || null} onChange={(n) => set({ duration: n ?? 0 })} />
              <div className="grid flex-1 grid-cols-3 gap-2">
                {(["day", "week", "month"] as DurationUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set({ durationUnit: u })}
                    aria-pressed={p.durationUnit === u}
                    className={`min-h-[48px] rounded-2xl text-[16px] ${p.durationUnit === u ? "bg-olive font-medium text-white" : "bg-cream"}`}
                  >
                    {UNIT_TH[u]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {plan && plan.direction !== "keep" && (
            <PlanSummary p={p} plan={plan} onUseSafe={(m) => set({ duration: m, durationUnit: "month" })} />
          )}
        </div>
      )}
    </div>
  );
}

export function PlanSummary({ p, plan, onUseSafe }: { p: Profile; plan: WeightPlan; onUseSafe: (months: number) => void }) {
  const today = thaiDateKey();
  if (plan.direction === "keep") {
    return (
      <p className="rounded-2xl bg-paper px-4 py-3 text-[15px]" data-testid="plan-summary">
        แผน: <b>รักษาน้ำหนัก</b> ไว้ที่ {kg(p.weightKg)} กก.
      </p>
    );
  }
  const verb = plan.direction === "lose" ? "ลด" : "เพิ่ม";
  const reachDays = plan.tooFast ? plan.safeWeeks * 7 : plan.days;
  return (
    <div className="space-y-2" data-testid="plan-summary">
      <div className="rounded-2xl bg-paper px-4 py-3 text-[15px]">
        <div>
          แผน: <b>{verb} {kg(plan.changeKg)} กก.</b> ({kg(p.weightKg)} → {kg(p.targetWeightKg)} กก.) ภายใน {p.duration} {UNIT_TH[p.durationUnit]}
        </div>
        <div className="text-muted">
          ≈ {kg(plan.usedKgPerWeek)} กก./สัปดาห์ · ถึงเป้าประมาณ {thaiDateLabel(shiftDateKey(today, Math.round(reachDays)))}
        </div>
      </div>
      {plan.tooFast && (
        <div className="space-y-2 rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">
          <p>
            เร็วเกินไปสำหรับร่างกาย: ต้อง{verb} {kg(plan.wantedKgPerWeek)} กก./สัปดาห์ แต่ไม่ควรเกิน {kg(plan.safeMaxKgPerWeek)} กก./สัปดาห์
            — ควรใช้เวลาอย่างน้อยประมาณ <b>{plan.safeMonths} เดือน</b> ({plan.safeWeeks} สัปดาห์) แอปจึงคำนวณด้วยความเร็วที่ปลอดภัยแทน
          </p>
          <button type="button" className="btn-soft !min-h-[44px] !bg-paper" onClick={() => onUseSafe(plan.safeMonths)}>
            เปลี่ยนเป็น {plan.safeMonths} เดือน
          </button>
        </div>
      )}
      {plan.direction === "lose" && plan.targetBmi < 18.5 && (
        <p className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">
          น้ำหนักที่อยากเป็นนี้ทำให้ BMI ≈ {kg(plan.targetBmi)} ซึ่งต่ำกว่าเกณฑ์ปกติ (18.5) ควรปรึกษาแพทย์ก่อนตั้งเป้านี้
        </p>
      )}
    </div>
  );
}

/** One big kcal number; tap it to type your own. */
export function BigTarget({
  value,
  onChange,
  caption,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  caption: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[15px] text-muted">{caption}</div>
      <NumberField
        aria-label="เป้าแคลอรีต่อวัน (แตะเพื่อแก้)"
        data-testid="big-target"
        value={value}
        onChange={onChange}
        // Inline size: the global `input { font-size }` rule would beat a class.
        style={{ fontSize: 64 }}
        className="num mx-auto block w-full max-w-[260px] rounded-2xl border-2 border-dashed border-line bg-transparent text-center font-bold leading-tight outline-none focus:border-olive focus:bg-white"
      />
      <div className="text-[15px] text-muted">kcal/วัน · แตะตัวเลขเพื่อแก้เอง</div>
      {value != null && (value < 500 || value > 6000) && (
        <p className="mt-1 text-[13px] text-warn-ink">ใส่ค่าระหว่าง 500–6,000 kcal</p>
      )}
    </div>
  );
}

export const validKcal = (n: number | null): n is number => n != null && n >= 500 && n <= 6000;
