"use client";
// The old "เป้าหมาย" tab moved to /profile. Keep this so old links still work.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GoalsMoved() {
  const router = useRouter();
  useEffect(() => router.replace("/profile"), [router]);
  return <main className="page" />;
}
