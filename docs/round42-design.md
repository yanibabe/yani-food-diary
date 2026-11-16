# Round 42 design — Search first (simplest plan using what already exists)

Principle: Search first → pick if found → enter manually if needed → save for future use.

## Where it goes
Recipe edit page `app/recipes/[id]/edit/page.tsx`. The button "+ เพิ่มวัตถุดิบ" opens a new bottom sheet
`app/components/AddIngredientSheet.tsx` (search-first). The existing `IngredientCard` stays as-is = the
manual/advanced editor (label scan, USDA, AI, reference choice). Nothing is deleted. Each added
ingredient still appears as an IngredientCard, now with its numbers already filled, and the USDA / AI buttons
inside it stay but are moved under a quiet "ตัวเลือกขั้นสูง / Advanced" fold.

## Sheet (4 things only)
1. One search input.  2. Suggestion list.  3. Quantity + unit.  4. "เพิ่ม / Add" button.
Plus one discreet text link "+ สร้างวัตถุดิบเอง / Add custom ingredient" ALWAYS visible (not only on empty).

## Pure logic (testable, no React): `app/lib/ingredientSearch.ts`
`localSuggestions(query, ctx)` → ordered list of `Suggestion`:
 - kind "custom" (her saved custom ingredients)       — first
 - kind "preferred" / "recent" (past picks, by use count + recency) — next
 - kind "ref" (FOOD_REF from foodRef.ts, via normalizeName / aliases) — next
 Thai + English, aliases (use USDA_ALIASES / englishQuery word list), spelling variants, case-insensitive.
 Egg example: "ไข่" → whole egg, egg white, egg yolk, boiled egg, fried egg... each a separate row with its state.
 Never merge nutritionally different foods; never auto-pick when ambiguous (just show rows).
`usdaSuggestions` = existing `/api/food/usda` search, called only when: query ≥ 2 chars, debounced 500 ms,
 passcode present, online, and local results fewer than ~4 close ones. Cache by normalized query in memory
 (+ sessionStorage). Offline / error / no passcode → local results still shown + one quiet line.
AI fallback: only if user taps the single row "ไม่เจอ? ให้ AI ประมาณค่า" shown at the bottom when there is no close
 match. Result is labelled "ประมาณ / estimate", editable. Smart Calorie Buffer unchanged (existing aiRef path).
`buildIngredient(suggestion, amount, unit)` → `Ingredient` using the EXISTING fields (label / usda / refPick / aiRef /
 gPerMl / gramsPerUnit) exactly like the current picker flows do, so recipe math, provenance, buffer, backup stay
 identical. Missing values stay unknown (never 0). User-typed values are never "verified".

## Memory (local only, in backup)
- `yfd:v1:customIngredients` : saved custom ingredients (name, state, per-100 g/ml kcal/P/C/F, optional extras,
  gramsPerUnit, gPerMl, createdAt). Edit + delete in the sheet ("จัดการ / Manage" fold).
- `yfd:v1:ingredientPrefs` : picks `{ queryKey, pick, count, lastUsed }`; change/remove ("ลืมตัวเลือกนี้ / Forget").
  Stores only ingredient names and numbers, never photos/personal data.
Both added to BACKUP_KEYS (old backups without them must still restore).

## Rules
- Do not change any saved recipe/diary numbers. Old data works unchanged (all new fields optional).
- No new paid service, no new npm packages.
- Thai + English text via tr(th, en). Phone first, calm, few buttons.
- Tests in `tests/round42-*.test.ts`: TH/EN autocomplete, aliases, ambiguity (egg, milk, rice raw/cooked, oyster sauce),
  ranking (custom > preferred > recent > ref), USDA/AI fallback with fake client, offline, repeat picks,
  unit conversions, old recipe + backup compatibility.
