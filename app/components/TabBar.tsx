"use client";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "../lib/lang";
import { Icon, type IconName } from "./Icon";
import { requestCloseChat, requestOpenChat } from "../lib/chatOpen";
import { askActive, barHidden, useChatUi } from "../lib/chatUi";

const TABS = [
  { href: "/", th: "วันนี้", en: "Today", icon: "house" as IconName },
  { href: "/recipes", th: "สูตรของฉัน", en: "My recipes", icon: "book-open" as IconName },
  { href: "/profile", th: "โปรไฟล์", en: "Profile", icon: "user" as IconName },
];

/** Where the "Ask AI" action sits: after "My recipes", before "Profile". It is an action (opens the chat), not a page. */
const ASK_AFTER = "/recipes";

/** Bottom tabs: a plain white bar with a thin top line, frosted glass; the open tab in a soft white pill. Hidden on full-screen flows. */
export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const { tr, lang } = useLang();
  const chat = useChatUi();
  const askOn = askActive(chat);
  if (barHidden(chat)) return null; // over the chat's review layer, or while the keyboard is up over the chat
  if (path === "/welcome" || path.startsWith("/r/") || path.startsWith("/add") || path.startsWith("/entry") || /^\/recipes\/.+/.test(path)) return null;
  return (
    <nav className={`tabbar fixed inset-x-0 bottom-0 ${chat.depth > 0 ? "z-[48]" : "z-30"} safe-bottom`} aria-label={tr("เมนูหลัก", "Main menu")}>
      <div className="mx-auto flex max-w-[560px] justify-around px-2 pt-1.5">
        {TABS.map((t) => {
          const active = !askOn && (t.href === "/" ? path === "/" : path.startsWith(t.href)); // while the chat is open, Ask AI is the active tab
          return (
            <Fragment key={t.href}>
              <Link
                href={t.href}
                onClick={(e) => {
                  if (chat.depth === 0) return;
                  // The chat is open: close it first, then go (the conversation is kept on the phone).
                  e.preventDefault();
                  requestCloseChat(() => router.push(t.href));
                }}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[12.5px] ${
                  active ? "bg-white/80 font-medium text-ink" : "text-muted"
                }`}
              >
                <Icon name={t.icon} className="h-[24px] w-[24px]" />
                {t[lang]}
              </Link>
              {t.href === ASK_AFTER && (
                <button
                  type="button"
                  onClick={requestOpenChat}
                  aria-haspopup="dialog"
                  aria-current={askOn ? "page" : undefined}
                  className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[12.5px] ${askOn ? "bg-white/80 font-medium text-ink" : "text-muted"}`}
                  data-testid="ask-ai-tab"
                >
                  <Icon name="sparkle" className="h-[24px] w-[24px]" />
                  {tr("ถาม AI", "Ask AI")}
                </button>
              )}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
