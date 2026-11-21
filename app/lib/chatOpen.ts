// The bottom bar's "Ask AI" action and the chat host (components/ChatFab.tsx) talk through one small browser event,
// so the bar never needs to know how the chat opens (history steps, layers). One chat, opened from one place.

export const OPEN_CHAT_EVENT = "yfd:open-chat";

/** Ask the chat host to open the (existing) chat. Does nothing if it is already open or a layer is up. */
export function requestOpenChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}
