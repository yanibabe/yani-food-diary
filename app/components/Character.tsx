"use client";
// Yani's brand character on Today, and the small "แต่งตัวน้อง" sheet (color + one decoration + cheeks).
// Her drawing (character-lines.png) is never changed; color is painted BEHIND it through the body mask.

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import { BACKUP_KEYS } from "../lib/backup";
import { BLUSH, CHAR_BOX, CHAR_COLORS, DECOS, DEFAULT_LOOK, cleanLook, parseLook, type CharDeco, type CharLook } from "../lib/character";

/** Saved look on this phone (included in the backup file). */
export function useCharLook() {
  const [look, setLook] = useState<CharLook>(DEFAULT_LOOK);
  useEffect(() => {
    // localStorage only exists on the phone, so read it after the page shows.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLook(parseLook(localStorage.getItem(BACKUP_KEYS.buddy)));
    } catch {
      /* keep the default */
    }
  }, []);
  const save = useCallback((l: CharLook): string | null => {
    try {
      localStorage.setItem(BACKUP_KEYS.buddy, JSON.stringify(cleanLook(l)));
      setLook(cleanLook(l));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, []);
  return { look, save };
}

/** Layers: color (through the body mask) → cheeks → her lines → decoration. */
export function CharacterPicture({ look, size }: { look: CharLook; size: number }) {
  const l = cleanLook(look);
  const mask = "url(/character-body.png) center / 100% 100% no-repeat";
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-0" style={{ background: l.color, WebkitMask: mask, mask }} />
      {/* Safe to inject: only our own fixed pieces, never saved text. */}
      {l.blush && <svg viewBox={`0 0 ${CHAR_BOX} ${CHAR_BOX}`} className="absolute inset-0 h-full w-full" dangerouslySetInnerHTML={{ __html: BLUSH }} />}
      {/* eslint-disable-next-line @next/next/no-img-element -- her exact file, layered; no resizing service needed */}
      <img src="/character-lines.png" alt="" width={size} height={size} className="absolute inset-0 h-full w-full" draggable={false} />
      {l.deco !== "none" && (
        <svg viewBox={`0 0 ${CHAR_BOX} ${CHAR_BOX}`} className="absolute inset-0 h-full w-full" dangerouslySetInnerHTML={{ __html: DECOS[l.deco].s }} />
      )}
    </span>
  );
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-testid={testId}
      className={`min-h-[44px] rounded-full border px-4 text-[15px] ${on ? "border-ink bg-yellow font-semibold" : "border-line bg-paper"}`}
    >
      {children}
    </button>
  );
}

/** Dress-up sheet. Changes show live; nothing is saved until "Save". */
export function CharacterMaker({ start, onClose, onSave }: { start: CharLook; onClose: () => void; onSave: (l: CharLook) => string | null }) {
  const { tr, lang } = useLang();
  const [draft, setDraft] = useState<CharLook>(start);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof CharLook>(k: K, v: CharLook[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const custom = !CHAR_COLORS.some((c) => c.toLowerCase() === draft.color.toLowerCase());

  return (
    <Sheet open onClose={onClose} title={tr("แต่งตัวน้อง", "Dress up")}>
      <div className="space-y-5 pb-4" data-testid="char-maker">
        <div className="sticky top-0 z-10 -mx-1 flex justify-center rounded-[20px] bg-cream py-3 shadow-[0_8px_12px_-10px_rgba(0,0,0,0.15)]">
          <CharacterPicture look={draft} size={170} />
        </div>

        <div>
          <p className="px-1 pb-2 text-[14px] text-muted">{tr("สีตัว", "Body color")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {CHAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("color", c)}
                aria-pressed={draft.color.toLowerCase() === c.toLowerCase()}
                aria-label={c === "#ffffff" ? tr("สีขาว (แบบต้นฉบับ)", "White (original)") : c}
                data-testid={`char-color-${c.slice(1)}`}
                className={`h-11 w-11 rounded-full border border-line ${draft.color.toLowerCase() === c.toLowerCase() ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                style={{ background: c }}
              />
            ))}
            <label
              className={`relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-line text-[18px] ${custom ? "outline-2 outline-offset-2 outline-ink" : ""}`}
              style={{ background: custom ? draft.color : "conic-gradient(#F4C0D1, #FAC775, #C0DD97, #9FE1CB, #B5D4F4, #CECBF6, #F4C0D1)" }}
              title={tr("เลือกสีเอง", "Pick any color")}
            >
              <input
                type="color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={draft.color}
                onChange={(e) => set("color", e.target.value)}
                aria-label={tr("เลือกสีเอง", "Pick any color")}
                data-testid="char-color-any"
              />
              {!custom && <span aria-hidden>+</span>}
            </label>
          </div>
        </div>

        <div>
          <p className="px-1 pb-2 text-[14px] text-muted">{tr("ของแต่ง (เลือก 1 อย่าง)", "Decoration (pick 1)")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DECOS) as CharDeco[]).map((d) => (
              <Chip key={d} on={draft.deco === d} onClick={() => set("deco", d)} testId={`char-deco-${d}`}>
                {DECOS[d][lang]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip on={draft.blush} onClick={() => set("blush", !draft.blush)} testId="char-blush">
            {tr("แก้มชมพู", "Pink cheeks")}
          </Chip>
          <Chip on={false} onClick={() => setDraft(DEFAULT_LOOK)} testId="char-reset">
            {tr("กลับเป็นแบบต้นฉบับ", "Back to original")}
          </Chip>
        </div>

        {error && (
          <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
            {tr("บันทึกไม่สำเร็จ", "Couldn't save")}: {error}
          </p>
        )}

        <button
          className="btn-primary w-full"
          data-testid="char-save"
          onClick={() => {
            const err = onSave(draft);
            if (err) setError(err);
            else onClose();
          }}
        >
          {tr("บันทึก", "Save")}
        </button>
      </div>
    </Sheet>
  );
}
