import { test } from "node:test";
import assert from "node:assert/strict";
import { backupCounts, backupFileName, makeBackup, parseBackup } from "../app/lib/backup.ts";

const data = {
  entries: JSON.stringify([{ id: "a" }, { id: "b" }]),
  recipes: JSON.stringify([{ id: "r" }]),
  goals: JSON.stringify({ targetKcal: 1600 }),
  body: JSON.stringify([{ date: "2026-11-12", weightKg: 79, steps: null }]),
  water: JSON.stringify([{ date: "2026-11-12", glasses: 6, updatedAt: 1 }]),
  lang: "en",
};

test("a backup survives the trip to a file and back unchanged", () => {
  const b = makeBackup(data, { p1: "data:image/jpeg;base64,AAA" }, 123);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.deepEqual(res.backup, b);
  assert.deepEqual(backupCounts(res.backup), { meals: 2, recipes: 1, days: 1, photos: 1 });
  assert.equal(backupFileName("2026-11-13"), "snapcal-backup-2026-11-13.json");
});

test("empty parts stay empty", () => {
  const b = makeBackup({ entries: null, recipes: null, goals: null, body: null, water: null, lang: null }, {}, 1);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.deepEqual(backupCounts(res.backup), { meals: 0, recipes: 0, days: 0, photos: 0 });
});

test("wrong or broken files are refused with a message", () => {
  for (const text of ["hello", "{}", JSON.stringify({ app: "other", version: 1, savedAt: 1, data: {}, photos: {} })]) {
    const res = parseBackup(text, "en");
    assert.ok(!res.ok);
    assert.equal(res.message, "This is not a SnapCal backup file.");
  }
  // A broken part inside would break the app after restoring, so refuse it.
  const broken = makeBackup({ ...data, entries: "{not json" }, {}, 1);
  assert.ok(!parseBackup(JSON.stringify(broken)).ok);
  const notList = makeBackup({ ...data, recipes: JSON.stringify({}) }, {}, 1);
  assert.ok(!parseBackup(JSON.stringify(notList)).ok);
  const badWater = makeBackup({ ...data, water: JSON.stringify({}) }, {}, 1);
  assert.ok(!parseBackup(JSON.stringify(badWater)).ok);
});

test("an older backup without water still opens (water stays empty)", () => {
  const old = makeBackup(data, {}, 1) as { data: Record<string, unknown> };
  delete old.data.water;
  const res = parseBackup(JSON.stringify(old));
  assert.ok(res.ok);
  assert.equal(res.backup.data.water, null);
});

test("only real pictures are kept from the photos part", () => {
  const b = makeBackup(data, { good: "data:image/png;base64,AA", bad: "javascript:alert(1)" }, 1);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.deepEqual(Object.keys(res.backup.photos), ["good"]);
});

test("backup reminder: after 14 days, never for an empty phone, and 'later' hides it 3 days", async () => {
  const { backupDue, snoozeUntil } = await import("../app/lib/backup.ts");
  const day = 24 * 60 * 60 * 1000;
  const now = 100 * day;
  // nothing saved yet
  assert.equal(backupDue({ now, lastBackup: null, oldestEntryAt: null, snoozeUntil: null }), null);
  // never backed up, first meal 13 days ago → not yet; 14 days → yes
  assert.equal(backupDue({ now, lastBackup: null, oldestEntryAt: now - 13 * day, snoozeUntil: null }), null);
  assert.deepEqual(backupDue({ now, lastBackup: null, oldestEntryAt: now - 14 * day, snoozeUntil: null }), { days: 14, never: true });
  // backed up 20 days ago → yes, counted from the backup
  assert.deepEqual(backupDue({ now, lastBackup: now - 20 * day, oldestEntryAt: now - 90 * day, snoozeUntil: null }), { days: 20, never: false });
  // backed up 2 days ago → no, even with old meals
  assert.equal(backupDue({ now, lastBackup: now - 2 * day, oldestEntryAt: now - 90 * day, snoozeUntil: null }), null);
  // "later" → hidden for 3 days, then back
  const until = snoozeUntil(now);
  assert.equal(backupDue({ now: now + 2 * day, lastBackup: null, oldestEntryAt: now - 30 * day, snoozeUntil: until }), null);
  assert.ok(backupDue({ now: now + 3 * day, lastBackup: null, oldestEntryAt: now - 30 * day, snoozeUntil: until }));
});
