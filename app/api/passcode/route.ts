// Check a passcode before the phone remembers it.
import { passcodeBlock } from "@/app/lib/server/passcode";

export async function POST(req: Request) {
  const lang = req.headers.get("accept-language")?.startsWith("en") ? "en" : "th";
  const blocked = await passcodeBlock(req, lang);
  return blocked ?? Response.json({ ok: true });
}
