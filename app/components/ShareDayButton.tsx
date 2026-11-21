"use client";
// Sharing a nutrition report (for a trainer / coach). Opened from the "Share report" tile on Today.
// ONE place to choose what to send: Day | Week (the day starts as the date being viewed on Today).
// The picture is made on the phone from the saved meals (see lib/nutritionReport.ts); nothing is uploaded and no AI is used.
import { useEffect, useState } from "react";
import { Sheet } from "./ui";
import { useLang } from "../lib/lang";
import { shortDayLabel } from "../lib/date";
import { buildDayReport, buildWeekReport, reportFileName } from "../lib/nutritionReport";
import { buildShareDay } from "../lib/shareDay";
import { layoutShareCard } from "../lib/shareCard";
import { dayShortLabel, layoutWeekCard } from "../lib/shareWeekCard";
import { MEAL_PICS_KEY, parseMealPics } from "../lib/mealPics";
import { weekRangeLabel } from "../lib/shareWeek";
import { weekStart } from "../lib/body";
import { shiftDateKey } from "../lib/date";
import { makeSharePicture } from "./shareDraw";
import type { Entry } from "../lib/types";

export type ShareRange = "day" | "week";

/** The dish-name -> picture map (saved on the phone by the meal pictures). */
function readPics() {
  try {
    return parseMealPics(localStorage.getItem(MEAL_PICS_KEY));
  } catch {
    return {};
  }
}

export function ShareDayButton({
  entries,
  date,
  today,
  target,
  name,
  macroTargets,
  water,
  weightKg = null,
  dayHasMeals = true,
  controlled,
}: {
  /** Which tab to open on (null = closed) and how to close. */
  controlled: { range: ShareRange | null; onClose: () => void };
  /** false = the viewed day has no meals: only the week report can be shared. */
  dayHasMeals?: boolean;
  weightKg?: number | null;
  entries: Entry[];
  /** The date being viewed on Today (the report is for THIS date, not for the calendar's today). */
  date: string;
  today: string;
  target: number;
  name: string;
  macroTargets: { protein: number; carbs: number; fat: number };
  water: { glasses: number; goal: number };
}) {
  const { tr, lang, dn } = useLang();
  const open = controlled.range !== null;
  const [range, setRange] = useState<ShareRange>("day");
  const [pic, setPic] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mt = macroTargets;
  const wt = water;
  // Opened from outside: start on the asked tab with a clean state (adjusted while rendering).
  const asked = controlled.range;
  const [seenAsk, setSeenAsk] = useState<ShareRange | null>(null);
  if (asked !== seenAsk) {
    setSeenAsk(asked);
    if (asked) {
      setPic(null);
      setError(null);
      setRange(asked === "day" && !dayHasMeals ? "week" : asked);
    }
  }

  useEffect(() => {
    if (!open) return;
    let url = "";
    let stop = false;
    const pics = readPics();
    const make = makeSharePicture((m) => {
      if (range === "week") {
        const rep = buildWeekReport({ entries, date, today, target, macroTargets: mt, lang, name });
        const stories = rep.days.map((d) => ({ date: d.date, label: dayShortLabel(d.date, lang), share: d.logged ? buildShareDay(entries, d.date, pics, dn, lang) : null }));
        return layoutWeekCard(rep, stories, m);
      }
      const rep = buildDayReport({ entries, date, target, macroTargets: mt, lang, name, show: dn, water: wt, weightKg });
      return layoutShareCard(
        { day: buildShareDay(entries, date, pics, dn, lang), date, dateLabel: rep.dateLabel, name, target, macroTargets: mt, water: wt, weightKg, incomplete: rep.incompleteNutrients, lang },
        m,
      );
    });
    make
      .then((blob) => {
        if (stop) return;
        url = URL.createObjectURL(blob);
        setPic({ blob, url });
      })
      .catch((e) => !stop && setError(String(e?.message || e)));
    return () => {
      stop = true;
      if (url) URL.revokeObjectURL(url);
    };
    // mt / wt are rebuilt from these numbers, so list the numbers (not the objects).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, range, entries, date, today, target, name, lang, mt.protein, mt.carbs, mt.fat, wt.glasses, wt.goal, weightKg]);

  const start = weekStart(date);
  const fileName = range === "week" ? reportFileName("week", start) : reportFileName("day", date);
  const file = pic ? new File([pic.blob], fileName, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      // Closing the share sheet is not an error.
      if ((e as Error)?.name !== "AbortError") setError(String((e as Error)?.message || e));
    }
  };

  const dayLabel = shortDayLabel(date, today, lang);
  const weekLabel = weekRangeLabel(start, shiftDateKey(start, 6), lang); // short form for the tab; the report itself shows the full range

  return (
    <Sheet open={open} onClose={controlled.onClose} title={tr("แชร์รายงานโภชนาการ", "Share nutrition report")}>
      <div className="space-y-3 pb-4" data-testid="share-day-sheet">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/60 p-1" role="tablist" data-testid="share-range">
          {(["day", "week"] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              disabled={r === "day" && !dayHasMeals}
              className={`min-h-[56px] rounded-xl px-2 text-left leading-tight disabled:opacity-40 ${range === r ? "bg-[#2b2724] text-white" : "text-ink"}`}
              onClick={() => {
                if (r === range) return;
                setPic(null);
                setError(null);
                setRange(r);
              }}
              data-testid={`share-range-${r}`}
            >
              <span className="block pl-2 text-[16px] font-medium">{r === "day" ? tr("รายวัน", "Daily") : tr("รายสัปดาห์", "Weekly")}</span>
              <span className={`block truncate pl-2 text-[13px] ${range === r ? "text-white/80" : "text-muted"}`}>{r === "day" ? (dayHasMeals ? dayLabel : tr("ไม่มีบันทึก", "Nothing logged")) : weekLabel}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert">
            {tr("ทำรูปไม่สำเร็จ", "Couldn't make the picture")}: {error}
          </p>
        )}
        {!pic && !error && <p className="py-10 text-center text-[15px] text-muted">{tr("กำลังทำรูป…", "Making the picture…")}</p>}
        {pic && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pic.url} alt={range === "week" ? tr("รายงานโภชนาการรายสัปดาห์", "Weekly nutrition report") : tr("รายงานโภชนาการรายวัน", "Daily nutrition report")} className="w-full rounded-[18px] border border-line" data-testid="share-day-image" />
            {canShare ? (
              <button className="btn-primary w-full !min-h-[56px] text-[18px]" onClick={share} data-testid="share-day-send">
                {tr("แชร์รายงานนี้", "Share this report")}
              </button>
            ) : (
              <a className="btn-primary flex w-full !min-h-[56px] items-center justify-center text-[18px]" href={pic.url} download={fileName} data-testid="share-day-download">
                {tr("บันทึกรูปรายงาน", "Save report image")}
              </a>
            )}
            <p className="text-center text-[13px] text-muted">{tr("ส่งทาง LINE ข้อความ หรือบันทึกลงรูปภาพได้", "Send by LINE, Messages, or save to Photos")}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
