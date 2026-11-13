"use client";
// Photos are big, so they live in IndexedDB (the phone's bigger built-in
// storage), not in localStorage. Everything else stays in localStorage.

const DB = "yani-food-diary";
const STORE = "photos";

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

export async function savePhoto(id: string, dataUrl: string): Promise<void> {
  await tx("readwrite", (s) => s.put(dataUrl, id));
}

export async function getPhoto(id: string): Promise<string | null> {
  try {
    return ((await tx("readonly", (s) => s.get(id))) as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

/** Shrink a picked/camera photo to a JPEG data URL (keeps the app light). */
export function compressImage(
  file: File,
  maxSide = 1280,
  quality = 0.8,
  badImageMessage = "อ่านรูปไม่ได้ ลองเลือกรูปอื่น",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(badImageMessage));
    };
    img.src = url;
  });
}

/** Every saved photo (id → picture), for the backup file. */
export async function allPhotos(): Promise<Record<string, string>> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out: Record<string, string> = {};
    const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      if (typeof c.value === "string") out[String(c.key)] = c.value;
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Put many photos back at once (restoring a backup). Existing ids are replaced. */
export async function putPhotos(photos: Record<string, string>): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const s = t.objectStore(STORE);
    for (const [id, url] of Object.entries(photos)) s.put(url, id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
