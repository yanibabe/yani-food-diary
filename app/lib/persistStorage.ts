// Phase 1: ask the browser to treat SnapCal's saved data as "keep if you can" (StorageManager.persist()).
// This is a REQUEST, not a promise: the browser may say no, and nothing here can stop the user (or iOS) from
// clearing site data. It never deletes or changes anything, never shows our own popup, and never throws.
// Safari / Chrome may answer silently; Firefox may show its own permission prompt once.
// Backups stay the real safety net.

export type PersistResult = "already" | "granted" | "denied" | "unsupported" | "error";

type StorageManagerLike = { persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> };

export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = typeof navigator !== "undefined" ? (navigator as { storage?: StorageManagerLike }).storage : undefined,
): Promise<PersistResult> {
  try {
    if (!storage || typeof storage.persist !== "function") return "unsupported";
    if (typeof storage.persisted === "function" && (await storage.persisted())) return "already";
    return (await storage.persist()) ? "granted" : "denied";
  } catch {
    return "error";
  }
}
