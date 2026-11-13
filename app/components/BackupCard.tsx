"use client";
// Backup card on the Profile page.
// "Save a backup" puts everything on this phone (meals, recipes, profile,
// weight/steps, photos) into one file. "Restore" reads that file back.

import { useEffect, useRef, useState } from "react";
import {
  BACKUP_KEYS,
  backupCounts,
  backupFileName,
  makeBackup,
  parseBackup,
  type Backup,
  type BackupPart,
} from "../lib/backup";
import { thaiDateKey, thaiDateLabel } from "../lib/date";
import { useLang } from "../lib/lang";
import { allPhotos, putPhotos } from "../lib/photos";

const LAST_KEY = "yfd:v1:lastBackup";

function readLast(): number | null {
  try {
    const n = Number(localStorage.getItem(LAST_KEY));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Hand the file to the phone: the iPhone share sheet ("Save to Files") when possible, else a normal download. */
async function handOver(file: File): Promise<"saved" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return "saved";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError")
        return "cancelled";
      // Share not allowed here: fall back to a download below.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}

/** `restoreOnly`: the small version on the first setup screen (a new phone has nothing to back up yet). */
export function BackupCard({ restoreOnly = false }: { restoreOnly?: boolean }) {
  const { tr, lang } = useLang();
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState<"save" | "restore" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLast(readLast());
  }, []);

  const dateOf = (ms: number) => thaiDateLabel(thaiDateKey(new Date(ms)), lang);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const data = {} as Record<BackupPart, string | null>;
      for (const [k, key] of Object.entries(BACKUP_KEYS) as [
        BackupPart,
        string,
      ][])
        data[k] = localStorage.getItem(key);
      const backup = makeBackup(data, await allPhotos());
      const file = new File(
        [JSON.stringify(backup)],
        backupFileName(thaiDateKey()),
        { type: "application/json" },
      );
      if ((await handOver(file)) === "cancelled") return;
      try {
        localStorage.setItem(LAST_KEY, String(backup.savedAt));
      } catch {
        /* only the "last backup" note is lost */
      }
      setLast(backup.savedAt);
      setMsg({
        ok: true,
        text: tr(
          "สร้างไฟล์สำรองแล้ว เก็บไว้ในแอปไฟล์ (Files) หรือ iCloud นะ",
          "Backup file made. Keep it in the Files app or iCloud.",
        ),
      });
    } catch (e) {
      setMsg({
        ok: false,
        text:
          tr("สำรองไม่สำเร็จ: ", "Backup failed: ") +
          (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setBusy(null);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const res = parseBackup(await file.text(), lang);
    if (!res.ok) setMsg({ ok: false, text: res.message });
    else setPending(res.backup);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function restore(b: Backup) {
    setBusy("restore");
    try {
      await putPhotos(b.photos);
      for (const [k, key] of Object.entries(BACKUP_KEYS) as [
        BackupPart,
        string,
      ][]) {
        const v = b.data[k];
        if (v == null) localStorage.removeItem(key);
        else localStorage.setItem(key, v);
      }
      // Start the app again so every screen reads the restored data.
      window.location.replace(new URL("/", window.location.href));
    } catch (e) {
      setBusy(null);
      setPending(null);
      setMsg({
        ok: false,
        text:
          tr("กู้คืนไม่สำเร็จ: ", "Restore failed: ") +
          (e instanceof Error ? e.message : String(e)),
      });
    }
  }

  const c = pending ? backupCounts(pending) : null;

  return (
    <section className="card space-y-3 p-5" data-testid="backup-card">
      <h2 className="text-[17px] font-semibold">
        {restoreOnly
          ? tr("มีไฟล์สำรองอยู่แล้ว?", "Already have a backup?")
          : tr("สำรองข้อมูล", "Backup")}
      </h2>
      {restoreOnly ? (
        <p className="text-[14px] text-muted">
          {tr(
            "กู้คืนข้อมูลเดิมทั้งหมด ไม่ต้องตั้งค่าใหม่",
            "Bring back all your old data, no setup needed.",
          )}
        </p>
      ) : (
        <>
          <p className="text-[14px] text-muted">
            {tr(
              "ข้อมูลทั้งหมดอยู่ในโทรศัพท์เครื่องนี้เท่านั้น บันทึกไฟล์สำรองไว้ ถ้าข้อมูลหายหรือเปลี่ยนเครื่อง ก็กู้คืนได้",
              "All your data lives only on this phone. Save a backup file, so you can bring it back if it gets lost or you change phones.",
            )}
          </p>
          <p className="text-[14px]" data-testid="last-backup">
            {last
              ? tr(`สำรองล่าสุด: ${dateOf(last)}`, `Last backup: ${dateOf(last)}`)
              : tr("ยังไม่เคยสำรอง", "No backup yet")}
          </p>
        </>
      )}

      {msg && (
        <p
          className={`rounded-xl px-3 py-2 text-[15px] ${msg.ok ? "bg-olive-soft text-olive-dark" : "bg-warn text-warn-ink"}`}
          role="status"
        >
          {msg.text}
        </p>
      )}

      {pending && c ? (
        <div
          className="space-y-3 rounded-2xl bg-warn p-4 text-warn-ink"
          data-testid="restore-confirm"
        >
          <p className="text-[15px]">
            {tr(
              `ไฟล์สำรองวันที่ ${dateOf(pending.savedAt)}`,
              `Backup from ${dateOf(pending.savedAt)}`,
            )}
            <br />
            {tr(
              `${c.meals} มื้อ · ${c.recipes} สูตร · น้ำหนัก/ก้าว ${c.days} วัน · ${c.photos} รูป`,
              `${c.meals} meals · ${c.recipes} recipes · ${c.days} weight/step days · ${c.photos} photos`,
            )}
          </p>
          <p className="text-[15px] font-semibold">
            {tr(
              "ข้อมูลที่อยู่ในเครื่องตอนนี้จะถูกแทนที่ด้วยไฟล์นี้ทั้งหมด",
              "Everything on this phone now will be replaced by this backup.",
            )}
          </p>
          <button
            className="btn-primary w-full"
            disabled={busy != null}
            onClick={() => restore(pending)}
          >
            {busy === "restore"
              ? tr("กำลังกู้คืน…", "Restoring…")
              : tr("กู้คืนจากไฟล์นี้", "Restore this backup")}
          </button>
          <button
            className="btn-soft w-full"
            disabled={busy != null}
            onClick={() => setPending(null)}
          >
            {tr("ยกเลิก", "Cancel")}
          </button>
        </div>
      ) : (
        <>
          {!restoreOnly && (
            <button
              className="btn-primary w-full"
              disabled={busy != null}
              onClick={save}
            >
              {busy === "save"
                ? tr("กำลังเตรียมไฟล์…", "Making the file…")
                : tr("💾 บันทึกไฟล์สำรอง", "💾 Save a backup")}
            </button>
          )}
          <button
            className="btn-soft w-full"
            disabled={busy != null}
            onClick={() => fileRef.current?.click()}
          >
            {tr("กู้คืนจากไฟล์สำรอง", "Restore from a backup")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="restore-input"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </>
      )}
    </section>
  );
}
