"use client";
// Open Food Facts' own store on the phone (IndexedDB "yfd-off", store "products").
// It keeps each OFF product exactly as OFF sent it (ODbL share-alike), never
// mixed with any other data. It is a cache: products older than 7 days are fetched again.
// Meals keep their own copy of the numbers, so this store is not part of backups.

import type { OffProduct } from "./openFoodFacts.ts";

const DB = "yfd-off";
const STORE = "products";
export const OFF_CACHE_DAYS = 7;

export type StoredOffProduct = { code: string; product: OffProduct; fetchedAt: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** A fresh saved product, or null (missing, too old, or storage blocked). */
export async function getOffProduct(code: string, now = Date.now()): Promise<StoredOffProduct | null> {
  try {
    const v = (await tx("readonly", (s) => s.get(code))) as StoredOffProduct | undefined;
    return v && now - v.fetchedAt < OFF_CACHE_DAYS * 86400_000 ? v : null;
  } catch {
    return null;
  }
}

export async function putOffProduct(code: string, product: OffProduct, now = Date.now()): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put({ code, product, fetchedAt: now } satisfies StoredOffProduct, code));
  } catch {
    // storage blocked: it will just ask OFF again next time
  }
}
