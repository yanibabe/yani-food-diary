// Two languages: Thai (default) and English.
// Text is written as a Thai/English pair right where it is used:
//   tr("วันนี้", "Today")
// This file has no React in it, so the math files and tests can use it too.

export type Lang = "th" | "en";

/** A word or sentence in both languages. */
export type L = { th: string; en: string };

/** Pick the Thai or English text. */
export type Tr = (th: string, en: string) => string;

export function trFor(lang: Lang): Tr {
  return (th, en) => (lang === "en" ? en : th);
}

/** Turn a { key: {th, en} } list into { key: text } for one language. */
export function pickAll<K extends string>(rec: Record<K, L>, lang: Lang): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(rec) as K[]) out[k] = rec[k][lang];
  return out;
}
