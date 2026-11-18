"use client";
// Locked first-run setup: until a profile with a name and a reason is saved,
// every screen sends her to /welcome.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOnboarded } from "../lib/profile";
import { useStore } from "../lib/store";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { goals } = useStore();
  const path = usePathname();
  const router = useRouter();
  const locked = !isOnboarded(goals) && path !== "/welcome" && !path.startsWith("/r/"); // a shared-recipe link opens even before first-run setup
  useEffect(() => {
    if (locked) router.replace("/welcome");
  }, [locked, router]);
  return locked ? <div className="min-h-dvh bg-cream" /> : <>{children}</>;
}
