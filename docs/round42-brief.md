# Round 42 — Smart Ingredient Search & Simplified UX (her brief, 2026-11-16)

Status: NOT STARTED. Do not deploy automatically. Report in Thai and ask approval before production.
Before starting: ask her what went wrong when she tried Round 41 on her iPhone (her message was cut off at "ลองแล้ว แต่…").

## Goal
Ingredient entry is too complicated (AI vs USDA vs reference vs many buttons). Make it like modern calorie apps:
type a name → see suggestions → pick one → enter quantity + unit → Add.
Example: type "ไข่" → whole egg / egg white / egg yolk / boiled egg … → pick → "2 eggs" → add.
No separate USDA or AI button in the normal flow. Keep all capabilities, just move them to a secondary option.

## 1. One unified Smart Ingredient Search (sources hidden behind it)
Recent + frequent ingredients, saved/favorite + custom ingredients, internal reference table (foodRef.ts),
USDA (Round 41), Open Food Facts where relevant, AI translation/matching/estimation only when needed.
Prioritize exact matches and the right preparation state. Never auto-pick a nutritionally different food
from a superficial name match.

## 2. Instant autocomplete
Thai + English, aliases + spelling variants, recent/frequent first, fast local results, debounced external
search, caching (fewer USDA calls), clear loading / offline / no-match states, avoid needless AI calls and cost.

## 3. Simple screen
Only: one search box, a simple suggestion list, quantity + unit, "Add ingredient".
Remove redundant AI / USDA buttons from the main flow (keep the code). Advanced source choice, manual
nutrition, label scan, AI estimate stay reachable through a secondary option. Provenance goes in expandable
"nutrition details", not in front of the choice.

## 4. On selecting an ingredient
Show name + preparation state. Allow g, ml and sensible household units. Auto-calculate kcal + macros.
Keep raw vs cooked. Ask a clarifying question only when it really changes nutrition. Missing values are never 0.
Never silently substitute an unrelated food.

## 5. Smart fallback
No reliable match → offer AI lookup/estimate, clearly labelled as estimated, with manual correction.
Never fake a USDA match. Keep the Round 40 Smart Calorie Buffer behavior.

## 6. Remember frequent ingredients
Surface a previously chosen specific food (egg, rice, minced beef product…) first next time.
Stored locally, privacy-friendly. She can change or remove a preferred match.

## 7. Do NOT remove
USDA, AI analysis, Open Food Facts, barcode scan, label scan, recipe math, provenance, Smart Calorie Buffer,
Food Diary, saved recipes, backup/import. Do not change historical nutrition data.

## 8. UX
Keep SnapCal's clean minimal look. Calm, easy for a first-time user. Thai + English. Fewest buttons and
decisions. iPhone first.

## 9. Approach
First inspect current ingredient screens + search services; propose the simplest unified architecture from
what exists; say which UI parts are reused. Build in small steps with regression tests: Thai + English
autocomplete, correct matching, ambiguous names, USDA + AI fallback, offline, repeat selections, quantity
conversions, existing recipes + diary compatibility. Run tests, tsc, lint, build.

## Extra requirements (second message) — convenience first
Flow: type → auto-search (existing ingredients, recents, internal refs, USDA, others) → select → quantity +
unit → nutrition calculated → added. This is the default.

**Custom ingredient.** If not found, she can create one with the EXISTING manual entry: name, quantity + unit,
kcal, protein, carbs, fat, extra nutrients where supported; nutrition per 100 g, per serving, or from a product
label (as the system already supports). A discreet "Add custom ingredient" must ALWAYS be available, not only
when results are empty.

**Remember custom ingredients.** She can save them; they appear in later searches, above unrelated database
results when relevant; she can edit and delete them. User-entered nutrition is NEVER marked verified.

Also: no choosing between AI / USDA / manual before searching; no competing search buttons; advanced source
options secondary; reuse the existing manual ingredient editor (do not rebuild it); keep recipes, math,
provenance, backup/import, Smart Calorie Buffer; Thai + English; never substitute a different food silently.
Principle: **Search first → select if found → enter manually if needed → save for future use.**

## Notes from the code (Round 41 state, for the next chat)
- Ingredient card lives in `app/recipes/[id]/edit/page.tsx` (IngredientCard): name box, amount + unit,
  label checkbox, ref choices, USDA picker, AI button. IngredientScan.tsx = barcode/photo fill.
- Search pieces: `app/lib/foodRef.ts` (matchRef), `app/lib/food/usdaSearch.ts` + `usdaMatch.ts`,
  `app/api/food/usda`, `app/api/ingredient` (AI lookup), Open Food Facts via barcode only (no live search).
- New saved data (recents, favorites, custom ingredients, preferred matches) must also go into backup.ts
  (new localStorage key + BACKUP_KEYS) so backup/import keeps working with old files.
