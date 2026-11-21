// Option B: "Ask AI" lives in the bottom bar and opens the existing chat. The floating button is gone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPEN_CHAT_EVENT } from "../app/lib/chatOpen.ts";
import { fabAllowedOn } from "../app/lib/chatFab.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const bar = read("../app/components/TabBar.tsx");
const host = read("../app/components/ChatFab.tsx");
const layout = read("../app/layout.tsx");

test("bottom bar keeps the three destinations and adds one Ask AI action between Recipes and Profile", () => {
  for (const href of ['href: "/"', 'href: "/recipes"', 'href: "/profile"']) assert.ok(bar.includes(href), href);
  assert.equal((bar.match(/href: "\//g) ?? []).length, 3, "still exactly three destinations");
  assert.match(bar, /const ASK_AFTER = "\/recipes"/);
  assert.match(bar, /<button[\s\S]*?type="button"[\s\S]*?onClick=\{requestOpenChat\}/);
  assert.match(bar, /data-testid="ask-ai-tab"/);
  assert.match(bar, /tr\("ถาม AI", "Ask AI"\)/);
  assert.match(bar, /name="sparkle"/);
});

test("Ask AI is an action, not a page: no href, no router push", () => {
  const btn = bar.slice(bar.indexOf('data-testid="ask-ai-tab"') - 600, bar.indexOf('data-testid="ask-ai-tab"') + 50);
  assert.doesNotMatch(btn, /href=/);
  assert.match(btn, /onClick=\{requestOpenChat\}/);
  // the only router use is for the three real destinations, while the chat is open (see ask-ai-tab-nav.test.ts)
  assert.equal((bar.match(/router\.push/g) ?? []).length, 1);
});

test("same size and look as the other items (min 72px wide, px-1 so My recipes stays on one line at 320px, same padding, so the bar stays 72px high)", () => {
  const items = bar.match(/flex min-w-\[72px\] flex-1 flex-col items-center gap-0\.5 rounded-2xl px-1 py-1\.5 text-\[12\.5px\]/g) ?? [];
  assert.equal(items.length, 2, "one class string for links, one for the Ask AI button");
  assert.match(bar, /tabbar fixed inset-x-0 bottom-0 \$\{chat\.depth > 0 \? "z-\[48\]" : "z-30"\} safe-bottom/);
});

test("the bar is still hidden on the same full-screen pages (chat is NOT added anywhere new)", () => {
  assert.match(bar, /path === "\/welcome" \|\| path\.startsWith\("\/r\/"\) \|\| path\.startsWith\("\/add"\) \|\| path\.startsWith\("\/entry"\)/);
  for (const p of ["/", "/recipes", "/profile"]) assert.equal(fabAllowedOn(p), true);
  for (const p of ["/welcome", "/add/photo", "/entry/x", "/recipes/abc", "/r/x"]) assert.equal(fabAllowedOn(p), false);
});

test("the one chat host listens for the request; no floating button is drawn any more", () => {
  assert.equal(OPEN_CHAT_EVENT, "yfd:open-chat");
  assert.match(host, /addEventListener\(OPEN_CHAT_EVENT/);
  assert.match(host, /if \(allowedRef\.current\) openChat\(\)/);
  assert.doesNotMatch(host, /chat-fab|data-testid="chat-fab"|setPointerCapture|onPointerDown/);
  assert.match(layout, /<TabBar \/>/);
  assert.match(layout, /<ChatFab \/>/);
});

test("chat behaviour is untouched: same history step, same layers, one guard against a second open", () => {
  assert.match(host, /const HISTORY_KEY = "yfdChat"/);
  assert.match(host, /if \(depthRef\.current !== 0\) return;/);
  assert.match(host, /window\.history\.back\(\)/);
  assert.match(host, /<FoodChat onBack=\{back\} onAdd=\{openReview\}/);
  assert.match(host, /<AddFlow embedded mode="text"/);
});

test("her old floating-button position is neither read nor deleted", () => {
  assert.doesNotMatch(host, /FAB_KEY|localStorage/);
  const all = [bar, host, read("../app/lib/chatOpen.ts")].join("\n");
  assert.doesNotMatch(all, /removeItem|localStorage\.clear/);
});
