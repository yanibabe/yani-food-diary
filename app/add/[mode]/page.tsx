"use client";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AddFlow, type AddMode } from "../../components/AddFlow";
import { thaiDateKey } from "../../lib/date";
import { cleanPrefill } from "../../lib/addSheet";
import { cleanBarcode } from "../../lib/food/provider";

// Round 53: the whole body now lives in components/AddFlow.tsx (also used as the full-screen layer on Today).
function AddInner() {
  const params = useParams<{ mode: string }>();
  const mode: AddMode =
    params.mode === "text" ? "text" : params.mode === "manual" ? "manual" : params.mode === "barcode" ? "barcode" : params.mode === "search" ? "search" : "photo";
  const search = useSearchParams();
  const router = useRouter();
  const date = search.get("date") || thaiDateKey();
  return (
    <AddFlow
      key={mode}
      barcode={cleanBarcode(search.get("barcode") ?? "") ?? undefined}
      onSwitchMode={(m, o) => {
        const p = new URLSearchParams();
        if (search.get("date")) p.set("date", search.get("date") as string);
        if (m === "photo" && o?.barcode) p.set("barcode", o.barcode);
        const qs = p.toString();
        router.replace(`/add/${m}${qs ? `?${qs}` : ""}`);
      }}
      mode={mode}
      date={date}
      dateParam={search.get("date")}
      prefill={cleanPrefill(search.get("q"))}
      auto={search.get("auto") === "1"}
      fromSheet={search.get("from") === "sheet"}
      create={search.get("create") === "1"}
      onBack={() => router.back()}
      onCancel={() => router.push(`/?date=${date}`)}
      onSaved={() => router.push(`/?date=${date}`)}
    />
  );
}

export default function AddPage() {
  return (
    <Suspense>
      <AddInner />
    </Suspense>
  );
}
