// The bottom bar's "Ask AI" action and the chat host (components/ChatFab.tsx) talk through one small browser event,
// so the bar never needs to know how the chat opens (history steps, layers). One chat, opened from one place.

export const OPEN_CHAT_EVENT = "yfd:open-chat";

/** Ask the chat host to open the (existing) chat. Does nothing if it is already open or a layer is up. */
export function requestOpenChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}

export const CLOSE_CHAT_EVENT = "yfd:close-chat";

/**
 * Close the chat (one history step back, like the Back button), THEN run `go` (e.g. open another tab).
 * The conversation itself is saved on the phone, so it is still there when the chat is opened again.
 * If the chat is not open, `go` runs at once.
 */
export function requestCloseChat(go?: () => void): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLOSE_CHAT_EVENT, { detail: { go } }));
}
