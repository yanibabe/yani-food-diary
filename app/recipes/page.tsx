"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PotTile, potTone } from "../components/ui";
import { useLang } from "../lib/lang";
import { fmtKcal } from "../lib/nutrition";
import { totalsForRecipe } from "../lib/recipe";
import { useStore } from "../lib/store";
import { RECIPE_CATEGORIES, type RecipeCategory } from "../lib/types";
import { Icon } from "../components/Icon";
import { MealThumb } from "../components/MealPicture";
import { MyIngredients } from "../components/MyIngredients";
import { ListSearchField } from "../components/ListSearchField";
import { filterByName } from "../components/recipeFilter";

// Round 33 — her pick "C": recipes sorted into category boxes that open and close.
// Rows show the line pot icon, never the photo (photos live inside the recipe).

const OPEN_KEY = "yfd:v1:recipes-open";

function readOpen(): RecipeCategory[] | null {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    return raw ? (JSON.parse(raw) as RecipeCategory[]) : null;
  } catch {
    return null;
  }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Icon name="caret-down" className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
  );
}

function RecipesInner() {
  const { ready, recipes } = useStore();
  const { tr, lang, dn } = useLang();
  const sp = useSearchParams();
  const date = sp.get("date");
  const [tab, setTab] = useState<"recipes" | "ingredients">(sp.get("tab") === "ingredients" ? "ingredients" : "recipes");
  const q = date ? `?date=${date}` : "";
  // Round 66: search (per tab) + the + for ingredients lives here in the header.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addingIng, setAddingIng] = useState(false);
  const searching = searchOpen && query.trim() !== "";
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };
  const list = [...recipes].sort((a, b) => b.updatedAt - a.updatedAt);
  const matched = filterByName(list, query);
  const groups = RECIPE_CATEGORIES.map((c) => ({ ...c, items: matched.filter((r) => (r.category ?? "other") === c.key) })).filter(
    (g) => g.items.length > 0,
  );
  const firstKey = groups[0]?.key ?? null;

  // Which boxes are open. First visit: only the first box.
  const [saved] = useState(() => (typeof window === "undefined" ? null : readOpen()));
  const [picked, setPicked] = useState<RecipeCategory[] | null>(null);
  const open = searching ? groups.map((g) => g.key) : picked ?? saved ?? (firstKey ? [firstKey] : []);
  function toggle(k: RecipeCategory) {
    const next = open.includes(k) ? open.filter((x) => x !== k) : [...open, k];
    setPicked(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      /* fine — just won't be remembered */
    }
  }

  return (
    <main className="page space-y-4">
      <header className="flex items-start justify-between">
        <h1 className="text-[26px] font-normal">{tr("สูตรของฉัน", "My recipes")}</h1>
        <div className="flex flex-col gap-2">
          {tab === "recipes" ? (
            <Link href="/recipes/new/edit" className="glass grid h-11 w-11 place-items-center" style={{ borderRadius: 9999 }} aria-label={tr("สูตรใหม่", "New recipe")} data-testid="new-recipe">
              <Icon name="plus" className="h-5 w-5" />
            </Link>
          ) : (
            <button type="button" className="glass grid h-11 w-11 place-items-center" style={{ borderRadius: 9999 }} aria-label={tr("เพิ่มวัตถุดิบ", "Add ingredient")} onClick={() => setAddingIng(true)} data-testid="my-ingredients-add">
              <Icon name="plus" className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="glass grid h-11 w-11 place-items-center" style={{ borderRadius: 9999 }} aria-label={tr("ค้นหา", "Search")} aria-pressed={searchOpen} onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))} data-testid="list-search-toggle">
            <Icon name="magnifying-glass" className="h-5 w-5" />
          </button>
        </div>
      </header>

      {searchOpen && (
        <ListSearchField
          value={query}
          onChange={setQuery}
          onClose={closeSearch}
          placeholder={tab === "recipes" ? tr("ค้นหาสูตร", "Search recipes") : tr("ค้นหาวัตถุดิบของฉัน", "Search my ingredients")}
        />
      )}

      <div className="grid grid-cols-2 gap-1 rounded-full border border-white/90 bg-white/55 p-1" role="tablist" data-testid="recipes-switch">
        {([
          ["recipes", tr("สูตร", "Recipes")],
          ["ingredients", tr("วัตถุดิบ", "Ingredients")],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`min-h-[44px] rounded-full text-[16px] ${tab === k ? "bg-ink text-paper" : "text-muted"}`}
            onClick={() => {
              setTab(k);
              closeSearch();
            }}
            data-testid={`recipes-tab-${k}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ingredients" && <MyIngredients query={query} searching={addingIng} onSearching={setAddingIng} onQueryClear={closeSearch} />}

      {tab === "recipes" && ready && list.length === 0 && (
        <div className="card p-6 text-center">
          <div className="mx-auto w-fit">
            <PotTile id="empty" size={56} radius={18} />
          </div>
          <p className="mt-3 text-[17px]">{tr("ยังไม่มีสูตร", "No recipes yet")}</p>
          <p className="text-[15px] text-muted">
            {tr("บันทึกเมนูที่ทำกินเอง แล้วกด “บันทึกว่ากิน” ได้ทุกครั้ง", "Save dishes you cook yourself, then tap “I ate this” any time")}
          </p>
        </div>
      )}

      {tab === "recipes" && ready && list.length > 0 && groups.length === 0 && (
        <p className="px-1 py-6 text-center text-[15px] text-muted">{tr("ไม่เจอ ลองคำอื่น", "Nothing found — try other words")}</p>
      )}

      {tab === "recipes" && groups.map((g) => {
        const isOpen = open.includes(g.key);
        return (
          <section key={g.key} className="card overflow-hidden" data-testid="recipe-group">
            <button className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left" onClick={() => toggle(g.key)} aria-expanded={isOpen}>
              <span>
                <span className="block text-[17px]">{g.label[lang]}</span>
                <span className="block text-[13px] text-muted">
                  {g.items.length} {tr("สูตร", g.items.length === 1 ? "recipe" : "recipes")}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {!isOpen && (
                  <span className="flex pl-2" aria-hidden>
                    {g.items.slice(0, 3).map((r) => (
                      <span key={r.id} className="-ml-2 h-6 w-6 rounded-full border-2 border-white" style={{ background: potTone(r.id) }} />
                    ))}
                  </span>
                )}
                <Chevron open={isOpen} />
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-1">
                {g.items.map((r) => {
                  const t = totalsForRecipe(r, lang);
                  return (
                    <Link
                      key={r.id}
                      href={`/recipes/${r.id}${q}`}
                      className="flex items-center gap-3 border-t border-line py-2.5 active:opacity-70"
                      data-testid="recipe-card"
                    >
                      <MealThumb title={r.name} className="h-[38px] w-[38px] shrink-0 rounded-[11px]" fallback={<PotTile id={r.id} size={38} radius={11} />} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">{dn(r.name, r.alt)}</span>
                        {r.sharedFrom && (
                          <span className="block truncate text-[12px]" style={{ color: "#C9845F" }} data-testid="recipe-shared-from">
                            💌 {tr("จาก", "from")} {r.sharedFrom}
                          </span>
                        )}
                      </span>
                      {t.complete ? (
                        <span className="shrink-0 text-right">
                          <span className="num text-[17px]">{fmtKcal(t.perServing.kcal)}</span>{" "}
                          <span className="text-[11px] text-muted">kcal</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[12px] text-warn-ink">{tr("ข้อมูลยังไม่ครบ", "Missing details")}</span>
                      )}
                      <Icon name="caret-right" className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}

export default function RecipesPage() {
  return (
    <Suspense>
      <RecipesInner />
    </Suspense>
  );
}
