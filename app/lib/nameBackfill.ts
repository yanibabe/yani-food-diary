// Round 79: fill in the other-language names in the background.
// Order, cheapest first: (1) the app's food table, (2) names translated before (the phone's memory),
// (3) ONE AI call for up to 60 names. At most MAX_CALLS_PER_DAY calls a day; a failed call pauses the
// AI part for one hour (silently). It never changes updatedAt and never blocks the screen.

import { missingNames, type Lookup } from "./names.ts";
import { MAX_NAMES, type NamePair } from "./translateNames.ts";
import { FAIL_PAUSE_MS, addPairs, loadRuns, saveRuns, type NameTrCache, type Runs, type StorageLike } from "./nameTr.ts";

export const MAX_CALLS_PER_DAY = 12;

type Shape = Parameters<typeof missingNames>[0];

export type BackfillIO = {
  /** The names as they are on the phone right now. */
  read: () => Shape;
  /** Merge names in everywhere (must not touch updatedAt). Called with a lookup, possibly several times. */
  apply: (lookup: Lookup) => void;
  /** One AI call for up to 60 names. May throw. */
  translate: (names: string[]) => Promise<NamePair[]>;
  cache: NameTrCache;
  storage: StorageLike | null;
  /** "YYYY-MM-DD" of today. */
  today: string;
  online?: boolean;
  /** Time in ms (for the one-hour pause after a failure). Defaults to Date.now(). */
  now?: number;
};

export type BackfillResult = { missing: number; calls: number; filled: number; stoppedBy: "none" | "offline" | "budget" | "failed" | "done" };

/** Split into batches of at most 60. */
export function batches<T>(list: T[], size = MAX_NAMES): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function runBackfill(io: BackfillIO): Promise<BackfillResult> {
  let cache = io.cache;
  const lookup: Lookup = (n) => cache[n];
  // Free sources first (food table + memory) — this part needs no network.
  io.apply(lookup);
  const start = missingNames(io.read(), lookup);
  const res: BackfillResult = { missing: start.length, calls: 0, filled: 0, stoppedBy: "none" };
  if (!start.length) return { ...res, stoppedBy: "done" };
  if (io.online === false) return { ...res, stoppedBy: "offline" };
  let runs: Runs = loadRuns(io.today, io.storage);
  const now = io.now ?? Date.now();
  if (runs.failedAt > 0 && now - runs.failedAt < FAIL_PAUSE_MS) return { ...res, stoppedBy: "failed" };
  if (runs.calls >= MAX_CALLS_PER_DAY) return { ...res, stoppedBy: "budget" };
  for (const batch of batches(start)) {
    if (runs.calls >= MAX_CALLS_PER_DAY) return { ...res, stoppedBy: "budget" };
    // Count the call BEFORE it, so a crash in the middle can never cause endless retries.
    runs = { ...runs, calls: runs.calls + 1 };
    saveRuns(runs, io.storage);
    res.calls++;
    let pairs: NamePair[];
    try {
      pairs = await io.translate(batch);
    } catch {
      runs = { ...runs, failedAt: io.now ?? Date.now() };
      saveRuns(runs, io.storage);
      return { ...res, stoppedBy: "failed" };
    }
    if (runs.failedAt) {
      // It worked again: the pause is over for good.
      runs = { ...runs, failedAt: 0 };
      saveRuns(runs, io.storage);
    }
    cache = addPairs(cache, pairs, io.storage);
    res.filled += pairs.length;
    io.apply(lookup);
  }
  return { ...res, stoppedBy: "done" };
}
