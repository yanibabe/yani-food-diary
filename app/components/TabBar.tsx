"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "../lib/lang";

const TABS = [
  { href: "/", th: "วันนี้", en: "Today", icon: "🍽️" },
  { href: "/recipes", th: "สูตรของฉัน", en: "My recipes", icon: "📖" },
  { href: "/body", th: "น้ำหนัก", en: "Weight", icon: "⚖️" },
  { href: "/profile", th: "โปรไฟล์", en: "Profile", icon: "🙂" },
];

/** Bottom tabs. Hidden on full-screen flows (adding food, editing). */
export function TabBar() {
  const path = usePathname();
  const { tr, lang } = useLang();
  if (path === "/welcome" || path.startsWith("/add") || path.startsWith("/entry") || /^\/recipes\/.+/.test(path)) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur safe-bottom"
      aria-label={tr("เมนูหลัก", "Main menu")}
    >
      <div className="mx-auto flex max-w-[560px] justify-around pt-2">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-w-[72px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[13px] font-medium ${
                active ? "bg-olive-soft text-olive-dark" : "text-muted"
              }`}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                {t.icon}
              </span>
              {t[lang]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
