// Round 40: no automatic +15%; an optional Smart Calorie Buffer on kcal only, for AI guesses only.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUFFER_CHOICES,
  BUFFER_TEXT,
  DEFAULT_BUFFER,
  bufferExtra,
  bufferSummary,
  bufferedKcal,
  canBuffer,
  cleanBufferPct,
  dropBuffer,
  forEnergyCheck,
  hasLegacyMargin,
  isBuffered,
  originalKcal,
  setBuffer,
  startBuffer,
} from "../app/lib/calorieBuffer.ts";
import { blankItem, changeAmount, energyCheck, pickMacros, sumMacros } from "../app/lib/nutrition.ts";
import { itemProvenance, provFromAi } from "../app/lib/provenance.ts";
import { aiRoom, fitAiIdeas, recipeIdeas } from "../app/lib/suggest.ts";
import { makeBackup, parseBackup, BACKUP_KEYS, type BackupPart } from "../app/lib/backup.ts";
import { foodToItem } from "../app/lib/food/toItem.ts";
import type { Entry, FoodItem } from "../app/lib/types.ts";

/** A fresh AI guess (amount guessed): 500 kcal, P 20 / C 60 / F 20. */
const aiGuess = (over: Partial<FoodItem> = {}): FoodItem => ({
  id: "it1",
  name: "ผัดกะเพราหมู",
  amount: 1,
  unit: "จาน",
  kcal: 500,
  protein: 20,
  carbs: 60,
  fat: 20,
  estimated: true,
  kind: "food",
  note: null,
  box: null,
  prov: provFromAi({ fromLabel: false, userAmount: false }),
  ...over,
});

const macrosOf = (i: FoodItem) => ({ protein: i.protein, carbs: i.carbs, fat: i.fat });

// ---- 1. 0% default ----

test("default is 0%: a missing or strange setting never adds anything", () => {
  assert.equal(DEFAULT_BUFFER, 0);
  assert.deepEqual([...BUFFER_CHOICES], [0, 5, 10, 15, 20]);
  for (const v of [undefined, null, "", "abc", 7, -5, 25, NaN, Infinity, {}]) assert.equal(cleanBufferPct(v), 0, String(v));
  assert.equal(cleanBufferPct("15"), 15);
  const it = startBuffer(aiGuess(), cleanBufferPct(undefined));
  assert.equal(it.kcal, 500);
  assert.equal(it.aiKcal, 500);
  assert.equal(it.bufferPct, 0);
  assert.equal(isBuffered(it), false);
});

// ---- 2. 5 / 10 / 15 / 20% ----

test("5, 10, 15 and 20% are worked out from the AI's own kcal", () => {
  const want: Record<number, number> = { 0: 500, 5: 525, 10: 550, 15: 575, 20: 600 };
  for (const p of BUFFER_CHOICES) {
    assert.equal(bufferedKcal(500, p), want[p]);
    const it = startBuffer(aiGuess(), p);
    assert.equal(it.kcal, want[p]);
    assert.equal(it.aiKcal, 500);
    assert.equal(it.bufferPct, p);
    assert.equal(bufferExtra(it), want[p] - 500);
  }
  assert.equal(bufferedKcal(333, 15), 382.95); // no rounding inside; the screen rounds
});

// ---- 3. Protein, carbs, fat never change ----

test("protein, carbs and fat stay exactly the same at every %", () => {
  for (const p of BUFFER_CHOICES) {
    const it = startBuffer(aiGuess(), p);
    assert.deepEqual(macrosOf(it), { protein: 20, carbs: 60, fat: 20 });
  }
});

// ---- 4. No double buffer ----

test("no double buffer: always from the AI's kcal, never from a buffered number", () => {
  const a = startBuffer(aiGuess(), 15);
  assert.equal(startBuffer(a, 15).kcal, 575); // starting again keeps the AI's 500
  assert.equal(setBuffer(a, 15).kcal, 575);
  assert.equal(setBuffer(setBuffer(setBuffer(a, 15), 15), 15).kcal, 575);
  assert.equal(setBuffer(a, 10).kcal, 550);
  assert.equal(setBuffer(setBuffer(a, 20), 0).kcal, 500);
  assert.equal(setBuffer(a, 20).aiKcal, 500);
});

// ---- 5. Labels, database, her numbers, reference values: never ----

test("labels, database values, typed numbers, recipes and exact amounts never get a buffer", () => {
  const label = aiGuess({ fromLabel: true, prov: provFromAi({ fromLabel: true }) });
  const exact = aiGuess({ prov: provFromAi({ userAmount: true }) });
  const typed = { ...blankItem(), name: "ข้าว", kcal: 300 };
  const recipe = aiGuess({ prov: { source: "recipe", verification: "estimated" } });
  const reference = aiGuess({ prov: { source: "reference", verification: "unverified", via: "defined" } });
  const off = foodToItem(
    { source: "off", sourceId: "885", name: "Snack", brand: null, servingSize: null, kcal: 500, protein: 5, carbs: 60, fat: 25 },
    30,
    "it9",
    "Product",
  );
  for (const it of [label, exact, typed, recipe, reference, off]) {
    assert.equal(canBuffer(it), false, it.name);
    const out = startBuffer(it, 20);
    assert.equal(out.kcal, it.kcal, it.name);
    assert.equal(out.aiKcal, undefined, it.name);
    assert.equal(setBuffer(it, 20).kcal, it.kcal, it.name);
  }
  // AI ideas from "what can I eat" are AI guesses → allowed
  assert.equal(canBuffer(aiGuess({ prov: { source: "ai", verification: "estimated", via: "suggest" } })), true);
});

// ---- 6. Mixed meals ----

test("a mixed meal: only the AI guess is buffered; totals show AI vs counted", () => {
  const items = [
    startBuffer(aiGuess(), 10), // 500 → 550
    startBuffer(aiGuess({ id: "l", fromLabel: true, kcal: 120, protein: 7, carbs: 12, fat: 5, prov: provFromAi({ fromLabel: true }) }), 10), // label: 120
    startBuffer({ ...blankItem(), id: "u", name: "กล้วย", kcal: 100 }, 10), // typed: 100
  ];
  const s = bufferSummary(items);
  assert.equal(s.trackingKcal, 770);
  assert.equal(s.aiKcal, 720);
  assert.equal(s.extra, 50);
  assert.deepEqual(s.pcts, [10]);
  const total = sumMacros(items.map(pickMacros));
  assert.equal(total.kcal, 770); // the diary counts tracking kcal
  assert.equal(total.protein, 27); // macros never buffered
});

// ---- 7. Items saved before Round 40 ----

test("old saved items are never changed (old +15% items, old AI items, old labels)", () => {
  // An old item: the old +15% is already inside ALL its numbers.
  const oldMargin: FoodItem = { ...aiGuess(), prov: undefined, margin: true, kcal: 575, protein: 23, carbs: 69, fat: 23 };
  assert.equal(hasLegacyMargin(oldMargin), true);
  assert.equal(canBuffer({ ...oldMargin, prov: provFromAi({}) }), false);
  for (const p of BUFFER_CHOICES) {
    assert.deepEqual(startBuffer(oldMargin, p), oldMargin);
    assert.deepEqual(setBuffer(oldMargin, p), oldMargin);
  }
  assert.equal(originalKcal(oldMargin), 575);
  assert.deepEqual(itemProvenance(oldMargin), { source: "ai", verification: "estimated", via: "guess" });
  // A Round 39 AI item (no aiKcal): setBuffer never touches it.
  const r39 = aiGuess();
  assert.deepEqual(setBuffer(r39, 20), r39);
  // Old +15% items' numbers still add up (all were scaled), so no false warning.
  assert.equal(energyCheck(forEnergyCheck(oldMargin)).status, "ok");
});

// ---- 8. Editing ----

test("editing: changing the amount keeps the same %, typing kcal makes it hers", () => {
  const a = startBuffer(aiGuess(), 15); // 575
  const half = changeAmount(a, 0.5);
  assert.equal(half.aiKcal, 250);
  assert.equal(half.kcal, 287.5);
  assert.equal(half.protein, 10);
  assert.equal(setBuffer(half, 15).kcal, 287.5); // still not doubled
  const back = changeAmount(half, 1);
  assert.equal(back.kcal, 575);
  assert.equal(back.aiKcal, 500);
  const hers = dropBuffer(a);
  assert.equal(hers.aiKcal, undefined);
  assert.equal(hers.bufferPct, undefined);
  assert.equal(hers.kcal, 575);
  assert.deepEqual(setBuffer({ ...hers, kcal: 400 }, 20).kcal, 400);
});

test("4/4/9 check uses the AI's kcal, so a buffer never looks like a mistake", () => {
  // 20×4 + 60×4 + 20×9 = 500
  const a = startBuffer(aiGuess(), 20); // 600 counted
  assert.equal(energyCheck(a).status, "ok"); // 600 vs 500 is still within 20%
  const big = startBuffer(aiGuess({ kcal: 420, protein: 20, carbs: 50, fat: 15 }), 20); // 420 → 504; macros = 415
  assert.equal(energyCheck(forEnergyCheck(big)).status, "ok");
  const odd = startBuffer(aiGuess({ kcal: 300, protein: 5, carbs: 10, fat: 2 }), 0); // macros = 78 → really off
  assert.equal(energyCheck(forEnergyCheck(odd)).status, "high");
});

// ---- 9. Backup + import ----

test("backup and import keep the AI's kcal and the % exactly (no re-buffering)", () => {
  const entry: Entry = {
    id: "en1", date: "2026-11-16", slot: "lunch", title: "กะเพรา", items: [startBuffer(aiGuess(), 15)],
    source: "photo", photoId: null, recipe: null, createdAt: 1, updatedAt: 1,
  };
  const data = Object.fromEntries(Object.keys(BACKUP_KEYS).map((k) => [k, null])) as Record<BackupPart, string | null>;
  data.entries = JSON.stringify([entry]);
  data.goals = JSON.stringify({ targetKcal: 1800, targetSource: "default", profile: null, maintenanceKcal: null, skippedEstimate: false, calorieBuffer: 15 });
  const parsed = parseBackup(JSON.stringify(makeBackup(data, {}, 5)));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const back = JSON.parse(parsed.backup.data.entries!) as Entry[];
  const it = back[0].items[0];
  assert.equal(it.kcal, 575);
  assert.equal(it.aiKcal, 500);
  assert.equal(it.bufferPct, 15);
  assert.equal(setBuffer(it, it.bufferPct!).kcal, 575);
  assert.equal(cleanBufferPct(JSON.parse(parsed.backup.data.goals!).calorieBuffer), 15);
  // An older backup with no setting → 0%.
  assert.equal(cleanBufferPct(JSON.parse('{"targetKcal":1800}').calorieBuffer), 0);
});

// ---- 10. Daily totals + kcal left ----

test("daily total and kcal left use the counted kcal", () => {
  const items = [startBuffer(aiGuess(), 20), startBuffer(aiGuess({ id: "b", kcal: 300, protein: 10, carbs: 40, fat: 8 }), 20)];
  const eaten = sumMacros(items.map(pickMacros));
  assert.equal(eaten.kcal, 960); // 600 + 360
  assert.equal(1800 - eaten.kcal, 840);
  assert.equal(bufferSummary(items).aiKcal, 800); // the AI's own numbers stay available
});

// ---- 11. Thai / English words ----

test("every buffer text exists in Thai and English", () => {
  for (const [k, v] of Object.entries(BUFFER_TEXT)) {
    assert.ok(v.th.trim().length > 0, `${k} th`);
    assert.ok(v.en.trim().length > 0, `${k} en`);
    assert.notEqual(v.th, v.en, k);
  }
  assert.match(BUFFER_TEXT.explain.en, /Protein, carbs and fat don't change/);
  assert.match(BUFFER_TEXT.explain.th, /โปรตีน คาร์บ ไขมัน ไม่เปลี่ยน/);
});

// ---- 12. Zero kcal (water) ----

test("0 kcal stays 0 at every % (water, ice, plain tea)", () => {
  const water = aiGuess({ name: "น้ำเปล่า", kcal: 0, protein: 0, carbs: 0, fat: 0 });
  for (const p of BUFFER_CHOICES) {
    const it = startBuffer(water, p);
    assert.equal(it.kcal, 0);
    assert.equal(bufferExtra(it), 0);
  }
  assert.equal(bufferedKcal(-10, 20), 0);
  assert.equal(bufferedKcal(NaN, 20), 0);
});

// ---- 13. AI ideas + saved recipes ----

test("meal ideas: AI ideas get her buffer and still fit; her recipes never do", () => {
  // 20% buffer: told room = 400 / 1.2 = 333 so the idea still fits after the buffer.
  assert.equal(aiRoom(400, 20), 333);
  assert.equal(aiRoom(400, 0), 400);
  const raw = [{ name: "ไข่ต้ม", amount: 2, unit: "ฟอง", place: "7-eleven" as const, kcal: 300, protein: 12, carbs: 1, fat: 10, why: "" }];
  const { seven } = fitAiIdeas(raw, 400, undefined, 20);
  assert.equal(seven[0].kcal, 360);
  assert.equal(seven[0].aiKcal, 300);
  assert.equal(seven[0].protein, 12);
  const rec = recipeIdeas([{ id: "r1", name: "ไก่อบ", kcal: 320, protein: 35, carbs: 5, fat: 15 }], 500);
  assert.equal(rec[0].kcal, 320);
  assert.equal(rec[0].aiKcal, null);
  assert.equal(rec[0].bufferPct, 0);
  // A logged recipe item is "recipe" → can't be buffered.
  assert.equal(canBuffer(aiGuess({ prov: { source: "recipe", verification: "unknown" } })), false);
});
