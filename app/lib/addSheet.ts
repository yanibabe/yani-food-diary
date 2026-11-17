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
