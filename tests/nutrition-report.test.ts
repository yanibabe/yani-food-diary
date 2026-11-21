// Nutrition reports for a trainer: daily + weekly (numbers and layout), plus the simplified share flow.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDayReport, buildWeekReport, fitText, reportFileName, weekRangeText, wrapText, type Measure,
} from "../app/lib/nutritionReport.ts";
import { buildShareDay } from "../app/lib/shareDay.ts";
import { layoutShareCard, type Cmd, type CardInput } from "../app/lib/shareCard.ts";
import { dayShortLabel, layoutWeekCard } from "../app/lib/shareWeekCard.ts";
import { calorieWeek } from "../app/lib/week.ts";
import { pickMacros, sumMacros } from "../app/lib/nutrition.ts";
import { macroTargets } from "../app/lib/energy.ts";
import type { Entry, FoodItem, MealSlot } from "../app/lib/types.ts";

const measure: Measure = (t, size) => Array.from(t).length * size * 0.5;
const item = (name: string, kcal: number, p: number, c: number, f: number, extra: Partial<FoodItem> = {}): FoodItem => ({ id: "i" + name, name, amount: 1, unit: "จาน", kcal, protein: p, carbs: c, fat: f, estimated: false, kind: "food", note: null, box: null, ...extra });
let n = 0;
const meal = (date: string, slot: MealSlot, title: string, items: FoodItem[]): Entry => ({ id: "e" + ++n, date, slot, title, items, source: "manual", photoId: null, recipe: null, createdAt: n, updatedAt: n } as unknown as Entry);
const MT = macroTargets(1800, 90);
const texts = (cmds: Cmd[]) => cmds.flatMap((c) => (c.t === "text" ? [c.s] : []));

/** The daily picture (old Frosted Calm card) for a day. */
function dayCard(entries: Entry[], date: string, o: { lang?: "th" | "en"; target?: number; name?: string } = {}) {
  const lang = o.lang ?? "en";
  const target = o.target ?? 1800;
  const rep = buildDayReport({ entries, date, target, macroTargets: MT, lang, name: o.name });
  const inp: CardInput = { day: buildShareDay(entries, date, {}, (x) => x, lang), date, dateLabel: rep.dateLabel, name: o.name ?? "", target, macroTargets: MT, water: { glasses: 0, goal: 8 }, incomplete: rep.incompleteNutrients, lang };
  return layoutShareCard(inp, measure);
}
/** The weekly picture for a week. */
function weekCard(entries: Entry[], o: { date?: string; today?: string; target?: number; lang?: "th" | "en"; name?: string } = {}) {
  const lang = o.lang ?? "en";
  const date = o.date ?? "2026-11-18";
  const rep = buildWeekReport({ entries, date, today: o.today ?? "2026-11-21", target: o.target ?? 1600, macroTargets: MT, lang, name: o.name });
  const stories = rep.days.map((d) => ({ date: d.date, label: dayShortLabel(d.date, lang), share: d.logged ? buildShareDay(entries, d.date, {}, (x) => x, lang) : null }));
  return { rep, card: layoutWeekCard(rep, stories, measure) };
}

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

test("an empty day is 'not logged' in the numbers", () => {
  const r = buildDayReport({ entries: [], date: DAY, target: 1800, macroTargets: MT, lang: "en" });
  assert.equal(r.mealCount, 0);
  assert.equal(r.notLogged.length, 4);
  assert.match(texts(dayCard([], DAY).cmds).join("|"), /No food logged yet/);
});

test("only another day's entries do not leak in", () => {
  const other = meal("2026-11-19", "dinner", "Other day", [item("x", 999, 1, 1, 1)]);
  const r = buildDayReport({ entries: [...day, other], date: DAY, target: 1800, macroTargets: MT, lang: "en" });
  assert.equal(r.total.kcal, 780);
});

test("daily card: brand, name, date, calories vs goal, macros, meals with food names and kcal", () => {
  const t = texts(dayCard(day, DAY, { name: "Alex" }).cmds);
  for (const x of ["ALEX", "Wednesday, 18 Nov 2026", "780", "goal 1,800", "1,020 left", "Protein", "Carbs", "Fat", "Breakfast", "Lunch", "Oats", "Rice and chicken", "~480", "SNAPCAL"]) assert.ok(t.includes(x), x + " in " + t.join("|"));
  assert.ok(t.some((x) => x.startsWith("Not logged") && x.includes("Dinner") && x.includes("Snack")));
  assert.ok(dayCard(day, DAY).cmds.some((c) => c.t === "char"), "the SnapCal character is on the card");
});

test("different goals change the left / over wording", () => {
  assert.ok(texts(dayCard(day, DAY, { target: 600 }).cmds).includes("180 over"));
  assert.ok(texts(dayCard(day, DAY, { target: 2400 }).cmds).includes("1,620 left"));
});

test("Thai card: Thai labels and the Thai date", () => {
  const t = texts(dayCard(day, DAY, { lang: "th" }).cmds);
  assert.ok(t.includes("มื้อเช้า"));
  assert.ok(t.some((x) => x.includes("ไม่ได้บันทึก")));
  assert.ok(t.some((x) => x.includes("พ.ย.")));
});

test("a food with incomplete nutrient data adds an honest footnote", () => {
  const inc = [meal(DAY, "lunch", "Mystery", [item("m", 200, 0, 0, 0, { missing: ["protein"] } as Partial<FoodItem>)])];
  assert.ok(texts(dayCard(inc, DAY).cmds).some((x) => x.startsWith("Some foods have incomplete nutrient data")));
  assert.ok(!texts(dayCard(day, DAY).cmds).some((x) => x.startsWith("Some foods have incomplete")));
});

test("long Thai and English food names never run past the card", () => {
  const long = [
    meal(DAY, "lunch", "ข้าวผัดกะเพราหมูสับไข่ดาวพร้อมน้ำจิ้มซีฟู้ดรสเด็ดและผักสดเคียงจานใหญ่พิเศษที่ทำเองที่บ้านทุกวันอาทิตย์", [item("ข้าวสวย", 260, 5, 57, 0.5), item("หมูสับผัดกะเพรา", 310, 22, 6, 22)]),
    meal(DAY, "snack", "Overnight oats with chia seeds, blueberries, almond butter, honey and a very long description that keeps going", [item("Rolled oats", 228, 8, 40, 4)]),
  ];
  const l = dayCard(long, DAY, { lang: "th" });
  for (const c of l.cmds) {
    if (c.t !== "text" || c.spacing) continue;
    const w = measure(c.s, c.size, c.weight);
    const left = c.align === "left" ? c.x : c.align === "right" ? c.x - w : c.x - w / 2;
    assert.ok(left >= 0 && left + w <= l.w - 28 + 1, `"${c.s.slice(0, 30)}" fits`);
  }
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
  const { rep, card } = weekCard([], { today: "2026-11-22" });
  assert.equal(rep.loggedDays, 0);
  assert.equal(rep.avg, null);
  assert.equal(rep.vsTarget, null);
  const t = texts(card.cmds);
  assert.ok(t.includes("No food logged"));
  assert.ok(t.includes("No food was logged this week"));
  assert.doesNotMatch(t.join("|"), /\b0 kcal\b/);
  assert.ok(t.filter((x) => x === "No data").length >= 7);
});

test("weekly card: range, average per logged day, days logged, chart, day by day; no-data days are marked", () => {
  const { card } = weekCard(wk, { name: "Alex" });
  const t = texts(card.cmds);
  for (const x of ["ALEX", "Mon 16 Nov – Sun 22 Nov 2026", "Weekly report", "1,318".replace("1,318", "1,300"), "kcal / day", "282".replace("282", "300") + " under", "Calories each day", "goal 1,600", "Day by day", "Tuesday 17 Nov", "SNAPCAL"]) assert.ok(t.includes(x), x + " in " + t.join("|"));
  assert.ok(t.includes("Upcoming"), "days after today are 'Upcoming', not zero");
  assert.ok(t.filter((x) => x === "No data").length >= 3, "chart + day list mark no-data days");
  assert.ok(t.includes("1 meal"), "a few-meals day is flagged on the chart");
  assert.ok(t.some((x) => x.startsWith("Averages use the 3 logged days (of 7)")));
  assert.ok(t.some((x) => x.includes("one meal logged may be incomplete")));
  assert.ok(card.cmds.some((c) => c.t === "char"));
  // 3 logged days = 3 filled/outlined bars in the chart; the no-data days are only dashed stubs
  const bars = card.cmds.filter((c) => c.t === "rect" && c.r === 20 && c.w <= 58 && c.h >= 10);
  assert.equal(bars.length, 3);
});

test("a bar's height is proportional to its kcal and the goal line sits at the goal", () => {
  const { card } = weekCard(wk);
  const bars = card.cmds.filter((c): c is Extract<Cmd, { t: "rect" }> => c.t === "rect" && c.r === 20 && c.w <= 58);
  assert.ok(Math.abs(bars[2].h / bars[0].h - 2000 / 900) < 0.02);
  const dashed = card.cmds.find((c) => c.t === "line" && c.dash);
  assert.ok(dashed && dashed.t === "line");
  const base = bars[0].y + bars[0].h;
  assert.ok(Math.abs(base - dashed.y1 - 1600 * (bars[2].h / 2000)) < 1, "goal line at 1,600 on the same scale");
});

test("different goals: wording and goal line follow the goal", () => {
  assert.equal(buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 2400, macroTargets: MT, lang: "en" }).overDays, 0);
  const lo = buildWeekReport({ entries: wk, date: "2026-11-18", today: "2026-11-21", target: 1000, macroTargets: MT, lang: "en" });
  assert.equal(lo.vsTarget, 300);
  assert.equal(lo.overDays, 1, "1,000 is not over a 1,000 target; only the 2,000 day is");
  assert.ok(texts(weekCard(wk, { target: 1000 }).card.cmds).includes("300 over"));
  assert.equal(weekCard(wk, { target: 0 }).card.cmds.some((c) => c.t === "line" && c.dash), false, "no goal = no goal line");
});

test("week range text: English and Thai, across a month change", () => {
  assert.equal(weekRangeText("2026-11-16", "2026-11-22", "en"), "Mon 16 Nov – Sun 22 Nov 2026");
  assert.equal(weekRangeText("2026-11-30", "2026-12-06", "en"), "Mon 30 Nov – Sun 6 Dec 2026");
  assert.match(weekRangeText("2026-11-16", "2026-11-22", "th"), /^(จ\.|จันทร์) 16 พ\.ย\. – (อา\.|อาทิตย์) 22 พ\.ย\. 2569$/);
});

test("partial week with a Thai long name still fits the card", () => {
  const e = [meal("2026-11-17", "lunch", "ข้าวผัดกะเพราหมูสับไข่ดาวพร้อมน้ำจิ้มซีฟู้ดรสเด็ดและผักสดเคียงจานใหญ่พิเศษ", [item("x", 700, 20, 80, 20)])];
  const { card } = weekCard(e, { date: "2026-11-17", today: "2026-11-20", target: 1800, lang: "th" });
  for (const c of card.cmds) {
    if (c.t !== "text" || c.spacing) continue;
    const w = measure(c.s, c.size, c.weight);
    const left = c.align === "left" ? c.x : c.align === "right" ? c.x - w : c.x - w / 2;
    assert.ok(left >= 0 && left + w <= card.w + 1, c.s.slice(0, 30));
  }
});

test("file names", () => {
  assert.equal(reportFileName("day", "2026-11-18"), "snapcal-day-2026-11-18.png");
  assert.equal(reportFileName("week", "2026-11-16"), "snapcal-week-2026-11-16.png");
});

test("no paid AI, no upload: the report code only reads saved meals and draws", () => {
  const src = ["../app/lib/nutritionReport.ts", "../app/lib/shareWeekCard.ts", "../app/components/shareDraw.ts", "../app/components/ShareDayButton.tsx"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(src, /aiFetch|\/api\/|fetch\(|openrouter/i);
});
