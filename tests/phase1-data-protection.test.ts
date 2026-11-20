// Phase 1, issue 5: restore is all-or-nothing; persistence is a polite, never-throwing request.
import test from "node:test";
import assert from "node:assert/strict";
import { applyBackupData, BACKUP_KEYS, type BackupPart } from "../app/lib/backup.ts";
import { requestPersistentStorage } from "../app/lib/persistStorage.ts";

class FakeStorage {
  m = new Map<string, string>();
  sets = 0;
  failOnSet = Infinity; // fail on the Nth setItem
  failRollbackKey: string | null = null;
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) {
    this.sets++;
    if (this.sets === this.failOnSet) throw new Error("QuotaExceededError");
    if (k === this.failRollbackKey && this.sets > this.failOnSet) throw new Error("still full");
    this.m.set(k, v);
  }
  removeItem(k: string) { this.m.delete(k); }
}

const parts = Object.keys(BACKUP_KEYS) as BackupPart[];
const backupData = (over: Partial<Record<BackupPart, string | null>> = {}) => {
  const d = {} as Record<BackupPart, string | null>;
  for (const p of parts) d[p] = p === "lang" ? "en" : p === "goals" || p === "mealPics" || p === "buddy" ? "{}" : "[]";
  d.entries = '[{"id":"new"}]';
  return { ...d, ...over };
};
const seedOld = (s: FakeStorage) => {
  s.m.set(BACKUP_KEYS.entries, '[{"id":"old"}]');
  s.m.set(BACKUP_KEYS.recipes, '[{"id":"oldrecipe"}]');
  s.m.set(BACKUP_KEYS.customIngredients, '[{"id":"mine"}]');
  s.sets = 0;
};

test("a normal restore writes everything", () => {
  const s = new FakeStorage(); seedOld(s);
  const r = applyBackupData(s, backupData());
  assert.equal(r.ok, true);
  assert.equal(s.getItem(BACKUP_KEYS.entries), '[{"id":"new"}]');
  assert.equal(s.getItem(BACKUP_KEYS.recipes), "[]");
});

test("if the phone runs out of room half-way, every key goes back to what it was", () => {
  const s = new FakeStorage(); seedOld(s);
  const before = new Map(s.m);
  s.failOnSet = 3;
  const r = applyBackupData(s, backupData());
  assert.equal(r.ok, false);
  if (!r.ok) { assert.match(r.error, /Quota/); assert.equal(r.rolledBack, true); }
  assert.deepEqual([...s.m.entries()].sort(), [...before.entries()].sort(), "storage identical to before");
});

test("a key that did not exist before is removed again on rollback", () => {
  const s = new FakeStorage(); seedOld(s);
  s.failOnSet = 5;
  applyBackupData(s, backupData());
  assert.equal(s.getItem(BACKUP_KEYS.water), null);
  assert.equal(s.getItem(BACKUP_KEYS.body), null);
});

test("an old backup without the newer parts keeps her saved custom ingredients (unchanged behaviour)", () => {
  const s = new FakeStorage(); seedOld(s);
  const r = applyBackupData(s, backupData({ customIngredients: null }));
  assert.equal(r.ok, true);
  assert.equal(s.getItem(BACKUP_KEYS.customIngredients), '[{"id":"mine"}]');
});

test("a part the backup says was empty is cleared (unchanged behaviour)", () => {
  const s = new FakeStorage(); seedOld(s);
  applyBackupData(s, backupData({ recipes: null }));
  assert.equal(s.getItem(BACKUP_KEYS.recipes), null);
});

test("persistence request: supported, already, denied, missing and throwing all end quietly", async () => {
  assert.equal(await requestPersistentStorage(undefined), "unsupported");
  assert.equal(await requestPersistentStorage({}), "unsupported");
  assert.equal(await requestPersistentStorage({ persisted: async () => true, persist: async () => assert.fail("not asked twice") as never }), "already");
  assert.equal(await requestPersistentStorage({ persisted: async () => false, persist: async () => true }), "granted");
  assert.equal(await requestPersistentStorage({ persisted: async () => false, persist: async () => false }), "denied");
  assert.equal(await requestPersistentStorage({ persist: async () => { throw new Error("boom"); } }), "error");
});
