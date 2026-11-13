"use client";
// Gentle card on Today: "it's been a while since your last backup".
// Shows when the last backup (or the first meal, if never backed up) is 14+ days old.
// "Later" hides it for 3 days. Backing up on the Profile page resets it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { BACKUP_SNOOZE_KEY, LAST_BACKUP_KEY, backupDue, snoozeUntil } from "../lib/backup";
import { useLang } from "../lib/lang";
import type { Entry } from "../lib/types";

function readNum(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function BackupReminder({ entries }: { entries: Entry[] }) {
  const { tr } = useLang();
  const [due, setDue] = useState<{ days: number; never: boolean } | null>(null);

  useEffect(() => {
    const oldest = entries.length ? Math.min(...entries.map((e) => e.createdAt)) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDue(
      backupDue({
        now: Date.now(),
        lastBackup: readNum(LAST_BACKUP_KEY),
        oldestEntryAt: oldest,
        snoozeUntil: readNum(BACKUP_SNOOZE_KEY),
      }),
    );
  }, [entries]);

  if (!due) return null;

  function later() {
    try {
      localStorage.setItem(BACKUP_SNOOZE_KEY, String(snoozeUntil(Date.now())));
    } catch {
      // storage blocked: just hide it for now
    }
    setDue(null);
  }

  return (
    <section className="rounded-[22px] bg-warn px-4 py-4 text-warn-ink" data-testid="backup-reminder">
      <p className="text-[16px] font-semibold">💾 {tr("ถึงเวลาสำรองข้อมูลแล้ว", "Time for a backup")}</p>
      <p className="mt-1 text-[14px]">
        {due.never
          ? tr(
              `คุณบันทึกมา ${due.days} วันแล้ว แต่ยังไม่เคยสำรองข้อมูล ถ้ามือถือหายหรือล้างข้อมูล Safari ทุกอย่างจะหายไป`,
              `You've been logging for ${due.days} days but haven't made a backup yet. If your phone is lost or Safari data is cleared, everything is gone.`,
            )
          : tr(`สำรองข้อมูลครั้งล่าสุดเมื่อ ${due.days} วันก่อน`, `Your last backup was ${due.days} days ago.`)}
      </p>
      <div className="mt-3 flex gap-2">
        <Link href="/profile#backup" className="btn-primary flex-1 text-center" data-testid="backup-now">
          {tr("สำรองเลย", "Back up now")}
        </Link>
        <button className="btn-soft flex-1" onClick={later} data-testid="backup-later">
          {tr("ไว้ทีหลัง", "Later")}
        </button>
      </div>
    </section>
  );
}
