// What the bottom bar needs to know about the chat (one tiny shared store; the chat host and FoodChat write, TabBar reads).
//   depth    0 = chat closed, 1 = chat open, 2 = chat + review layer on top
//   keyboard the phone keyboard is open over the chat
import { useSyncExternalStore } from "react";

export type ChatUi = { depth: number; keyboard: boolean };

const CLOSED: ChatUi = { depth: 0, keyboard: false };
let ui: ChatUi = CLOSED;
const listeners = new Set<() => void>();

export function getChatUi(): ChatUi {
  return ui;
}

export function setChatUi(patch: Partial<ChatUi>): void {
  const next = { ...ui, ...patch };
  if (next.depth === ui.depth && next.keyboard === ui.keyboard) return;
  ui = next;
  for (const l of listeners) l();
}

export function resetChatUi(): void {
  setChatUi(CLOSED);
}

export function useChatUi(): ChatUi {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => ui,
    () => CLOSED,
  );
}

/** The bar goes away only where it would be in the way: over the review layer, or while the keyboard is up over the chat. */
export function barHidden(u: ChatUi): boolean {
  return u.depth >= 2 || (u.depth >= 1 && u.keyboard);
}

/** "Ask AI" is the active tab exactly while the chat itself is the top layer. */
export function askActive(u: ChatUi): boolean {
  return u.depth === 1;
}
