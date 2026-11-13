// Passcode for the AI: strangers who only have the link can't spend Yani's AI credit.
// The real passcode lives on the server (Vercel setting APP_PASSCODE), never in the app code.
// Each phone types it once; it is remembered on that phone.
// No React and no browser storage here, so the tests can use it.

/** Header the app sends with every AI call. */
export const PASSCODE_HEADER = "x-snapcal-passcode";
/** Where the phone remembers it (not part of the backup file). */
export const PASSCODE_KEY = "yfd:v1:passcode";

/** Same text after trimming spaces? Compared without stopping early, so timing gives nothing away. */
export function passcodeMatches(expected: string, given: string | null | undefined): boolean {
  const a = expected.trim();
  const b = (given ?? "").trim();
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Headers can only carry plain letters, so Thai passcodes are encoded on the way. */
export function passcodeHeaderValue(code: string): string {
  return encodeURIComponent(code.trim());
}

export function readPasscodeHeader(v: string | null): string | null {
  if (v == null) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
