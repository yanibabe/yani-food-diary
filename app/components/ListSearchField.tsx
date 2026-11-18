"use client";
// Round 66: the slim search field that opens under the header when she taps the magnifier.
import { Icon } from "./Icon";
import { useLang } from "../lib/lang";

export function ListSearchField({ value, onChange, onClose, placeholder }: { value: string; onChange: (v: string) => void; onClose: () => void; placeholder: string }) {
  const { tr } = useLang();
  return (
    <div className="relative">
      <Icon name="magnifying-glass" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
      <input
        className="min-h-[44px] w-full rounded-full border border-white/90 bg-white/70 py-2.5 pl-12 pr-12 text-[16px] font-normal outline-none placeholder:text-muted"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoFocus
        data-testid="list-search-input"
      />
      <button type="button" className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted" onClick={onClose} aria-label={tr("ปิดการค้นหา", "Close search")}>
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
}
