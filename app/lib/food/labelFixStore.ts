"use client";
// Where her label fixes are saved on the phone (localStorage). Included in the backup file.

import { BACKUP_KEYS } from "../backup";
import type { LabelFix } from "./labelFix";

export function readFixes(): LabelFix[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEYS.labelFixes);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Returns an error message, or null when saved. */
export function writeFixes(list: LabelFix[]): string | null {
  try {
    localStorage.setItem(BACKUP_KEYS.labelFixes, JSON.stringify(list));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
