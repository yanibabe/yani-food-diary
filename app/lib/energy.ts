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
// 3b) Reason for using the app:
//    lose / gain → the target weight + time plan above.
//    maintain    → maintenance, no change.
//    build muscle → a small surplus (+10% of maintenance) and a protein
//    target of 1.6 g per kg body weight per day. The ISSN position stand on
//    protein and exercise (Jäger R, et al. J Int Soc Sports Nutr.
//    2017;14:20) recommends 1.4–2.0 g/kg/day for people who exercise.
//
// 4) Safety floor for the suggestion: not below 1,200 kcal (female) or
//    1,500 kcal (male) without medical supervision — from NIH/NHLBI
//    "Clinical Guidelines on the Identification, Evaluation, and Treatment
//    of Overweight and Obesity in Adults" (1998).
//
// Not for: under 18, pregnant, or breastfeeding. Those people can still set
// their own target by hand.

import { trFor, type L, type Lang } from "./i18n.ts";
import type { DailyActivity, DurationUnit, ExerciseFreq, Profile, Reason } from "./types.ts";

export const REASON_LABEL: Record<Reason, L> = {
  lose: { th: "ลดน้ำหนัก", en: "Lose weight" },
  muscle: { th: "เพิ่มกล้ามเนื้อ", en: "Build muscle" },
  gain: { th: "เพิ่มน้ำหนัก", en: "Gain weight" },
  maintain: { th: "รักษาน้ำหนัก", en: "Keep my weight" },
};

/** Build muscle: +10% of maintenance, protein 1.6 g/kg/day (ISSN 2017: 1.4–2.0). */
export const MUSCLE_SURPLUS = 0.1;
export const MUSCLE_PROTEIN_G_PER_KG = 1.6;

/** lose/gain use the target weight + time; maintain/muscle stay at today's weight. */
export function usesWeightGoal(reason: Reason | undefined): boolean {
  return reason !== "maintain" && reason !== "muscle";
}

/** Protein target in grams/day, only for "build muscle". */
export function proteinTargetG(p: Profile | null): number | null {
  if (!p || p.reason !== "muscle" || !(p.weightKg > 0)) return null;
  return Math.round(p.weightKg * MUSCLE_PROTEIN_G_PER_KG);
}

export const DAILY_LABEL: Record<DailyActivity, L> = {
  sitting: { th: "นั่งทำงาน/นั่งเป็นส่วนใหญ่", en: "Sitting most of the day (desk work)" },
  light: { th: "เดินบ้างระหว่างวัน", en: "Walking around a bit during the day" },
  standing: { th: "ยืนหรือเดินเกือบทั้งวัน", en: "Standing or walking most of the day" },
  physical: { th: "ใช้แรงกายมาก (ยกของ งานหนัก)", en: "Heavy physical work (lifting, labor)" },
};

export const EXERCISE_LABEL: Record<ExerciseFreq, L> = {
  none: { th: "ไม่ได้ออกกำลังกาย", en: "No exercise" },
  "1-2": { th: "1–2 วัน/สัปดาห์", en: "1–2 days a week" },
  "3-5": { th: "3–5 วัน/สัปดาห์", en: "3–5 days a week" },
  "6-7": { th: "6–7 วัน/สัปดาห์", en: "6–7 days a week" },
  twice: { th: "วันละ 2 ครั้ง / ฝึกหนักมาก", en: "Twice a day / very hard training" },
};
const EXERCISE_SCORE: Record<ExerciseFreq, number> = {
  none: 0,
  "1-2": 1,
  "3-5": 2,
  "6-7": 3,
  twice: 4,
};

export type ActivityLevel = { factor: number; label: L; description: L };

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { factor: 1.2, label: { th: "น้อยมาก", en: "Very low" }, description: { th: "นั่งเป็นส่วนใหญ่ แทบไม่ออกกำลังกาย", en: "Mostly sitting, almost no exercise" } },
  { factor: 1.375, label: { th: "เบา", en: "Light" }, description: { th: "ออกกำลังกายเบา ๆ 1–3 วัน/สัปดาห์", en: "Light exercise 1–3 days a week" } },
  { factor: 1.55, label: { th: "ปานกลาง", en: "Moderate" }, description: { th: "ออกกำลังกาย 3–5 วัน/สัปดาห์", en: "Exercise 3–5 days a week" } },
  { factor: 1.725, label: { th: "มาก", en: "High" }, description: { th: "ออกกำลังกายหนัก 6–7 วัน/สัปดาห์", en: "Hard exercise 6–7 days a week" } },
  { factor: 1.9, label: { th: "มากที่สุด", en: "Very high" }, description: { th: "งานใช้แรง + ฝึกหนักทุกวัน", en: "Physical job + hard training every day" } },
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

export const DURATION_UNIT: Record<DurationUnit, L> = {
  day: { th: "วัน", en: "days" },
  week: { th: "สัปดาห์", en: "weeks" },
  month: { th: "เดือน", en: "months" },
};

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
      /** Protein target (g/day) for "build muscle", otherwise null. */
      proteinG: number | null;
      steps: string[];
    }
  | { ok: false; reason: "not-adult" | "pregnant" | "breastfeeding" | "invalid"; message: string };

export function validateProfile(p: Profile, lang: Lang = "th"): string | null {
  const t = trFor(lang);
  if (!(p.age >= 18 && p.age <= 100)) return t("อายุควรอยู่ระหว่าง 18–100 ปี", "Age should be 18–100 years");
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return t("ส่วนสูงควรอยู่ระหว่าง 120–230 ซม.", "Height should be 120–230 cm");
  if (!(p.weightKg >= 30 && p.weightKg <= 300)) return t("น้ำหนักควรอยู่ระหว่าง 30–300 กก.", "Weight should be 30–300 kg");
  if (!usesWeightGoal(p.reason)) return null;
  if (!(p.targetWeightKg >= 30 && p.targetWeightKg <= 300))
    return t("น้ำหนักที่ต้องการควรอยู่ระหว่าง 30–300 กก.", "Goal weight should be 30–300 kg");
  if (p.reason === "lose" && p.targetWeightKg > p.weightKg - SAME_WEIGHT_KG)
    return t("อยากลดน้ำหนัก: น้ำหนักที่ต้องการต้องน้อยกว่าน้ำหนักตอนนี้", "To lose weight, your goal weight must be less than your weight now");
  if (p.reason === "gain" && p.targetWeightKg < p.weightKg + SAME_WEIGHT_KG)
    return t("อยากเพิ่มน้ำหนัก: น้ำหนักที่ต้องการต้องมากกว่าน้ำหนักตอนนี้", "To gain weight, your goal weight must be more than your weight now");
  if (Math.abs(p.targetWeightKg - p.weightKg) >= SAME_WEIGHT_KG) {
    if (!(p.duration > 0)) return t("ใส่ระยะเวลาที่อยากให้ถึงเป้า", "Enter how long you want to take");
    if (durationDays(p.duration, p.durationUnit) > 1100) return t("ระยะเวลาไม่ควรเกินประมาณ 3 ปี", "The time should be no more than about 3 years");
  }
  return null;
}

export function bmrMifflin(sex: "female" | "male", kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

const fmt1 = (n: number) => (Math.round(n * 100) / 100).toString();

export function estimateEnergy(p: Profile, lang: Lang = "th"): EnergyResult {
  const t = trFor(lang);
  if (p.age > 0 && p.age < 18)
    return {
      ok: false,
      reason: "not-adult",
      message: t(
        "การประเมินอัตโนมัตินี้ใช้กับผู้ใหญ่ 18 ปีขึ้นไปเท่านั้น ใช้ไดอารีและสูตรได้ตามปกติ และตั้งเป้าเองได้ (ควรปรึกษาแพทย์หรือนักโภชนาการ)",
        "This automatic estimate is for adults 18 and over only. You can still use the diary and recipes, and set your own target (please ask a doctor or dietitian).",
      ),
    };
  if (p.pregnant || p.breastfeeding)
    return {
      ok: false,
      reason: p.pregnant ? "pregnant" : "breastfeeding",
      message: t(
        "ช่วงตั้งครรภ์หรือให้นมลูกต้องการพลังงานต่างจากสมการนี้ แอปจึงไม่ประเมินให้ ใช้ไดอารีและสูตรได้ตามปกติ และตั้งเป้าเองตามคำแนะนำของแพทย์",
        "Pregnancy and breastfeeding need different energy than this formula, so the app does not estimate it. You can still use the diary and recipes, and set your own target with your doctor's advice.",
      ),
    };
  const bad = validateProfile(p, lang);
  if (bad) return { ok: false, reason: "invalid", message: bad };

  const bmr = bmrMifflin(p.sex, p.weightKg, p.heightCm, p.age);
  const level = activityLevel(p.daily, p.exercise);
  const maintenance = bmr * level.factor;
  // maintain / build muscle: no weight change planned.
  const plan = weightPlan(usesWeightGoal(p.reason) ? p : { ...p, targetWeightKg: p.weightKg });
  const muscle = p.reason === "muscle";
  const surplus = muscle ? maintenance * MUSCLE_SURPLUS : 0;
  const floor = p.sex === "male" ? 1500 : 1200;
  const raw = maintenance + plan.dailyDelta + surplus;
  const floorApplied = raw < floor;
  const suggested = Math.round(Math.max(raw, floor) / 10) * 10;
  const sexTerm = p.sex === "male" ? "+ 5" : "− 161";
  const steps = [
    `BMR = 10 × ${p.weightKg} + 6.25 × ${p.heightCm} − 5 × ${p.age} ${sexTerm} = ${Math.round(bmr)} kcal`,
    t(
      `ระดับกิจกรรม "${level.label.th}" × ${level.factor} → รักษาน้ำหนัก ≈ ${Math.round(maintenance)} kcal/วัน`,
      `Activity level "${level.label.en}" × ${level.factor} → keep weight ≈ ${Math.round(maintenance)} kcal/day`,
    ),
  ];
  const day = t("kcal/วัน", "kcal/day");
  const kgWk = t("กก./สัปดาห์", "kg/week");
  if (muscle) {
    steps.push(t(`เพิ่มกล้ามเนื้อ: +10% ≈ +${Math.round(surplus)} kcal/วัน → ${Math.round(raw)} kcal/วัน`, `Build muscle: +10% ≈ +${Math.round(surplus)} kcal/day → ${Math.round(raw)} kcal/day`));
    steps.push(t(`โปรตีน ${MUSCLE_PROTEIN_G_PER_KG} g × ${p.weightKg} กก. ≈ ${proteinTargetG(p)} g/วัน`, `Protein ${MUSCLE_PROTEIN_G_PER_KG} g × ${p.weightKg} kg ≈ ${proteinTargetG(p)} g/day`));
  } else if (plan.direction === "keep") {
    steps.push(t(`เป้าหมายคือรักษาน้ำหนัก (+0) → ${Math.round(raw)} kcal/วัน`, `Goal is to keep your weight (+0) → ${Math.round(raw)} kcal/day`));
  } else {
    const verb = plan.direction === "lose" ? t("ลด", "Lose") : t("เพิ่ม", "Gain");
    steps.push(
      `${verb} ${fmt1(plan.changeKg)} ${t("กก. ใน", "kg in")} ${p.duration} ${DURATION_UNIT[p.durationUnit][lang]} ≈ ${fmt1(plan.wantedKgPerWeek)} ${kgWk}`,
    );
    if (plan.tooFast)
      steps.push(t(`เร็วเกินไป ใช้ความเร็วที่ปลอดภัย ${fmt1(plan.usedKgPerWeek)} กก./สัปดาห์ แทน`, `Too fast — using the safe pace of ${fmt1(plan.usedKgPerWeek)} kg/week instead`));
    steps.push(
      `${fmt1(plan.usedKgPerWeek)} ${kgWk} × 7,700 ÷ 7 ≈ ${plan.dailyDelta >= 0 ? "+" : "−"}${Math.round(Math.abs(plan.dailyDelta))} ${day} → ${Math.round(raw)} ${day}`,
    );
  }
  if (floorApplied) steps.push(t(`ปรับขึ้นเป็นขั้นต่ำ ${floor} kcal/วัน เพื่อความปลอดภัย`, `Raised to the safe minimum of ${floor} kcal/day`));
  return { ok: true, bmr, level, maintenance: Math.round(maintenance), suggested, floor, floorApplied, plan, proteinG: proteinTargetG(p), steps };
}

/**
 * Macro targets for the cards. Default split 20% P / 50% C / 30% F.
 * With a protein target (build muscle): protein = that many grams,
 * fat stays 30% of kcal, carbs get the rest.
 */
export function macroTargets(kcal: number, proteinG: number | null = null) {
  if (proteinG != null) {
    return {
      protein: proteinG,
      carbs: Math.max(0, kcal - proteinG * 4 - kcal * 0.3) / 4,
      fat: (kcal * 0.3) / 9,
    };
  }
  return {
    protein: (kcal * 0.2) / 4,
    carbs: (kcal * 0.5) / 4,
    fat: (kcal * 0.3) / 9,
  };
}

// ---- BMI (Asian / Thai cut-offs, WHO Western Pacific 2000) ----
export type BmiLevel = "under" | "normal" | "over" | "obese1" | "obese2";

export const BMI_LABEL: Record<BmiLevel, L> = {
  under: { th: "น้ำหนักน้อย", en: "Underweight" },
  normal: { th: "ปกติ", en: "Healthy" },
  over: { th: "น้ำหนักเกิน", en: "Overweight" },
  obese1: { th: "อ้วนระดับ 1", en: "Obese 1" },
  obese2: { th: "อ้วนระดับ 2", en: "Obese 2" },
};

export const BMI_NOTE: Record<BmiLevel, L> = {
  under: { th: "น้ำหนักต่ำกว่าเกณฑ์ ลองเพิ่มน้ำหนักอย่างค่อยเป็นค่อยไป", en: "Below the healthy range. Gaining a little, slowly, may help." },
  normal: { th: "อยู่ในเกณฑ์ดี เก่งมาก!", en: "You're in the healthy range. Nice!" },
  over: { th: "เกินเกณฑ์เล็กน้อย ลดลงนิดหน่อยก็ช่วยสุขภาพได้", en: "A little above the healthy range. Losing a bit can help your health." },
  obese1: { th: "สูงกว่าเกณฑ์ การลดน้ำหนักจะช่วยสุขภาพได้มาก ค่อย ๆ ไปด้วยกันนะ", en: "Above the healthy range. Losing weight can really help your health — one step at a time." },
  obese2: { th: "สูงกว่าเกณฑ์มาก การลดน้ำหนักจะช่วยสุขภาพได้มาก ค่อย ๆ ไปด้วยกันนะ", en: "Well above the healthy range. Losing weight can really help your health — one step at a time." },
};

export function bmiLevel(bmi: number): BmiLevel {
  if (bmi < 18.5) return "under";
  if (bmi < 23) return "normal";
  if (bmi < 25) return "over";
  if (bmi < 30) return "obese1";
  return "obese2";
}

/** BMI + level, or null when height/weight are not filled in sensibly yet. */
export function bmiInfo(heightCm: number, weightKg: number): { bmi: number; level: BmiLevel } | null {
  if (!(heightCm >= 120 && heightCm <= 230 && weightKg >= 30 && weightKg <= 300)) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  return { bmi, level: bmiLevel(bmi) };
}
