import { test } from "node:test";
import assert from "node:assert/strict";
import { backupCounts, backupFileName, makeBackup, parseBackup } from "../app/lib/backup.ts";

const data = {
  entries: JSON.stringify([{ id: "a" }, { id: "b" }]),
  recipes: JSON.stringify([{ id: "r" }]),
  goals: JSON.stringify({ targetKcal: 1600 }),
  body: JSON.stringify([{ date: "2026-11-12", weightKg: 79, steps: null }]),
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
  const b = makeBackup({ entries: null, recipes: null, goals: null, body: null, lang: null }, {}, 1);
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
});

test("only real pictures are kept from the photos part", () => {
  const b = makeBackup(data, { good: "data:image/png;base64,AA", bad: "javascript:alert(1)" }, 1);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.deepEqual(Object.keys(res.backup.photos), ["good"]);
});
