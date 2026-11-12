"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "วันนี้", icon: "🍽️" },
  { href: "/recipes", label: "สูตรของฉัน", icon: "📖" },
  { href: "/profile", label: "โปรไฟล์", icon: "🙂" },
];

/** Bottom tabs. Hidden on full-screen flows (adding food, editing). */
export function TabBar() {
  const path = usePathname();
  if (path === "/welcome" || path.startsWith("/add") || path.startsWith("/entry") || /^\/recipes\/.+/.test(path)) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur safe-bottom"
      aria-label="เมนูหลัก"
    >
      <div className="mx-auto flex max-w-[560px] justify-around pt-2">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-w-[88px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[13px] font-medium ${
                active ? "bg-olive-soft text-olive-dark" : "text-muted"
              }`}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
