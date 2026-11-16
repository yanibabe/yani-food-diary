"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "../lib/lang";

const ICON_PATHS: Record<string, React.ReactNode> = {
  today: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  recipes: (
    <>
      <path d="M5 5.5c2.5-1 5-1 7 .5v13c-2-1.5-4.5-1.5-7-.5z" />
      <path d="M19 5.5c-2.5-1-5-1-7 .5v13c2-1.5 4.5-1.5 7-.5z" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 19.5c1.2-3.3 3.6-5 6.5-5s5.3 1.7 6.5 5" />
    </>
  ),
};

const TABS = [
  { href: "/", th: "วันนี้", en: "Today", icon: "today" },
  { href: "/recipes", th: "สูตรของฉัน", en: "My recipes", icon: "recipes" },
  { href: "/profile", th: "โปรไฟล์", en: "Profile", icon: "profile" },
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
              <svg
                viewBox="0 0 24 24"
                className="h-[24px] w-[24px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {ICON_PATHS[t.icon]}
              </svg>
              {t[lang]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
