// Daily energy estimate for adults.
//
// 1) Resting energy (BMR) with the Mifflin–St Jeor equation:
//      female: 10 × kg + 6.25 × cm − 5 × age − 161
//      male:   10 × kg + 6.25 × cm − 5 × age + 5
//    Source: Mifflin MD, St Jeor ST, et al. "A new predictive equation for
//    resting energy expenditure in healthy individuals."
//    Am J Clin Nutr. 1990;51(2):241–247.
//
// 2) Maintenance = BMR × activity factor. The five standard factors
//    (1.2 / 1.375 / 1.55 / 1.725 / 1.9) are the widely used multipliers from
//    exercise-physiology texts (e.g. McArdle, Katch & Katch, Exercise
//    Physiology). The idea of a "physical activity level" comes from
//    FAO/WHO/UNU, Human Energy Requirements (2004).
//    Exercise frequency picks the standard level; daily life (on your feet,
//    heavy work) moves it up. The app always shows which level it used.
//
// 3) Weight goal: the user gives a target weight and a time (days/weeks/
//    months). Pace = kg ÷ weeks; kcal/day change = pace × 7,700 ÷ 7
//    (about 7,700 kcal ≈ 1 kg — a common rule of thumb; real change varies).
//    Safe pace limits for the suggestion: lose at most 1 kg/week AND at most
//    1% of body weight per week (NIH/NHLBI 1998 recommends ~0.5–1 kg/week);
//    gain at most 0.5 kg/week. If the chosen time is too short, the app uses
//    the safe pace and says how long it would really take.
//
// 4) Safety floor for the suggestion: not below 1,200 kcal (female) or
//    1,500 kcal (male) without medical supervision — from NIH/NHLBI
//    "Clinical Guidelines on the Identification, Evaluation, and Treatment
//    of Overweight and Obesity in Adults" (1998).
//
// Not for: under 18, pregnant, or breastfeeding. Those people can still set
// their own target by hand.

import type { DailyActivity, DurationUnit, ExerciseFreq, Profile } from "./types.ts";

export const DAILY_LABEL: Record<DailyActivity, string> = {
  sitting: "นั่งทำงาน/นั่งเป็นส่วนใหญ่",
  light: "เดินบ้างระหว่างวัน",
  standing: "ยืนหรือเดินเกือบทั้งวัน",
  physical: "ใช้แรงกายมาก (ยกของ งานหนัก)",
};

export const EXERCISE_LABEL: Record<ExerciseFreq, string> = {
  none: "ไม่ได้ออกกำลังกาย",
  "1-2": "1–2 วัน/สัปดาห์",
  "3-5": "3–5 วัน/สัปดาห์",
  "6-7": "6–7 วัน/สัปดาห์",
  twice: "วันละ 2 ครั้ง / ฝึกหนักมาก",
};
const EXERCISE_SCORE: Record<ExerciseFreq, number> = {
  none: 0,
  "1-2": 1,
  "3-5": 2,
  "6-7": 3,
  twice: 4,
};

export type ActivityLevel = { factor: number; label: string; description: string };

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { factor: 1.2, label: "น้อยมาก", description: "นั่งเป็นส่วนใหญ่ แทบไม่ออกกำลังกาย" },
  { factor: 1.375, label: "เบา", description: "ออกกำลังกายเบา ๆ 1–3 วัน/สัปดาห์" },
  { factor: 1.55, label: "ปานกลาง", description: "ออกกำลังกาย 3–5 วัน/สัปดาห์" },
  { factor: 1.725, label: "มาก", description: "ออกกำลังกายหนัก 6–7 วัน/สัปดาห์" },
  { factor: 1.9, label: "มากที่สุด", description: "งานใช้แรง + ฝึกหนักทุกวัน" },
];

/**
 * Combine daily life + exercise into one of the 5 standard levels.
 * The standard levels are defined by exercise frequency, so exercise sets the
 * starting level (none→1.2, 1–2→1.375, 3–5→1.55, 6–7→1.725, twice→1.9).
 * A job on your feet moves it up one level, heavy physical work up two.
 * Walking around during the day lifts "no exercise" to at least "light".
 */
export function activityLevel(daily: DailyActivity, exercise: ExerciseFreq): ActivityLevel {
  let idx = EXERCISE_SCORE[exercise]; // 0..4
  if (daily === "standing") idx += 1;
  if (daily === "physical") idx += 2;
  if (daily === "light" && idx === 0) idx = 1;
  return ACTIVITY_LEVELS[Math.min(4, idx)];
}

export const UNIT_TH: Record<DurationUnit, string> = { day: "วัน", week: "สัปดาห์", month: "เดือน" };

/** ~7,700 kcal ≈ 1 kg of body weight (rule of thumb). */
export const KCAL_PER_KG = 7700;
/** Safe pace limits used for the suggestion. */
export const MAX_LOSS_KG_PER_WEEK = 1;
export const MAX_LOSS_PCT_PER_WEEK = 0.01; // 1% of body weight per week
export const MAX_GAIN_KG_PER_WEEK = 0.5;
/** Within this many kg of the target counts as "keep my weight". */
const SAME_WEIGHT_KG = 0.3;

export function durationDays(n: number, unit: DurationUnit): number {
  return unit === "day" ? n : unit === "week" ? n * 7 : n * 30.44;
}

export type WeightPlan = {
  direction: "lose" | "gain" | "keep";
  changeKg: number; // positive number of kg to lose or gain
  days: number;
  wantedKgPerWeek: number; // pace the user asked for
  safeMaxKgPerWeek: number;
  usedKgPerWeek: number; // pace the suggestion actually uses
  tooFast: boolean;
  /** Shortest safe time, in whole weeks and months (rounded up). */
  safeWeeks: number;
  safeMonths: number;
  dailyDelta: number; // kcal/day added to maintenance (negative = eat less)
  targetBmi: number;
};

/** Turn "reach X kg within N days/weeks/months" into a kcal/day change. */
export function weightPlan(p: Profile): WeightPlan {
  const target = p.targetWeightKg > 0 ? p.targetWeightKg : p.weightKg;
  const diff = target - p.weightKg;
  const days = Math.max(1, durationDays(p.duration > 0 ? p.duration : 1, p.durationUnit));
  const targetBmi = target / (p.heightCm / 100) ** 2;
  if (Math.abs(diff) < SAME_WEIGHT_KG) {
    return {
      direction: "keep", changeKg: 0, days, wantedKgPerWeek: 0, safeMaxKgPerWeek: 0,
      usedKgPerWeek: 0, tooFast: false, safeWeeks: 0, safeMonths: 0, dailyDelta: 0, targetBmi,
    };
  }
  const direction = diff < 0 ? "lose" : "gain";
  const changeKg = Math.abs(diff);
  const wantedKgPerWeek = changeKg / (days / 7);
  const safeMaxKgPerWeek =
    direction === "lose"
      ? Math.min(MAX_LOSS_KG_PER_WEEK, MAX_LOSS_PCT_PER_WEEK * p.weightKg)
      : MAX_GAIN_KG_PER_WEEK;
  const tooFast = wantedKgPerWeek > safeMaxKgPerWeek + 1e-9;
  const usedKgPerWeek = Math.min(wantedKgPerWeek, safeMaxKgPerWeek);
  const safeWeeks = Math.ceil(changeKg / safeMaxKgPerWeek);
  const safeMonths = Math.ceil((changeKg / safeMaxKgPerWeek) * 7 / 30.44);
  const dailyDelta = ((direction === "lose" ? -1 : 1) * usedKgPerWeek * KCAL_PER_KG) / 7;
  return { direction, changeKg, days, wantedKgPerWeek, safeMaxKgPerWeek, usedKgPerWeek, tooFast, safeWeeks, safeMonths, dailyDelta, targetBmi };
}

export type EnergyResult =
  | {
      ok: true;
      bmr: number;
      level: ActivityLevel;
      maintenance: number;
      suggested: number;
      floor: number;
      floorApplied: boolean;
      plan: WeightPlan;
      steps: string[];
    }
  | { ok: false; reason: "not-adult" | "pregnant" | "breastfeeding" | "invalid"; message: string };

export function validateProfile(p: Profile): string | null {
  if (!(p.age >= 18 && p.age <= 100)) return "อายุควรอยู่ระหว่าง 18–100 ปี";
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return "ส่วนสูงควรอยู่ระหว่าง 120–230 ซม.";
  if (!(p.weightKg >= 30 && p.weightKg <= 300)) return "น้ำหนักควรอยู่ระหว่าง 30–300 กก.";
  if (!(p.targetWeightKg >= 30 && p.targetWeightKg <= 300)) return "น้ำหนักที่อยากเป็นควรอยู่ระหว่าง 30–300 กก.";
  if (Math.abs(p.targetWeightKg - p.weightKg) >= SAME_WEIGHT_KG) {
    if (!(p.duration > 0)) return "ใส่ระยะเวลาที่อยากให้ถึงเป้า";
    if (durationDays(p.duration, p.durationUnit) > 1100) return "ระยะเวลาไม่ควรเกินประมาณ 3 ปี";
  }
  return null;
}

export function bmrMifflin(sex: "female" | "male", kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

const fmt1 = (n: number) => (Math.round(n * 100) / 100).toString();

export function estimateEnergy(p: Profile): EnergyResult {
  if (p.age > 0 && p.age < 18)
    return {
      ok: false,
      reason: "not-adult",
      message: "การประเมินอัตโนมัตินี้ใช้กับผู้ใหญ่ 18 ปีขึ้นไปเท่านั้น ใช้ไดอารีและสูตรได้ตามปกติ และตั้งเป้าเองได้ (ควรปรึกษาแพทย์หรือนักโภชนาการ)",
    };
  if (p.pregnant)
    return {
      ok: false,
      reason: "pregnant",
      message: "ช่วงตั้งครรภ์ต้องการพลังงานต่างจากสมการนี้ แอปจึงไม่ประเมินให้ ใช้ไดอารีและสูตรได้ตามปกติ และตั้งเป้าเองตามคำแนะนำของแพทย์",
    };
  if (p.breastfeeding)
    return {
      ok: false,
      reason: "breastfeeding",
      message: "ช่วงให้นมต้องการพลังงานต่างจากสมการนี้ แอปจึงไม่ประเมินให้ ใช้ไดอารีและสูตรได้ตามปกติ และตั้งเป้าเองตามคำแนะนำของแพทย์",
    };
  const bad = validateProfile(p);
  if (bad) return { ok: false, reason: "invalid", message: bad };

  const bmr = bmrMifflin(p.sex, p.weightKg, p.heightCm, p.age);
  const level = activityLevel(p.daily, p.exercise);
  const maintenance = bmr * level.factor;
  const plan = weightPlan(p);
  const floor = p.sex === "male" ? 1500 : 1200;
  const raw = maintenance + plan.dailyDelta;
  const floorApplied = raw < floor;
  const suggested = Math.round(Math.max(raw, floor) / 10) * 10;
  const sexTerm = p.sex === "male" ? "+ 5" : "− 161";
  const steps = [
    `BMR = 10 × ${p.weightKg} + 6.25 × ${p.heightCm} − 5 × ${p.age} ${sexTerm} = ${Math.round(bmr)} kcal`,
    `ระดับกิจกรรม "${level.label}" × ${level.factor} → รักษาน้ำหนัก ≈ ${Math.round(maintenance)} kcal/วัน`,
  ];
  if (plan.direction === "keep") {
    steps.push(`เป้าหมายคือรักษาน้ำหนัก (+0) → ${Math.round(raw)} kcal/วัน`);
  } else {
    const verb = plan.direction === "lose" ? "ลด" : "เพิ่ม";
    steps.push(
      `${verb} ${fmt1(plan.changeKg)} กก. ใน ${p.duration} ${UNIT_TH[p.durationUnit]} ≈ ${fmt1(plan.wantedKgPerWeek)} กก./สัปดาห์`,
    );
    if (plan.tooFast)
      steps.push(`เร็วเกินไป ใช้ความเร็วที่ปลอดภัย ${fmt1(plan.usedKgPerWeek)} กก./สัปดาห์ แทน`);
    steps.push(
      `${fmt1(plan.usedKgPerWeek)} กก./สัปดาห์ × 7,700 ÷ 7 ≈ ${plan.dailyDelta >= 0 ? "+" : "−"}${Math.round(Math.abs(plan.dailyDelta))} kcal/วัน → ${Math.round(raw)} kcal/วัน`,
    );
  }
  if (floorApplied) steps.push(`ปรับขึ้นเป็นขั้นต่ำ ${floor} kcal/วัน เพื่อความปลอดภัย`);
  return { ok: true, bmr, level, maintenance: Math.round(maintenance), suggested, floor, floorApplied, plan, steps };
}

/** Simple default split so the macro cards have a target: 20% P / 50% C / 30% F. */
export function macroTargets(kcal: number) {
  return {
    protein: (kcal * 0.2) / 4,
    carbs: (kcal * 0.5) / 4,
    fat: (kcal * 0.3) / 9,
  };
}
