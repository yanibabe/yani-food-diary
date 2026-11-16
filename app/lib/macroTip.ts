// One short tip under the macro tiles on Today: the ONE thing that matters most right now.
// No AI: it compares what she ate today with her own targets (made from her weight, height,
// age and goal in Profile). Free and instant.
//
// Order of what matters most:
//   1. fat over target      2. carbs over target
//   3. protein behind how far the day's calories have got
//   4. carbs running ahead of the day's calories
//   5. otherwise: a calm "good balance" line.

export type MacroKey = "protein" | "carbs" | "fat";
export type Tip = { key: MacroKey | "ok"; th: string; en: string };

type G = { kcal: number; protein: number; carbs: number; fat: number };
type T = { protein: number; carbs: number; fat: number };

/** Over target only counts when it is clearly over (10% and at least 5 g), not 1 g. */
const over = (eaten: number, target: number) => eaten > target * 1.1 && eaten - target >= 5;

export function macroTip(m: G, t: T, kcalTarget: number): Tip | null {
  if (!(m.kcal > 0) || !(kcalTarget > 0)) return null;
  const g = (n: number) => Math.round(n);

  if (t.fat > 0 && over(m.fat, t.fat))
    return {
      key: "fat",
      th: `ไขมันเกินเป้าแล้ว ${g(m.fat - t.fat)} g มื้อต่อไปเลือกต้ม นึ่ง ย่าง แทนของทอด`,
      en: `Fat is ${g(m.fat - t.fat)} g over target. Next meal, pick boiled, steamed or grilled instead of fried.`,
    };

  if (t.carbs > 0 && over(m.carbs, t.carbs))
    return {
      key: "carbs",
      th: `คาร์บเกินเป้าแล้ว ${g(m.carbs - t.carbs)} g มื้อต่อไปเน้นผักกับโปรตีน ลดข้าวและของหวาน`,
      en: `Carbs are ${g(m.carbs - t.carbs)} g over target. Next meal, go for vegetables and protein, less rice and sweets.`,
    };

  // How far through the day's calories she is (0..1). Protein should keep up with that.
  const dayPart = Math.min(1, m.kcal / kcalTarget);
  const need = t.protein - m.protein;
  if (t.protein > 0 && need >= 10 && m.protein / t.protein < dayPart - 0.15)
    return {
      key: "protein",
      th: `โปรตีนยังขาดอีก ${g(need)} g มื้อต่อไปลองเพิ่มไข่ อกไก่ ปลา หรือเต้าหู้`,
      en: `Protein is still ${g(need)} g short. Next meal, try adding eggs, chicken breast, fish or tofu.`,
    };

  if (t.carbs > 0 && m.carbs / t.carbs > dayPart + 0.25 && dayPart < 0.9)
    return {
      key: "carbs",
      th: "คาร์บมาเร็วกว่าแคลอรี มื้อต่อไปลองลดข้าวหรือแป้งลงครึ่งหนึ่ง",
      en: "Carbs are running ahead of your calories. Next meal, try half the rice or noodles.",
    };

  return { key: "ok", th: "สัดส่วนวันนี้ดีแล้ว ไปต่อแบบนี้เลย", en: "Good balance today. Keep going like this." };
}
