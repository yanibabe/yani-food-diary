// Round 78: GET /api/share/recipe/<id>/cover — the cover picture. Public on purpose: LINE's link preview needs it.
import { isValidShareId } from "@/app/lib/shareRecipe";
import { readCover, ShareStoreError } from "@/app/lib/server/shareStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isValidShareId(id)) return new Response("Not found", { status: 404 });
  try {
    const c = await readCover(id);
    if (!c) return new Response("Not found", { status: 404 });
    return new Response(c.stream, {
      headers: {
        "Content-Type": c.contentType === "image/webp" ? "image/webp" : "image/jpeg",
        "Content-Length": String(c.size),
        // A share never changes, so the picture can be kept for a year.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    const code = e instanceof ShareStoreError ? e.code : "failed";
    return new Response(e instanceof Error ? e.message : String(e), { status: code === "no-token" ? 503 : 502 });
  }
}
