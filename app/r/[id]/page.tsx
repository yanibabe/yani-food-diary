// Round 78: the page a friend opens from a shared recipe link. Server-drawn <head> (link preview
// for LINE / Messages), then the letter UI (client side) saves the recipe into their own phone.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SharedRecipeView } from "../../components/SharedRecipeView";
import { isValidShareId, ogDescription, sharedTotals } from "../../lib/shareRecipe";
import { originFrom, readShare } from "../../lib/server/shareStore";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!isValidShareId(id)) return null;
  try {
    return await readShare(id);
  } catch (e) {
    console.error("[share-page]", e instanceof Error ? e.message : e);
    return undefined; // the shelf itself is not reachable (different from "no such recipe")
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await load(id);
  if (!s) return { title: "SnapCal", robots: { index: false, follow: false } };
  const origin = originFrom(await headers());
  const t = sharedTotals(s.recipe);
  const description = t.complete ? ogDescription(t.perServing.kcal, s.from) : `${s.from} แชร์จาก SnapCal`;
  const image = s.hasCover ? `${origin}/api/share/recipe/${id}/cover` : undefined;
  const url = `${origin}/r/${id}`;
  return {
    title: s.recipe.name,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: s.recipe.name, description, url, siteName: "SnapCal", type: "website", locale: "th_TH", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: s.recipe.name, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function SharedRecipePage({ params }: Props) {
  const { id } = await params;
  const s = await load(id);
  if (s === null) notFound();
  if (s === undefined) {
    return (
      <main className="page pt-20 text-center">
        <p className="text-[17px]">ตอนนี้เปิดสูตรไม่ได้ ลองใหม่อีกครั้งนะ</p>
        <p className="mt-1 text-[14px] text-muted">Could not open this recipe right now. Please try again.</p>
      </main>
    );
  }
  const t = sharedTotals(s.recipe);
  return (
    <SharedRecipeView
      shareId={id}
      share={s}
      coverUrl={s.hasCover ? `/api/share/recipe/${id}/cover` : null}
      perServing={t.complete ? t.perServing : null}
    />
  );
}
