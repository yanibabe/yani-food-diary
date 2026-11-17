// Round 51: pure helpers for the smooth page-to-page "melt" (View Transitions). No React here, so tests can run them.

/** The pieces of the browser we look at (kept tiny so a test can fake them). */
export type VtDoc = { startViewTransition?: unknown } | null | undefined;
export type VtCss = { supports?: (q: string) => boolean } | null | undefined;

/**
 * Can this browser do the melt the way React needs it (startViewTransition + transition types)?
 * If not, the old soft fade-in (.page-enter) stays in charge, so a page is never blank.
 */
export function viewTransitionsSupported(doc: VtDoc, css: VtCss): boolean {
  if (!doc || typeof doc.startViewTransition !== "function") return false;
  try {
    return !!css?.supports?.("selector(:active-view-transition-type(x))");
  } catch {
    return false;
  }
}

/** Where the Add food sheet can lead. `q` is "" for today, or "?date=YYYY-MM-DD". */
export function addSheetPrefetchUrls(q: string): string[] {
  return [`/add/text${q}`, `/add/search${q}`, `/add/photo${q}`, `/add/barcode${q}`, `/add/manual${q}`, `/recipes${q}`];
}
