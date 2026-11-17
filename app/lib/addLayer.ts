// Round 53: the Add food sheet opens its next screen IN PLACE, as a full-screen layer on top of Today
// (a state change, so it is there at once; no page change). Pure helpers here (no React) so the tests can run them.

import { cleanPrefill } from "./addSheet.ts";
import type { Ingredient } from "./types.ts";

/** What the layer shows: the AI check of typed words, or the review of one chosen food. null = no layer. */
export type AddLayer = { kind: "ai"; text: string } | { kind: "review"; ing: Ingredient } | null;

/** The mark we put on our one history step, so Back can tell it is ours. */
export const LAYER_HISTORY_KEY = "yfdAddLayer";

export function layerHistoryState(): Record<string, 1> {
  return { [LAYER_HISTORY_KEY]: 1 };
}

export function isLayerHistoryState(s: unknown): boolean {
  return !!s && typeof s === "object" && (s as Record<string, unknown>)[LAYER_HISTORY_KEY] === 1;
}

/** Open a layer. `push` = add one history step (so Back closes the layer). A second tap while one is open changes nothing. */
export function openAddLayer(cur: AddLayer, next: AddLayer): { layer: AddLayer; push: boolean } {
  if (cur !== null || next === null) return { layer: cur, push: false };
  if (next.kind === "ai") {
    const text = cleanPrefill(next.text);
    if (!text) return { layer: cur, push: false };
    return { layer: { kind: "ai", text }, push: true };
  }
  return { layer: next, push: true };
}

/** The browser went back (swipe, Back button, or our own history.back()): the layer is gone. */
export function layerAfterPop(): AddLayer {
  return null;
}

/** How to close from a button. A layer always owns one history step, so closing = going back one step. */
export function closeAddLayerAction(cur: AddLayer): "history-back" | "none" {
  return cur === null ? "none" : "history-back";
}
