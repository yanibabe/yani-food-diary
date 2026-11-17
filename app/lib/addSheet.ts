// Round 46: pure helpers for the "search first" Add food sheet (no React here, so they are easy to test).

/** The longest typed text we carry in a link. */
export const PREFILL_MAX = 200;

/** Clean what she typed before it travels in a link or fills a box: trim, squeeze spaces, cap the length. */
export function cleanPrefill(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, PREFILL_MAX);
}

/**
 * A link into the add pages. `date` is the day on screen (kept only when it is not today, like before);
 * `text` (optional) travels as `q`, safely encoded (Thai, spaces, & and # all survive).
 */
export function buildAddUrl(mode: "search" | "text", date: string | null | undefined, text?: string): string {
  const p = new URLSearchParams();
  if (date) p.set("date", date);
  const q = cleanPrefill(text);
  if (q) p.set("q", q);
  const s = p.toString();
  return `/add/${mode}${s ? `?${s}` : ""}`;
}

// ---------------------------------------------------------------------------
// Round 47: live search inside the sheet, one hand-over at the end.
// ---------------------------------------------------------------------------

/** Extra link switches: `auto` = start the AI check right away (text page); `create` = open "my own food" (search page). */
export type AddUrlFlags = { auto?: boolean; create?: boolean };

/** Same as buildAddUrl, plus the two optional switches above. */
export function buildAddUrlWith(mode: "search" | "text", date: string | null | undefined, text: string | undefined, flags: AddUrlFlags): string {
  const p = new URLSearchParams();
  if (date) p.set("date", date);
  const q = cleanPrefill(text);
  if (q) p.set("q", q);
  if (flags.auto && q) p.set("auto", "1");
  if (flags.create && q) p.set("create", "1");
  const s = p.toString();
  return `/add/${mode}${s ? `?${s}` : ""}`;
}

/** The link used once, at the end: the search page picks the chosen food up and opens the review straight away. */
export function buildReviewUrl(date: string | null | undefined): string {
  const p = new URLSearchParams();
  p.set("from", "sheet");
  if (date) p.set("date", date);
  return `/add/search?${p.toString()}`;
}

/** The pinned "let the AI calculate" row shows from 2 typed characters. */
export const AI_ROW_MIN = 2;

export function showWholeDishRow(typed: string | null | undefined): boolean {
  return [...cleanPrefill(typed)].length >= AI_ROW_MIN;
}

/** Which ONE AI button is on screen. In the sheet it is always the whole-dish row; the page keeps its own estimate row. */
export function visibleAiRow(opts: { inSheet: boolean; typed: string; estimateOffered: boolean }): "whole-dish" | "estimate" | null {
  if (opts.inSheet) return showWholeDishRow(opts.typed) ? "whole-dish" : null;
  return opts.estimateOffered ? "estimate" : null;
}
