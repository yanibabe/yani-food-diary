"use client";
// Round 54: a page that opens its own full-screen layer / sheet tells the floating chat button to hide.
// (A tiny shared flag; the button listens.) Each page uses its own key, so two pages never switch each other off.

import { useEffect, useSyncExternalStore } from "react";

const open = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setOverlayOpen(key: string, on: boolean) {
  const had = open.has(key);
  if (on === had) return;
  if (on) open.add(key);
  else open.delete(key);
  emit();
}

/** Call from a page: while `on` is true the chat button hides. */
export function useReportOverlay(key: string, on: boolean) {
  useEffect(() => {
    setOverlayOpen(key, on);
    return () => setOverlayOpen(key, false);
  }, [key, on]);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** true while any page reports an open layer. */
export function useAnyOverlay(): boolean {
  return useSyncExternalStore(subscribe, () => open.size > 0, () => false);
}
