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
  if (alt.manual === true) return alt;
  if (alt.src !== name) return undefined;
  // An automatic name that names a different meat (saved before this check existed) is not trusted.
  const other = alt[otherLang(name)];
  if (typeof other === "string" && !sameProtein(name, other)) return undefined;
  return alt;
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

const PROTEINS: [RegExp, RegExp][] = [
  [/หมู/, /\b(pork|pig|ham|bacon)\b/i],
  [/ไก่/, /\b(chicken|hen)\b/i],
  [/เนื้อวัว|เนื้อ(?!ปลา|ปู|หมู|ไก่)/, /\bbeef\b/i],
  [/กุ้ง/, /\b(shrimps?|prawns?)\b/i],
  [/ปลา/, /\b(fish|salmon|tuna|mackerel|tilapia|catfish|sea ?bass)\b/i],
  [/เป็ด/, /\bduck\b/i],
];

/** Do a Thai name and an English name agree on which meat it is? (A name with no meat word agrees.) */
export function sameProtein(a: string, b: string): boolean {
  const th = nameLang(a) === "th" ? a : b;
  const en = th === a ? b : a;
  const thHas = PROTEINS.map(([t]) => t.test(th));
  const enHas = PROTEINS.map(([, e]) => e.test(en));
  // A meat named on one side but a DIFFERENT meat (and not this one) on the other side = they disagree.
  for (let i = 0; i < PROTEINS.length; i++) {
    if (thHas[i] && !enHas[i] && enHas.some((x, j) => x && !thHas[j])) return false;
    if (enHas[i] && !thHas[i] && thHas.some((x, j) => x && !enHas[j])) return false;
  }
  return true;
}

/** Build an alt from names in both languages (e.g. the AI's name_th / name_en). Keeps only the other-language one. */
export function altFor(name: string, names: { th?: unknown; en?: unknown }): NameAlt | undefined {
  const other = otherLang(name);
  const text = cleanAltText(names[other]);
  if (!text) return undefined;
  // The AI sometimes keeps her Thai name but writes the English from the photo ("แหนมเอ็นหมู" → "…chicken").
  // A pair that disagrees on the main meat is dropped; the background translation then makes a true one.
  if (!sameProtein(name, text)) return undefined;
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

// ---------------------------------------------------------------------------
// Round 80: the two edit boxes follow the APP language.
// The big (main) box shows the name in the app language; the small box shows the other language.
// Under the hood nothing changes: `name` is still the original, `alt` still holds the other language.
// ---------------------------------------------------------------------------

export type NameBoxes = {
  /** Text of the big box. */
  main: string;
  /** Text of the small box. */
  small: string;
  /** The language the small box is written in (for its label). */
  smallLang: Lang;
  /** True when the big box holds the saved other-language name (not the original). */
  mainIsAlt: boolean;
};

/** What the two boxes show for this name, alt and app language. */
export function nameBoxes(name: string, alt: NameAlt | undefined, lang: Lang): NameBoxes {
  const orig = nameLang(name);
  const other = otherLang(name);
  const altText = cleanAltText(validAlt(name, alt)?.[other]);
  // Original is in another language than the app AND we have the app-language name → show that one big.
  if (orig !== lang && altText) return { main: altText, small: name, smallLang: orig, mainIsAlt: true };
  return { main: name, small: altText ?? "", smallLang: other, mainIsAlt: false };
}

/**
 * She typed in the big box. Returns the new original name and alt.
 *  - the big box shows the original → the name changes (a name she typed herself keeps its alt; an
 *    automatic alt is dropped and made again);
 *  - the big box shows the alt → what she typed becomes the real original name (it is what matching and
 *    the AI use). The old original stays as her other-language name only if the alt was hers (manual).
 */
export function editMainBox(name: string, alt: NameAlt | undefined, lang: Lang, typed: string): { name: string; alt: NameAlt | undefined } {
  const b = nameBoxes(name, alt, lang);
  if (!b.mainIsAlt) return { name: typed, alt: renameAlt(alt, name, typed) };
  const keep = validAlt(name, alt)?.manual === true && nameLang(typed) !== nameLang(name) && typed.trim() !== "";
  return { name: typed, alt: keep ? ({ [nameLang(name)]: name, src: typed, manual: true } as NameAlt) : undefined };
}

/**
 * She typed in the small box. Returns the new original name and alt.
 *  - the small box shows the other language → it is her own alt (manual), as before;
 *  - the small box shows the original (big box shows the alt) → the original is edited and the alt that
 *    is on screen stays (it becomes hers). Emptied → the alt becomes the original.
 */
export function editSmallBox(name: string, alt: NameAlt | undefined, lang: Lang, typed: string): { name: string; alt: NameAlt | undefined } {
  const b = nameBoxes(name, alt, lang);
  if (!b.mainIsAlt) return { name, alt: setManualAlt(name, alt, typed) };
  const v = validAlt(name, alt);
  if (!typed.trim()) return { name: b.main, alt: undefined };
  return { name: typed, alt: v ? { ...v, src: typed, manual: true } : undefined };
}

// ---------------------------------------------------------------------------
// Round 80: the meal title follows a renamed item.
// ---------------------------------------------------------------------------

export type Renamed = { oldName: string; oldAlt?: NameAlt; newName: string; newAlt?: NameAlt };

/** The name in one language, if we have it (the original or a fitting alt). */
function textIn(name: string, alt: NameAlt | undefined, l: Lang): string | undefined {
  if (nameLang(name) === l) return cleanAltText(name) ?? undefined;
  return cleanAltText(validAlt(name, alt)?.[l]);
}

/** Replace the first case-insensitive match. Null when `find` is not inside `text`. */
function replaceFirst(text: string, find: string, repl: string): string | null {
  const f = find.trim();
  if (f.length < 2) return null;
  const at = text.toLowerCase().indexOf(f.toLowerCase());
  if (at < 0) return null;
  return text.slice(0, at) + repl + text.slice(at + f.length);
}

const LANGS: Lang[] = ["th", "en"];

/**
 * Items were renamed. If the title (typed by the app or the AI, not by her) still contains an old item name —
 * in either language — put the new name there. The title's other-language name is changed the same way, or
 * dropped (so it is translated again) when that cannot be done. Null when the title does not change.
 */
export function followRenames(title: string, alt: NameAlt | undefined, renames: Renamed[]): { title: string; alt: NameAlt | undefined } | null {
  let t = title;
  let a = validAlt(title, alt);
  const other = otherLang(title);
  let changed = false;
  for (const r of renames) {
    if (r.oldName === r.newName) continue;
    let done = false;
    // 1) Swap in the title's own language, only when the new name exists in that language too.
    for (const l of LANGS) {
      const old = textIn(r.oldName, r.oldAlt, l);
      const nu = textIn(r.newName, r.newAlt, l);
      if (!old || !nu) continue;
      const next = replaceFirst(t, old, nu);
      if (next == null) continue;
      t = next;
      done = true;
      break;
    }
    // 2) The new name is only in the OTHER language (she typed Thai over an English title): do the swap in
    //    the title's other-language version and make that the title, so it never ends up half Thai, half
    //    English. Its translation is made again in the background.
    if (!done) {
      const nl = nameLang(r.newName);
      const oldNl = textIn(r.oldName, r.oldAlt, nl);
      const curNl = nameLang(t) === nl ? t : cleanAltText(a?.[nl]);
      const swapped = curNl && oldNl ? replaceFirst(curNl, oldNl, r.newName) : null;
      if (swapped != null) {
        t = swapped;
        a = undefined;
        changed = true;
        continue;
      }
    }
    // 3) Last resort: plain swap (may mix languages until the background translation catches up).
    if (!done) {
      for (const l of LANGS) {
        const old = textIn(r.oldName, r.oldAlt, l);
        const next = old ? replaceFirst(t, old, r.newName) : null;
        if (next == null) continue;
        t = next;
        done = true;
        break;
      }
    }
    if (!done) continue;
    changed = true;
    // The other-language title: same swap in that language; if it cannot be done the alt is dropped.
    const old = textIn(r.oldName, r.oldAlt, other);
    const nu = textIn(r.newName, r.newAlt, other);
    const cur = cleanAltText(a?.[other]);
    const swapped = cur && old && nu ? replaceFirst(cur, old, nu) : null;
    a = swapped && a ? { ...a, [other]: swapped } : undefined;
  }
  if (!changed) return null;
  return { title: t, alt: a ? { ...a, src: t } : undefined };
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

/** Every distinct name that still lacks its other-language name. Newest meals first (by date), so today's
 *  meals are translated in the first batch even with a long history; then recipes, then my ingredients. */
export function missingNames(
  data: { entries: EntryLike[]; recipes: RecipeLike[]; custom: ({ name: string } & Named)[] },
  lookup: Lookup,
): string[] {
  const seen = new Set<string>();
  const collect = (n: string, a: NameAlt | undefined) => {
    if (needsAlt(n, a) && !resolveAlt(n, a, lookup)?.[otherLang(n)]) seen.add(n);
    return a;
  };
  const day = (e: EntryLike) => String((e as { date?: unknown }).date ?? "");
  [...data.entries].sort((a, b) => day(b).localeCompare(day(a))).forEach((e) => fixEntry(e, collect));
  data.recipes.forEach((r) => fixRecipe(r, collect));
  fixCustom(data.custom, collect);
  return [...seen];
}
