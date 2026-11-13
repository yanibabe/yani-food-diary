"use client";
// Where her buddy is saved on the phone (localStorage). Included in the backup file.

import { useCallback, useEffect, useState } from "react";
import { BACKUP_KEYS } from "../backup";
import { cleanBuddy, parseBuddy, type BuddyConfig } from "./parts";

export function readBuddy(): BuddyConfig | null {
  try {
    return parseBuddy(localStorage.getItem(BACKUP_KEYS.buddy));
  } catch {
    return null;
  }
}

/** Returns an error message, or null when saved. */
export function writeBuddy(b: BuddyConfig): string | null {
  try {
    localStorage.setItem(BACKUP_KEYS.buddy, JSON.stringify(cleanBuddy(b)));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Her saved buddy (null = not made yet, or still loading) and a save function. */
export function useBuddy(): { buddy: BuddyConfig | null; loaded: boolean; save: (b: BuddyConfig) => string | null } {
  const [buddy, setBuddy] = useState<BuddyConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // localStorage only exists on the phone, so read it after the page shows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuddy(readBuddy());
    setLoaded(true);
  }, []);
  const save = useCallback((b: BuddyConfig) => {
    const err = writeBuddy(b);
    if (!err) setBuddy(cleanBuddy(b));
    return err;
  }, []);
  return { buddy, loaded, save };
}
