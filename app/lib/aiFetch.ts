"use client";
// Every AI call goes through aiFetch. It adds the passcode this phone remembers.
// If the server says the passcode is missing or wrong, it opens the passcode box
// (PasscodeBox), waits for a correct one, remembers it, and tries the call again.

import { PASSCODE_HEADER, PASSCODE_KEY, passcodeHeaderValue } from "./passcode";
import type { Lang } from "./i18n";

type Asker = () => Promise<string | null>;
let asker: Asker | null = null;
/** PasscodeBox registers itself here. */
export function setPasscodeAsker(fn: Asker | null) {
  asker = fn;
}

function readCode(): string | null {
  try {
    return localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

function writeCode(code: string | null) {
  try {
    if (code == null) localStorage.removeItem(PASSCODE_KEY);
    else localStorage.setItem(PASSCODE_KEY, code);
  } catch {
    // storage blocked: it will just ask again next time
  }
}

function send(url: string, body: unknown, code: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (code) headers[PASSCODE_HEADER] = passcodeHeaderValue(code);
  return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
}

async function isPasscodeError(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const data = await res.clone().json().catch(() => null);
  return data?.error === "passcode";
}

export async function aiFetch(url: string, body: unknown, lang: Lang): Promise<Response> {
  const res = await send(url, body, readCode());
  if (!(await isPasscodeError(res)) || !asker) return res;
  writeCode(null);
  const code = await asker(); // only resolves with a passcode the server accepted
  if (!code) {
    const message = lang === "en" ? "The AI needs the passcode first." : "ต้องใส่รหัสผ่านก่อนใช้ AI";
    return Response.json({ error: "passcode", message }, { status: 401 });
  }
  writeCode(code);
  return send(url, body, code);
}

/** Ask the server if this passcode is right (used by the passcode box). */
export async function checkPasscode(code: string, lang: Lang): Promise<"ok" | "wrong" | "offline"> {
  try {
    const res = await fetch("/api/passcode", {
      method: "POST",
      headers: { [PASSCODE_HEADER]: passcodeHeaderValue(code), "Accept-Language": lang },
    });
    return res.ok ? "ok" : res.status === 401 ? "wrong" : "offline";
  } catch {
    return "offline";
  }
}
