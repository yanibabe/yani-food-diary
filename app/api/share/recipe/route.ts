// Round 78: POST /api/share/recipe — store a recipe (and its cover) online, answer with a link.
import { newShareId, MAX_BODY_BYTES, parseShareRequest, toStoredShare } from "@/app/lib/shareRecipe";
import { originFrom, saveShare, ShareStoreError } from "@/app/lib/server/shareStore";

export const maxDuration = 30;

const err = (status: number, error: string, message: string) => Response.json({ error, message }, { status });

export async function POST(req: Request) {
  // Cheap guard first: refuse a body that announces itself as too big, before reading it.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return err(413, "too-big", "The recipe is too big to share (max about 600 KB).");
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return err(400, "bad-request", "Could not read the request.");
  }
  if (raw.length > MAX_BODY_BYTES) return err(413, "too-big", "The recipe is too big to share (max about 600 KB).");
  const checked = parseShareRequest(raw);
  if (!checked.ok) return err(checked.error.startsWith("body: too big") ? 413 : 400, "bad-request", checked.error);

  const id = newShareId();
  try {
    await saveShare(id, toStoredShare(checked.value), checked.value.cover);
  } catch (e) {
    const code = e instanceof ShareStoreError ? e.code : "failed";
    console.error("[share-recipe]", code, e instanceof Error ? e.message : e);
    return err(code === "no-token" ? 503 : 502, code, e instanceof Error ? e.message : String(e));
  }
  return Response.json({ id, url: `${originFrom(req.headers, req.url)}/r/${id}` });
}
