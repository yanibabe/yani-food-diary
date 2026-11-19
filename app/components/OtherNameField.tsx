"use client";
// Round 79: a small optional box under a name: the same name in the OTHER language
// (English for a Thai name, Thai for an English one). Empty = the app translates it for her.
// What she types is kept as hers and is never replaced by an automatic translation.

import { useState } from "react";
import { useLang } from "../lib/lang";
import { manualAltText, otherLang, setManualAlt, type NameAlt } from "../lib/names";

export function OtherNameField({
  name,
  alt,
  onChange,
  id,
}: {
  name: string;
  alt: NameAlt | undefined;
  onChange: (alt: NameAlt | undefined) => void;
  id?: string;
}) {
  const { tr } = useLang();
  // Local text, so a space at the end of a word can be typed (the saved value is trimmed).
  const [text, setText] = useState(() => manualAltText(name, alt));
  const other = otherLang(name);
  const label = other === "en" ? tr("ชื่อภาษาอังกฤษ (ไม่ใส่ก็ได้)", "English name (optional)") : tr("ชื่อภาษาไทย (ไม่ใส่ก็ได้)", "Thai name (optional)");
  return (
    <div className="mt-2" data-testid="other-name">
      <label className="mb-1 block text-[13px] text-muted" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="field !min-h-[44px] !text-[16px]"
        value={text}
        maxLength={120}
        placeholder={tr("เว้นว่าง = แอปแปลให้เอง", "Empty = the app translates it for you")}
        onChange={(e) => {
          setText(e.target.value);
          onChange(setManualAlt(name, alt, e.target.value));
        }}
      />
    </div>
  );
}
