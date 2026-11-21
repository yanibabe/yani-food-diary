// Ask AI is a normal fourth tab: the bottom bar stays visible under the chat, Ask AI is active, tabs switch without erasing the chat.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { askActive, barHidden, getChatUi, resetChatUi, setChatUi } from "../app/lib/chatUi.ts";
import { CLOSE_CHAT_EVENT, OPEN_CHAT_EVENT } from "../app/lib/chatOpen.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const bar = read("../app/components/TabBar.tsx");
const host = read("../app/components/ChatFab.tsx");
const chat = read("../app/components/FoodChat.tsx");

test("bar visibility rules: visible over the chat, hidden over the review layer and while the keyboard is up", () => {
  assert.equal(barHidden({ depth: 0, keyboard: false }), false);
  assert.equal(barHidden({ depth: 1, keyboard: false }), false, "chat open, keyboard closed: bar stays");
  assert.equal(barHidden({ depth: 1, keyboard: true }), true, "keyboard up: bar steps aside");
  assert.equal(barHidden({ depth: 2, keyboard: false }), true, "review layer (it has its own Save bar)");
});

test("Ask AI is active exactly while the chat is the top layer", () => {
  assert.equal(askActive({ depth: 0, keyboard: false }), false);
  assert.equal(askActive({ depth: 1, keyboard: false }), true);
  assert.equal(askActive({ depth: 1, keyboard: true }), true);
  assert.equal(askActive({ depth: 2, keyboard: false }), false);
});

test("the shared store only changes (and notifies) when something really changed", () => {
  resetChatUi();
  setChatUi({ depth: 1 });
  assert.deepEqual(getChatUi(), { depth: 1, keyboard: false });
  const before = getChatUi();
  setChatUi({ depth: 1 });
  assert.equal(getChatUi(), before, "same values: same object");
  setChatUi({ keyboard: true });
  assert.equal(getChatUi().keyboard, true);
  resetChatUi();
  assert.deepEqual(getChatUi(), { depth: 0, keyboard: false });
});

test("TabBar: lifted above the chat only while it is open, other tabs go inactive, Ask AI shows active", () => {
  assert.match(bar, /chat\.depth > 0 \? "z-\[48\]" : "z-30"/);
  assert.match(bar, /const active = !askOn && /);
  assert.match(bar, /aria-current=\{askOn \? "page" : undefined\}/);
  assert.match(bar, /if \(barHidden\(chat\)\) return null/);
});

test("tabs tapped while the chat is open: close the chat first, then go (no extra history step)", () => {
  assert.match(bar, /if \(chat\.depth === 0\) return;/);
  assert.match(bar, /e\.preventDefault\(\);\s*\n\s*requestCloseChat\(\(\) => router\.push\(t\.href\)\)/);
  assert.equal(CLOSE_CHAT_EVENT, "yfd:close-chat");
  assert.equal(OPEN_CHAT_EVENT, "yfd:open-chat");
  assert.match(host, /window\.history\.go\(-depthRef\.current\)/);
  assert.match(host, /if \(stateDepth\(\) === 0 && pendingGo\.current\)/);
  assert.match(host, /setTimeout\(\(\) => \{\s*const f = pendingGo\.current;/); // fallback if the browser never answers
});

test("host publishes the chat depth to the bar and cleans up", () => {
  assert.match(host, /setChatUi\(\{ depth: d \}\)/);
  assert.match(host, /resetChatUi\(\)/);
});

test("chat layer ends above the bar (and uses the whole visible area while the keyboard is up)", () => {
  assert.match(chat, /const kbOpen = !!vv && typeof window !== "undefined" && vv\.height < window\.innerHeight - 120;/);
  assert.match(chat, /const lift = kbOpen \? 0 : barH;/);
  assert.match(chat, /height: Math\.max\(0, vv\.height - lift\)/);
  assert.match(chat, /\{ top: 0, bottom: lift \}/);
  assert.match(chat, /document\.querySelector<HTMLElement>\("\.tabbar"\)/);
  assert.match(chat, /setChatUi\(\{ keyboard: kbOpen \}\)/);
});

test("conversation is kept: still saved/read from the same storage key, nothing clears it on tab switch", () => {
  assert.match(chat, /localStorage\.getItem\(CHAT_KEY\)/);
  assert.match(chat, /localStorage\.setItem\(CHAT_KEY/);
  assert.doesNotMatch(bar + host, /CHAT_KEY|removeItem|localStorage/);
});

test("chat behaviour untouched: same history key, same guard against a second open, same layers", () => {
  assert.match(host, /const HISTORY_KEY = "yfdChat"/);
  assert.match(host, /if \(depthRef\.current !== 0\) return;/);
  assert.match(host, /<FoodChat onBack=\{back\} onAdd=\{openReview\}/);
});
