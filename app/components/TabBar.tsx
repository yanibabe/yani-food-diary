"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "../lib/lang";
import { Icon, type IconName } from "./Icon";

const TABS = [
  { href: "/", th: "วันนี้", en: "Today", icon: "house" as IconName },
  { href: "/recipes", th: "สูตรของฉัน", en: "My recipes", icon: "book-open" as IconName },
  { href: "/profile", th: "โปรไฟล์", en: "Profile", icon: "user" as IconName },
];

/** Bottom tabs: a plain white bar with a thin top line, frosted glass; the open tab in a soft white pill. Hidden on full-screen flows. */
export function TabBar() {
  const path = usePathname();
  const { tr, lang } = useLang();
  if (path === "/welcome" || path.startsWith("/add") || path.startsWith("/entry") || /^\/recipes\/.+/.test(path)) return null;
  return (
    <nav className="tabbar fixed inset-x-0 bottom-0 z-30 safe-bottom" aria-label={tr("เมนูหลัก", "Main menu")}>
      <div className="mx-auto flex max-w-[560px] justify-around px-2 pt-1.5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[12.5px] ${
                active ? "bg-white/80 font-medium text-ink" : "text-muted"
              }`}
            >
              <Icon name={t.icon} className="h-[24px] w-[24px]" />
              {t[lang]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
