"use client";
// Back button closes an open Home sheet. One history step per open sheet (marked yfdSheet in history.state),
// same style as ChatFab (yfdChat) and addLayer (yfdAddLayer). Pure decisions are exported so tests can run them.

import { useEffect, useRef } from "react";

export const SHEET_HISTORY_KEY = "yfdSheet";

/** Marks other layers push on top of our step (they copy our state with a spread). */
const OTHER_LAYER_KEYS = ["yfdChat", "yfdAddLayer"];

export function sheetHistoryState(cur: unknown): Record<string, unknown> {
  const base = cur && typeof cur === "object" ? (cur as Record<string, unknown>) : {};
  return { ...base, [SHEET_HISTORY_KEY]: 1 };
}

/** Our sheet step is the top step: marked, and no chat / add layer sits above it. */
export function isSheetOnTop(s: unknown): boolean {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return o[SHEET_HISTORY_KEY] === 1 && !OTHER_LAYER_KEYS.some((k) => o[k]);
}

/** Sheet just opened: push our step once (strict-mode double effects must not push twice). */
export function shouldPush(open: boolean, pushed: boolean): boolean {
  return open && !pushed;
}

/** Sheet closed by its own button/backdrop: go back one step only if our step is still on top. */
export function shouldBackOnClose(open: boolean, pushed: boolean, state: unknown): boolean {
  return !open && pushed && isSheetOnTop(state);
}

/** The browser went back while open: close the sheet only when our step is gone (not when a layer above it popped). */
export function shouldCloseOnPop(open: boolean, stateAfterPop: unknown): boolean {
  return open && !isSheetOnTop(stateAfterPop);
}

export function useBackClose(open: boolean, onClose: () => void): void {
  const pushed = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (shouldPush(open, pushed.current)) {
      window.history.pushState(sheetHistoryState(window.history.state), "", window.location.href);
      pushed.current = true;
    } else if (shouldBackOnClose(open, pushed.current, window.history.state)) {
      pushed.current = false;
      window.history.back();
    } else if (!open) {
      pushed.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      if (!shouldCloseOnPop(true, window.history.state)) return;
      pushed.current = false; // our step is gone, so closing must not go back again
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);
}
