// Backup: put everything saved on this phone into ONE file, and read it back.
// No React and no browser storage here, so the tests can use it.

import type { Lang } from "./i18n.ts";

/** The localStorage keys that hold her data (same names the app uses). */
export const BACKUP_KEYS = {
  entries: "yfd:v1:entries",
  recipes: "yfd:v1:recipes",
  goals: "yfd:v1:goals",
  body: "yfd:v1:body",
  water: "yfd:v1:water",
  labelFixes: "yfd:v1:labelFixes",
  lang: "yfd:v1:lang",
} as const;

export type BackupPart = keyof typeof BACKUP_KEYS;

export type Backup = {
  app: "snapcal";
  version: 1;
  savedAt: number;
  /** The raw saved text of each localStorage key (null = nothing saved). */
  data: Record<BackupPart, string | null>;
  /** Photo id → picture (data URL), from IndexedDB. */
  photos: Record<string, string>;
};

export function makeBackup(data: Record<BackupPart, string | null>, photos: Record<string, string>, now = Date.now()): Backup {
  return { app: "snapcal", version: 1, savedAt: now, data, photos };
}

/** File name like "snapcal-backup-2026-11-13.json". */
export function backupFileName(dateKey: string): string {
  return `snapcal-backup-${dateKey}.json`;
}

/** Small counts to show before restoring, so she knows what is inside. */
export function backupCounts(b: Backup): { meals: number; recipes: number; days: number; photos: number } {
  const len = (raw: string | null) => {
    try {
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v.length : 0;
    } catch {
      return 0;
    }
  };
  return { meals: len(b.data.entries), recipes: len(b.data.recipes), days: len(b.data.body), photos: Object.keys(b.photos).length };
}

/** Read a backup file's text. Returns the backup, or a message saying what is wrong. */
export function parseBackup(text: string, lang: Lang = "th"): { ok: true; backup: Backup } | { ok: false; message: string } {
  const bad = {
    ok: false as const,
    message: lang === "en" ? "This is not a SnapCal backup file." : "ไฟล์นี้ไม่ใช่ไฟล์สำรองของ SnapCal",
  };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return bad;
  }
  if (!v || typeof v !== "object") return bad;
  const o = v as Record<string, unknown>;
  if (o.app !== "snapcal" || o.version !== 1 || typeof o.savedAt !== "number") return bad;
  if (!o.data || typeof o.data !== "object" || !o.photos || typeof o.photos !== "object") return bad;

  const rawData = o.data as Record<string, unknown>;
  const data = {} as Record<BackupPart, string | null>;
  for (const k of Object.keys(BACKUP_KEYS) as BackupPart[]) {
    const raw = rawData[k];
    if (raw == null) {
      data[k] = null;
      continue;
    }
    if (typeof raw !== "string") return bad;
    // Each saved part must itself be readable, or the app would break after restoring.
    try {
      const parsed = k === "lang" ? raw : JSON.parse(raw);
      if (k === "lang" && raw !== "th" && raw !== "en") return bad;
      if ((k === "entries" || k === "recipes" || k === "body" || k === "water" || k === "labelFixes") && !Array.isArray(parsed)) return bad;
      if (k === "goals" && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) return bad;
    } catch {
      return bad;
    }
    data[k] = raw;
  }

  const photos: Record<string, string> = {};
  for (const [id, url] of Object.entries(o.photos as Record<string, unknown>)) {
    if (typeof url === "string" && url.startsWith("data:image/")) photos[id] = url;
  }
  return { ok: true, backup: { app: "snapcal", version: 1, savedAt: o.savedAt, data, photos } };
}

/** localStorage keys for the backup reminder (not part of the backup itself). */
export const LAST_BACKUP_KEY = "yfd:v1:lastBackup";
export const BACKUP_SNOOZE_KEY = "yfd:v1:backupSnooze";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Remind when the last backup (or the first meal, if never backed up) is this many days old. */
export const BACKUP_REMIND_DAYS = 14;
/** "Later" hides the reminder for this many days. */
export const BACKUP_SNOOZE_DAYS = 3;

/**
 * Should Today show the gentle "time to back up" card?
 * - Nothing saved yet → no.
 * - Never backed up → yes once the oldest meal is 14+ days old.
 * - Backed up before → yes once that backup is 14+ days old.
 * - "Later" pressed → hidden until the snooze ends.
 * Returns the number of days since the last backup (or since the first meal), or null when no reminder.
 */
export function backupDue(o: {
  now: number;
  lastBackup: number | null;
  oldestEntryAt: number | null;
  snoozeUntil: number | null;
}): { days: number; never: boolean } | null {
  if (o.snoozeUntil && o.now < o.snoozeUntil) return null;
  const from = o.lastBackup ?? o.oldestEntryAt;
  if (!from) return null;
  const days = Math.floor((o.now - from) / DAY_MS);
  return days >= BACKUP_REMIND_DAYS ? { days, never: !o.lastBackup } : null;
}

export function snoozeUntil(now: number): number {
  return now + BACKUP_SNOOZE_DAYS * DAY_MS;
}
