"use client";
// Form pieces shared by first-run setup (/welcome) and the Profile page.

import { NumberField } from "./ui";
import { BMI_LABEL, BMI_NOTE, bmiInfo, DAILY_LABEL, DURATION_UNIT, EXERCISE_LABEL, REASON_LABEL, estimateEnergy, paceAtTarget, safeFloor, usesWeightGoal, validateProfile, type BmiLevel, type EnergyResult, type WeightPlan } from "../lib/energy";
import { shiftDateKey, thaiDateKey, thaiDateLabel } from "../lib/date";
import { pickAll, trFor, type Lang } from "../lib/i18n";
import { useLang } from "../lib/lang";
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
  const { tr } = useLang();
  return (
    <div>
      <label className="label" htmlFor="name">{tr("ชื่อ", "Name")}</label>
      <input
        id="name"
        className="field"
        value={p.name ?? ""}
        maxLength={30}
        autoComplete="given-name"
        placeholder={tr("เช่น ยานี่", "e.g. Yani")}
        onChange={(e) => set({ name: e.target.value })}
      />
    </div>
  );
}

export function BodyFields({ p, set }: { p: Profile; set: SetP }) {
  const { tr } = useLang();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="age">{tr("อายุ (ปี)", "Age (years)")}</label>
          <NumberField id="age" value={p.age || null} onChange={(n) => set({ age: n ?? 0 })} />
        </div>
        <div>
          <label className="label" htmlFor="height">{tr("ส่วนสูง (ซม.)", "Height (cm)")}</label>
          <NumberField id="height" value={p.heightCm || null} onChange={(n) => set({ heightCm: n ?? 0 })} />
        </div>
        <div>
          <label className="label" htmlFor="weight">{tr("น้ำหนัก (กก.)", "Weight (kg)")}</label>
          <NumberField id="weight" value={p.weightKg || null} onChange={(n) => set({ weightKg: n ?? 0 })} />
        </div>
      </div>
      <div>
        <span className="label">{tr("เพศของคุณ", "Your sex")}</span>
        <Choice<Sex> value={p.sex} options={{ female: tr("หญิง", "Female"), male: tr("ชาย", "Male") }} onChange={(v) => set({ sex: v })} cols={2} />
      </div>
      <BmiCard heightCm={p.heightCm} weightKg={p.weightKg} />
    </div>
  );
}

const BMI_TONE: Record<BmiLevel, string> = {
  under: "bg-[#dde7f0] text-[#2f5577]",
  normal: "bg-[#e6ecd6] text-[#4f6326]",
  over: "bg-warn text-warn-ink",
  obese1: "bg-[#f6ddd6] text-[#9a3b2a]",
  obese2: "bg-[#f6ddd6] text-[#9a3b2a]",
};

/** BMI from height + weight, with the Asian / Thai cut-offs. Hidden until both numbers make sense. */
export function BmiCard({ heightCm, weightKg }: { heightCm: number; weightKg: number }) {
  const { tr, lang } = useLang();
  const b = bmiInfo(heightCm, weightKg);
  if (!b) return null;
  return (
    <div className="rounded-2xl bg-paper px-4 py-3" data-testid="bmi-card">
      <div className="text-[15px]">
        {tr("ดัชนีมวลกาย (BMI) ของคุณ", "Your Body Mass Index (BMI)")}: <b className="num">{b.bmi.toFixed(1)}</b>
      </div>
      <span className={`mt-2 inline-block rounded-full px-3 py-1 text-[14px] font-semibold ${BMI_TONE[b.level]}`}>{BMI_LABEL[b.level][lang]}</span>
      <p className="mt-2 text-[14px] text-muted">{BMI_NOTE[b.level][lang]}</p>
      <p className="mt-1 text-[12px] text-muted">
        {tr("เกณฑ์สำหรับคนเอเชีย: ปกติ 18.5–22.9", "Asian cut-offs: healthy range 18.5–22.9")}
      </p>
    </div>
  );
}

/** Problem with the body numbers, or null. Under 18 is allowed (no automatic suggestion later). */
export function bodyProblem(p: Profile, lang: Lang = "th"): string | null {
  const t = trFor(lang);
  if (!(p.age >= 1 && p.age <= 100)) return t("ใส่อายุ (1–100 ปี)", "Enter your age (1–100)");
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return t("ใส่ส่วนสูง (120–230 ซม.)", "Enter your height (120–230 cm)");
  if (!(p.weightKg >= 30 && p.weightKg <= 300)) return t("ใส่น้ำหนัก (30–300 กก.)", "Enter your weight (30–300 kg)");
  return null;
}

/** Problem with the reason step, or null. Age is checked elsewhere. */
export function reasonProblem(p: Profile, lang: Lang = "th"): string | null {
  const t = trFor(lang);
  if (!p.reason) return t("เลือกเหตุผลหนึ่งข้อ", "Pick one reason");
  if (!usesWeightGoal(p.reason)) return null;
  if (!(p.targetWeightKg > 0)) return t("ใส่น้ำหนักที่ต้องการ", "Enter your goal weight");
  return validateProfile({ ...p, age: Math.max(18, p.age) }, lang);
}

export function ActivityFields({ p, set }: { p: Profile; set: SetP }) {
  const { tr, lang } = useLang();
  return (
    <div className="space-y-4">
      <div>
        <span className="label">{tr("ชีวิตประจำวัน (ไม่นับออกกำลังกาย)", "Daily life (not counting exercise)")}</span>
        <Choice<DailyActivity> value={p.daily} options={pickAll(DAILY_LABEL, lang)} onChange={(v) => set({ daily: v })} />
      </div>
      <div>
        <span className="label">{tr("ออกกำลังกายบ่อยแค่ไหน", "How often do you exercise?")}</span>
        <Choice<ExerciseFreq> value={p.exercise} options={pickAll(EXERCISE_LABEL, lang)} onChange={(v) => set({ exercise: v })} />
      </div>
    </div>
  );
}

export function ReasonFields({ p, set, plan }: { p: Profile; set: SetP; plan: WeightPlan | null }) {
  const { tr, lang } = useLang();
  return (
    <div className="space-y-4">
      <Choice<Reason>
        value={p.reason}
        options={pickAll(REASON_LABEL, lang)}
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
          {tr(
            "แอปจะเผื่อพลังงานเพิ่มเล็กน้อย (+10%) และตั้งเป้าโปรตีนประมาณ 1.6 g ต่อน้ำหนักตัว 1 กก.",
            "The app adds a little extra energy (+10%) and sets a protein goal of about 1.6 g per kg of body weight.",
          )}
        </p>
      )}
      {usesWeightGoal(p.reason) && p.reason && (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="target-weight">{tr("น้ำหนักที่ต้องการ (กก.)", "Goal weight (kg)")}</label>
            <NumberField id="target-weight" value={p.targetWeightKg || null} onChange={(n) => set({ targetWeightKg: n ?? 0 })} />
          </div>
          <div>
            <label className="label" htmlFor="duration">{tr("ภายในเวลา", "Within")}</label>
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
                    {DURATION_UNIT[u][lang]}
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

/**
 * Phase 1: when the safe minimum raised the suggestion, say so plainly (what the plan needed, what is used,
 * where the 1,200 / 1,500 comes from, and that it is general information, not medical advice).
 */
export function FloorNote({ result }: { result: EnergyResult | null }) {
  const { tr } = useLang();
  if (!result?.ok || !result.floorApplied) return null;
  return (
    <p className="rounded-2xl bg-warn px-4 py-3 text-[14px] text-warn-ink" role="note" data-testid="floor-note">
      {tr(
        `แผนที่ตั้งไว้ต้องกินประมาณ ${Math.round(result.rawTarget).toLocaleString("en-US")} kcal/วัน ซึ่งต่ำกว่าขั้นต่ำที่นิยมใช้ (${result.floor.toLocaleString("en-US")} kcal สำหรับผู้ใหญ่ที่ไม่มีแพทย์ดูแล) แอปจึงปรับเป็น ${result.suggested.toLocaleString("en-US")} kcal แทน น้ำหนักจะลดช้ากว่าที่ตั้งเวลาไว้ ค่านี้เป็นข้อมูลทั่วไป ไม่ใช่คำแนะนำทางการแพทย์ ถ้ามีโรคประจำตัวควรปรึกษาแพทย์`,
        `Your plan would need about ${Math.round(result.rawTarget).toLocaleString("en-US")} kcal/day, which is below the usual minimum (${result.floor.toLocaleString("en-US")} kcal for adults without a doctor's supervision). So the app raised it to ${result.suggested.toLocaleString("en-US")} kcal. Your weight will change more slowly than the time you set. This is general information, not medical advice — if you have a health condition, please ask a doctor.`,
      )}
    </p>
  );
}

/** Phase 1: a gentle warning (never a block) when a target typed by hand is below the usual minimum. */
export function LowTargetNote({ value, sex }: { value: number | null; sex?: Sex }) {
  const { tr } = useLang();
  const floor = safeFloor(sex);
  if (value == null || value < 500 || value >= floor) return null;
  return (
    <p className="mt-1 text-[13px] text-warn-ink" role="note" data-testid="low-target-note">
      {tr(
        `ต่ำกว่าขั้นต่ำที่นิยมใช้ (${floor.toLocaleString("en-US")} kcal/วัน สำหรับผู้ใหญ่ที่ไม่มีแพทย์ดูแล · NIH/NHLBI 1998) ใช้ได้ถ้าคุณตั้งใจ แต่ควรปรึกษาแพทย์หรือนักโภชนาการ ค่านี้เป็นข้อมูลทั่วไป ไม่ใช่คำแนะนำทางการแพทย์`,
        `Below the usual minimum (${floor.toLocaleString("en-US")} kcal/day for adults without a doctor's supervision · NIH/NHLBI 1998). You can still use it if you mean to, but please talk to a doctor or dietitian. This is general information, not medical advice.`,
      )}
    </p>
  );
}

export function PlanSummary({ p, plan, onUseSafe, targetKcal }: { p: Profile; plan: WeightPlan; onUseSafe: (months: number) => void; targetKcal?: number }) {
  const { tr, lang } = useLang();
  const today = thaiDateKey();
  if (plan.direction === "keep") {
    return (
      <p className="rounded-2xl bg-paper px-4 py-3 text-[15px]" data-testid="plan-summary">
        {tr("แผน", "Plan")}: <b>{tr("รักษาน้ำหนัก", "Keep my weight")}</b> {tr("ไว้ที่", "at")} {kg(p.weightKg)} {tr("กก.", "kg")}
      </p>
    );
  }
  const verb = plan.direction === "lose" ? tr("ลด", "Lose") : tr("เพิ่ม", "Gain");
  const kgU = tr("กก.", "kg");
  const kgWk = tr("กก./สัปดาห์", "kg/week");
  const plannedDays = plan.tooFast ? plan.safeWeeks * 7 : plan.days;
  // Phase 1: the date must follow the calories she will really eat (after the safe minimum, or her own
  // number), not only the planned pace. Small differences (rounding to 10 kcal) keep the planned date.
  const est = estimateEnergy(p, lang);
  const used = targetKcal ?? (est.ok ? est.suggested : null);
  const pace = est.ok && used != null ? paceAtTarget(est.maintenance, used, plan) : null;
  const differs = pace != null && plan.usedKgPerWeek > 0 && Math.abs(pace.kgPerWeek - plan.usedKgPerWeek) / plan.usedKgPerWeek > 0.05;
  const shownKgWk = differs ? pace!.kgPerWeek : plan.usedKgPerWeek;
  const noMove = differs && pace!.days == null;
  const reachDays = differs && pace!.days != null ? pace!.days : plannedDays;
  return (
    <div className="space-y-2" data-testid="plan-summary">
      <div className="rounded-2xl bg-paper px-4 py-3 text-[15px]">
        <div>
          {tr("แผน", "Plan")}: <b>{verb} {kg(plan.changeKg)} {kgU}</b> ({kg(p.weightKg)} → {kg(p.targetWeightKg)} {kgU}) {tr("ภายใน", "within")} {p.duration}{" "}
          {DURATION_UNIT[p.durationUnit][lang]}
        </div>
        <div className="text-muted">
          ≈ {kg(shownKgWk)} {kgWk} ·{" "}
          {noMove
            ? tr("ด้วยเป้านี้น้ำหนักไม่น่าจะเปลี่ยนไปทางเป้าหมาย", "with this target your weight is not expected to move toward the goal")
            : <>{tr("ถึงเป้าประมาณ", "reach your goal around")} {thaiDateLabel(shiftDateKey(today, Math.round(reachDays)), lang)}</>}
        </div>
        {differs && used != null && (
          <div className="mt-1 text-[13px] text-muted" data-testid="plan-effective-note">
            {tr(
              `คิดจากเป้า ${Math.round(used).toLocaleString("en-US")} kcal/วัน ที่ใช้จริง (ไม่ใช่เวลาที่ตั้งไว้)`,
              `Worked out from the ${Math.round(used).toLocaleString("en-US")} kcal/day target actually used (not the time you set)`,
            )}
          </div>
        )}
      </div>
      {est.ok && est.floorApplied && targetKcal == null && <FloorNote result={est} />}
      {plan.tooFast && (
        <div className="space-y-2 rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">
          <p>
            {lang === "en" ? (
              <>
                Too fast for your body: you would need to {verb.toLowerCase()} {kg(plan.wantedKgPerWeek)} kg/week, but it should be no more
                than {kg(plan.safeMaxKgPerWeek)} kg/week — it should take at least about <b>{plan.safeMonths} months</b> ({plan.safeWeeks}{" "}
                weeks), so the app uses the safe pace instead.
              </>
            ) : (
              <>
                เร็วเกินไปสำหรับร่างกาย: ต้อง{verb} {kg(plan.wantedKgPerWeek)} กก./สัปดาห์ แต่ไม่ควรเกิน {kg(plan.safeMaxKgPerWeek)} กก./สัปดาห์
                — ควรใช้เวลาอย่างน้อยประมาณ <b>{plan.safeMonths} เดือน</b> ({plan.safeWeeks} สัปดาห์) แอปจึงคำนวณด้วยความเร็วที่ปลอดภัยแทน
              </>
            )}
          </p>
          <button type="button" className="btn-soft !min-h-[44px]" onClick={() => onUseSafe(plan.safeMonths)}>
            {tr(`เปลี่ยนเป็น ${plan.safeMonths} เดือน`, `Change to ${plan.safeMonths} months`)}
          </button>
        </div>
      )}
      {plan.direction === "lose" && plan.targetBmi < 18.5 && (
        <p className="rounded-2xl bg-warn px-4 py-3 text-[15px] text-warn-ink" role="alert">
          {tr(
            `น้ำหนักที่ต้องการนี้ทำให้ BMI ≈ ${kg(plan.targetBmi)} ซึ่งต่ำกว่าเกณฑ์ปกติ (18.5) ควรปรึกษาแพทย์ก่อนตั้งเป้านี้`,
            `This goal weight gives a BMI of about ${kg(plan.targetBmi)}, which is below the normal range (18.5). Please talk to a doctor before setting this goal.`,
          )}
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
  sex,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  caption: string;
  sex?: Sex;
}) {
  const { tr } = useLang();
  return (
    <div className="text-center">
      <div className="text-[15px] text-muted">{caption}</div>
      <NumberField
        aria-label={tr("เป้าแคลอรีต่อวัน (แตะเพื่อแก้)", "Daily calorie target (tap to edit)")}
        data-testid="big-target"
        value={value}
        onChange={onChange}
        // Inline size: the global `input { font-size }` rule would beat a class.
        style={{ fontSize: 64 }}
        className="num mx-auto block w-full max-w-[260px] rounded-2xl border-2 border-dashed border-line bg-transparent text-center font-bold leading-tight outline-none focus:border-olive focus:bg-white"
      />
      <div className="text-[15px] text-muted">{tr("kcal/วัน · แตะตัวเลขเพื่อแก้เอง", "kcal/day · tap the number to change it")}</div>
      {value != null && (value < 500 || value > 6000) && (
        <p className="mt-1 text-[13px] text-warn-ink">{tr("ใส่ค่าระหว่าง 500–6,000 kcal", "Enter a number from 500 to 6,000 kcal")}</p>
      )}
      <LowTargetNote value={value} sex={sex} />
    </div>
  );
}

export const validKcal = (n: number | null): n is number => n != null && n >= 500 && n <= 6000;
