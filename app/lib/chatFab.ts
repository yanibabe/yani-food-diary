// Round 54: the floating "ask before eating" button. Pure position math (no React, no browser storage),
// so the tests can run it. The button is a 52px circle that she can drag; on release it snaps to the
// nearest left/right edge. Only { side, y } is remembered; the x is worked out from the screen width,
// so a rotation or a different screen size never leaves it off-screen.

export const FAB_KEY = "yfd:v1:chatFab";
export const FAB_SIZE = 52;
export const FAB_MARGIN = 8;
/** Moving less than this (in px) is still a tap. */
export const DRAG_THRESHOLD = 6;

export type FabSide = "left" | "right";
export type FabStored = { side: FabSide; y: number };
/** Space the button must keep clear: top = status bar / notch, bottom = the tab bar + home bar. */
export type Insets = { top: number; bottom: number };

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** The lowest and highest top edge the button may have. */
export function yRange(vh: number, insets: Insets): { min: number; max: number } {
  const min = Math.max(0, num(insets.top, 0)) + FAB_MARGIN;
  const max = vh - Math.max(0, num(insets.bottom, 0)) - FAB_SIZE - FAB_MARGIN;
  return { min, max: Math.max(min, max) };
}

export function clampY(y: number, vh: number, insets: Insets): number {
  const { min, max } = yRange(vh, insets);
  return Math.min(max, Math.max(min, num(y, max)));
}

export function clampX(x: number, vw: number): number {
  return Math.min(Math.max(0, vw - FAB_SIZE), Math.max(0, num(x, 0)));
}

export function fabX(side: FabSide, vw: number): number {
  return side === "left" ? FAB_MARGIN : Math.max(FAB_MARGIN, vw - FAB_SIZE - FAB_MARGIN);
}

/** Which edge is nearer to the button's centre. */
export function snapSide(x: number, vw: number): FabSide {
  return x + FAB_SIZE / 2 < vw / 2 ? "left" : "right";
}

/** Before she ever moves it: right edge, just above the tab bar. */
export function defaultFab(vh: number, insets: Insets): FabStored {
  const { max } = yRange(vh, insets);
  return { side: "right", y: clampY(max - 56, vh, insets) };
}

/** Where to draw it now (always inside the screen and clear of the tab bar). */
export function placeFab(stored: FabStored | null, vw: number, vh: number, insets: Insets): { x: number; y: number; side: FabSide } {
  const s = stored ?? defaultFab(vh, insets);
  return { x: fabX(s.side, vw), y: clampY(s.y, vh, insets), side: s.side };
}

/** While dragging: follows the finger, kept on screen. */
export function dragPos(start: { x: number; y: number }, dx: number, dy: number, vw: number, vh: number, insets: Insets): { x: number; y: number } {
  return { x: clampX(start.x + dx, vw), y: clampY(start.y + dy, vh, insets) };
}

/** On release: snap to the nearest edge. This is what gets remembered. */
export function releaseFab(x: number, y: number, vw: number, vh: number, insets: Insets): FabStored {
  return { side: snapSide(x, vw), y: clampY(y, vh, insets) };
}

/** Has the finger moved far enough to count as a drag (not a tap)? */
export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}

/** Saved text → a safe position, or null (nothing / broken / wrong shape). */
export function parseFab(raw: string | null): FabStored | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (o.side !== "left" && o.side !== "right") return null;
    if (typeof o.y !== "number" || !Number.isFinite(o.y)) return null;
    return { side: o.side, y: o.y };
  } catch {
    return null;
  }
}

export function serializeFab(s: FabStored): string {
  return JSON.stringify({ side: s.side, y: Math.round(s.y) });
}

/** Where is the button allowed to show? Only the main tab pages. */
export function fabAllowedOn(path: string | null | undefined): boolean {
  return path === "/" || path === "/recipes" || path === "/profile";
}

/** The overall rule: shown on the tab pages, hidden while any layer or the chat is open. */
export function fabVisible(path: string | null | undefined, overlayOpen: boolean, chatOpen: boolean): boolean {
  return fabAllowedOn(path) && !overlayOpen && !chatOpen;
}
