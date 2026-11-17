"use client";
// Round 54: the floating "ask before eating" button (her character, line art) + the chat layer it opens.
// - Draggable; snaps to the left/right edge; remembers where it is. Tap (a move of under 6px) opens the chat.
// - The chat opens IN PLACE (state change, no route change). One history step per layer, so Back / swipe-back
//   closes it: step 1 = chat, step 2 = the review of a suggestion. Each step is marked in history.state.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CharacterPicture } from "./Character";
import { AddFlow } from "./AddFlow";
import { FoodChat } from "./FoodChat";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
import { useAnyOverlay } from "../lib/overlayFlag";
import { thaiDateKey } from "../lib/date";
import { newId } from "../lib/nutrition";
import { cleanBufferPct } from "../lib/calorieBuffer";
import { suggestionToItem, type Suggestion } from "../lib/foodChat";
import type { FoodItem } from "../lib/types";
import { dragPos, FAB_CAPTION_H, FAB_KEY, FAB_SIZE, isDrag, parseFab, placeFab, releaseFab, serializeFab, fabVisible, type FabStored, type Insets } from "../lib/chatFab";

const HISTORY_KEY = "yfdChat";

function stateDepth(): number {
  const v = (window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY];
  return v === 1 || v === 2 ? v : 0;
}

function readInsets(): Insets {
  let top = 0;
  let bottom = 0;
  try {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    top = parseFloat(cs.paddingTop) || 0;
    bottom = parseFloat(cs.paddingBottom) || 0;
    probe.remove();
    const bar = document.querySelector<HTMLElement>(".tabbar");
    if (bar) bottom = Math.max(bottom, bar.offsetHeight);
  } catch {
    /* defaults */
  }
  return { top, bottom };
}

export function ChatFab() {
  const { tr, lang } = useLang();
  const { goals } = useStore();
  const path = usePathname();
  const router = useRouter();
  const overlay = useAnyOverlay();

  const [depth, setDepth] = useState(0); // 0 = closed, 1 = chat, 2 = chat + review
  const depthRef = useRef(0);
  const [review, setReview] = useState<FoodItem | null>(null);
  const afterClose = useRef<"today" | null>(null);

  const [stored, setStored] = useState<FabStored | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);

  // Load where she left it, and keep it inside the screen when the screen changes (rotation, resize).
  useEffect(() => {
    let saved: FabStored | null = null;
    try {
      saved = parseFab(localStorage.getItem(FAB_KEY));
    } catch {
      saved = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- phone storage is only readable after mount
    setStored(saved);
  }, []);
  const place = useCallback(
    (s: FabStored | null) => {
      const p = placeFab(s, window.innerWidth, window.innerHeight, readInsets());
      posRef.current = { x: p.x, y: p.y };
      setPos({ x: p.x, y: p.y });
    },
    [],
  );
  const visible = fabVisible(path, overlay, depth > 0);
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- screen size is only known after mount
    place(stored);
    const onResize = () => {
      if (!drag.current) place(stored);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [visible, stored, path, place]);

  // ---- chat layers + history ----
  const syncDepth = (d: number) => {
    depthRef.current = d;
    setDepth(d);
    if (d < 2) setReview(null);
  };
  const pushStep = (d: 1 | 2) => {
    try {
      window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_KEY]: d }, "", window.location.href);
    } catch {
      /* the layer still works; only Back would leave the page */
    }
  };
  const openChat = () => {
    if (depthRef.current !== 0) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    pushStep(1);
    syncDepth(1);
  };
  const openReview = (s: Suggestion) => {
    if (depthRef.current !== 1) return;
    const item = suggestionToItem(s, newId("it"), lang, cleanBufferPct(goals.calorieBuffer));
    pushStep(2);
    setReview(item);
    syncDepth(2);
  };
  const back = () => {
    if (depthRef.current > 0) window.history.back();
  };
  const saved = () => {
    // After saving: close every layer and show Today (the chat text stays as it was, on this phone).
    afterClose.current = "today";
    if (depthRef.current > 0) window.history.go(-depthRef.current);
    else syncDepth(0);
  };
  useEffect(() => {
    if (depth === 0) return;
    const onPop = () => {
      syncDepth(stateDepth());
      if (stateDepth() === 0 && afterClose.current === "today") {
        afterClose.current = null;
        const u = new URL(window.location.href);
        if (u.pathname !== "/" || u.searchParams.has("date")) router.push("/");
      }
    };
    window.addEventListener("popstate", onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = prev;
    };
  }, [depth > 0, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- dragging ----
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = posRef.current;
    if (!p) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (!isDrag(dx, dy)) return;
      d.moved = true;
      setDragging(true);
    }
    const p = dragPos({ x: d.ox, y: d.oy }, dx, dy, window.innerWidth, window.innerHeight, readInsets());
    posRef.current = p;
    setPos(p);
  };
  const finish = (e: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    if (d.moved) {
      setDragging(false);
      const p = posRef.current ?? { x: d.ox, y: d.oy };
      const s = releaseFab(p.x, p.y, window.innerWidth, window.innerHeight, readInsets());
      setStored(s); // the effect above places it on the edge
      try {
        localStorage.setItem(FAB_KEY, serializeFab(s));
      } catch {
        /* just not remembered */
      }
    } else if (!cancelled) {
      openChat();
    }
  };

  return (
    <>
      {visible && pos && (
        <div className="fixed left-0 top-0 z-40" style={{ width: FAB_SIZE, height: FAB_SIZE + FAB_CAPTION_H, transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }} data-testid="chat-fab-wrap">
          <button
            type="button"
            className="grid place-items-center rounded-full border border-white/90 bg-[rgba(250,246,240,0.78)] shadow-[0_4px_16px_rgba(43,39,36,0.14)] backdrop-blur-[18px]"
            style={{ width: FAB_SIZE, height: FAB_SIZE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", cursor: dragging ? "grabbing" : "pointer" }}
            aria-label={tr("ถามก่อนกิน / Ask before eating", "ถามก่อนกิน / Ask before eating")}
            data-testid="chat-fab"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, false)}
            onPointerCancel={(e) => finish(e, true)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              // Mouse/touch taps are handled on pointer-up (so a drag never counts as a tap). A keyboard press has detail 0.
              if (e.detail === 0) openChat();
            }}
          >
            <CharacterPicture size={34} />
          </button>
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(250,246,240,0.7)] px-1.5 text-[11px] leading-4 text-muted backdrop-blur-[10px]"
            style={{ top: FAB_SIZE + 2, userSelect: "none", WebkitUserSelect: "none" }}
            data-testid="chat-fab-caption"
          >
            {tr("ถามผู้ช่วย", "Ask AI")}
          </span>
        </div>
      )}
      {depth >= 1 && <FoodChat onBack={back} onAdd={openReview} />}
      {depth >= 2 && review && (
        <div className="add-layer fixed inset-0 z-[46] overflow-y-auto overscroll-contain" data-testid="chat-review-layer">
          <AddFlow embedded mode="text" date={thaiDateKey()} dateParam={null} prefill="" initialItem={review} onBack={back} onCancel={back} onSaved={saved} />
        </div>
      )}
    </>
  );
}
