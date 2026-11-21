// Nutrition reports for a trainer: daily + weekly (numbers and layout), plus the simplified share flow.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPORT_W, buildDayReport, buildWeekReport, fitText, layoutDayReport, layoutWeekReport, reportFileName, weekRangeText, wrapText, type Measure, type RCmd,
} from "../app/lib/nutritionReport.ts";
import { calorieWeek } from "../app/lib/week.ts";
import { pickMacros, sumMacros } from "../app/lib/nutrition.ts";
import { macroTargets } from "../app/lib/energy.ts";
import type { Entry, FoodItem, MealSlot } from "../app/lib/types.ts";

const measure: Measure = (t, size) => Array.from(t).length * size * 0.5;
const item = (name: string, kcal: number, p: number, c: number, f: number, extra: Partial<FoodItem> = {}): FoodItem => ({ id: "i" + name, name, amount: 1, unit: "จาน", kcal, protein: p, carbs: c, fat: f, estimated: false, kind: "food", note: null, box: null, ...extra });
let n = 0;
const meal = (date: string, slot: MealSlot, title: string, items: FoodItem[]): Entry => ({ id: "e" + ++n, date, slot, title, items, source: "manual", photoId: null, recipe: null, createdAt: n, updatedAt: n } as unknown as Entry);
const MT = macroTargets(1800, 90);
const texts = (cmds: RCmd[]) => cmds.flatMap((c) => (c.t === "text" ? [c.s] : []));

const DAY = "2026-11-18"; // a Wednesday; its week is Mon 16 – Sun 22
const day = [
  meal(DAY, "breakfast", "Oats", [item("oats", 300, 10, 50, 6)]),
  meal(DAY, "lunch", "Rice and chicken", [item("rice", 260, 5, 57, 0.5), item("chicken", 220, 30, 0, 10, { estimated: true })]),
];

test("daily numbers: totals are exactly the sums of the logged foods (same maths as Today)", () => {
  const r = buildDayReport({ entries: day, date: DAY, target: 1800, macroTargets: MT, lang: "en" });
  const s = sumMacros(day.flatMap((e) => e.items.map(pickMacros)));
  assert.equal(r.total.kcal, Math.round(s.kcal));
  assert.equal(r.total.kcal, 780);
  assert.equal(r.total.protein, 45);
  assert.equal(r.mealCount, 2);
  assert.deepEqual(r.slots.map((x) => x.slot), ["breakfast", "lunch", "dinner", "snack"]);
  assert.deepEqual(r.notLogged, ["dinner", "snack"]);
  assert.equal(r.slots[1].meals[0].est, true, "the estimated food is marked");
  assert.equal(r.hasEstimate, true);
});

test("an empty day is 'not logged', never 0 kcal", () => {
  const r = buildDayReport({ entries: [], date: DAY, target: 1800, macroTargets: MT, lang: "en" });
  assert.equal(r.mealCount, 0);
  assert.equal(r.notLogged.length, 4);
  const l = layoutDayReport(r, measure);
  const all = texts(l.cmds).join(" | ");
  assert.match(all, /No food logged/);
  assert.match(all, /not the same as eating 0 kcal/);
  assert.doesNotMatch(all.replace("(not the same as eating 0 kcal)", ""), /\b0 kcal\b/);
  assert.equal(texts(l.cmds).filter((s) => s === "Not logged").length, 4);
});

test("only another day's entries do not leak in", () => {
  const other = meal("2026-11-19", "dinner", "Other day", [item("x", 999, 1, 1, 1)]);
  const r = buildDayReport({ entries: [...day, other], date: DAY, target: 1800, macroTargets: MT, lang: "en" });
  assert.equal(r.total.kcal, 780);
});

test("daily layout: brand, date, calories vs target, macros, meals with food names and kcal", () => {
  const r = buildDayReport({ entries: day, date: DAY, target: 1800, macroTargets: MT, lang: "en", name: "Alex" });
  const t = texts(layoutDayReport(r, measure).cmds);
  for (const s of ["SnapCal", "Daily nutrition report", "Wednesday, 18 Nov 2026", "Alex", "Calories consumed", "780", "1,800 kcal", "1,020 kcal remaining", "Protein", "Carbs", "Fat", "Breakfast", "Lunch", "Oats", "300 kcal", "Rice and chicken", "~480 kcal", "Dinner", "Snack"]) assert.ok(t.includes(s), s + " in " + t.join("|"));
  assert.ok(t.some((s) => s.startsWith("2 meal entries logged") && s.includes("Not logged: Dinner, Snack")));
});

test("different goals change the remaining / over-target wording", () => {
  const low = buildDayReport({ entries: day, date: DAY, target: 600, macroTargets: macroTargets(600, 40), lang: "en" });
  assert.ok(texts(layoutDayReport(low, measure).cmds).includes("180 kcal over target"));
  const high = buildDayReport({ entries: day, date: DAY, target: 2400, macroTargets: macroTargets(2400, 120), lang: "en" });
  assert.ok(texts(layoutDayReport(high, measure).cmds).includes("1,620 kcal remaining"));
  const noTarget = buildDayReport({ entries: day, date: DAY, target: 0, macroTargets: MT, lang: "en" });
  assert.doesNotMatch(texts(layoutDayReport(noTarget, measure).cmds).join("|"), /remaining|over target/);
});

test("Thai report: Thai labels and the Thai date", () => {
  const r = buildDayReport({ entries: day, date: DAY, target: 1800, macroTargets: MT, lang: "th" });
  const t = texts(layoutDayReport(r, measure).cmds);
  assert.ok(t.includes("รายงานโภชนาการรายวัน"));
  assert.ok(t.includes("มื้อเช้า") && t.includes("มื้อเย็น"));
  assert.ok(t.some((s) => s.includes("ยังไม่ได้บันทึก")));
  assert.ok(t.some((s) => s.includes("พ.ย.")));
});

test("long Thai and English food names never run past the page; they wrap (2 lines) or end with …", () => {
  const long = [
    meal(DAY, "lunch", "ข้าวผัดกะเพราหมูสับไข่ดาวพร้อมน้ำจิ้มซีฟู้ดรสเด็ดและผักสดเคียงจานใหญ่พิเศษที่ทำเองที่บ้านทุกวันอาทิตย์", [item("ข้าวสวย", 260, 5, 57, 0.5), item("หมูสับผัดกะเพรา", 310, 22, 6, 22)]),
    meal(DAY, "snack", "Overnight oats with chia seeds, blueberries, almond butter, honey and a very long description that keeps going", [item("Rolled oats", 228, 8, 40, 4)]),
  ];
  const r = buildDayReport({ entries: long, date: DAY, target: 1800, macroTargets: MT, lang: "th" });
  const l = layoutDayReport(r, measure);
  for (const c of l.cmds) {
    if (c.t !== "text") continue;
    const w = measure(c.s, c.size, c.weight);
    const left = c.align === "left" ? c.x : c.align === "right" ? c.x - w : c.x - w / 2;
    assert.ok(left >= 0 && left + w <= REPORT_W - 56 + 1, `"${c.s.slice(0, 30)}" fits (${Math.round(left)}..${Math.round(left + w)})`);
  }
  assert.ok(l.h > 800 && l.cmds.length > 10);
});

test("fitText / wrapText: Thai (no spaces) and English", () => {
  assert.equal(fitText(measure, "short", 20, 400, 500), "short");
  const f = fitText(measure, "ข้าวผัดกะเพราหมูสับไข่ดาวพร้อมน้ำจิ้ม", 20, 400, 100);
  assert.ok(f.endsWith("…") && measure(f, 20, 400) <= 100);
  const w = wrapText(measure, "one two three four five six seven eight nine ten", 20, 400, 150, 2);
  assert.equal(w.length, 2);
  assert.ok(w.every((x) => measure(x, 20, 400) <= 150));
  assert.equal(wrapText(measure, "", 20, 400, 100, 2).length, 0);
});

// ---------------- weekly

const wk = [
  meal("2026-11-17", "breakfast", "Eggs", [item("e", 300, 20, 10, 20)]),
  meal("2026-11-17", "lunch", "Noodles", [item("n", 600, 20, 90, 10)]),
  meal("2026-11-19", "lunch", "Chicken rice", [item("c", 1000, 40, 100, 30)]), // one meal only -> "few"
  meal("2026-11-20", "breakfast", "Toast", [item("t", 200, 5, 30, 4)]),
  meal("2026-11-20", "dinner", "Fish", [item("f", 1800, 60, 100, 50)]), // over a 1,600 target
];

test("weekly numbers: Monday–Sunday, averages over LOGGED days only (same average as the app)", () => {
  const r = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 1600, macroTargets: MT, lang: "en" });
  assert.equal(r.start, "2026-11-16");
  assert.equal(r.end, "2026-11-22");
  assert.equal(r.days.length, 7);
  assert.equal(r.loggedDays, 3);
  assert.deepEqual(r.days.map((d) => d.logged), [false, true, false, true, true, false, false]);
  const app = calorieWeek(wk, "2026-11-18", "2026-11-21", 1600);
  assert.equal(r.avg!.kcal, app.avg, "identical to the existing week average");
  assert.equal(Math.round(r.avg!.kcal), 1300); // (900 + 1000 + 2000) / 3
  assert.equal(r.vsTarget, -300);
  assert.equal(r.days[1].mealSlots, 2);
  assert.equal(r.days[3].few, true, "one meal logged = may be incomplete");
  assert.equal(r.days[1].few, false);
  assert.equal(r.fewDays, 1);
  assert.equal(r.overDays, 1);
  assert.equal(r.days[6].future, true, "Sunday is after today (Saturday)");
  assert.equal(r.days[5].future, false, "today itself is not 'upcoming'");
});

test("every date in the week gives the same week (the report follows the VIEWED date)", () => {
  for (const d of ["2026-11-16", "2026-11-18", "2026-11-22"]) assert.equal(buildWeekReport({ entries: [], date: d, today: "2026-11-22", target: 1600, macroTargets: MT, lang: "en" }).start, "2026-11-16");
  assert.equal(buildWeekReport({ entries: [], date: "2026-11-23", today: "2026-11-23", target: 1600, macroTargets: MT, lang: "en" }).start, "2026-11-23");
});

test("an empty week: no average, no invented zeros", () => {
  const r = buildWeekReport({ entries: [], date: "2026-11-18", today: "2026-11-22", target: 1600, macroTargets: MT, lang: "en" });
  assert.equal(r.loggedDays, 0);
  assert.equal(r.avg, null);
  assert.equal(r.vsTarget, null);
  const t = texts(layoutWeekReport(r, measure).cmds).join("|");
  assert.match(t, /No food logged this week/);
  assert.match(t, /No food was logged this week/);
  assert.doesNotMatch(t, /\b0 kcal\b/);
  assert.equal(texts(layoutWeekReport(r, measure).cmds).filter((s) => s === "No data").length >= 7, true);
});

test("weekly layout: explicit range, average per logged day, days logged, chart, table; no-data days are marked, not drawn as zero bars", () => {
  const r = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 1600, macroTargets: MT, lang: "en", name: "Alex" });
  const l = layoutWeekReport(r, measure);
  const t = texts(l.cmds);
  for (const s of ["Weekly nutrition report", "Mon 16 Nov – Sun 22 Nov 2026", "Average calories per logged day", "1,300", "Days with food logged", "3", "Calories per day", "Target 1,600", "Average (logged days only)"]) assert.ok(t.includes(s), s);
  assert.ok(t.includes("−300 kcal/day vs target 1,600"));
  assert.ok(t.includes("Upcoming"), "days after today are 'Upcoming', not zero");
  assert.ok(t.filter((s) => s === "No data").length >= 3, "chart + table mark no-data days");
  assert.ok(t.includes("1 meal"), "a few-meals day is flagged on the chart");
  assert.ok(t.some((s) => s.startsWith("Averages use the 3 logged days (of 7)")));
  assert.ok(t.some((s) => s.includes("only one meal logged may be incomplete")));
  // a no-data day has an outline only (no fill) in the chart: count filled bars = logged days
  const bars = l.cmds.filter((c) => c.t === "rect" && c.fill && (c.fill === "#3f4b5b" || c.fill === "#b4701f" || c.fill === "#c6ced8") && c.w <= 72 && c.h >= 8 && c.r === 8);
  assert.equal(bars.length, 3);
  const over = l.cmds.filter((c) => c.t === "rect" && c.fill === "#b4701f" && c.r === 8);
  assert.equal(over.length, 1, "only the day over target is amber");
});

test("a bar's height is proportional to its kcal and the target line sits at the target", () => {
  const r = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 1600, macroTargets: MT, lang: "en" });
  const l = layoutWeekReport(r, measure);
  const bars = l.cmds.filter((c): c is Extract<RCmd, { t: "rect" }> => c.t === "rect" && !!c.fill && c.r === 8 && c.w <= 72);
  const byKcal = new Map<number, number>([[900, bars[0].h], [1000, bars[1].h], [2000, bars[2].h]]);
  assert.ok(Math.abs(byKcal.get(2000)! / byKcal.get(900)! - 2000 / 900) < 0.02);
  const dashed = l.cmds.find((c) => c.t === "line" && c.dash);
  assert.ok(dashed && dashed.t === "line");
  const base = bars[0].y + bars[0].h;
  const scale = bars[2].h / 2000;
  assert.ok(Math.abs(base - dashed.y1 - 1600 * scale) < 1, "target line at 1,600 on the same scale");
});

test("different goals: the comparison and the target line follow the goal", () => {
  const hi = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 2400, macroTargets: MT, lang: "en" });
  assert.equal(hi.vsTarget, -1100);
  assert.equal(hi.overDays, 0);
  const lo = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 1000, macroTargets: MT, lang: "en" });
  assert.equal(lo.vsTarget, 300);
  assert.equal(lo.overDays, 1, "1,000 is not over a 1,000 target; only the 2,000 day is");
  assert.ok(texts(layoutWeekReport(lo, measure).cmds).includes("+300 kcal/day vs target 1,000"));
  const none = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 0, macroTargets: MT, lang: "en" });
  assert.equal(none.vsTarget, null);
  assert.equal(layoutWeekReport(none, measure).cmds.some((c) => c.t === "line" && c.dash), false, "no target = no target line");
});

test("week range text: English and Thai, across a month change", () => {
  assert.equal(weekRangeText("2026-11-16", "2026-11-22", "en"), "Mon 16 Nov – Sun 22 Nov 2026");
  assert.equal(weekRangeText("2026-11-30", "2026-12-06", "en"), "Mon 30 Nov – Sun 6 Dec 2026");
  assert.match(weekRangeText("2026-11-16", "2026-11-22", "th"), /^(จ\.|จันทร์) 16 พ\.ย\. – (อา\.|อาทิตย์) 22 พ\.ย\. 2569$/);
});

test("partial week with a Thai long name still fits the page", () => {
  const e = [meal("2026-11-17", "lunch", "ข้าวผัดกะเพราหมูสับไข่ดาวพร้อมน้ำจิ้มซีฟู้ดรสเด็ดและผักสดเคียงจานใหญ่พิเศษ", [item("x", 700, 20, 80, 20)])];
  const l = layoutWeekReport(buildWeekReport({ entries: e, date: "2026-11-17", today: "2026-11-20", target: 1800, macroTargets: MT, lang: "th" }), measure);
  for (const c of l.cmds) {
    if (c.t !== "text") continue;
    const w = measure(c.s, c.size, c.weight);
    const left = c.align === "left" ? c.x : c.align === "right" ? c.x - w : c.x - w / 2;
    assert.ok(left >= 0 && left + w <= REPORT_W + 1, c.s.slice(0, 30));
  }
});

test("file names", () => {
  assert.equal(reportFileName("day", "2026-11-18"), "snapcal-day-2026-11-18.png");
  assert.equal(reportFileName("week", "2026-11-16"), "snapcal-week-2026-11-16.png");
});

test("no paid AI, no upload: the report code only reads saved meals and draws", () => {
  const src = ["../app/lib/nutritionReport.ts", "../app/components/reportDraw.ts", "../app/components/ShareDayButton.tsx"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(src, /aiFetch|\/api\/|fetch\(|openrouter/i);
});
