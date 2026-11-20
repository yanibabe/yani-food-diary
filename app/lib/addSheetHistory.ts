// Batch 3: browser Back and the Add food sheet.
// The sheet owns ONE history step (marked yfdAddSheet, copied from the current state so Next.js still
// recognises it). A full-screen layer (review / AI / photo / barcode / manual) pushes one more step on top.
//   Home → [sheet step] → [layer step]
// Back from the layer returns to the sheet (search words kept); Back from the sheet closes it. Leaving by a link
// first removes the sheet step, so no dead step is left behind. Pure decisions live here so tests can run them.

export const ADD_SHEET_KEY = "yfdAddSheet";

/** The state for the sheet step: keeps whatever Next.js put there (it checks for its own marker on Back). */
export function sheetStepState(cur: unknown): Record<string, unknown> {
  const base = cur && typeof cur === "object" ? (cur as Record<string, unknown>) : {};
  return { ...base, [ADD_SHEET_KEY]: 1 };
}

export function isSheetStep(s: unknown): boolean {
  return !!s && typeof s === "object" && (s as Record<string, unknown>)[ADD_SHEET_KEY] === 1;
}

export type PopAction = "none" | "close-sheet" | "reopen-sheet" | "drop-sheet-step" | "run-pending";

/** What to do when the browser went back / forward. */
export function actionOnPop(i: { layerOpen: boolean; stepActive: boolean; pending: boolean; reopen: boolean; state: unknown }): PopAction {
  if (i.layerOpen) {
    // The layer was closed by Back (or by our own history.back()).
    if (i.reopen && i.stepActive) return "reopen-sheet";
    if (i.stepActive && isSheetStep(i.state)) return "drop-sheet-step"; // e.g. after Save: also remove the sheet step
    return "none";
  }
  if (i.pending) return "run-pending"; // we removed the sheet step ourselves to leave by a link
  if (i.stepActive && !isSheetStep(i.state)) return "close-sheet"; // Back from the sheet itself
  return "none";
}

/** Opening the sheet: push a step only if we do not already own one (a double tap must not add two). */
export function shouldPushSheetStep(stepActive: boolean): boolean {
  return !stepActive;
}

/** Closing / leaving: go back one step only if our sheet step is still the top one. */
export function shouldRemoveSheetStep(stepActive: boolean, state: unknown): boolean {
  return stepActive && isSheetStep(state);
}
