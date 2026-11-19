"use client";
// Round 79/80: the small box under a name. The BIG box above it shows the name in the app language;
// this small one shows the OTHER language (see nameBoxes in names.ts). Empty = the app translates it.
// What she types here is kept as hers and is never replaced by an automatic translation.
// If the big box shows a saved translation, this small box holds the original name.

import { useState } from "react";
import { useLang } from "../lib/lang";
import { editSmallBox, nameBoxes, type NameAlt } from "../lib/names";

export function OtherNameField({
  name,
  alt,
  onChange,
  id,
}: {
  name: string;
  alt: NameAlt | undefined;
  onChange: (next: { name: string; alt: NameAlt | undefined }) => void;
  id?: string;
}) {
  const { tr, lang } = useLang();
  const boxes = nameBoxes(name, alt, lang);
  // Local text, so a space at the end of a word can be typed (the saved value is trimmed).
  const [text, setText] = useState(boxes.small);
  const [seen, setSeen] = useState(boxes.small);
  if (boxes.small !== seen) {
    // Changed from outside (e.g. the AI renamed it): follow it, unless it is only the trimmed form of what she typed.
    setSeen(boxes.small);
    if (boxes.small !== text.trim()) setText(boxes.small);
  }
  const label = boxes.smallLang === "en" ? tr("ชื่อภาษาอังกฤษ (ไม่ใส่ก็ได้)", "English name (optional)") : tr("ชื่อภาษาไทย (ไม่ใส่ก็ได้)", "Thai name (optional)");
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
          onChange(editSmallBox(name, alt, lang, e.target.value));
        }}
      />
    </div>
  );
}
