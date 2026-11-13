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
  body: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="5" />
      <path d="M9 10.5a3.5 3.5 0 0 1 6 0" />
      <path d="M12 10.5l1.2-1.6" />
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
  { href: "/body", th: "น้ำหนัก", en: "Weight", icon: "body" },
  { href: "/profile", th: "โปรไฟล์", en: "Profile", icon: "profile" },
];

/** Bottom tabs: a floating white bar, the open tab in a yellow pill. Hidden on full-screen flows. */
export function TabBar() {
  const path = usePathname();
  const { tr, lang } = useLang();
  if (path === "/welcome" || path.startsWith("/add") || path.startsWith("/entry") || /^\/recipes\/.+/.test(path)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 safe-bottom" aria-label={tr("เมนูหลัก", "Main menu")}>
      <div className="mx-auto flex max-w-[540px] justify-around rounded-[28px] border border-line bg-paper/95 p-1.5 shadow-[0_6px_24px_rgb(60_40_20/0.08)] backdrop-blur">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 rounded-[22px] px-2 py-1.5 text-[12.5px] font-medium ${
                active ? "bg-yellow text-ink" : "text-muted"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[24px] w-[24px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
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
