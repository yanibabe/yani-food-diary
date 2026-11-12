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
// 3) Weight goal: about 7,700 kcal ≈ 1 kg body weight (a common rule of
//    thumb; real change varies person to person).
//    0.25 kg/week ≈ 275 kcal/day, 0.5 kg/week ≈ 550 kcal/day.
//
// 4) Safety floor for the suggestion: not below 1,200 kcal (female) or
//    1,500 kcal (male) without medical supervision — from NIH/NHLBI
//    "Clinical Guidelines on the Identification, Evaluation, and Treatment
//    of Overweight and Obesity in Adults" (1998).
//
// Not for: under 18, pregnant, or breastfeeding. Those people can still set
// their own target by hand.

import type { DailyActivity, ExerciseFreq, Profile, WeightGoal } from "./types.ts";

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

export const GOAL_LABEL: Record<WeightGoal, string> = {
  "lose-0.5": "ลดน้ำหนัก ~0.5 กก./สัปดาห์",
  "lose-0.25": "ลดน้ำหนัก ~0.25 กก./สัปดาห์",
  maintain: "รักษาน้ำหนัก",
  "gain-0.25": "เพิ่มน้ำหนัก ~0.25 กก./สัปดาห์",
};
export const GOAL_DELTA: Record<WeightGoal, number> = {
  "lose-0.5": -550,
  "lose-0.25": -275,
  maintain: 0,
  "gain-0.25": 275,
};

export type EnergyResult =
  | {
      ok: true;
      bmr: number;
      level: ActivityLevel;
      maintenance: number;
      suggested: number;
      floor: number;
      floorApplied: boolean;
      steps: string[];
    }
  | { ok: false; reason: "not-adult" | "pregnant" | "breastfeeding" | "invalid"; message: string };

export function validateProfile(p: Profile): string | null {
  if (!(p.age >= 18 && p.age <= 100)) return "อายุควรอยู่ระหว่าง 18–100 ปี";
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return "ส่วนสูงควรอยู่ระหว่าง 120–230 ซม.";
  if (!(p.weightKg >= 30 && p.weightKg <= 300)) return "น้ำหนักควรอยู่ระหว่าง 30–300 กก.";
  return null;
}

export function bmrMifflin(sex: "female" | "male", kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

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
  const floor = p.sex === "male" ? 1500 : 1200;
  const raw = maintenance + GOAL_DELTA[p.goal];
  const floorApplied = raw < floor;
  const suggested = Math.round(Math.max(raw, floor) / 10) * 10;
  const sexTerm = p.sex === "male" ? "+ 5" : "− 161";
  const steps = [
    `BMR = 10 × ${p.weightKg} + 6.25 × ${p.heightCm} − 5 × ${p.age} ${sexTerm} = ${Math.round(bmr)} kcal`,
    `ระดับกิจกรรม "${level.label}" × ${level.factor} → รักษาน้ำหนัก ≈ ${Math.round(maintenance)} kcal/วัน`,
    `${GOAL_LABEL[p.goal]} (${GOAL_DELTA[p.goal] >= 0 ? "+" : "−"}${Math.abs(GOAL_DELTA[p.goal])}) → ${Math.round(raw)} kcal/วัน`,
  ];
  if (floorApplied) steps.push(`ปรับขึ้นเป็นขั้นต่ำ ${floor} kcal/วัน เพื่อความปลอดภัย`);
  return {
    ok: true,
    bmr,
    level,
    maintenance: Math.round(maintenance),
    suggested,
    floor,
    floorApplied,
    steps,
  };
}

/** Simple default split so the macro cards have a target: 20% P / 50% C / 30% F. */
export function macroTargets(kcal: number) {
  return {
    protein: (kcal * 0.2) / 4,
    carbs: (kcal * 0.5) / 4,
    fat: (kcal * 0.3) / 9,
  };
}
