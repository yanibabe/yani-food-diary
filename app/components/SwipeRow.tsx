"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLang } from "../lib/lang";
import { decideSwipe, dragOffset, settleOffset, SWIPE_BUTTON_W } from "../lib/swipe";

const OPEN_EVENT = "snapcal-swipe-open";
const EASE = "transform 180ms ease-out, width 180ms ease-out";

/** A row you can swipe left to reveal a red Delete button. Only the button deletes. */
export function SwipeRow({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) {
  const { tr } = useLang();
  const id = useId();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const drag = useRef<{ x: number; y: number; pid: number; wasOpen: boolean; mode: "pending" | "horizontal" | "vertical" } | null>(null);
  const moved = useRef(false);
  const open = offset <= -SWIPE_BUTTON_W + 0.5;

  const set = useCallback((v: number) => {
    offsetRef.current = v;
    setOffset(v);
  }, []);

  // One open row at a time; tapping elsewhere or scrolling closes it.
  useEffect(() => {
    const closeIfOther = (ev: Event) => {
      if ((ev as CustomEvent).detail !== id) set(0);
    };
    const closeOutside = (ev: PointerEvent) => {
      if (offsetRef.current === 0) return;
      const el = rootRef.current;
      if (el && ev.target instanceof Node && el.contains(ev.target)) return;
      set(0);
    };
    const closeNow = () => {
      if (offsetRef.current !== 0 && !drag.current) set(0);
    };
    window.addEventListener(OPEN_EVENT, closeIfOther);
    document.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("scroll", closeNow, true);
    return () => {
      window.removeEventListener(OPEN_EVENT, closeIfOther);
      document.removeEventListener("pointerdown", closeOutside, true);
      window.removeEventListener("scroll", closeNow, true);
    };
  }, [id, set]);

  const rootRef = useRef<HTMLLIElement>(null);

  const onPointerDown = (ev: React.PointerEvent) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest("[data-swipe-delete]")) return;
    drag.current = { x: ev.clientX, y: ev.clientY, pid: ev.pointerId, wasOpen: offsetRef.current <= -SWIPE_BUTTON_W + 0.5, mode: "pending" };
    moved.current = false;
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pid !== ev.pointerId) return;
    const dx = ev.clientX - d.x;
    const dy = ev.clientY - d.y;
    if (d.mode === "pending") {
      d.mode = decideSwipe(dx, dy);
      if (d.mode === "horizontal") {
        moved.current = true;
        setDragging(true);
        try {
          (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
        } catch {}
      }
    }
    if (d.mode === "horizontal") set(dragOffset(dx, SWIPE_BUTTON_W, d.wasOpen));
  };
  const end = (ev: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.pid !== ev.pointerId) return;
    drag.current = null;
    if (d.mode !== "horizontal") return;
    setDragging(false);
    const to = cancelled ? (d.wasOpen ? -SWIPE_BUTTON_W : 0) : settleOffset(ev.clientX - d.x, SWIPE_BUTTON_W, d.wasOpen);
    set(to);
    if (to !== 0) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    // Swallow the click that follows a drag (a swipe must not open the entry).
    setTimeout(() => {
      moved.current = false;
    }, 0);
  };

  const onClickCapture = (ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest("[data-swipe-delete]")) return;
    if (moved.current) {
      ev.preventDefault();
      ev.stopPropagation();
    } else if (offsetRef.current !== 0) {
      // A tap on an open row just closes it.
      ev.preventDefault();
      ev.stopPropagation();
      set(0);
    }
  };

  const revealed = -offset;
  return (
    <li ref={rootRef} className="relative overflow-hidden" data-testid="swipe-row" data-open={open ? "yes" : "no"}>
      <div
        className="absolute inset-y-0 right-0 flex justify-end overflow-hidden py-1"
        style={{ width: revealed, transition: dragging ? "none" : EASE }}
        aria-hidden={!open}
      >
        <button
          type="button"
          data-swipe-delete
          data-testid="swipe-delete"
          tabIndex={open ? 0 : -1}
          aria-label={label}
          onClick={() => {
            set(0);
            onDelete();
          }}
          className="h-full min-h-[44px] shrink-0 rounded-2xl bg-[#f6e1dc] text-[15px] font-normal text-danger"
          style={{ width: SWIPE_BUTTON_W - 8 }}
        >
          {tr("ลบ", "Delete")}
        </button>
      </div>
      <div
        className="relative touch-pan-y select-none"
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? "none" : EASE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </li>
  );
}
