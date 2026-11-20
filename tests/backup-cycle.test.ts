// Batch 3: a whole backup -> file -> restore cycle with SYNTHETIC data only (never touches the real phone storage).
import test from "node:test";
import assert from "node:assert/strict";
import { applyBackupData, BACKUP_KEYS, backupCounts, makeBackup, parseBackup, type BackupPart } from "../app/lib/backup.ts";

class FakeStorage {
  m = new Map<string, string>();
  failAfter = Infinity; // writes allowed before it "runs out of room"
  writes = 0;
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { if (this.writes++ >= this.failAfter) { this.failAfter = Infinity; throw new Error("QuotaExceededError"); } this.m.set(k, v); } // fails once, like running out of room on one big write
  removeItem(k: string) { this.m.delete(k); }
}

const item = (name: string, kcal: number, extra: object = {}) => ({ id: `it_${name}`, name, amount: 100, unit: "g", kcal, protein: 10.5, carbs: 20.25, fat: 3.125, fiber: 1, sugar: 2, sodium: 300, estimated: false, ...extra });
const synthetic: Record<BackupPart, string> = {
  entries: JSON.stringify([
    { id: "en_1", date: "2026-11-01", slot: "lunch", title: "ข้าวมันไก่ (test)", alt: { en: "Chicken rice (test)", src: "ข้าวมันไก่ (test)" }, items: [item("ข้าวสวย", 130, { kind: "ai", bufferPct: 10 }), item("ไก่ต้ม", 165, { estimated: true, missing: ["fiber"] })], source: "photo", photoId: "ph_1", recipe: null, createdAt: 1, updatedAt: 2 },
    { id: "en_2", date: "2026-11-02", slot: "snack", title: "Test snack", items: [item("egg", 72)], source: "manual", recipe: null, createdAt: 3, updatedAt: 3 },
  ]),
  recipes: JSON.stringify([{ id: "rc_1", name: "สูตรทดสอบ", servings: 2.5, cookedWeight: 480, ingredients: [{ id: "i1", name: "ข้าว", amount: 200, unit: "g", label: { basis: "per100", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, via: "typed" }, gramsPerUnit: null, photoId: null }], steps: ["ต้ม"], coverPhotoId: "ph_2", category: "onedish", createdAt: 1, updatedAt: 1 }]),
  goals: JSON.stringify({ targetKcal: 1750, targetSource: "manual", waterGoal: 9, calorieBuffer: 10, profile: { name: "Test", reason: "maintain", age: 30, heightCm: 165, weightKg: 60, sex: "female" } }),
  body: JSON.stringify([{ date: "2026-11-01", weightKg: 61.2, updatedAt: 1 }, { date: "2026-11-02", weightKg: 60.9, steps: 8000, updatedAt: 2 }]),
  water: JSON.stringify([{ date: "2026-11-01", glasses: 7, updatedAt: 1 }]),
  labelFixes: JSON.stringify([]),
  buddy: JSON.stringify({ stage: 2 }),
  lang: "en",
  customIngredients: JSON.stringify([{ id: "ci_1", name: "My oats", basis: "per100", per: "g", kcal: 380, protein: 13, carbs: 67, fat: 7, gramsPerUnit: null, gPerMl: null, unit: "g", createdAt: 1 }]),
  ingredientPrefs: JSON.stringify([{ queryKey: "egg", pick: { kind: "custom", name: "My egg" }, lastUsed: 5 }]),
  chat: JSON.stringify([]),
  mealPics: JSON.stringify({ ข้าวมันไก่: "ph_1" }),
  nameTr: JSON.stringify({}),
};
const PHOTOS = { ph_1: "data:image/jpeg;base64,AAAA", ph_2: "data:image/png;base64,BBBB" };

function fill(s: FakeStorage, data: Record<string, string | null>) {
  for (const [part, key] of Object.entries(BACKUP_KEYS)) { const v = data[part]; if (v != null) s.m.set(key, v); }
}

test("full cycle: phone A -> file -> an empty phone B gets exactly the same data", () => {
  const a = new FakeStorage(); fill(a, synthetic);
  const data = Object.fromEntries(Object.entries(BACKUP_KEYS).map(([p, k]) => [p, a.getItem(k)])) as Record<BackupPart, string | null>;
  const file = JSON.stringify(makeBackup(data, PHOTOS, 123));
  const parsed = parseBackup(file, "en");
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.backup.photos, PHOTOS, "images survive");
  const counts = backupCounts(parsed.backup);
  assert.equal(counts.meals, 2); assert.equal(counts.recipes, 1); assert.equal(counts.photos, 2);

  const b = new FakeStorage();
  const r = applyBackupData(b, parsed.backup.data);
  assert.ok(r.ok);
  for (const [part, key] of Object.entries(BACKUP_KEYS)) assert.equal(b.getItem(key), synthetic[part as BackupPart], `${part} identical (byte for byte)`);
  // nutrition numbers specifically
  const meals = JSON.parse(b.getItem(BACKUP_KEYS.entries)!);
  assert.equal(meals[0].items[0].protein, 10.5);
  assert.equal(meals[0].items[1].missing[0], "fiber");
  assert.equal(JSON.parse(b.getItem(BACKUP_KEYS.goals)!).waterGoal, 9);
  assert.equal(JSON.parse(b.getItem(BACKUP_KEYS.water)!)[0].glasses, 7);
  assert.equal(JSON.parse(b.getItem(BACKUP_KEYS.body)!)[1].weightKg, 60.9);
  assert.equal(JSON.parse(b.getItem(BACKUP_KEYS.customIngredients)!)[0].name, "My oats");
});

test("restoring over a phone that has OTHER data replaces it fully (no mixing)", () => {
  const b = new FakeStorage();
  b.m.set(BACKUP_KEYS.entries, JSON.stringify([{ id: "old" }]));
  b.m.set(BACKUP_KEYS.water, JSON.stringify([{ date: "2020-01-01", glasses: 1 }]));
  const r = applyBackupData(b, synthetic);
  assert.ok(r.ok);
  assert.equal(b.getItem(BACKUP_KEYS.entries), synthetic.entries);
  assert.equal(b.getItem(BACKUP_KEYS.water), synthetic.water);
});

test("failure half-way (phone out of room): every key is put back exactly as it was", () => {
  const b = new FakeStorage();
  const before = { ...synthetic, entries: JSON.stringify([{ id: "mine", title: "keep me" }]), goals: JSON.stringify({ targetKcal: 2000 }) };
  fill(b, before);
  const snapshot = new Map(b.m);
  b.failAfter = 4; // dies on the 5th write
  const r = applyBackupData(b, { ...synthetic, entries: JSON.stringify([{ id: "new" }]), goals: JSON.stringify({ targetKcal: 1111 }) });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.rolledBack, true);
  b.failAfter = Infinity;
  assert.deepEqual([...b.m.entries()].sort(), [...snapshot.entries()].sort(), "storage is identical to before the failed restore");
});

test("broken / foreign / half-broken files are refused and nothing is written", () => {
  const b = new FakeStorage(); fill(b, synthetic);
  const snap = new Map(b.m);
  const good = JSON.parse(JSON.stringify(makeBackup(synthetic, PHOTOS, 1)));
  const bad = [
    "not json",
    JSON.stringify({ app: "other", version: 1, savedAt: 1, data: {}, photos: {} }),
    JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, data: { ...good.data, entries: "{\"not\":\"a list\"}" } }),
    JSON.stringify({ ...good, data: { ...good.data, goals: "[1]" } }),
    JSON.stringify({ ...good, data: { ...good.data, lang: "fr" } }),
    JSON.stringify({ ...good, data: { ...good.data, recipes: "{broken" } }),
  ];
  for (const text of bad) assert.equal(parseBackup(text, "en").ok, false, text.slice(0, 40));
  assert.deepEqual([...b.m.entries()], [...snap.entries()], "refusing a file writes nothing");
});

test("non-image 'photos' in a file are dropped, real images kept", () => {
  const f = makeBackup(synthetic, { ok: "data:image/png;base64,AA", evil: "javascript:alert(1)", html: "data:text/html,<b>x</b>" } as Record<string, string>, 1);
  const p = parseBackup(JSON.stringify(f), "en");
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual(Object.keys(p.backup.photos), ["ok"]);
});

test("an OLD backup without the newer parts keeps the phone's current ingredients/prefs", () => {
  const b = new FakeStorage();
  b.m.set(BACKUP_KEYS.customIngredients, synthetic.customIngredients);
  const old = { ...synthetic, customIngredients: null, ingredientPrefs: null } as unknown as Record<BackupPart, string | null>;
  assert.ok(applyBackupData(b, old).ok);
  assert.equal(b.getItem(BACKUP_KEYS.customIngredients), synthetic.customIngredients);
});
