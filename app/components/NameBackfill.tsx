"use client";
// Round 79: quietly gives every saved food name its other-language version (see app/lib/nameBackfill.ts).
// Draws nothing. Waits a few seconds after the app opens (and after changes), never blocks, never shows an error.

import { useEffect, useRef } from "react";
import { useStore } from "../lib/store";
import { useLang } from "../lib/lang";
import { fixCustom, resolveAlt, type Lookup } from "../lib/names";
import { loadCustom, saveCustom } from "../lib/customIngredients";
import { loadNameTr } from "../lib/nameTr";
import { runBackfill } from "../lib/nameBackfill";
import { parseTranslateReply } from "../lib/translateNames";
import { PASSCODE_HEADER, PASSCODE_KEY, passcodeHeaderValue } from "../lib/passcode";
import { thaiDateKey } from "../lib/date";
import { parseTitleReply, runTitleCheck, type TitleAsk } from "../lib/mealTitles";

const WAIT_MS = 3000;

/** A plain call with the passcode this phone remembers. Unlike aiFetch it never opens the passcode box. */
async function translateCall(names: string[], lang: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const code = localStorage.getItem(PASSCODE_KEY);
    if (code) headers[PASSCODE_HEADER] = passcodeHeaderValue(code);
  } catch {
    /* no passcode saved */
  }
  const res = await fetch("/api/translate-names", { method: "POST", headers, body: JSON.stringify({ names, lang }) });
  if (!res.ok) throw new Error(`translate-names ${res.status}`);
  const data = await res.json();
  return parseTranslateReply({ names: data?.pairs }, names);
}

async function titleCall(meals: TitleAsk[], lang: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const code = localStorage.getItem(PASSCODE_KEY);
    if (code) headers[PASSCODE_HEADER] = passcodeHeaderValue(code);
  } catch {
    /* no passcode saved */
  }
  const res = await fetch("/api/meal-titles", { method: "POST", headers, body: JSON.stringify({ meals, lang }) });
  if (!res.ok) throw new Error(`meal-titles ${res.status}`);
  const data = await res.json();
  return parseTitleReply({ meals: (data?.fixes ?? []).map((f: { id: string; th: string; en: string }) => ({ id: f.id, title_th: f.th, title_en: f.en })) }, meals.map((m) => m.id));
}

export function NameBackfill() {
  const { ready, entries, recipes, applyNames, applyTitleFixes } = useStore();
  const { lang } = useLang();
  const busy = useRef(false);
  const latest = useRef({ entries, recipes });
  useEffect(() => {
    latest.current = { entries, recipes };
  }, [entries, recipes]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        let custom = loadCustom();
        await runBackfill({
          read: () => ({ entries: latest.current.entries, recipes: latest.current.recipes, custom }),
          apply: (lookup: Lookup) => {
            applyNames(lookup);
            const next = fixCustom(custom, (n, a) => resolveAlt(n, a, lookup));
            if (next !== custom) {
              custom = next;
              saveCustom(next);
            }
          },
          translate: (names) => translateCall(names, lang),
          cache: loadNameTr(),
          storage: localStorage,
          today: thaiDateKey(),
          online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
        });
      } catch {
        /* background work: stay silent, try again next time */
      }
      // Round 81: meal names made only from the foods in each meal (Thai first), checked once per meal.
      try {
        const res = await runTitleCheck({
          meals: latest.current.entries,
          ask: (meals) => titleCall(meals, lang),
          storage: localStorage,
          today: thaiDateKey(),
          online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
        });
        if (res.fixes.length) applyTitleFixes(res.fixes);
      } catch {
        /* stay silent */
      } finally {
        busy.current = false;
      }
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [ready, entries, recipes, lang, applyNames, applyTitleFixes]);

  return null;
}
