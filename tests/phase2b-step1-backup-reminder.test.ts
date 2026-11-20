// Phase 2B, step 1: the backup reminder is compact, but its words, colours, actions and conditions are unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupDue } from "../app/lib/backup.ts";

const src = readFileSync(new URL("../app/components/BackupReminder.tsx", import.meta.url), "utf8");

test("same test ids, same destination and same snooze action (nothing else on Home changed)", () => {
  assert.match(src, /data-testid="backup-reminder"/);
  assert.match(src, /data-testid="backup-now"/);
  assert.match(src, /data-testid="backup-later"/);
  assert.match(src, /href="\/profile#backup"/);
  assert.match(src, /localStorage\.setItem\(BACKUP_SNOOZE_KEY, String\(snoozeUntil\(Date\.now\(\)\)\)\)/);
  assert.match(src, /backupDue\(\{/); // the "when to show" rule is still the shared one
});

test("same words in Thai and English (the message stays as clear as before)", () => {
  for (const s of [
    "ถึงเวลาสำรองข้อมูลแล้ว", "Time for a backup",
    "ถ้ามือถือหายหรือล้างข้อมูล Safari ทุกอย่างจะหายไป",
    "If your phone is lost or Safari data is cleared, everything is gone.",
    "สำรองข้อมูลครั้งล่าสุดเมื่อ", "Your last backup was",
    "สำรองเลย", "Back up now", "ไว้ทีหลัง", "Later",
  ]) assert.ok(src.includes(s), `missing text: ${s}`);
});

test("keeps SnapCal's own look: the warm warn colours, rounded card, and the dark pill button", () => {
  assert.match(src, /rounded-\[22px\] bg-warn/);
  assert.match(src, /text-warn-ink/);
  assert.match(src, /btn-primary/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,6}\b/, "no hard-coded colours: only the existing tokens");
});

test("both actions are at least 44 px tall", () => {
  assert.equal((src.match(/min-h-\[44px\]/g) ?? []).length, 2); // "Back up now" (!min-h) and "Later"
  assert.match(src, /!min-h-\[44px\]/);
});

test("compact layout: text on the left, actions stacked on the right, in one row", () => {
  assert.match(src, /<section className="flex items-center gap-3/);
  assert.match(src, /flex shrink-0 flex-col/);
});

test("when to show is unchanged: 14+ days (or never backed up), snooze 3 days", () => {
  const DAY = 86400000, now = Date.now();
  assert.equal(backupDue({ now, lastBackup: now - 13 * DAY, oldestEntryAt: now - 40 * DAY, snoozeUntil: null }), null);
  assert.equal(backupDue({ now, lastBackup: now - 14 * DAY, oldestEntryAt: now - 40 * DAY, snoozeUntil: null })?.days, 14);
  assert.equal(backupDue({ now, lastBackup: null, oldestEntryAt: now - 20 * DAY, snoozeUntil: null })?.never, true);
  assert.equal(backupDue({ now, lastBackup: null, oldestEntryAt: now - 20 * DAY, snoozeUntil: now + DAY }), null);
});
