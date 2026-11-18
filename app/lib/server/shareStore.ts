// Round 78: the online shelf for shared recipes — a PRIVATE Vercel Blob store.
// shared/<id>.json = the recipe, shared/<id>.jpg = the cover picture. Nothing here is listed or public:
// the only way to read one is to know its long random id, and only these server routes read the store.

import { del, get, put } from "@vercel/blob";
import { parseStoredShare, type CoverFile, type StoredShare } from "../shareRecipe.ts";

export class ShareStoreError extends Error {
  constructor(readonly code: "no-token" | "failed", message: string) {
    super(message);
  }
}

const jsonPath = (id: string) => `shared/${id}.json`;
const coverPath = (id: string) => `shared/${id}.jpg`;

function needToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ShareStoreError("no-token", "Sharing is not set up on this server (no BLOB_READ_WRITE_TOKEN).");
}

/** Save a new share. Never overwrites. The cover goes first, so a recipe never points at a missing picture. */
export async function saveShare(id: string, stored: StoredShare, cover: CoverFile | null): Promise<void> {
  needToken();
  try {
    if (cover) {
      await put(coverPath(id), Buffer.from(cover.bytes), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: cover.mime });
    }
    await put(jsonPath(id), JSON.stringify(stored), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" });
  } catch (e) {
    if (cover) await del(coverPath(id)).catch(() => {});
    throw new ShareStoreError("failed", e instanceof Error ? e.message : String(e));
  }
}

/** Read a share. null = there is none with this id. */
export async function readShare(id: string): Promise<StoredShare | null> {
  needToken();
  try {
    const r = await get(jsonPath(id), { access: "private" });
    if (!r || r.statusCode !== 200) return null;
    return parseStoredShare(await new Response(r.stream).text());
  } catch (e) {
    if (e instanceof Error && /not.?found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw new ShareStoreError("failed", e instanceof Error ? e.message : String(e));
  }
}

/** The cover picture as a stream. null = none. */
export async function readCover(id: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; size: number } | null> {
  needToken();
  try {
    const r = await get(coverPath(id), { access: "private" });
    if (!r || r.statusCode !== 200) return null;
    return { stream: r.stream, contentType: r.blob.contentType, size: r.blob.size };
  } catch (e) {
    if (e instanceof Error && /not.?found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw new ShareStoreError("failed", e instanceof Error ? e.message : String(e));
  }
}

/** The public address of this server, from the request (works on localhost and on Vercel). */
export function originFrom(h: { get(name: string): string | null }, fallbackUrl?: string): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host && /^[A-Za-z0-9.\-:\[\]]+$/.test(host)) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }
  return fallbackUrl ? new URL(fallbackUrl).origin : "https://yani-food-diary.vercel.app";
}
