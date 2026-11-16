// How the day's calories split between protein, carbs and fat, in whole percents.
// Based on calories (protein 4, carbs 4, fat 9 kcal per gram), the usual way to show a "macro split".
// The three numbers always add up to exactly 100.

export type Split = { protein: number; carbs: number; fat: number };

export function macroSplit(g: { protein: number; carbs: number; fat: number }): Split | null {
  const kc = { protein: Math.max(0, g.protein) * 4, carbs: Math.max(0, g.carbs) * 4, fat: Math.max(0, g.fat) * 9 };
  const sum = kc.protein + kc.carbs + kc.fat;
  if (!(sum > 0)) return null;
  const keys = ["protein", "carbs", "fat"] as const;
  const raw = keys.map((k) => (kc[k] / sum) * 100);
  const out = raw.map(Math.floor);
  // Give the leftover points to the biggest remainders, so the total is 100.
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let j = 0; left > 0; j++, left--) out[order[j % 3][1]]++;
  return { protein: out[0], carbs: out[1], fat: out[2] };
}
