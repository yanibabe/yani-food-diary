"use client";
// The app language (ไทย / English). Saved on this phone, like everything else.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { trFor, type Lang, type Tr } from "./i18n.ts";
import { displayName, type NameAlt } from "./names.ts";
import { cachedPair } from "./nameTr.ts";

const KEY = "yfd:v1:lang";

/** Round 79: the name to show for a food, in the app language (see names.ts). */
export type DisplayNameFn = (name: string, alt?: NameAlt | null) => string;

type LangStore = { lang: Lang; setLang: (l: Lang) => void; tr: Tr; dn: DisplayNameFn };

const Ctx = createContext<LangStore | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    // Read once on the device (localStorage is not available on the server).
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "en" || saved === "th") setLangState(saved);
    } catch {
      /* keep Thai */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* still switches for now, just not remembered */
    }
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      tr: trFor(lang),
      // No saved alt (e.g. a name from her usual picks)? Use a name the phone already translated once.
      dn: ((name, alt) => {
        const shown = displayName(name, alt, lang);
        if (shown !== name || alt) return shown;
        const c = cachedPair(name);
        return c ? displayName(name, { ...c, src: name }, lang) : name;
      }) as DisplayNameFn,
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangStore {
  const s = useContext(Ctx);
  if (!s) throw new Error("useLang outside LangProvider");
  return s;
}

/** Two buttons: ไทย | English. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1" role="group" aria-label="ภาษา / Language" data-testid="lang-toggle">
      {(
        [
          ["th", "ไทย"],
          ["en", "English"],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => setLang(k)}
          aria-pressed={lang === k}
          className={`min-h-[44px] rounded-xl text-[16px] font-medium ${lang === k ? "bg-olive text-white" : "text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
