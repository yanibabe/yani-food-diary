"use client";
// Round 54: the "ask before eating" chat + the review layer it can open.
// Final UI change (Option B): the floating button is gone. The "Ask AI" action in the bottom bar (TabBar) sends an
// open-chat request (lib/chatOpen.ts); this component is the one chat host and opens the SAME existing chat.
// - The chat opens IN PLACE (state change, no route change). One history step per layer, so Back / swipe-back
//   closes it: step 1 = chat, step 2 = the review of a suggestion. Each step is marked in history.state.
// - Her old floating-button position (the saved yfd:v1:chatFab value) is simply left alone: nothing reads it now, nothing deletes it.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AddFlow } from "./AddFlow";
import { FoodChat } from "./FoodChat";
import { useLang } from "../lib/lang";
import { useStore } from "../lib/store";
import { useAnyOverlay } from "../lib/overlayFlag";
import { CLOSE_CHAT_EVENT, OPEN_CHAT_EVENT } from "../lib/chatOpen";
import { resetChatUi, setChatUi } from "../lib/chatUi";
import { thaiDateKey } from "../lib/date";
import { newId } from "../lib/nutrition";
import { cleanBufferPct } from "../lib/calorieBuffer";
import { suggestionToItem, type Suggestion } from "../lib/foodChat";
import type { FoodItem } from "../lib/types";
import { fabAllowedOn } from "../lib/chatFab";

const HISTORY_KEY = "yfdChat";

function stateDepth(): number {
  const v = (window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY];
  return v === 1 || v === 2 ? v : 0;
}

export function ChatFab() {
  const { lang } = useLang();
  const { goals } = useStore();
  const path = usePathname();
  const router = useRouter();
  const overlay = useAnyOverlay();

  const [depth, setDepth] = useState(0); // 0 = closed, 1 = chat, 2 = chat + review
  const depthRef = useRef(0);
  const [review, setReview] = useState<FoodItem | null>(null);
  const afterClose = useRef<"today" | null>(null);
  const pendingGo = useRef<(() => void) | null>(null); // a tab tapped while the chat is open: runs once the chat has closed


  // ---- chat layers + history ----
  const syncDepth = (d: number) => {
    depthRef.current = d;
    setDepth(d);
    setChatUi({ depth: d });
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
      if (stateDepth() === 0 && pendingGo.current) {
        const go = pendingGo.current;
        pendingGo.current = null;
        go();
      }
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

  // ---- the "Ask AI" action in the bottom bar asks us to open the chat ----
  const allowedRef = useRef(false);
  useEffect(() => {
    allowedRef.current = fabAllowedOn(path) && !overlay;
  }, [path, overlay]);
  useEffect(() => {
    const onOpen = () => {
      if (allowedRef.current) openChat();
    };
    // The bar's other tabs: close the chat first (history back, no leftover step), then go. Nothing is erased: the chat is saved on the phone.
    const onClose = (e: Event) => {
      const go = (e as CustomEvent<{ go?: () => void }>).detail?.go;
      if (depthRef.current === 0) {
        go?.();
        return;
      }
      pendingGo.current = go ?? null;
      if (go) {
        setTimeout(() => {
          const f = pendingGo.current;
          pendingGo.current = null;
          f?.(); // fallback if the browser never answers
        }, 700);
      }
      window.history.go(-depthRef.current);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    window.addEventListener(CLOSE_CHAT_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
      window.removeEventListener(CLOSE_CHAT_EVENT, onClose);
      resetChatUi();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- openChat only uses refs and stable setters

  return (
    <>
      {depth >= 1 && <FoodChat onBack={back} onAdd={openReview} />}
      {depth >= 2 && review && (
        <div className="add-layer fixed inset-0 z-[46] overflow-y-auto overscroll-contain" data-testid="chat-review-layer">
          <AddFlow embedded mode="text" date={thaiDateKey()} dateParam={null} prefill="" initialItem={review} onBack={back} onCancel={back} onSaved={saved} />
        </div>
      )}
    </>
  );
}
