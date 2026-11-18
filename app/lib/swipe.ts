// Pure helpers for the swipe-left-to-delete rows on the home page.

/** Width of the revealed red button, in px. */
export const SWIPE_BUTTON_W = 88;
/** How far a finger must move before we decide what the gesture is. */
export const SWIPE_SLOP = 8;
/** Horizontal must beat vertical by this factor to count as a swipe. */
export const SWIPE_RATIO = 1.5;

export type SwipeDecision = "pending" | "horizontal" | "vertical";

/** Decide what a drag is. Only a clearly-horizontal move starts a swipe; anything else keeps page scroll. */
export function decideSwipe(dx: number, dy: number): SwipeDecision {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < SWIPE_SLOP && ay < SWIPE_SLOP) return "pending";
  if (ax >= SWIPE_SLOP && ax >= ay * SWIPE_RATIO) return "horizontal";
  if (ay >= SWIPE_SLOP) return "vertical";
  return "pending";
}

/** Where the row sits while dragging: never right of 0, never far past the button (small rubber band). */
export function dragOffset(dx: number, width: number, wasOpen: boolean): number {
  const start = wasOpen ? -width : 0;
  const raw = start + dx;
  const min = -width * 1.25;
  return Math.max(min, Math.min(0, raw));
}

/** Where the row settles on release: 0 (closed) or -width (open). Never deletes. */
export function settleOffset(dx: number, width: number, wasOpen: boolean): number {
  const pos = dragOffset(dx, width, wasOpen);
  if (wasOpen) return dx > width * 0.25 ? 0 : -width;
  return pos < -width * 0.4 ? -width : 0;
}
