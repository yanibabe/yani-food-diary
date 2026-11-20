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

  // Step 1 of the Home refinement: same colours, same words, same actions, same conditions — just compact.
  // The text sits on the left and the two actions stack on the right (each still a full 44 px tap target).
  return (
    <section className="flex items-center gap-3 rounded-[22px] bg-warn py-2.5 pl-4 pr-2.5 text-warn-ink" data-testid="backup-reminder">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">💾 {tr("ถึงเวลาสำรองข้อมูลแล้ว", "Time for a backup")}</p>
        <p className="mt-0.5 text-[13px] leading-snug">
          {due.never
            ? tr(
                `คุณบันทึกมา ${due.days} วันแล้ว แต่ยังไม่เคยสำรองข้อมูล ถ้ามือถือหายหรือล้างข้อมูล Safari ทุกอย่างจะหายไป`,
                `You've been logging for ${due.days} days but haven't made a backup yet. If your phone is lost or Safari data is cleared, everything is gone.`,
              )
            : tr(`สำรองข้อมูลครั้งล่าสุดเมื่อ ${due.days} วันก่อน`, `Your last backup was ${due.days} days ago.`)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-0.5">
        <Link href="/profile#backup" className="btn-primary !min-h-[44px] justify-center px-4 text-[15px]" data-testid="backup-now">
          {tr("สำรองเลย", "Back up now")}
        </Link>
        <button className="min-h-[44px] rounded-full px-3 text-[14px] font-medium text-warn-ink active:opacity-60" onClick={later} data-testid="backup-later">
          {tr("ไว้ทีหลัง", "Later")}
        </button>
      </div>
    </section>
  );
}
