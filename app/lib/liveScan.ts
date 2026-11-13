// Small pure helpers for the live camera barcode scanner (no browser needed, so they can be tested).

/** The middle band of a video frame where the on-screen guide box sits. Barcodes are read only here. */
export function scanArea(videoW: number, videoH: number, maxW = 960) {
  const w = Math.round(videoW * 0.8);
  const h = Math.round(videoH * 0.4);
  const x = Math.round((videoW - w) / 2);
  const y = Math.round((videoH - h) / 2);
  const scale = w > maxW ? maxW / w : 1; // smaller picture = faster reading
  return { x, y, w, h, outW: Math.round(w * scale), outH: Math.round(h * scale) };
}

/**
 * Accept a code only after it was read twice in a row (the same number both times).
 * One wrong read can slip past the check digit; two matching reads almost never do.
 */
export function makeConfirmer(needed = 2) {
  let last: string | null = null;
  let count = 0;
  return (code: string | null): string | null => {
    if (!code) return null; // a blurry frame in between doesn't reset the count
    if (code === last) count += 1;
    else {
      last = code;
      count = 1;
    }
    return count >= needed ? code : null;
  };
}

/** Why the camera could not start, as a short kind the screen turns into friendly words. */
export function cameraErrorKind(e: unknown): "denied" | "none" | "other" {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotSupportedError") return "none";
  return "other";
}
