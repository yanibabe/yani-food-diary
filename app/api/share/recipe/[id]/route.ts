// Round 78: GET /api/share/recipe/<id> — the shared recipe as JSON.
import { isValidShareId } from "@/app/lib/shareRecipe";
import { readShare, ShareStoreError } from "@/app/lib/server/shareStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isValidShareId(id)) return Response.json({ error: "not-found", message: "Not found" }, { status: 404 });
  try {
    const s = await readShare(id);
    if (!s) return Response.json({ error: "not-found", message: "Not found" }, { status: 404 });
    return Response.json(s, { headers: { "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });
  } catch (e) {
    const code = e instanceof ShareStoreError ? e.code : "failed";
    return Response.json({ error: code, message: e instanceof Error ? e.message : String(e) }, { status: code === "no-token" ? 503 : 502 });
  }
}
