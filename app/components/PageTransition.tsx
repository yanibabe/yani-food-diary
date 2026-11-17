"use client";
// Round 51: the old screen stays on screen until the new one is ready, then they melt together
// (real View Transitions). Where the browser cannot do it, nothing changes: the soft .page-enter fade runs as before.
import { useEffect, ViewTransition } from "react";
import { viewTransitionsSupported } from "../lib/viewTransition";

export function PageTransition({ children }: { children: React.ReactNode }) {
  // Tell the CSS the melt is available, so the old fade does not also run on top of it (no double animation).
  useEffect(() => {
    try {
      if (viewTransitionsSupported(document, window.CSS)) document.documentElement.dataset.vt = "1";
    } catch {
      /* fine: the old fade stays */
    }
  }, []);
  return <ViewTransition default="page-melt">{children}</ViewTransition>;
}
