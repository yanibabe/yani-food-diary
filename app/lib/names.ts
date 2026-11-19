// Round 79: food names follow the app language.
// Every name she typed (or the AI gave) keeps its ORIGINAL text — that is what nutrition matching, search,
// USDA mapping and recipe linking use. Next to it we may keep the same name in the other language (`alt`),
// and ONLY the screens change which one they show (displayName).
//
//   alt = { th?, en?, src?, manual? }
//     th / en : the name in that language
//     src     : the original name the alt was made for. If the original changes later, the alt no longer
//               fits and is ignored (so a rename can never show a stale translation)
//     manual  : she typed it herself → kept, never replaced by an automatic translation
//
// No React and no storage here, so the tests can use it.

import type { Lang } from "./i18n.ts";
import { FOOD_REF, normalizeName } from "./foodRef.ts";

export type NameAlt = { th?: string; en?: string; src?: string; manual?: boolean };

/** One alt per name, in the same object as the name. Only these shapes carry one. */
export type Named = { alt?: NameAlt };

export const MAX_NAME_LEN = 120;

const THAI = /[฀-๿]/;

/** The language a name is written in: any Thai letter → "th", otherwise "en". */
export function nameLang(name: string): Lang {
  return THAI.test(name) ? "th" : "en";
}

/** The language the alt would hold for this name (the other one). */
export function otherLang(name: string): Lang {
  return nameLang(name) === "th" ? "en" : "th";
}

/** Trim, one space between words, no control characters, at most 120 letters. Empty → undefined. */
export function cleanAltText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!s || s.length > MAX_NAME_LEN) return undefined;
  return s;
}

/** Read an alt from saved or received data. Anything odd is dropped; never throws. */
export function sanitizeAlt(v: unknown): NameAlt | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: NameAlt = {};
  const th = cleanAltText(o.th);
  const en = cleanAltText(o.en);
  if (th) out.th = th;
  if (en) out.en = en;
  if (!out.th && !out.en) return undefined;
  if (typeof o.src === "string" && o.src.length <= MAX_NAME_LEN) out.src = o.src;
  if (o.manual === true) out.manual = true;
  // An alt that says neither "made for this name" nor "typed by her" can never be used.
  if (out.src === undefined && !out.manual) return undefined;
  return out;
}

/** The alt, only if it still fits this name (made for it, or typed by her). Otherwise undefined. */
export function validAlt(name: string, alt: NameAlt | undefined | null): NameAlt | undefined {
  if (!alt || typeof alt !== "object") return undefined;
  if (alt.manual === true || alt.src === name) return alt;
  return undefined;
}

/**
 * The name to show.
 *  - the app language is the language the original is written in → the original;
 *  - otherwise the saved name in the app language, if there is one that fits → that;
 *  - otherwise the original (never an empty or wrong name).
 */
export function displayName(original: string, alt: NameAlt | undefined | null, lang: Lang): string {
  if (nameLang(original) === lang) return original;
  const a = validAlt(original, alt);
  return cleanAltText(a?.[lang]) ?? original;
}

/** Build an alt from names in both languages (e.g. the AI's name_th / name_en). Keeps only the other-language one. */
export function altFor(name: string, names: { th?: unknown; en?: unknown }): NameAlt | undefined {
  const other = otherLang(name);
  const text = cleanAltText(names[other]);
  if (!text) return undefined;
  return { [other]: text, src: name } as NameAlt;
}

/** She changed a name. The automatic alt no longer fits (it is dropped); one she typed herself is kept. */
export function renameAlt(alt: NameAlt | undefined, oldName: string, newName: string): NameAlt | undefined {
  if (!alt) return undefined;
  if (oldName === newName) return alt;
  if (alt.manual === true) return alt;
  return undefined;
}

/** What she typed in the "other language" box. Empty clears it. Typed text is kept as hers (manual). */
export function setManualAlt(name: string, alt: NameAlt | undefined, typed: string): NameAlt | undefined {
  const other = otherLang(name);
  const base = validAlt(name, alt) ?? {};
  const rest: NameAlt = { ...base };
  delete rest[other];
  const t = typed.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN);
  if (!t) {
    const left = rest.th ?? rest.en;
    return left ? { ...rest, src: name } : undefined;
  }
  return { ...rest, [other]: t, src: name, manual: true };
}

/** The text for the "other language" box in an edit sheet (empty when there is none that fits). */
export function manualAltText(name: string, alt: NameAlt | undefined): string {
  return cleanAltText(validAlt(name, alt)?.[otherLang(name)]) ?? "";
}

/** True for a name worth translating: has a letter, not too long. */
export function translatable(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n.length <= MAX_NAME_LEN && /\p{L}/u.test(n);
}

/** Does this name still lack the other-language name? */
export function needsAlt(name: string, alt: NameAlt | undefined): boolean {
  if (!translatable(name)) return false;
  return !cleanAltText(validAlt(name, alt)?.[otherLang(name)]);
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The cheapest source: the app's own food table already has the Thai and English name of a food.
 * Only an EXACT name counts ("ไข่ไก่" yes, "ไข่ไก่ทอด" no — that is a different food).
 */
export function refPair(name: string): { th: string; en: string } | null {
  const n = normalizeName(name);
  if (!n) return null;
  for (const f of FOOD_REF) {
    if (!f.names.some((w) => normalizeName(w) === n)) continue;
    const th = f.names.find((w) => THAI.test(w)) ?? f.label.th;
    const en = f.label.en;
    if (!th || !en) return null;
    return { th, en: cap(en) };
  }
  return null;
}

/** Where a missing name can come from without the AI: the food table, then names already translated once. */
export type Lookup = (name: string) => { th?: string; en?: string } | null | undefined;

/**
 * Fill in a missing other-language name. Returns the SAME object (===) when nothing changes,
 * so callers can tell whether to save.
 */
export function resolveAlt(name: string, alt: NameAlt | undefined, lookup: Lookup): NameAlt | undefined {
  if (!needsAlt(name, alt)) return alt;
  const found = refPair(name) ?? lookup(name);
  const other = otherLang(name);
  const text = cleanAltText(found?.[other]);
  if (!text) return alt;
  const base = validAlt(name, alt) ?? {};
  return { ...base, [other]: text, src: name };
}

// ---------------------------------------------------------------------------
// Walking her data: every place that has a name and an alt.
// ---------------------------------------------------------------------------

type Ingredientish = { name: string } & Named;
type ItemLike = { name: string } & Named;
type EntryLike = { title: string; items: ItemLike[]; recipe: ({ recipeName: string; ingredients: Ingredientish[] } & Named) | null } & Named;
type RecipeLike = { name: string; ingredients: Ingredientish[] } & Named;

/** Apply `fix` to one named thing; returns the same object when nothing changed. */
function fixOne<T extends Named>(obj: T, name: string, fix: (name: string, alt: NameAlt | undefined) => NameAlt | undefined): T {
  const next = fix(name, obj.alt);
  if (next === obj.alt) return obj;
  const out = { ...obj } as T;
  if (next) out.alt = next;
  else delete out.alt;
  return out;
}

function fixList<T extends { name: string } & Named>(list: T[], fix: (n: string, a: NameAlt | undefined) => NameAlt | undefined): T[] {
  let changed = false;
  const out = list.map((x) => {
    const y = fixOne(x, x.name, fix);
    if (y !== x) changed = true;
    return y;
  });
  return changed ? out : list;
}

export function fixEntry<E extends EntryLike>(e: E, fix: (n: string, a: NameAlt | undefined) => NameAlt | undefined): E {
  let out = fixOne(e, e.title, fix);
  const items = fixList(out.items, fix);
  if (items !== out.items) out = { ...out, items };
  if (out.recipe) {
    let rec = fixOne(out.recipe, out.recipe.recipeName, fix);
    const ings = fixList(rec.ingredients, fix);
    if (ings !== rec.ingredients) rec = { ...rec, ingredients: ings };
    if (rec !== out.recipe) out = { ...out, recipe: rec };
  }
  return out;
}

export function fixRecipe<R extends RecipeLike>(r: R, fix: (n: string, a: NameAlt | undefined) => NameAlt | undefined): R {
  let out = fixOne(r, r.name, fix);
  const ings = fixList(out.ingredients, fix);
  if (ings !== out.ingredients) out = { ...out, ingredients: ings };
  return out;
}

export function fixCustom<C extends { name: string } & Named>(list: C[], fix: (n: string, a: NameAlt | undefined) => NameAlt | undefined): C[] {
  return fixList(list, fix);
}

/** Same array back (===) when nothing changed. */
export function mapEntries<E extends EntryLike>(list: E[], fix: (n: string, a: NameAlt | undefined) => NameAlt | undefined): E[] {
  let changed = false;
  const out = list.map((e) => {
    const y = fixEntry(e, fix);
    if (y !== e) changed = true;
    return y;
  });
  return changed ? out : list;
}

export function mapRecipes<R extends RecipeLike>(list: R[], fix: (n: string, a: NameAlt | undefined) => NameAlt | undefined): R[] {
  let changed = false;
  const out = list.map((r) => {
    const y = fixRecipe(r, fix);
    if (y !== r) changed = true;
    return y;
  });
  return changed ? out : list;
}

/** Fill in names from a lookup everywhere. Same arrays back (===) when nothing changed. */
export function applyLookup<E extends EntryLike, R extends RecipeLike, C extends { name: string } & Named>(
  data: { entries: E[]; recipes: R[]; custom: C[] },
  lookup: Lookup,
): { entries: E[]; recipes: R[]; custom: C[] } {
  const fix = (n: string, a: NameAlt | undefined) => resolveAlt(n, a, lookup);
  return { entries: mapEntries(data.entries, fix), recipes: mapRecipes(data.recipes, fix), custom: fixCustom(data.custom, fix) };
}

/** Every distinct name (in first-seen order) that still lacks its other-language name. */
export function missingNames(
  data: { entries: EntryLike[]; recipes: RecipeLike[]; custom: ({ name: string } & Named)[] },
  lookup: Lookup,
): string[] {
  const seen = new Set<string>();
  const collect = (n: string, a: NameAlt | undefined) => {
    if (needsAlt(n, a) && !resolveAlt(n, a, lookup)?.[otherLang(n)]) seen.add(n);
    return a;
  };
  data.entries.forEach((e) => fixEntry(e, collect));
  data.recipes.forEach((r) => fixRecipe(r, collect));
  fixCustom(data.custom, collect);
  return [...seen];
}
