"use client";
// React side of lib/addSheetHistory.ts: owns the refs and the one Back listener for the Add food sheet.

import { useCallback, useEffect, useRef } from "react";
import { ADD_SHEET_KEY, actionOnPop, isSheetStep, shouldPushSheetStep, shouldRemoveSheetStep, sheetStepState } from "./addSheetHistory";

export function useAddSheetHistory(io: {
  /** Is a full-screen layer open right now? */
  layerOpen: () => boolean;
  /** Back closed the layer: clear it. */
  closeLayerState: () => void;
  setSheetOpen: (open: boolean) => void;
}) {
  const stepActive = useRef(false);
  const reopen = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const ioRef = useRef(io);
  useEffect(() => {
    ioRef.current = io;
  });

  // A reload with the sheet open keeps our marker on the page's entry while the sheet itself is gone: clear the
  // stale marker so Back is not confused later.
  useEffect(() => {
    if (!isSheetStep(window.history.state)) return;
    const { [ADD_SHEET_KEY]: _gone, ...rest } = window.history.state as Record<string, unknown>;
    void _gone;
    try {
      window.history.replaceState(rest, "", window.location.href);
    } catch {
      /* harmless */
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const act = actionOnPop({ layerOpen: ioRef.current.layerOpen(), stepActive: stepActive.current, pending: pending.current !== null, reopen: reopen.current, state: window.history.state });
      if (act === "none") return;
      if (act === "run-pending") {
        const go = pending.current;
        pending.current = null;
        go?.();
        return;
      }
      if (ioRef.current.layerOpen()) ioRef.current.closeLayerState();
      if (act === "reopen-sheet") ioRef.current.setSheetOpen(true);
      else if (act === "drop-sheet-step") {
        stepActive.current = false;
        window.history.back();
      } else if (act === "close-sheet") {
        stepActive.current = false;
        ioRef.current.setSheetOpen(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** The sheet just opened. */
  const pushStep = useCallback(() => {
    if (!shouldPushSheetStep(stepActive.current)) return;
    try {
      window.history.pushState(sheetStepState(window.history.state), "", window.location.href);
      stepActive.current = true;
    } catch {
      /* the sheet still works; only Back would leave the page */
    }
  }, []);

  /** Close the sheet from a button / backdrop / one-tap add, and remove its step. */
  const closeSheet = useCallback(() => {
    ioRef.current.setSheetOpen(false);
    const remove = shouldRemoveSheetStep(stepActive.current, window.history.state);
    stepActive.current = false;
    if (remove) window.history.back();
  }, []);

  /** A layer is about to open on top: Back / Cancel should come back to the sheet. */
  const layerOpening = useCallback(() => {
    reopen.current = stepActive.current;
  }, []);
  /** The layer was saved: do not come back to the sheet. */
  const layerSaved = useCallback(() => {
    reopen.current = false;
  }, []);

  /** Leave by a link: remove the sheet step first, then run `go` (no dead step left behind). */
  const runAfterStep = useCallback((go: () => void) => {
    if (!shouldRemoveSheetStep(stepActive.current, window.history.state)) {
      go();
      return;
    }
    stepActive.current = false;
    pending.current = go;
    window.history.back();
    setTimeout(() => {
      const f = pending.current;
      pending.current = null;
      f?.();
    }, 600); // fallback if the browser never answers
  }, []);

  return { pushStep, closeSheet, layerOpening, layerSaved, runAfterStep };
}
