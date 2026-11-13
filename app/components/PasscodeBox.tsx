"use client";
// The "enter passcode" box. It only appears when an AI call is refused for a missing
// or wrong passcode. After a correct passcode, this phone remembers it.

import { useEffect, useRef, useState } from "react";
import { checkPasscode, setPasscodeAsker } from "../lib/aiFetch";
import { useLang } from "../lib/lang";
import { Sheet } from "./ui";

export function PasscodeBox() {
  const { tr, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = useRef<((code: string | null) => void) | null>(null);

  useEffect(() => {
    setPasscodeAsker(
      () =>
        new Promise((resolve) => {
          done.current?.(null); // an older question that was never answered
          done.current = resolve;
          setCode("");
          setMsg(null);
          setOpen(true);
        }),
    );
    return () => setPasscodeAsker(null);
  }, []);

  function finish(result: string | null) {
    setOpen(false);
    done.current?.(result);
    done.current = null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await checkPasscode(c, lang);
    setBusy(false);
    if (r === "ok") finish(c);
    else if (r === "wrong") setMsg(tr("รหัสผ่านไม่ถูกต้อง ลองอีกครั้ง", "Wrong passcode. Please try again."));
    else setMsg(tr("เชื่อมต่อไม่ได้ ลองอีกครั้ง", "Couldn't connect. Please try again."));
  }

  return (
    <Sheet open={open} onClose={() => finish(null)} title={tr("🔒 ใส่รหัสผ่าน", "🔒 Enter the passcode")}>
      <form onSubmit={submit} className="space-y-3 pb-4" data-testid="passcode-box">
        <p className="text-[15px] text-muted">
          {tr(
            "ต้องใช้รหัสผ่านก่อนใช้ AI ครั้งแรก ใส่ครั้งเดียว มือถือเครื่องนี้จะจำไว้ ถามรหัสได้จากเจ้าของแอป",
            "The AI needs a passcode the first time. Type it once and this phone remembers it. Ask the app's owner for it.",
          )}
        </p>
        <input
          className="field w-full text-[20px]"
          type="password"
          autoComplete="off"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label={tr("รหัสผ่าน", "Passcode")}
          data-testid="passcode-input"
        />
        {msg && <p className="text-[14px] text-danger" role="alert">{msg}</p>}
        <button className="btn-primary w-full" disabled={!code.trim() || busy} data-testid="passcode-ok">
          {busy ? tr("กำลังตรวจ…", "Checking…") : tr("ตกลง", "OK")}
        </button>
      </form>
    </Sheet>
  );
}
