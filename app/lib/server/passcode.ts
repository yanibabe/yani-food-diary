// Server side of the AI passcode. When APP_PASSCODE is not set, AI calls are open (e.g. on this Mac).
import { trFor, type Lang } from "../i18n.ts";
import { PASSCODE_HEADER, passcodeMatches, readPasscodeHeader } from "../passcode.ts";

/** null = allowed. Otherwise a 401 answer to send back (after a short pause, so guessing is slow). */
export async function passcodeBlock(req: Request, lang: Lang): Promise<Response | null> {
  const expected = process.env.APP_PASSCODE?.trim();
  if (!expected) return null;
  if (passcodeMatches(expected, readPasscodeHeader(req.headers.get(PASSCODE_HEADER)))) return null;
  await new Promise((r) => setTimeout(r, 800));
  return Response.json(
    { error: "passcode", message: trFor(lang)("รหัสผ่านไม่ถูกต้อง", "Wrong passcode") },
    { status: 401 },
  );
}
