# NEXT_STEPS — SnapCal (folder/repo/URL still "yani-food-diary")

**This file is the handoff.** Read it first in every chat about this app.

**To resume in a fresh chat, Yani types:** `continue yani-food-diary`

---

## LIVE (updated 2026-11-16; Round 41 USDA LIVE (ca631a5) — see "NEXT — Round 41"; Round 40 Smart Calorie Buffer + final checks LIVE (commit 4526f87, Vercel success); Round 39.1 plain water = 0 kcal LIVE; Round 39 nutrition accuracy: careful matching + source marks + unknown nutrients + densities LIVE; Round 38 recipe ingredient photos: any/many photos + average fallback LIVE; Round 37 waiting popup while a photo is read LIVE; Round 36 camera asks once per opening + album photos LIVE; Round 35 scan ingredients in recipes LIVE; Round 34 Phosphor Light icons LIVE; Round 33 recipes in category boxes + pot icon + 34 units LIVE; Round 32 line-only small character + % in tiles + food tip LIVE; Round 31 whole app in Frosted Calm + richer share picture LIVE; Round 30 Frosted Calm share picture + Profile LIVE; Round 29 share my day with my trainer (picture) LIVE; Round 28 simpler "กินอะไรดี" (menu + recipe, no delivery) LIVE; Round 27 label numbers = no +15% LIVE; Round 26 grouped "what can I eat" LIVE; Round 25 "what can I eat" LIVE; Round 24 weight moved to Profile, steps removed)

- **App:** https://yani-food-diary.vercel.app  (Vercel, exm-labs account, free)
- **Code:** https://github.com/yanibabe/yani-food-diary  (private; pushes auto-deploy)
- `OPENROUTER_API_KEY` is set in Vercel (Production + Preview), encrypted.
- Checked live: home, manifest, icon load; `/api/status` says configured; one real AI
  call ("กล้วยหอม 1 ลูก" → 120 kcal) worked.
- Sharing the link: each person's diary, recipes and profile live ONLY on their own
  phone (localStorage + IndexedDB). Nobody sees anyone else's data. But everyone with
  the link uses Yani's OpenRouter key, so their AI photo/text checks spend HER credit.
  Since Round 8 the AI needs a passcode (typed once per phone), so strangers can't spend it.

## ▶ HER 3 NEW WISHES (2026-11-16) — one round each, in this order unless she picks another

1. ~~Round 27 — real label numbers, no +15%~~ ✅ DONE (see Round 27 below). Next = Round 28.
2. ~~Round 28 — "กินอะไรดี" simpler~~ ✅ DONE (see Round 28 below). Next = Round 29.
   (old wish text:) **Round 28 — "กินอะไรดี" simpler.** Remove the delivery group (+ Grab / LINE MAN buttons): she finds it too much.
   Instead: suggested menu names; tap one → recipe (ingredients + steps) + kcal, so people can cook it,
   or just search the name. Keep "my recipes" group. 7-Eleven group: ask her if it stays.
3. ~~Round 29 — share my day with my trainer~~ ✅ DONE (see Round 29 below). All 3 wishes done.
   (old wish text:) **Round 29 — share my day with my trainer.** One-tap share of a whole day: every food eaten +
   kcal, protein, fat, carbs (and totals). Easy to send (image and/or text via the iPhone share sheet).
   Ask her: picture, text, or both.

## ▶ NEXT: she tries Rounds 36 + 37 on her iPhone, then picks what's next
Rounds 33–35 tried on her iPhone ✓ ("okay"). Round 36 = her 2 fixes from that try.
Round 36: she said "okay" (2026-11-16) and asked for Round 37.

## ▶ PHASE 1 — NUTRITION ACCURACY UPGRADE (approved by her 2026-11-16)
She had the project reviewed outside (review zip on her Desktop) and approved this plan.
Order: accuracy first, THEN Healthy Recipe Library, personalized meal ideas, weekly meal planner.
- **Round 39 ✅ DONE + LIVE (details in the Round 39 section below):** nutrition data reliability, no outside services.
  Fix ingredient name matching (oyster sauce "น้ำมันหอย" ≠ oil, raw rice ≠ cooked rice, condensed / soy /
  coconut milk ≠ cow milk, egg white ≠ whole egg, dried ≠ fresh shrimp, chicken cuts). Never auto-pick an
  unclear match: ask her. Record WHERE every number comes from (source) + HOW sure it is (verification).
  User-typed values are NOT "verified". Old records with unclear origin = "unknown" (never claim verified).
  Missing nutrients stay unknown (not 0). Raw / cooked / dried states. Real densities for ml ↔ g
  (never assume every liquid is 1 g/ml). 4/4/9 kcal check as a hint only. Small estimate marks in the
  existing design. Never rewrite saved diary numbers. Regression tests for every issue.
  NOT in Round 39: USDA, Mahidol data, any change to the +15% rule, recipe library, meal planner.
- **Round 40 ✅ BUILT (not deployed yet):** +15% removed; optional Smart Calorie Buffer 0–20% on kcal only
  (she chose: no numeric ranges unless the method is clear → only "~" estimate marks). See Round 40 section.
- **Round 41:** USDA FoodData Central (free, public domain CC0, source credit requested). Needs a free
  data.gov API key that SHE signs up for; key lives on the server only. 1,000 requests/hour.
- **Round 42:** Mahidol INMU Thai Food Composition Database — free for non-commercial use with credit,
  but "all rights reserved"; putting values inside an app needs permission by email (I can draft it in
  English, she sends it). No API or download file found. Do NOT use it before permission.
- Checkpoint before Round 39: git tag `before-round-39` (also on GitHub).

## ▶ NEXT — ask her (one at a time)
- Round 39 + 39.1 (water fix) are live. She should try them on her iPhone (checklist in the Round 39 section). Then Round 40
  (her decision on the +15% rule).
- ✅ Round 38 tried on her iPhone (2026-11-16): she said "ลองแล้ว ใช้ได้" (tried it, it works). Nothing
  more was reported (which photos / products she used is not known).
- Barcode page "ไม่ตรงกับซอง? ถ่าย/เลือกรูปฉลาก" was NOT changed (she let me decide: that button exists
  to FIX numbers, which needs a real label photo). Could be its own round later if she wants it.
- Older open items under Round 36 (food tip ก/ข choice; Rounds 33–35 not tried on iPhone).

## ▶ NEXT — Round 42 "Smart Ingredient Search & Simplified UX" is APPROVED TO START (brief saved)
- Her full brief (2 messages) is in `docs/round42-brief.md`. Read it first. Nothing is built yet.
- Round 41 question settled: her "ลองแล้ว แต่…" was a typo, no problem.
  cut off). Fix any real Round 41 problem before Round 42.
- Do not deploy Round 42 automatically; report in Thai and ask approval first.
- Fresh chat: she types `continue yani-food-diary`.

## ▶ NEXT — Round 41 USDA is LIVE (2026-11-16, commit ca631a5, Vercel success)
- She approved the deploy. USDA_API_KEY added to Vercel **Production only**, type Sensitive (piped from
  .env.local, never printed). Preview has no USDA key (she asked for Production) → preview deploys show no USDA button.
- Live checks done: home 200; /api/status `usda: true`; /api/food/usda without passcode → 401 (passcode lock
  works, not bypassed); live phone JS (13 files) has the USDA picker but NO key and NO USDA address.
- NOT done by me: a real USDA search on production — it needs HER passcode. She does it on her iPhone:
  1) My recipes → edit → ingredient "ข้าวสวย" 150 g → "ค้นหาค่าใน USDA" → cooked white rice ~130 kcal/100 g → ใช้อันนี้ → ~195 kcal + USDA badge.
  2) Add a meal by text → tap an item → "ใช้ค่าจาก USDA" → pick → grams → USDA badge; others still ประมาณ; undo works.
  3) Airplane mode → open the USDA panel → friendly error + "ลองอีกครั้ง"; close it and the meal still saves.
- Her cut-off message was just a typo (she confirmed 2026-11-16): Round 41 has no known problem.
- Do NOT start Round 42 (Mahidol) or the Recipe Library until she says.

## ▶ NEXT — Round 40 is LIVE (2026-11-16)
- She tries it on her iPhone (checklist in the Round 40 section + "อกไก่ทอด 200 กรัม" → oil as its own item).
- Real AI not tried yet with the new prompt.
- Then Round 41 (USDA) only when she says — she must sign up for a free data.gov key herself.

## Round 41 (2026-11-16) — USDA FoodData Central ✅ LIVE (ca631a5)
Checkpoint: git tag `before-round-41` (local). Brief = her long pasted Round 41 spec (items 1–10).
- Server client `app/lib/food/usda.ts`: key from `USDA_API_KEY` in the X-Api-Key header (never in URL,
  logs, errors or the phone bundle — checked .next/static). DEMO_KEY refused in production. 8 s timeout,
  one retry on 5xx/network, 429 never retried (hourly limit 1,000). In-memory cache (search 1 day,
  details 7 days). Route `app/api/food/usda/route.ts` (passcode like the AI routes); `/api/status` now says
  `usda: true/false` only. Test mode: `USDA_MOCK=1` (in `npm run dev:mock`) uses `app/lib/food/usdaMock.ts`.
- Nutrients `app/lib/food/usdaNutrients.ts`: ids 1008 → 2048 → 2047 → 1062 kJ÷4.184 for kcal (never 4/4/9);
  1003 protein, 1004 fat, 1005 → 1050 carbs; fiber/sugar/sodium/sat fat kept as extras (not in totals).
  All 3 USDA answer shapes read; units checked (G/MG/UG, kcal vs kJ); duplicates = first value; missing
  = null (unknown), real 0 kept (water). Real Foundation chicken breast has NO 1008 → uses 2048 (112 kcal).
  Household measures → portions + density from cup/spoon weights. Raw data kept in the snapshot.
- Matching `app/lib/food/usdaMatch.ts`: safe Thai→English word list (longest wins: น้ำมันหอย = oyster
  sauce), state/method/cut/skin words, AI translation of the NAME only when not in the list
  (`translateForUsda` in server/ai.ts). Results ranked; differences shown (ดิบ/สุก ไม่ตรง, วิธีปรุงไม่ตรง,
  ส่วนไม่ตรง, หนังไม่ตรง, ชื่อไม่ตรงทั้งหมด — mixed dishes like "Beans and white rice" count).
  "ใกล้เคียงที่สุด" is only a hint; NOTHING is auto-picked. Branded = separate search.
- Source priority: recipe ingredient = her label > USDA pick (`ing.usda`, only while the name is the same)
  > her reference pick / AI / reference table. Prov = database + unverified + via "usda" / "usda-branded"
  (badge "USDA" / "USDA · แบรนด์"). Never "verified".
- Diary item: ItemEditor → "ใช้ค่าจาก USDA" → pick → grams (USDA portion buttons) → `applyUsdaToItem`.
  Keeps her name/kind/dairy; drops this item's AI kcal + buffer; other AI items keep theirs; undo button.
  "Tell the AI more" can only change a USDA item's grams (USDA values stay); other edits clear `usda`.
- Old items/recipes/backups unchanged (no migration; new optional fields `usda` on FoodItem + Ingredient).
- Tests: `tests/round41-usda.test.ts` (32) + fixtures from real USDA answers in tests/fixtures/.
  198/198 pass after the real-API fixes (36 USDA tests), tsc clean, lint 0 errors (old warning), build OK, browser check in mock mode OK
  (recipe "อกไก่ทอด" 150 g → 281 kcal USDA; meal "ข้าวสวย" 150 g → 195 kcal USDA, others still ประมาณ).
- Limits: USDA has few Thai dishes (best for ingredients); search on the server is per instance cache;
  not all FNDDS portions have ml; AI refine for USDA items needs g/ml units.
- iPhone checks (after deploy): recipe ingredient → "ค้นหาค่าใน USDA"; ข้าวสวย vs ข้าวสาร; อกไก่ทอด;
  น้ำมันหอย; a meal item → USDA → grams → USDA badge; undo; buffer 15% only on the other items;
  airplane mode → friendly error + "ลองอีกครั้ง", the meal can still be saved.

## Round 40 final checks (2026-11-16) — commit ba57ef0 ✅ LIVE (pushed with 4526f87)
Her review asked 2 checks before deploy. (1) Her weight never makes AI numbers "verified" (was already OK).
Fixed narrowly: weighed item with a guessed recipe → via "amount-known" (badge "น้ำหนักจริง · สูตรประมาณ");
a guessed oil/sauce "extra" stays a guess (gets her buffer) even if the AI says userAmount; AI prompt no longer
says "plain food-table values" for weighed items (could drop cooking oil) — guessed oil/sauce go in their own
extra item. (2) Portion edits: already correct (600 → half at 15% = 300 / 345; P/C/F scale, no buffer; no stacking).
New `tests/round40-final.test.ts` (7 tests). Tests 162/162, tsc clean, lint 0 errors (1 old warning), build OK,
mock-AI browser check OK. First push was blocked by Claude Code's auto-mode safety check (it judged a push to
main = production deploy as risky without a direct OK). After her explicit OK the normal push worked: 74b1588..4526f87.
Vercel status: success. Live check: home 200, /api/status configured, live code has the new badge + buffer text.

## Round 40 (2026-11-16) — no automatic +15%; optional Smart Calorie Buffer (kcal only) ✅ BUILT, NOT DEPLOYED
Checkpoint before: git tag `before-round-40` (also on GitHub).
Tests 155/155 (142 old; 5 old +15% tests updated/retired on purpose: margin.test.ts removed, 1 in
logic.test.ts, 3 in suggest.test.ts; 13 new in `tests/round40.test.ts`). tsc clean. Lint 0 errors
(1 old warning in LiveBarcodeScanner.tsx). Build OK. Browser check at phone size with the pretend AI (passed).
- **Rule now:** the AI gives its plain best guess. Nothing is added by default (0%). In Profile → "เผื่อแคลอรี่"
  she can pick 0 / 5 / 10 / 15 / 20% (`goals.calorieBuffer`, missing = 0).
- **Only** fresh AI guesses (prov.source "ai", amount guessed) get it: photo/text meals, chat adds, and
  "กินอะไรดี" AI ideas. **Never:** labels, Open Food Facts, numbers she typed, recipes/reference values,
  AI items with an exact weight she gave, old saved items.
- **kcal only.** Protein / carbs / fat never change.
- **Stored per item:** `aiKcal` (AI's own kcal), `bufferPct`, `kcal` = tracking kcal (what totals count),
  plus `prov` from Round 39. `setBuffer` always works from `aiKcal` → no double buffer. Changing the amount
  scales `aiKcal` too. Typing kcal herself drops `aiKcal`/`bufferPct` (it's her number now).
- **Old items:** never rewritten. Old items with `margin: true` already have the old +15% in ALL numbers;
  they now show a small "เดิม +15%" badge + a note when opened. Chat edits on them scale as before, no new buffer.
- **Screens:** meal review shows "AI ประมาณ ~710 · นับในไดอารี 799 kcal" when a buffer is on, "+15%" badge per
  item; item editor shows "AI ~290 · +15% → 334". Today keeps "~" for estimates. 4/4/9 hint uses the AI's
  kcal, so a buffer never triggers "ตัวเลขไม่ค่อยตรง". No numeric ranges shown (no invented ranges).
- **AI prompts:** removed "be generous / pick the larger portion" and every +15% instruction. The AI now asks
  ONE short question when a missing detail (portion, oil, sauce, sugar, fried vs steamed) would change kcal a
  lot (~100 kcal or 20%+), and not for small things. Ideas: room told to the AI is shrunk by the buffer so
  ideas still fit after it.
- Files: new `app/lib/calorieBuffer.ts`, `tests/round40.test.ts`; changed `types.ts`, `nutrition.ts`
  (AI_MARGIN/withMargin/markMargin removed), `suggest.ts`, `server/ai.ts`, `api/suggest/route.ts`,
  `components/MealReview.tsx`, `add/[mode]/page.tsx`, `add/suggest/page.tsx`, `profile/page.tsx`.
- **Not tried:** the real AI (only the pretend AI) — real question quality and real estimates unknown.
  NOT on her iPhone. NOT deployed.
- **Behavior she may notice:** new AI meals are ~13% lower than before (no automatic +15%) unless she picks
  15%. Editing a label/typed item with the AI chat never adds a buffer.
- **iPhone checklist (after deploy):** (1) Profile → เผื่อแคลอรี่ shows 0%; pick 15%; (2) add a meal by photo →
  "+15%" badges and "AI ประมาณ ~X · นับในไดอารี Y"; protein/carbs/fat same as AI; (3) a snack with a label in
  the photo → no "+15%"; (4) tell the AI "กินครึ่งเดียว" → kcal halves, still +15% (not more); (5) old meals on
  Today show the same kcal as before; (6) set back to 0% → new meals have no buffer.

## Round 39 (2026-11-16) — nutrition accuracy (matching, source, unknowns, density) ✅ LIVE
Tests: 137/137 pass (118 old, 4 old ones updated on purpose, 19 new in `tests/round39.test.ts`).
tsc clean. Lint: 0 errors (1 old warning in LiveBarcodeScanner.tsx, not touched). Build OK.
Browser check at phone size (fake AI): Today "~" + "?" marks, meal badges, recipe choice chips,
"weight of 1 cup" box. NOT yet tried on her iPhone.
- **Matching** (`app/lib/foodRef.ts`, rewritten): the longest name wins; a match counts only if nothing
  meaningful is left over; English names must be whole words ("eggplant" ≠ egg). Unclear names
  (ข้าว, ไก่, สะโพกไก่, หมู, ไข่, กุ้ง, นม, นมถั่วเหลือง, or a cooked dish like อกไก่ทอด) return "ask" with
  choices — never picked by itself. New foods: egg white/yolk, uncooked rice (360), chicken cuts
  (breast ± skin, thigh ± skin, drumstick, wing), pork tenderloin/belly, dried shrimp, soy milk
  sweet/unsweet, condensed, evaporated, coconut milk. "น้ำมันหอย" = oyster sauce. Old values unchanged.
- **Source + how sure** (`app/lib/provenance.ts`, new): `prov {source, verification, via}` on new items
  and labels. Sources: label/user/database/reference/ai/recipe/unknown. Nothing is "verified" yet.
  Old items are worked out when SHOWN, never written back; unclear ones = "unknown" (e.g. old barcode
  items: Open Food Facts or her fix — can't tell).
- **Unknown nutrients:** `missing` list on items and labels. Shown as "ไม่ทราบ" / "?" / a note; still 0 in
  sums so totals and old screens keep working. OFF item is "estimated" only when kcal is missing.
- **Density:** her number → AI's → table. No guess of 1 g/ml any more: asks "น้ำหนักต่อ 1 <หน่วย>".
  Old labels with no `per` keep the old "per 100 ml" behavior; new labels record per g / per ml, and
  the recipe editor has a "ฉลากต่อ 100 มล. / 100 กรัม" switch for spoon/cup amounts.
- **4/4/9 check** (`energyCheck` in nutrition.ts): hint only ("ตัวเลขไม่ค่อยตรง"), gap must be
  > 20 kcal AND > 20%; skipped when a nutrient is missing. Never changes numbers.
- **Screens:** small badges only, same design. Today: "~" before kcal, "?" after a missing P/C/F.
  Meal list: ประมาณ / ไม่ทราบที่มา / ข้อมูลไม่ครบ / ตัวเลขไม่ค่อยตรง. Recipe editor: choice chips, density
  box, label per switch, source badge + state (ดิบ/สุก/แห้ง).
- **Behavior changes she may notice:** plain "ข้าว"/"ไก่"/"หมู"/"ไข่"/"กุ้ง" in a recipe now ask her to pick;
  spoons/cups of some foods ask for a weight; AI items always show "ประมาณ"; old label ingredients show
  "ไม่ทราบที่มา"; missing nutrients show as unknown, not 0. Old recipes that already had an AI lookup
  keep their numbers. No saved diary numbers were changed. Backups keep the new fields.
- **iPhone checklist:** (1) recipe: type "ข้าว" → choice appears; (2) "น้ำมันหอย 1 ช้อนโต๊ะ" → oyster sauce
  ≈ 9 kcal; (3) "อกไก่ 1 ถ้วยตวง" → asks weight of 1 cup; (4) old meals on Today still show the same
  numbers, with "~" on AI meals; (5) barcode snack with a missing nutrient shows "?".
- Remaining / not done: no USDA, no Mahidol, +15% rule untouched (Round 40). AI prompt now returns
  `state` and gPerMl for spoons — real AI answers not tried (mock only).

## Round 39.1 (2026-11-16) — plain water + real zeros ✅ LIVE (commit 9d85bc0, she approved the deploy)
- Bug she found: "น้ำเปล่า" in a recipe → "no nutrition data". Causes: (1) water was not in the table, so it
  went to the AI; (2) the AI lookup threw away ANY 0-kcal answer (`!(kcal > 0)`), so water, ice, salt,
  diet drinks were all "not found".
- Fix: `water` in foodRef.ts (น้ำ, น้ำเปล่า, น้ำดื่ม, น้ำสะอาด, น้ำต้มสุก, น้ำกรอง, น้ำแร่, water, plain/drinking/
  still/tap/filtered/mineral water), 0/0/0/0, gPerMl 1. New flags: `strict` (any extra word → a different
  food, never offered: น้ำมะพร้าว, coconut water, น้ำซุป, flavored water…) and `exact` (value fixed by
  definition → badge "ค่าอ้างอิง", verification "unverified", not "estimated", not "verified").
- AI answer check moved to `app/lib/ingredientRef.ts` (`cleanIngredientRef`): 0 kcal is kept; only a
  missing / non-number kcal or known=false is rejected. Prompt says 0 is a valid answer.
- Checked: suggest.ts / macroTip.ts / suggest page skip 0-kcal items on purpose (meal ideas, % tip) — not
  ingredient rejections, left alone.
- Tests 145/145 (8 new in `tests/water.zero.test.ts`). tsc, build OK; lint 0 errors. Browser: น้ำเปล่า 500 มล.
  → 0 kcal, ค่าอ้างอิง, no AI call.
- Deployed 2026-11-16: Vercel production "Ready". Checked on the LIVE site (test data in Claude's browser
  only, removed after): น้ำเปล่า 1.5 ลิตร → 0 kcal, "ค่าอ้างอิง", 0 calls to /api/ingredient; an old-style recipe
  (label with no source + saved AI lookup + egg) still 383 kcal; old AI meal on Today still "~600";
  "ข้าว" still shows the 2 choices. NOT yet tried on her iPhone. A real AI 0-kcal answer (e.g. น้ำแข็ง) not tried.

## Round 38 (2026-11-16) — recipe ingredient photos: any photo, many photos, average fallback ✅ LIVE
- Button "รูปฉลาก" → "รูปสินค้า". Picker allows several photos; they show as small squares (× to remove,
  + to add more, max 4), then "อ่าน N รูป" / ยกเลิก. WaitPopup "กำลังอ่านรูป N รูป…".
- New `/api/food/pack-photos` (images[] ≤4) → `readPackPhotos` in ai.ts (PackSchema: name, brand, netG,
  liquid, label|null). Label needs size + kcal (front energy box with no size → uses net weight).
  No label numbers → server calls `lookupIngredient(name)` = average per 100 g.
- `ingredientFromPack` in toIngredient.ts (tested): label → real numbers per 100 g (Round 27: no +15%),
  amount = whole pack (netG). No numbers → keeps name + pack size, sets aiRef (shows "ค่าจาก AI" +
  "ไม่ใช่ค่าจากฉลาก" = estimate). Never replaces label numbers she typed. Kept her typed name/amount/unit.
- Old /api/food/label-photo still used by the barcode page (unchanged).
- Bug found + fixed while testing: 2nd photo got lost (file list was read after the input was cleared).
- 118 tests pass (4 new), build clean. Checked at phone size in practice mode: 2 photos → label numbers,
  1 photo → average estimate. Real AI with real photos NOT tried yet. NOT tried on her iPhone yet.

## Round 37 (2026-11-16) — a waiting popup every time a photo is read ✅ LIVE
Her wish: whenever a photo is uploaded or taken and the app is reading it, show a popup saying what it's doing.
- New `WaitPopup` in app/components/ui.tsx: dim screen + small frosted card in the middle, spinner,
  one line of what's happening + "อาจใช้เวลาสักครู่". Can't be tapped away (it closes by itself when done).
- Used in: add food photo/text (`/add/[mode]`, replaced the old full-page wait; keeps the "don't close
  this page" note) — "กำลังอ่านรูปอาหาร…" / "กำลังวิเคราะห์อาหาร…";
  BarcodeLookup — "กำลังอ่านบาร์โค้ดในรูป…", "กำลังอ่านฉลาก…", "กำลังหาสินค้า…";
  IngredientScan (recipes) — same three lines (new busy value "barcodePhoto").
- Checked at phone size in the browser with a slowed fake AI: popup shows, right words, closes after.

## Round 36 (2026-11-16) — camera asks less + photos from the album ✅ LIVE
1. She disliked tapping "Allow camera" on EVERY barcode scan. iPhone home-screen apps forget the camera OK
   once the camera is switched off. The app can NOT make iOS remember forever (that is iOS's rule).
   What we did: app/lib/cameraStream.ts keeps ONE camera open (hidden, not recorded) for 3 minutes after a
   scan; the next scan reuses it → no new question. Turns off for real after 3 min idle, or when the app
   goes to the background / phone locks. So she is asked about once per app opening, not per scan.
   If she still finds it annoying: she may try iPhone Settings → Apps → Safari → Camera → "Allow"
   (may or may not apply to home-screen apps; untested). She changes that herself.
2. Label / barcode photos can now come from the album: removed capture="environment" from the photo inputs
   in IngredientScan + BarcodeLookup, so iPhone shows its own menu (photo library / take photo / file).
   Button words: recipe "รูปฉลาก"; add-by-barcode "ถ่าย/เลือกรูป…"; live scanner fallback "ใช้รูปแทน".
- 114 tests pass, build clean. Checked at phone size (buttons fit one line). Camera reuse NOT testable on Mac.
Still open (ask her ONE at a time):
- Food tip line (Round 32): she asked why no AI / how it decides. Explained: compares today's food with her
  targets from Profile (20/50/30 split, or protein by body weight). Offered: (ก) tap the tip → show the numbers
  behind it (free), or (ข) a "ask AI for advice" button that reads today's actual foods (costs credit per tap).
  She hasn't picked yet.
- Not yet tried on her iPhone: Round 33, 34, 35.

## Round 35 (2026-11-16) — scan ingredients inside a recipe ✅ LIVE
Each ingredient card in the recipe form now starts with 2 pill buttons: "สแกนบาร์โค้ด" and "ถ่ายรูปฉลาก".
- app/components/IngredientScan.tsx: barcode = live camera (LiveBarcodeScanner) → "take a photo instead"
  fallback (free reader, then AI reads digits) → phone cache → Open Food Facts; her saved label fix for that
  barcode wins. Label photo = /api/food/label-photo (per pack) → turned into per 100 g.
- app/lib/food/toIngredient.ts (pure, tested in tests/toIngredient.test.ts): fills label per 100 g; keeps
  what she typed (name/amount/unit). Empty amount → one whole pack in g (ml for drinks). Counted unit
  (ขวด, ซอง…) → weight of 1 = pack size. Label photo has no product name → message asks her to type it.
  Missing protein/carbs/fat on a label photo count as 0. Product with no kcal → message: photo the label.
- Checked in practice mode at phone size: label photo filled 20 g = 70 kcal; barcode photo found Nutella
  and filled name + per-100 g numbers. 114 tests pass (6 new), build clean. Live camera NOT tried (no camera on Mac).
- NOT tried on her iPhone yet.

## Round 34 (2026-11-16) — whole app in Phosphor Light icons ✅ LIVE
She didn't like the hand-drawn icons. Showed 10 free libraries side by side (Phosphor Light/Duotone, Lucide,
Tabler, Iconoir, Solar Linear/Duotone, Hugeicons, Fluent, MingCute) → she picked "1 · Phosphor Light".
- app/components/Icon.tsx: `<Icon name=... className=.../>` with 18 Phosphor Light shapes COPIED in (MIT
  notice in the file; nothing installed). To add one: fetch https://api.iconify.design/ph.json?icons=<name>-light
  and paste its body into P.
- Swapped: tab bar (house / book-open / user), add-food sheet + entry source icons (camera, chat-text,
  book-open, pencil-simple, barcode, arrows-clockwise), share (export), recipe pot (cooking-pot, PotIcon now
  wraps it), recipes list plus/caret-down/caret-right, every ‹ › × text symbol → caret-left/right / x,
  📷 → camera, ✨ → sparkle, ⚖️ → scales. Round buttons are `grid place-items-center`.
- NOT changed: water glasses (fill meter), calorie ring, weight chart, "+ เพิ่มอาหาร" text plus.
- Checked at phone size: Today, add sheet, recipes list + detail, Profile. NOT on her iPhone yet.

## Round 33 (2026-11-16) — My recipes = category boxes (her pick "C") + pot icon + many units ✅ LIVE
She saw 6 samples (A list, B chips, C open/close boxes, D shelves, E menu text, F 3-col grid) → picked C,
and loved the thin line POT icon ("logo") → it replaces photos in the list; photos only inside a recipe.
- Recipe.category (types.ts RECIPE_CATEGORIES: อาหารจานเดียว, กับข้าว, ต้ม·แกง, สลัด·ผัก, ของว่าง·ขนม,
  เครื่องดื่ม, อื่น ๆ). Required when saving; old recipes without one show under อื่น ๆ until edited.
- app/recipes/page.tsx: glass box per non-empty category, tap to open/close (open set remembered in
  localStorage "yfd:v1:recipes-open"; first visit opens the first box). Rows: PotTile + name + kcal/serving.
  Round glass "+" button (inline borderRadius: .glass's 24px radius beats Tailwind's rounded-full).
- ui.tsx PotIcon / PotTile / potTone(id) (soft tone chosen from the recipe id). Detail page cover
  placeholder = pot icon (no 🍲). Edit cover button lost its 📷.
- Units: types.ts UNITS (34): weight g kg mg oz lb; volume ml l ช้อนชา 5 / ช้อนโต๊ะ 15 / ถ้วยตวง 240 / fl oz;
  counted ฟอง ชิ้น ลูก/ผล กลีบ เม็ด ใบ ต้น ฝัก หัว แผ่น เส้น ก้อน ไม้ ทัพพี ถ้วย/ชาม กำมือ หยิบมือ ซอง แพ็ค ถุง
  กล่อง กระป๋อง ขวด. Picker = <select> with 3 optgroups. recipe.ts converts by kind/factor.
- Counted units: AI is asked for the weight of ONE of that unit (api/ingredient takes `unit`;
  aiRef.unitFor). The AI's weight only counts for the unit it was asked for; old aiRefs (no unitFor) only fit
  ฟอง/ชิ้น/ลูก. Changing to a new counted unit re-asks the AI automatically. Typed weight always wins.
- Tests tests/units.test.ts (108 total pass). Checked at phone size with test recipes (mock AI): list, open/close,
  category chips, unit change → 2nd AI call. Real AI answer for "1 กลีบ" NOT checked (mock only). NOT on her iPhone yet.

## Round 32 (2026-11-16) — character = fixed small line logo; % in tiles; one-line food tip ✅ LIVE
Her words: split box repeats the tiles?; no more dress-up (useless), logo too big; lines only, every white
area see-through (spoon, fork, eye too); add advice like "protein not enough / carbs too much".
- Character: `scripts/character-lines-only.mjs` rebuilds public/character-lines.png from character.png:
  dark → black, every light pixel → see-through (0 white pixels left). Character.tsx is now just
  `CharacterPicture({size})` (an <img>). Dress-up sheet REMOVED from Today + Profile; share picture draws
  lines only. Today: 44px, centered above "วันนี้" (her pick "A" of 3 samples); greeting line removed with it.
  Profile keeps 124px, no tap. (lib/character.ts + character-body.png are unused leftovers; backup key kept.)
- Split: separate "สัดส่วนแคลอรี" box removed (it repeated the tiles). Each Today tile shows its % of kcal
  under "จาก X g" (MacroCards `showSplit`; still sums to 100).
- Tip: `app/lib/macroTip.ts` (no AI) → ONE line under the tiles (`MacroTipLine`, ui.tsx). Order: fat over
  target → carbs over → protein behind the day's kcal progress (≥10 g short, >15 pts behind) → carbs far
  ahead of kcal → "สัดส่วนวันนี้ดีแล้ว". Targets = macroTargets (her weight/height/goal from Profile).
  Tests tests/macroTip.test.ts (103 total pass). Checked at phone size: Today, Profile, share picture.
  NOT yet tried on her iPhone.

## Round 31b (2026-11-16) — calorie split on Today ✅ LIVE
- Her wish: show how protein / carbs / fat share the calories, in %, always 100%, as a nice diagram.
- `app/lib/macroSplit.ts` `macroSplit(g)` → whole percents BY CALORIES (P×4, C×4, F×9), largest-remainder
  rounding so they always total 100; null when nothing eaten. Tests: tests/macroSplit.test.ts (95 pass).
- `MacroSplitBar` (ui.tsx), under the 3 macro tiles on Today: glass box "สัดส่วนแคลอรี · 100%", one thin
  3-color bar (peach/lilac/sage, width = percent), legend "● โปรตีน 27% ● คาร์บ 35% ● ไขมัน 38%".
  Empty day: gray bar + "–". Checked at phone size. NOT yet tried on her iPhone.

## Round 31 (2026-11-16) — WHOLE APP in "Frosted Calm" + share picture polish ✅ LIVE
Her words: Round 30 okay; (1) don't say "trainer" on share — she may send it to anyone; (2) share picture
"still missing something, not well-rounded"; (3) "can't the whole app be one theme? it looks odd mixed".
- Wording: button = "แชร์สรุปวันนี้" / "Share this day" (with a thin share icon, glass pill);
  sheet button = "แชร์รูปนี้" / "Share this picture". No "trainer" anywhere on screen.
- Share picture additions (ShareDayButton.tsx): macro tiles get a color dot + "จาก X g" + thin color line
  toward the target (peach protein / lilac carbs / sage fat — the cloud colors); a water strip
  (dots + "5 / 8 แก้ว · 1,250 มล.") only if water was logged; meals grouped by meal time with a small
  header (name + slot kcal), each meal row shows its PHOTO (rounded square) or a soft tile with the first
  letter; P/C/F with color dots; empty meal times are ONE quiet line "ไม่ได้บันทึก · มื้อเย็น · ของว่าง".
  shareDay.ts now carries photoId. ShareDayButton takes macroTargets + water props (page.tsx passes them).
- Whole app: `calm` class is now on <body> and `<div className="calm-backdrop" />` is in layout.tsx, so
  EVERY page wears it (Profile no longer adds its own). The old color names in globals.css :root now hold
  calm colors (cream = white 55%, olive = ink, yellow/pink/mint/sky = soft peach/peach/sage/lilac,
  protein/carbs/fat = peach/lilac/sage + new --*-dot colors, --over = soft terracotta). New `.sheet`
  (frosted pop-ups) and `.tabbar` (frosted tab bar, open tab = white pill).
- Today: ring thin (5px) ink line, over = --over; macro tiles = glass + dot + thin line; "Add food" sheet
  tiles = glass with thin line icons + a small color dot (no emoji); meal rows use line icons; water card
  calm (dot heading, soft blue "+1" with dark-blue text); week chart bars soft (ink 15%, selected ink,
  over = terracotta).
- Gotcha: the old dev server (started earlier) stopped picking up globals.css changes — restart it if
  colors look old.
- Checked in the mock server at phone size: Today, Add sheet, manual add, meal page, recipes, Profile,
  share picture (3 test meals + photo + water). 92 tests pass, lint + build clean. NOT yet tried on her iPhone.

## Round 30 (2026-11-16) — "Frosted Calm" look: trainer share picture + Profile ✅ LIVE
- New thin font IBM Plex Sans Thai (`--font-calm`, layout.tsx). New CSS in globals.css under
  "Frosted Calm": `.calm` (page scope), `.calm-backdrop` (beige + 3 color clouds, fixed),
  `.glass` + `.calm .card` (frosted glass), `.calm-open` (a card opened inside the list loses its box + title).
  To restyle another page later: add `calm relative z-0` to its <main> and `<div className="calm-backdrop" />`.
  (`relative z-0` must be ON the element: without it the clouds hide behind the body's cream.)
- Profile (app/profile/page.tsx): her character 124px (tap → dress-up sheet), name, "age · cm · kg",
  glass box with 2 thin numbers (kcal a day | goal kg, or kg now if no weight goal) — tap it to open
  the target editor. Then ONE glass list: ข้อมูลร่างกาย · น้ำหนัก · (อาหารที่เลี่ยง if milk warning on) ·
  ภาษา · สำรองข้อมูล · วิธีคำนวณ. Each row opens its old content right under it. /profile#backup opens backup.
- Share picture (ShareDayButton.tsx canvas): beige + soft radial clouds, glass = white 55% + white border,
  her character drawn with the same layers as Today (color through body mask → cheeks → lines → deco),
  "NAME · d · m · yyyy" spaced + Thai date, big thin kcal + "kcal · เป้า · เหลือ/เกิน" + thin bar,
  3 macro tiles, one glass card of meals (slot | name + detail + P/C/F | kcal), footer SNAPCAL.
- Checked in the mock server at phone size: Profile, rows open/close, target editor, share picture with 3 test meals.
  92 tests pass, lint + build clean. NOT yet tried on her iPhone.

## (done) Round 30 plan — WHOLE-APP RESTYLE (every page)
## Round 29 share tried on her iPhone ✓ ("okay to a degree" — works).
## Her wish: every page looks more professional and easy to use; LESS text on screen, but still clear.
## She had no references, so she asked ME for 5–6 style ideas. FOCUS first: (a) the trainer share picture
## (minimal but professional, details clear) and (b) the Profile page (too plain; show her character).
## Made 6 samples (share picture + profile each): docs/design-round30/styles.html
##   1 Clean White · 2 Soft Pastel Blocks · 3 Big Numbers (Editorial) · 4 Receipt · 5 Night Mode · 6 Character Sticker
## View: food-diary dev server → /styles-preview.html (a copy in public/, NOT in git — kept out via .git/info/exclude).
## Her answer to 1–6: "not quite — something cool, simple, cute, or like popular apps". So I made 6 MORE:
##   docs/design-round30/styles-2.html (preview copy: /styles-preview-2.html, also not in git)
##   7 Bento Grid · 8 Liquid Glass · 9 Color Pop · 10 Calm Minimal · 11 Cute Pills · 12 Sporty Mono
## Her answer to 7–12: LIKES 10 Calm Minimal, 11 Cute Pills, 8 Liquid Glass — wants to see more. So 6 MORE:
##   docs/design-round30/styles-3.html (preview: /styles-preview-3.html, not in git)
##   13 Frosted Calm (8+10) · 14 Glass Pills (8+11) · 15 Milk Tea · 16 Cloud Pastel · 17 Dot Notebook · 18 Sorbet Glass
## ✅ HER PICK (2026-11-16): **13 Frosted Calm** (in docs/design-round30/styles-3.html — the first style there).
## BUILD PLAN:
##   Round 30 (next chat) = trainer share picture (ShareDayButton.tsx canvas) + Profile page in Frosted Calm.
##   Round 31+ = the rest of the app (Today, add, recipes, etc.) in the same look, a few pages per round.
## Frosted Calm look (copy values from styles-3.html, style 13):
##   - Background #F4EFE7 (soft beige) + 3 soft color clouds behind: peach #F3D9C8 (top-left),
##     lilac #E3E0F2 (right), sage #E6EEDD (bottom). Text #2B2724, muted #9C948A.
##   - Frosted glass cards: white 50% see-through + blur 18px + thin white border, big round corners (18–26px).
##   - Font IBM Plex Sans Thai, THIN weights (200–300) for big numbers; little text; lots of empty space.
##   - Big kcal number (thin), thin 2px progress line, macros in 3 small glass tiles (number + "โปรตีน g").
##   - Meals: one line each (slot in small muted text, name, kcal), thin dividers.
##   - Share picture: character small on top center, date with wide letter spacing, footer "SNAPCAL".
##   - Profile: character BIG (~124px) top center, name thin 24px, "28 · 160 ซม. · 55 กก." under it,
##     glass box with 2 numbers (kcal per day | goal kg) split by a thin line, then a glass list of settings rows.
##   - Character: her file exactly (character-lines.png + body color layer as now). Never redraw.
##   - Canvas (share picture) can't use CSS blur: draw the clouds as soft radial gradients and the glass
##     cards as white ~55% fill + thin white border — it looks the same in a still picture.
## Keep everything the profile page does today (edit forms, BMI, plan, avoid foods, backup) — only the look changes. share picture + profile in that style, then the rest of the app.
## Then: use them for the FEEL only (never copy), show 2–3 mockups to pick from (she likes minimal),
## keep her own brand character as-is, then build page by page. May need 2–3 rounds.
## Still untried with the REAL AI: Rounds 27 + 28 (label photo; a "เมนูทำเอง" recipe; "ค้นหาสูตรอื่น" link).

## Round 29 (2026-11-16) — share my day with my trainer (picture) ✅ LIVE

Her answer: picture (not text).
- `app/lib/shareDay.ts`: `buildShareDay(entries, date)` → per meal slot (เช้า/กลางวัน/เย็น/ของว่าง) every meal with
  kcal + protein/carbs/fat (whole numbers), a small "what was in it" line when a meal has 2+ items, slot totals,
  day total. `shareFileName` → "snapcal-YYYY-MM-DD.png". Tests: `tests/shareDay.test.ts` (92/92 pass).
- `app/components/ShareDayButton.tsx`: draws a 1080-px-wide PNG on a canvas (no new library), minimal look:
  cream background, white card, date + her name, big kcal / target + left/over, 3 pastel macro boxes, meals,
  empty slots say "ไม่ได้บันทึก", footer "บันทึกด้วย SnapCal". Thai or English follows the app language.
  Waits for the app fonts first. Tap button → sheet with preview → "ส่งรูปนี้" (navigator.share with the file →
  iPhone share sheet). Where file sharing isn't supported (desktop), the button is "บันทึกรูปนี้" (download).
  Picture is made BEFORE the tap on "send" so iPhone allows the share (needs a fresh tap).
- `app/page.tsx`: the button sits under the meal cards, only when the day on screen has at least one meal.
  Works for past days too (uses the day on screen). No photos and no water on the picture (keep it simple).
- Checked at iPhone size with the test server: button shows, sheet opens, picture correct (Thai text, long
  names wrap to 2 lines, totals right), no console errors. Build OK. NOT yet tried on a real iPhone share sheet.

## Round 28 (2026-11-16) — "กินอะไรดี" simpler: delivery out, cook-it-yourself menus in ✅ LIVE

Her answers: remove delivery (+ Grab / LINE MAN); 7-Eleven group STAYS.
- `app/lib/suggest.ts`: place "delivery" → "menu"; `shop` removed; ideas carry `ingredients` + `steps`
  (empty for non-menu). Menu ideas without ingredients or steps are dropped. AiGroups = { seven, menu }.
- `app/lib/server/ai.ts`: AI asked for 4 7-Eleven + 4 simple home dishes (≤ ~20 min), ONE serving,
  3–8 ingredients with amounts, 3–6 short steps, common dish name (so it can be searched). All text Thai in th.
- `app/add/suggest/page.tsx`: groups = สูตรของฉัน / 7-Eleven / เมนูทำเอง (sky dot). Tapping a menu idea opens a
  recipe view (kcal, protein/carbs/fat, ingredients, numbered steps, "+15% included" note) with
  "กินเมนูนี้ · บันทึก" (→ normal check page; back returns to the recipe) and "ค้นหาสูตรอื่นของเมนูนี้"
  (Google search "<name> สูตร", new tab). Recipe + 7-Eleven taps still go straight to the check page.
- Tests: `tests/suggest.test.ts` delivery test → menu test. 90/90 pass, tsc, eslint, build OK.
- Checked at iPhone size with the test AI: 3 groups, recipe view, search link, log → check page. No console errors.
- NOT yet tried with the REAL AI.

## (older) she tries Round 26 (grouped ideas) on her iPhone with the real AI

Watch for: does the AI name real chain shops that list kcal? Do Grab / LINE MAN buttons open the apps on iPhone
(they are plain web links; not tried on a phone yet)? If shop ideas look made-up, tune SUGGEST_SYSTEM.
Then pick the next idea with her (one question at a time, in Thai). Ideas not done:
- option B "summary" tab (week of kcal + water + weight on one page)
- use her character in more places (app icon? empty states?) — ask, don't assume
- other clip colors for the character (the yellow clip is hard to see on pink)

## Round 27 (2026-11-16) — label numbers are real: no +15% ✅ LIVE

Her rule: +15% is ONLY for food with no nutrition info. If the photo (or her typed words) has printed numbers
from the pack (nutrition facts / kcal on the label), use them exactly.
- `ItemSchema` in `app/lib/server/ai.ts` got `fromLabel`. ANALYZE + REFINE prompts: read printed label numbers,
  multiply by servings eaten, blurry label → don't guess (fromLabel=false, normal estimate + margin).
- `markMargin` (`app/lib/nutrition.ts`): no margin when `userAmount` OR `fromLabel`. Refine edits too.
- `FoodItem.fromLabel` saved on the item. MealReview badge "ตามฉลาก / From label" (else "น้ำหนักจริง"); note text mentions labels.
- Mock AI: typing "ฉลาก"/"label" adds a soy-milk item with fromLabel (for screen tests).
- Tests: 2 new in `tests/margin.test.ts`. 90/90 pass, tsc, eslint, build OK.
- Checked at iPhone size with the test AI: label item 120 kcal + "ตามฉลาก", other items +15%.
- NOT yet tried with the REAL AI on a real label photo.

## Round 26 (2026-11-15) — "กินอะไรดี" split into 3 groups, fewer emojis ✅ LIVE

She tried Round 25: felt hard to use, too many emoji/icons. She wanted groups. Agreed together:
3 groups only (no "menu names only" group), delivery = well-known chains that publish kcal (so she can check
the shop's own number), plus buttons to open Grab / LINE MAN. She picked look A (all groups stacked) over
B (tabs) from 2 mockups.
- `app/lib/suggest.ts` rewritten: `recipeIdeas()` = her recipes that fit (real numbers, NO AI, instant);
  `fitAiIdeas()` = AI ideas split into `seven` / `delivery` (+15% margin, delivery must have `shop`),
  max 3 per group, most protein first. "home" place removed.
- `app/lib/server/ai.ts`: AI asked for 4 7-Eleven + 4 delivery-chain ideas, `shop` field, no emoji.
  Recipes no longer sent to the AI (route no longer takes `recipes`).
- `app/add/suggest/page.tsx`: 3 sections (pink/mint/sky dot + title), plain rows (name, amount/shop · protein,
  kcal). No emoji anywhere (also removed from the Today button). Delivery row saves as "Name (Shop)".
  Grab link https://food.grab.com/th/th/ , LINE MAN https://lineman.line.me/ (open in a new tab).
- Tests: `tests/suggest.test.ts` rewritten (6 tests). 88/88 pass, tsc, eslint, build OK.
- Checked at iPhone size with the test AI: all 3 groups, light mode, delivery idea → check page → saved
  "Chicken Wrap (Starbucks)", recipe idea → saved as source "recipe".

## Round 25 (2026-11-15) — 🤔 "เหลือเท่านี้ กินอะไรดี" (what can I eat with what's left) ✅ LIVE

Her answers: she gets food from 7-Eleven, delivery, and cooking at home (+ her recipes);
ideas should lean HIGH PROTEIN; tapping an idea opens the normal check page first (not one-tap save).
- Today: a small button under "เหลืออีก X kcal" (today only) → new page `app/add/suggest/page.tsx`.
- The page asks the AI once on open (+ "ขอไอเดียใหม่" button). Sends: kcal left, protein left, meal + hour,
  her complete recipes (per serving), titles eaten today, avoid-dairy setting.
- New route `app/api/suggest/route.ts` (passcode check like the others) → `suggestMeals` in `app/lib/server/ai.ts`
  (asks for 6 ideas; mock answer in AI_MOCK mode).
- `app/lib/suggest.ts` checks the AI's numbers: +15% margin on AI guesses, recipe ideas get the recipe's
  real numbers (unknown recipe ids dropped), ideas bigger than the kcal left dropped, duplicates dropped,
  most protein first, max 4. Light mode when < 100 kcal left (or over target): each idea ≤ 100 kcal and a
  kind "it's okay" message, no scolding.
- Tap idea → MealReview (chat works) → saved as source "text" (or "recipe" with a RecipeLog for her recipes).
- Tests: `tests/suggest.test.ts` (5 tests). 87/87 pass, tsc, eslint, build OK.
- Checked at iPhone size with the test AI: button, list (too-big idea dropped), review, save (kcal left updated),
  over-target gentle message. Pushed da469fa; live check: /add/suggest 200, /api/suggest asks for passcode (401).
- NOT yet tried with the REAL AI (that needs her passcode on her phone). If ideas look odd, tune SUGGEST_SYSTEM.

## Round 24 (2026-11-15) — ⚖️ Weight moved into Profile, steps removed ✅ LIVE

She said the "น้ำหนัก & ก้าว" tab felt useless; she picked option A.
- New `app/components/WeightCard.tsx` on the Profile page (between the kcal target and her info):
  log a weight for any day (date box, defaults to today), progress bar to target weight,
  this week's average vs last week, and a 30-day / 3-month line chart.
- Steps are gone: step card, steps chart, `/api/steps` route and `readSteps` in `lib/server/ai.ts` deleted.
  Old step numbers are NOT deleted: they stay in `yfd:v1:body` and in backups (`lib/body.ts` unchanged).
- Bottom menu is now 3 tabs (Today, My recipes, Profile). `/body` just redirects to `/profile`.
- Checked at iPhone size: old /body link → Profile, save weight works, old steps kept.
- Live check: home 200, /api/steps gone (404), /body forwards to /profile, /api/status configured. Not tried on her iPhone yet.
- Ideas not done: option B "summary" tab (week of kcal + water + weight on one page).

## Round 23 (2026-11-14) — 🎨 See-through character + body color + small decorations ✅ LIVE

She asked: no white circle (just the character, like a PNG), and the color change + small decorations we talked about.
- `scripts/character-layers.mjs` (no packages, Node zlib) turns `public/character.png` into:
  `public/character-lines.png` (her ink exactly, paper see-through; spoon/fork/monocle/mouth stay solid white)
  and `public/character-body.png` (mask of body + both hands + both feet, grown 3px under her lines).
  White areas are found automatically; BODY_IDS = [1,5,6,8,9] (body, right hand, left hand, feet).
- Today: tap the character → "แต่งตัวน้อง" sheet: 8 colors (white = original) + any-color picker,
  ONE decoration (bow, flower, cherry, strawberry, clip, star, heart), pink cheeks, "back to original".
  Saved in localStorage key `yfd:v1:buddy` (already in backups). Old Round 20 buddy data opens (color + cheeks kept).
- Code: `app/lib/character.ts` (+ `tests/character.test.ts`), `app/components/Character.tsx`.
- Checked in browser at iPhone size: every decoration, cheeks, colors, save, original look. 82/82 tests, tsc, eslint, build OK.
- Small note: the hair clip is hard to see on a pink body (yellow+pink). Ask her if she wants other clip colors.
- Pushed 2c57f28; live check: home 200, both new layer files byte-identical to local, AI configured. NOT yet tried on her iPhone.
- Next: she tries it on her iPhone.

## Round 22 (2026-11-14) — 🐥 Yani's OWN brand character replaces the dress-up buddy ✅ LIVE

She tried the studio and said it was too complicated, and that pick-a-shape/face/color feels the same as
everyone else's apps. Her decision: use her own stationery-brand character (eats with spoon + fork, wink,
monocle). **Her rule: use her file exactly — never redraw, never recolor, never change the shape.**
- Original file kept: `docs/character-original.png` (sheet with 4 sizes). `public/character.png` = the big one,
  cut out with `sips` (crop only, pixels untouched, white background kept). Shown on Today in a 72px white circle.
- Today no longer opens the dress-up sheet. With her OK, the old buddy/studio code was DELETED (Buddy.tsx,
  app/lib/buddy, app/studio, app/api/studio, tests/buddy.test.ts). Old saved buddies in backups still restore
  (backup key `buddy` kept, just unused). Design drafts in docs/buddy-design kept. Tests 78/78, tsc, eslint, build OK.
- Idea 3 (buddy made from each person's name) she liked but couldn't picture; I showed a demo. Not decided.
- Pushed 2026-11-14 (2aafd0a). Live check: home 200, /character.png 200 and byte-identical to the local file,
  /studio 404, AI status configured. NOT yet tried on her iPhone.
- Next: (1) she tries it on her iPhone, (2) maybe use the character
  elsewhere (app icon? empty states?) — ask, don't assume.

## Round 21 (2026-11-14) — 🎨 Yani's Parts Studio ✅ BUILT, saved in git, NOT pushed/live yet

**Start here in the next chat.** The studio is built and works on her Mac. Next = SHE designs parts.

### What's done
- `/studio` (dev only) at http://localhost:3218/studio — launch config `food-diary`. Production shows
  "not available"; `/api/studio/parts` returns 404 outside `npm run dev` (logic checked, not tried on the live site).
- Elements + parts-file checks + drawing: `app/lib/buddy/elements.ts`. Parts file: `app/lib/buddy/studio-parts.json`.
- Seeded with the Round 20 eyes/mouths (same ids) + 3 brows (soft, straight, worried) + 3 noses
  (button, tiny, heart). The seed brows/noses are MY drafts, all switched on — she may edit/hide/delete them.
- Customer sheet: eyes · brows (new) · nose (new; old "nose" extra → `button`) · mouth as picture-only buttons
  on the buddy's own color. Old saved buddies + old backups still open (tested).
- Checked in the browser: studio add/drag/mirror/unsaved warning; save API round-trip + bad file refused;
  old Round 20 buddy opens on Today with its nose; dress-up sheet rows. `npm test` 90/90 pass; tsc, eslint, build OK.

### Next
1. Yani opens the studio (I start the dev server for her) and designs parts. "บันทึกลงไฟล์" writes the JSON.
2. She says **"ใส่ลงแอป"** → I run tests/tsc/eslint/build, commit the JSON, **push** (= goes live), check live.
3. Then try it on her iPhone (Round 20 + 21 not yet tried on the phone).

### Original plan (for reference)

How we got here (all drafts in `docs/buddy-design/`, kept for reference only, NOT to be built):
circle doodle faces (`circle-prototype.html`: she liked pastel + any-color picker + part-only choice buttons),
fruit shapes / fruit decorations on a circle (`fruit-prototype.html` v3–v4) — she said "ยังไม่ใช่". Final wish:
1. **Shapes go back to Round 20's 6** (ก้อนนุ่ม · โมจิ · ข้าวปั้น · ซาลาเปา · เมฆ · เยลลี่). Customers pick any.
2. **A studio for HER (the app maker), not for customers**: she designs the face parts herself from basic
   elements I provide. The customer's "แต่งตัวของฉัน" sheet shows ONLY the parts she designed and switched on.

### Build plan
- **Studio page `/studio`** — works only in dev (`npm run dev`, launch config `food-diary`, port 3218).
  In production it shows "not available" and the API returns 404. Not linked from the app.
- **API `app/api/studio/parts/route.ts`** (dev only): GET/PUT → reads/writes
  `app/lib/buddy/studio-parts.json` (committed to git, shipped with the app). Validate with zod.
- **Data:** `Part = { id, kind: "eyes"|"brows"|"nose"|"mouth", name, visible, items: El[] }`,
  `El = { type, x, y, size, rot, thick, color, filled?, mirror }` in the 100×100 face box.
  `mirror` = also draw a copy flipped at x → 100−x (so eyes/brows/cheeks come out even).
- **Elements (our own simple shapes):** dot · ring · oval · oval ring · line · curve (smile) · deep curve ·
  wave · angle (>) · cross (x) · heart · star · sparkle (4-point) · tear · half-circle (open mouth) · triangle.
  Colors: ink #2a2622 default, white (eye shine), pinks, red, tear blue, + any color picker.
- **Studio layout (wide Mac screen):** LEFT = tabs ตา/คิ้ว/จมูก/ปาก + "คลังของฉัน" list (edit · duplicate ·
  delete · switch "ลูกค้าเห็น"). MIDDLE = big live buddy (pick shape + color for preview) with the other
  categories' parts shown, the edited part highlighted, a faint guide box for that part's zone. RIGHT =
  element buttons + selected element controls (size, rotate, thickness, color, filled, mirror, layer up/down,
  duplicate, delete). Drag on the canvas with the mouse; arrow keys nudge. Name + Save.
- **Seed the library** with element-built versions of the current parts using the SAME ids
  (eyes: dot, shine, happy, calm, squint, wink · mouths: smile, cat, open, o, flat, tongue) + a few brows/noses,
  so buddies people already saved still open the same.
- **Customer sheet (`Buddy.tsx`):** shape · color · eyes · brows (new) · nose (new, replaces the "nose" extra) ·
  mouth · on the head (unchanged) · extras (blush, glasses, earrings, coffee). Choice buttons show ONLY the
  part (zoomed into its zone — she asked for this). Hidden parts never show. Unknown ids → default
  (`cleanBuddy`). Old saved buddies + old backups must still open.
- **"ใส่ลงแอป" flow:** she designs → says "ใส่ลงแอป" → I run tests/tsc/eslint/build, commit the JSON, push.
- Tests: parts JSON validation, mirror math, cleanBuddy with studio ids, old configs still load.
- Parked ideas (ask her later, do NOT build now): face changes with the day (her own face + mood swaps of
  eyes/mouth; never sad about eating) · any-color picker for the customer body color.

## Round 20 (2026-11-13) — 🍡 "My buddy" character on Today ✅ LIVE (not yet tried on her iPhone)

Built from the approved design in `docs/buddy-design/prototype.html` (her own idea: a soft blob/food buddy
where she picks the parts; add-ons flat soft color, NO dark outline).
- Small buddy (52px) at the top of Today, ABOVE "สวัสดี <name>" (she asked: side by side looked odd). Only on today's date, nowhere else.
  Before she makes one: default buddy (blob, blue, ตาวิบวับ, ยิ้ม, แก้มชมพู, nothing on the head).
- Tap it → sheet "แต่งตัวของฉัน": preview (stays at the top while she scrolls), rows: shape (6) · color (7) ·
  eyes (6) · mouth (6) · on the head (pick 1 of 9 incl. none) · other extras (pick many of 5) · Save.
  Nothing is saved until Save; closing the sheet throws the changes away.
- Code: `app/lib/buddy/parts.ts` (all parts + `cleanBuddy`/`parseBuddy`/`buddySvg`, pure),
  `app/lib/buddy/store.ts` (localStorage + `useBuddy` hook), `app/components/Buddy.tsx` (picture + sheet).
  The drawing is built only from our own parts; saved text is cleaned first, so nothing odd can be injected.
- Saved on the phone: localStorage `yfd:v1:buddy`; in the backup (`BACKUP_KEYS.buddy`); old backups still open.
- Tests: `tests/buddy.test.ts` + 2 backup tests → 83 pass. tsc, eslint, build pass.
- Checked on a built server at phone size (new preview `food-diary-buddy`, port 3237, because 3227 was busy):
  default buddy shows; made a bun + flower + earrings + coffee, saved, reloaded → still there. No console errors.

### ▶ NEXT
1. She tries it on her iPhone and says what to tweak (size of the buddy? more parts?).
2. Still open: new home-screen icon (could use her buddy!); monthly look-back (kcal + weight line; could add water).

## Round 19b (2026-11-13) — 🤍 Calmer, minimal look (her pick: mix of A + B) ✅ LIVE

She found Round 19 too busy and too close to the reference. Wants SIMPLE + MINIMAL, colors were OK, and likes
choosing between versions. I showed 3 phone mockups (A clean white · B soft pastel · C paper and lines);
she picked a mix of A + B.
- Removed: blob mascot (`Blob.tsx` deleted), yellow arrow circle on buttons, Mitr heading font, floating tab bar.
- Now: page #f8f6f3, cards pure white with thin line (radius 20, no shadow); headings back in Noto Sans Thai;
  numbers still Nunito (`.num`). Meal slots = small colored dot + title (A). Kept from B: yellow kcal ring,
  pastel protein/carbs/fat cards, yellow pill for the open tab. Tab bar = plain white bar with top line.
  Recipes empty state/cover placeholders back to emoji. Add-food tiles stay pastel.
- Checked: 76 tests, tsc, eslint, build; built server at phone size (Today, welcome) — no console errors.
  ✅ 2026-11-13: she looked on her iPhone — "Looks good", no tweaks.

### ▶ NEXT
1. ~~She looks on her iPhone~~ done, approved.
2. **Her new feature wish: a dress-up character as her profile picture** — pick body, hair (style + color),
   face, skin color, mouth, outfit. Plan: drawn SVG parts in the app, no AI, free. Own round. Style should be
   simple/minimal to match the app. Start with /idea-style questions (one at a time): where it shows, how many
   choices per part.
3. Still open: new home-screen icon; monthly look-back.

## Round 19 (2026-11-13) — 🎨 New look: beige paper, black pills, pastel blob friends ✅ LIVE

She asked to decorate ("ตกแต่ง") and shared a reference board (Japanese design-studio style: off-white #F7F3EF,
black #111 pill buttons with a yellow arrow circle, pastels yellow #FFE59A · pink #FFB5C1 · mint #B7E1D1 ·
sky #A9D3FF, rounded type, white/pastel blobs with two dot eyes). We took the STYLE only — our own blob drawings,
no logo/text copied.
- `app/globals.css`: new tokens. Old names kept so nothing broke: `olive`/`olive-dark` = black, `olive-soft` =
  soft yellow. New: `yellow`, `yellow-deep`, `pink`, `mint`, `sky`. Macro cards pink/yellow/blue. `.btn-soft`
  is now an outline pill (black border). `.btn-arrow` adds the yellow → circle (used on "+ เพิ่มอาหาร" and the
  welcome "ถัดไป"). Disabled primary = light grey-beige.
- Fonts (`app/layout.tsx`): h1/h2/h3 + `.num` use Nunito (digits/English) then Mitr (Thai); body stays Noto Sans
  Thai. (Mitr alone had a slashed zero "Ø" — that's why Nunito is first.)
- `app/components/Blob.tsx`: the mascot (3 shapes, color, eyes, look). Used: peeking from the kcal ring card,
  one per meal slot (yellow/mint/sky/pink), recipes empty state + recipe cards without photo, welcome hero.
- Tab bar: floating white rounded bar, thin line icons (no emoji), open tab = yellow pill.
- Kcal ring: yellow on beige (pink when over). Week chart bars: yellow, selected day black, over = pink.
- Add-food sheet tiles: photo yellow · AI text sky · recipes mint · manual pink · barcode beige.
- Checked: tests pass, tsc, eslint, build. Built server at phone size: Today, add sheet, recipes, weight,
  profile, welcome — no console errors. NOT yet seen on her iPhone. App icon NOT changed (still old).
- Note: the old `npm run dev:mock` server (port 3217) had stopped noticing file changes; I used the
  `food-diary-verify` build server instead.

### ▶ NEXT
1. She looks at it on her iPhone and says what to tweak.
2. Optional: new home-screen icon with a blob friend (matching the new look).
3. Idea still open: monthly look-back (kcal + weight line; could add water).

## Round 18b (2026-11-13) — 📷 Photo of the nutrition label fills it in ✅ LIVE

She said the 5-box form was hard ("ยากอะ") and asked why the app can't just be right. Told her honestly: the
app can't know the database is wrong — only the pack knows. She chose: photo the label, AI reads it
(uses a little OpenRouter credit, once per pack; she said "เอา").
- Product card (when not fixed): soft button "📷 ไม่ตรงกับซอง? ถ่ายรูปฉลาก" + tiny "หรือพิมพ์เอง" link (old form).
- Photo → `/api/food/label-photo` (passcode-protected) → `readNutritionLabel` in `app/lib/server/ai.ts`
  (Thai label words in the prompt; prefers one serving, else whole pack by net weight, else per 100 g; kJ→kcal;
  no guessing). Needs pack size + kcal (`fixIsValid`) or it says "couldn't read, retake sharp/straight/no glare".
  Mock mode returns 20 g / 70 kcal / P1 C12 F2.
- Saved as her LabelFix for that barcode (same as Round 18). Green note now shows the numbers to check:
  "✓ ใช้ตัวเลขตามฉลาก: 20 ก. = 70 kcal · เช็กว่าตรงกับบนซองนะ" with "ถ่ายใหม่" · "แก้เอง" · "ใช้ข้อมูลเดิม".
- Checked: 76 tests, tsc, eslint, build pass; built mock server at phone size: label photo → 20 ก. = 70 kcal,
  card 350/100 g, grams 20; "ใช้ข้อมูลเดิม" clicked → back to 300/30 g, fix removed. No console errors.
  Live: `/api/food/label-photo` without passcode → 401 (route live, guarded).
  ✅ 2026-11-13: she tried it on her iPhone with the real Taro pack — a REAL AI read of the label worked ("ได้ผล").

### ▶ NEXT
1. Idea still open: monthly look-back (kcal + weight line; could add water).

## Round 18 (2026-11-13) — ✏️ "Fix it from the label" for barcode products ✅ LIVE

Her first live scan (Taro "รสเข้มข้น") worked, but Open Food Facts said 300 kcal/100 g, serving 30 g, while
HER pack says 20 g = 70 kcal (= 350/100 g). 20 g → app said 60. The math was right; the volunteer data was
wrong / another pack size. Told her: the label on the pack always wins.
- Product card now has a small link "ไม่ตรงกับฉลาก? แก้ตามซอง". It opens a form: pack size (g, or mL for
  drinks; prefilled from the database), calories per pack (required, empty), protein/carbs/fat per pack
  (optional, empty — blank keeps the database's per-100 g number). Prefilling macros was tried and removed:
  they were for the database's pack size, so they'd be wrong after changing the size.
- Save → card switches to her numbers (stored per 100 g like every Food), grams prefilled to her pack size,
  green note "✓ ใช้ตัวเลขตามฉลากที่คุณแก้ไว้" with "แก้อีกครั้ง" (edit again, prefilled with her saved
  numbers) and "ใช้ข้อมูลเดิม" (remove her fix, back to the database).
- Remembered per barcode on the phone: localStorage `yfd:v1:labelFixes` (array of LabelFix), included in the
  backup (`BACKUP_KEYS.labelFixes`; old backups without it still open). Never sent to Open Food Facts.
- Code: `app/lib/food/labelFix.ts` (applyLabelFix, fixIsValid, find/upsert/removeFix — pure),
  `app/lib/food/labelFixStore.ts` (localStorage), UI in `BarcodeLookup.tsx`. Tests: `tests/labelFix.test.ts`
  (her Taro case) + backup test.
- Checked: 76 tests, tsc, eslint, build pass. Built server at phone size with a fake cached Taro product
  (300 kcal, 30 g): fix 20 g / 70 kcal → card 350 kcal/100 g, grams 20; reopen + scan again → still fixed;
  Next → review says 70 kcal. No console errors. NOT clicked in the browser: "ใช้ข้อมูลเดิม" (unit-tested only).
  Live site has the new code. NOT yet tried on her iPhone.

### ▶ NEXT
(superseded by Round 18b — she found the typing form hard)

## Round 17 (2026-11-13) — 📷 Live camera barcode scanning ✅ LIVE

She picked "live camera scanning" from the ideas list.
- Barcode page now: big "📷 สแกนด้วยกล้อง" (Scan with camera) on top; the old photo button stays below as
  "🖼️ ถ่ายรูปบาร์โค้ดแทน" (backup, still with the AI digit-reading fallback); typing still works.
- Scan opens a full-screen black camera view with a white guide box ("เล็งบาร์โค้ดให้อยู่ในกรอบ") and Cancel.
  It reads frames every ~120 ms, ONLY inside the guide box (middle 80% × 40% of the frame, shrunk to ≤960 px),
  with the free on-phone reader (`scanBarcodeFrame`, fast settings). A code counts only after the SAME
  number is read twice in a row (check digit OK too). Then camera turns off → number filled → looked up.
- After 12 s with no read, a "อ่านไม่ได้? ถ่ายรูปแทน" button appears. Camera blocked / missing → friendly
  message + "ถ่ายรูปแทน" button. No AI, no cost, nothing recorded or sent.
- Code: `app/components/LiveBarcodeScanner.tsx`, `app/lib/liveScan.ts` (scanArea, makeConfirmer,
  cameraErrorKind), `scanBarcodeFrame` in `app/lib/barcodeScan.ts`, wiring in `BarcodeLookup.tsx`.
- Checked: 73 tests, tsc, eslint, build pass. Built server "food-diary-verify" at phone size with a fake
  camera (drawn EAN-13 of her Coke Zero 8851959132074): read it, closed, filled the number. Denied camera
  → message + photo button; Cancel closes. (Local lookup said "not set up" — expected, no OFF env locally.)
  Live site: deployed Ready, new button found in the live code. Tried on her iPhone: works ✓

### ▶ NEXT
1. ✅ Tried on her iPhone 2026-11-13: scanned Taro fine. Its numbers were off → Round 18.

## Round 16 (2026-11-13) — 💧 Water counter on Today ✅ LIVE

She picked "water counter" from the ideas list.
- New card "💧 ดื่มน้ำ" on Today, right under "+ เพิ่มอาหาร" (above the week chart). Works for any day
  on screen (past days too). Shows "5/8 แก้ว", ml drunk, and "อีก 3 แก้ว" or "ครบเป้าแล้ว 🎉".
- One glass = 250 ml. Big blue "+ 1 แก้ว" button, small "−" button, and a row of glasses (8 per row):
  tapping glass N fills up to N; tapping the last full glass empties it. Goes past the goal (max 40).
- Goal: 8 glasses by default; "เป้า 8 แก้ว/วัน · แตะเพื่อเปลี่ยน" opens a − / + stepper (1–20). Saved as
  `goals.waterGoal`.
- Saved on the phone in localStorage key `yfd:v1:water` ({date, glasses, updatedAt}[], day dropped at 0).
  Included in backup (`BACKUP_KEYS.water`); older backups without water still restore.
- Code: `app/lib/water.ts` (pure logic), `app/components/WaterCard.tsx`, store `waterLogs`/`setWater`,
  new colors `--water`, `--water-soft`, `--water-ink` in `globals.css`. Tests: `tests/water.test.ts`
  + backup tests.
- Checked: 70 tests, tsc, eslint, build pass; own prod server (preview "food-diary-verify", port 3227)
  at phone size: +/−/tap glass/goal editor/reload keeps it/yesterday separate, no overflow, no console
  errors. Live site checked after deploy (tap + saved). Tried on her iPhone 2026-11-13: works ✓
- Note: the other chat's dev server on 3217 did not pick up the new CSS colors (stale); use
  "food-diary-verify" (build first) when checking styles.

### ▶ NEXT (done → see Round 17)

## Round 15b (2026-11-13) — "กินซ้ำ" moved into its own tile + search ✅

Her iPhone screenshot: the 6-meal list at the top of the add sheet felt cluttered. She asked for a tab
to tap into, a name search, and the list sorted by the day she last ate it.
- Add sheet is back to just tiles; a 6th tile "🔁 กินซ้ำ" (shown once she has any meal) opens the list
  inside the same sheet with "‹ กลับ" (Back). Search box filters by meal name OR a food inside it
  (any case, all words must match). Each row now says "กินล่าสุด วันนี้ / เมื่อวาน / 11 พ.ย." + kcal.
- ALL different meals are listed now (no 6 limit), sorted by eaten date (`e.date`), newest first.
- Code: `recentMeals` (sort by date, no limit), new `searchMeals` in `app/lib/repeat.ts`;
  new `shortDayLabel` in `app/lib/date.ts`; UI in `app/page.tsx` (`againView`, `againQuery`).
- Checked: 65 tests, tsc, eslint, build pass; mock browser at phone size: tile → list in right order,
  search "ข้าว" narrows to one, tap adds + Undo removes, no console errors. Tried on her iPhone 2026-11-13: works ✓


## Round 15 (2026-11-13) — 🔁 "กินซ้ำ" / Eat again, one tap ✅ LIVE

She picked this from the ideas list. Today → "+ เพิ่มอาหาร" sheet now starts with "🔁 กินซ้ำ": her 6 most
recent DIFFERENT meals (same title + same total kcal = same meal), each with photo/icon, kcal and a "+".
- One tap = saved right away to the day on screen. Today → meal slot from the time now (`guessSlot`);
  a past day → the meal's old slot. No AI call, no credit. Sheet closes; a dark note at the bottom says
  "✓ เพิ่ม X ใน มื้อ…" with "เลิกทำ" (Undo, deletes the copy) for 6 seconds.
- `app/lib/repeat.ts`: `recentMeals`, `copyMeal` (new ids, same numbers, SAME photoId — shared, not copied),
  `photoStillUsed`. Deleting a meal (`app/entry/[id]/page.tsx`) now only deletes the photo if no other
  meal uses it.
- Tests: `tests/repeat.test.ts` (4) — 63 pass; tsc, eslint, build clean. Checked in the browser (phone size):
  list dedupes, tap adds to today (dinner by time), Undo removes it, past day keeps the old slot (snack),
  no console errors. NOT checked on her real iPhone yet.

### ▶ NEXT
1. She tries "กินซ้ำ" on her iPhone.
2. Other ideas still open: live camera barcode scanning · monthly look-back (kcal + weight) · water counter.
3. Check on a real iPhone: food photo from the real camera.

## Small change (2026-11-13) — milk warnings switched OFF for now ✅

She said the milk warning isn't needed yet. One switch: `MILK_WARNING_ON = false` in `app/lib/dairy.ts`.
`warnDairy(goals)` is used by MealReview + recipe page; Profile hides the "Foods I avoid" card. All code,
saved flags and the AI's `dairy` field are KEPT, so turning it back on = set the switch to true.
Checked: 59 tests, tsc, eslint, build pass; mock browser with avoidDairy=true saved → no Profile card,
"ชาเย็น" meal shows no warning/badge/checkbox.

### ▶ NEXT: she is choosing the next feature. Ideas offered (2026-11-13):
1. "กินซ้ำ" — re-log a meal she ate before in one tap (recent meals list) — recommended.
2. Live camera barcode scanning (no photo button).
3. Monthly look-back: average kcal + weight line together.
4. Water glasses counter.
Fixes to check: real iPhone food photo; data still there after a long time / iOS clearing storage (backup exists).

## Round 14 (2026-11-13) — barcode from a PHOTO + mL drink sizes ✅ LIVE

Started from her first real phone test: Coke Zero 8851959132074 was found (0 kcal ✓) but the amount
said 100 instead of the can's 325 mL. She then asked: can a photo fill the number in for her?
- `app/lib/barcodeScan.ts` — free reader ON the phone: `zxing-wasm@3.1.6` (exact pin, MIT; she OK'd the
  install). `public/zxing_reader.wasm` is served by the app (a `postinstall` script re-copies it from
  node_modules so it always matches the package). Formats EAN13/EAN8/UPCA/UPCE, tryHarder + tryRotate.
- `app/api/food/barcode-photo/route.ts` + `readBarcodeDigits` in `app/lib/server/ai.ts` — BACKUP only:
  if the free reader can't read the stripes, the AI reads the printed digits. Passcode-protected. The
  answer must pass the check digit (`barcodeCheckOk` in provider.ts) or it counts as "couldn't read".
  Mock mode returns the Nutella code.
- UI (`BarcodeLookup.tsx`): big "📷 ถ่ายรูปบาร์โค้ด" button on top → reads → fills the number → looks it up
  by itself. Typing still works below. If the AI read it: small note "check the numbers match the pack".
  If nothing could read it: friendly error (retake closer / type it).
- mL fix: `servingGrams` now reads g / mL / cL / L (1 mL ≈ 1 g); `servingIsLiquid` → card says
  "ต่อ 100 มล." and "ดื่มไปกี่ มล.", meal item unit "mL".
- Tests: 59 pass (new: mL sizes, check digit incl. her Coke Zero code). tsc, eslint, next build clean.
- Checked in the browser (mobile size, mock AI): drawn EAN-13 photo → free reader read it (no AI);
  digits-only picture → AI backup path; Coke Zero typed → 325 prefilled, mL labels.
- Live check after deploy: `/add/barcode` 200, `/zxing_reader.wasm` 200, `/api/food/barcode-photo`
  without passcode → 401. NOT checked: a real iPhone camera photo, and a real (non-mock) AI digit read.

### ▶ NEXT
1. ✅ She tried 📷 on her iPhone with a real pack (2026-11-13): worked, "very fast".
2. Resume the paused phone tests: photo → milk warning → backup.
3. ~~milk warning~~ switched off (see above); live camera scanning without taking a photo (own round).

## Round 13 (2026-11-13) — barcode lookup via Open Food Facts ✅ LIVE

She pasted a technical spec: Open Food Facts (OFF) as barcode source behind a provider interface
(USDA FoodData Central + FatSecret plug in later). Plan approved; contact email = her exm-labs email
(she said so in chat). The phone test round (photo / milk warning / backup) is paused, not done.
- `app/lib/food/provider.ts` — `FoodProvider` (getByBarcode / getById) + `Food` (per 100 g, nullable),
  `SNAPSHOT_ALLOWED` (off yes, usda yes, fatsecret no until its terms are checked), `cleanBarcode`, `servingGrams`.
- `app/lib/food/openFoodFacts.ts` — server-side provider: API **v3** (docs mark v2 deprecated), custom
  User-Agent on every call, 15 reads/min throttle, 429/503 → wait (Retry-After or 1 s, 2 s) max 2 retries,
  unknown barcode (v3 404 "product_not_found" / v2 status 0) → null, defensive number parsing, kJ→kcal
  fallback, `saveProduct` stub (writing needs an OFF account — out of scope).
- `app/lib/food/config.ts` — dev/tests always staging (world.openfoodfacts.net, basic auth off/off);
  production ONLY from `OFF_BASE_URL`; `OFF_CONTACT_EMAIL` from env (in .env.local, NOT in git).
- `app/api/food/barcode/route.ts` — POST {code, lang}, passcode-protected, small memory cache (found 24 h,
  not found 1 h). Returns the raw OFF product + normalized food.
- `app/lib/food/offStore.ts` — OFF's own IndexedDB db `yfd-off`/`products`: raw product unchanged + fetchedAt,
  7-day cache. Not in backups (meals keep their own number snapshot).
- UI: Today "Add food" → 🏷️ Barcode (`/add/barcode`): type digits → product card (per 100 g) → grams (prefilled
  from serving size, else 100) → normal review. No +15% margin. Item gets `ref: {source:"off", sourceId}`;
  entry `source: "barcode"`. "Data from Open Food Facts (ODbL)" shows on the product card and in the review.
- Tests: `tests/off.test.ts` (11) — all 58 pass; tsc, eslint, next build clean. Live staging lookup of
  3017624010701 → Nutella 539 kcal / 6.3 P / 57.5 C / 30.9 F per 100 g. Checked in the browser (mobile size).
- Doc differences told to her: v3 not v2; 15 reads/min (not 100); no facet limit in docs; over-limit = 503 /
  IP ban (429 only in retry advice); unknown barcode undocumented (checked live: v3 → HTTP 404).
- Known gaps: no camera scanning (iPhone Safari can't read barcodes alone; needs a library — its own round);
  the milk warning only checks the product NAME (e.g. "Nutella" isn't flagged); OFF allergen data not used yet.

### Deployed (she said "Yes, deploy it")
- Vercel Production env added: `OFF_BASE_URL=https://world.openfoodfacts.org`, `OFF_CONTACT_EMAIL` (her
  exm-labs email, read from .env.local). Not added for Preview (preview deploys say "not set up" — fine).
- Live check: `/add/barcode` → 200; `/api/food/barcode` without passcode → 401 (route live, guarded).
  NOT checked: a real production lookup (needs her passcode, which never goes in chat).

### ▶ NEXT (done → see Round 14)
1. ✅ She tried Barcode on her phone: Coke Zero found, 0 kcal.
2. Resume the paused phone tests: photo → milk warning → backup.
3. Ideas: use OFF allergen data for the milk warning; camera barcode scanning (own round).

## Round 12 (2026-11-13) — +15% margin only for amounts the AI guessed ✅

Her question: her home-made salmon + potato + veg recipe = 480 kcal/serving, but a photo of it → 600+.
Explained: the recipe (weighed) is the most accurate; photo = guess (±20–30%) + her +15% margin + "generous oil /
larger portion" rules. Advice given: home food with a recipe → log with "เลือกสูตรของฉัน"; photo → tell the AI
real weights; eating out → photo is fine. She agreed to this fix:
- AI item field `userAmount` (true only when SHE gave the exact weight/volume or an exact count). Prompt: use her
  amounts exactly, follow how she says it was cooked (e.g. no oil), plain food-table values for those items.
- `markMargin()` in `app/lib/nutrition.ts`: userAmount → no margin (`margin: false`); otherwise +15% (`margin: true`).
  Used for analyze items and chat adds. Chat edits: exact amount → `margin: false`; scaling edits keep the old flag.
  The refine prompt now gets `margin` per item. `FoodItem.margin?` saved on meals (old meals: missing).
- Review screen: badge "+15%" (AI guessed) or "น้ำหนักจริง" (exact) per item; note under the total explains
  "tell it the real weight and no margin is added" (shown only when some item has the margin).
- Tested: `npm test` 47 pass (2 new, `tests/margin.test.ts`). Pretend AI at iPhone size: "ข้าว 200 กรัม ไก่ทอด ผักลวก"
  → rice 260 (no margin), chicken 334 (+15%); chat "ข้าว 150 กรัม" → rice 195 น้ำหนักจริง, others unchanged.
  No console errors. Build passes.
- **Not tested:** the REAL AI setting userAmount (costs credit). She tries: photo of a home meal + note with grams.

## Round 11 (2026-11-13) — recipe ingredients: kg / liters + AI looks up any ingredient ✅

Her report (iPhone screenshot): "มันฝรั่ง 100 g" showed nothing, but "เนย 5 g" got a number. Cause: without a
label the app only knew ~20 foods in a tiny built-in table (`app/lib/foodRef.ts`) — butter yes, potato no.
- **New units:** กิโลกรัม (`kg`) and ลิตร (`l`) in `IngredientUnit`. The math turns them into g / ml first.
- **AI looks up any ingredient:** new route `/api/ingredient` → `lookupIngredient()` in `app/lib/server/ai.ts`
  returns per-100 g kcal/P/C/F (raw, as bought; reads the whole name, e.g. "salmon trout" ≠ "salmon"),
  plus weight of 1 piece and density for liquids. NO +15% margin (plain food-table values).
  Saved on the ingredient as `aiRef: {name, per100, unitG, gPerMl}` — only used while the name is the same.
- **Order now:** label → AI values → built-in table (fallback while offline / before the AI answers).
- **Recipe edit screen:** leaving the name field (blur) asks the AI automatically (through `aiFetch`, so
  the passcode works). Shows "✨ AI กำลังหาค่าสารอาหาร…", then the numbers with a "✨ ค่าจาก AI" badge and
  "ต่อ 100 กรัม: 77 kcal · ค่าดิบทั่วไป ไม่ใช่ค่าจากฉลาก". A "✨ ให้ AI หาค่าสารอาหาร" button shows when there
  are no AI values yet (old recipes, or the AI failed / didn't know the name).
- Each lookup = one small AI text call (cheap), only when a name is typed/changed.
- Tested: `npm test` 45 pass (3 new, `tests/ingredient.test.ts`). Pretend AI at iPhone size: มันฝรั่ง 100 g →
  77 kcal; 1.5 kg → 1,155; unknown name → message + button; renamed to ปลาแซลมอนเทราต์ 242 g → 341 kcal;
  saved, reopened → values kept; Thai + English; no console errors. Build passes.
- **Not tested:** the REAL AI lookup (costs credit). She tries: open her recipe → tap the potato name → tap elsewhere.

## Round 10 (2026-11-13) — weekly calorie chart on Today ✅

- Her pick: on the **Today** page (between "+ Add food" and the meal groups).
- `app/components/WeekKcalChart.tsx`: bars Mon → Sun for the week that holds the day she is
  looking at (go back days → earlier weeks), dashed goal line ("เป้า 1,500"), big average
  "เฉลี่ย kcal/วัน" top right. Over-target bars are soft orange; the day on screen is darker
  with a dark weekday chip. Tap a bar → that day. Future days are faded and can't be tapped.
- Line under the chart: "บันทึก N วัน · ต่ำกว่า/เกินเป้า X kcal/วัน · เกินเป้า N วัน".
  **The average only counts days with meals** (empty days don't pull it down) — said on screen.
- Math in `app/lib/week.ts` (`calorieWeek`), uses `weekStart` from `body.ts`.
- Tested: `npm test` 42 pass (2 new). Pretend AI at iPhone size with test meals: average
  1,361 checked by hand; tap Monday → Today shows Monday; previous day → last week's chart;
  Thai + English; no console errors. Build passes.

## Round 9 (2026-11-13) — milk warnings ✅ (the allergy idea, finished "all three")

Her need: milk upsets her stomach right away (sounds like lactose intolerance — told her
we're not doctors). Her picks: warn for ALL milk products (milk, cream, cheese, yogurt, butter,
condensed milk, ice cream), and a gentle warning only (no extra "are you sure?" when saving).
- **Switch:** Profile → "อาหารที่เลี่ยง / Foods I avoid" → ☐ 🥛 นมและผลิตภัณฑ์จากนม. Saved as
  `goals.avoidDairy` (so it's in the backup). Off by default → mom's phone never warns.
- **AI:** every item now has `dairy` + `dairySource` (e.g. "นมข้นหวาน"), for analyze AND chat
  edits/adds. The prompt explains Thai dishes that hide milk (Thai tea, coffee, bakery, creamy soups).
- **Word check** `app/lib/dairy.ts` (`looksDairy`, `isDairy`, `aiDairy`, `dairyItems`, `dairyIngredients`):
  for typed names. Look-alikes are skipped: ขนม…, นมถั่วเหลือง/อัลมอนด์/โอ๊ต/มะพร้าว, เนยถั่ว,
  soy/almond/oat/coconut milk, peanut butter. AI items = AI yes OR milky name.
- **Review screen:** orange box under the photo "🥛 อาจมีนม: ชาเย็น (นมข้นหวาน…)" + "🥛 นม" badge on
  the item. In the item editor a checkbox "มีนมหรือผลิตภัณฑ์จากนม" lets her fix a wrong guess.
- **Recipes:** "🥛 สูตรนี้มีนม: เนยสด" box + badge on the ingredient (word check only). Logging a
  recipe saves `dairy` on the meal item.
- Not shown on Today's meal list (not asked for).
- Tested: `npm test` 40 pass (2 new). Pretend AI at iPhone size: switch saves; "ข้าวไก่ทอด กับชาเย็น"
  → warning + badge; untick → warning gone; re-tick → back; saved meal keeps `dairy: true`; recipe
  with เนยสด → warning + badge; switch off → no warnings anywhere; English text OK. Build passes.
- **Not tested:** the REAL AI marking milk (costs credit). She tries: type "ชาเย็น 1 แก้ว" → Analyze.

## Round 8 (2026-11-13) — "all three" round: reminder ✅ · passcode ✅ · allergies ✅ (Round 9)

She asked for all three ideas: backup reminder, AI passcode, allergy warnings. One at a time.
- **Backup reminder ✅ (live):** `app/components/BackupReminder.tsx` on Today (today only).
  Shows when the last backup — or, if never, the first meal — is 14+ days old. "สำรองเลย" →
  `/profile#backup` (scrolls to the Backup card); "ไว้ทีหลัง" hides it 3 days
  (`localStorage` `yfd:v1:backupSnooze`). Logic `backupDue()` / `snoozeUntil()` in `app/lib/backup.ts`.
  Tested: `npm test` 36 pass (1 new); browser at iPhone size: card shows at 20 days (Thai),
  "Back up now" lands on the card, a fresh backup hides it, 16 days → English text, Later hides it. Build passes.
- **Passcode for AI ✅ (live):** her pick = "type once per phone".
  - Server: Vercel env `APP_PASSCODE` (Production, Sensitive — she typed it herself in a terminal
    tab; nobody else has seen it, it can't be read back; if forgotten, set a new one with
    `vercel env rm APP_PASSCODE production` + `vercel env add APP_PASSCODE production`, then redeploy).
    When `APP_PASSCODE` is NOT set (e.g. on this Mac), AI is open as before.
  - `app/lib/server/passcode.ts` `passcodeBlock()` runs first in `/api/analyze`, `/api/refine`,
    `/api/steps` → 401 `{error:"passcode"}` + 0.8 s pause on a wrong one. `/api/passcode` checks a code.
    `/api/status` now also says `passcode: true/false`.
  - Phone: every AI call goes through `aiFetch()` (`app/lib/aiFetch.ts`). It sends header
    `x-snapcal-passcode` (URI-encoded, so Thai works) from `localStorage` `yfd:v1:passcode`.
    On a passcode 401 it opens `PasscodeBox` (`app/components/PasscodeBox.tsx`, mounted in layout),
    which checks the code first, then the call is retried. Closing the box → "ต้องใส่รหัสผ่านก่อนใช้ AI".
    The passcode is NOT in the backup file (a new phone asks once).
  - Tested: `npm test` 38 pass (2 new). Test server `food-diary-passcode` (port 3219, pretend passcode
    `test-1234`, pretend AI) at iPhone size: box appears on first analyze, wrong → message, right →
    result + remembered, chat afterwards doesn't ask, close → message. Live: status says passcode on,
    AI call without code → 401, wrong code → 401.
  - **Not tested:** the REAL passcode on her phone (only she knows it). She should: open the app →
    type a food → Analyze → enter passcode once. Her MOM's phone will ask too — Yani tells her the passcode.
- **Allergy warnings:** done as Round 9 (milk only, her need).

## Round 7 (2026-11-13) — backup / restore ✅

- **Profile page → "สำรองข้อมูล / Backup" card** (`app/components/BackupCard.tsx`):
  - "💾 บันทึกไฟล์สำรอง" puts EVERYTHING on the phone in one file `snapcal-backup-YYYY-MM-DD.json`:
    meals, recipes, profile/goals, weight+steps, language, and all photos (from IndexedDB).
    On iPhone it opens the share sheet → she picks "Save to Files" (iCloud Drive is best).
    Falls back to a normal download when sharing isn't possible.
  - Shows "สำรองล่าสุด: <date>" (`localStorage` key `yfd:v1:lastBackup`, not part of the backup).
  - "กู้คืนจากไฟล์สำรอง" → pick the file → shows date + counts (meals · recipes · days · photos)
    + a warning that everything on the phone now will be REPLACED → confirm → app restarts on Today.
- **First setup screen (`/welcome`, step 1)** has a small "มีไฟล์สำรองอยู่แล้ว?" restore box, so a
  new phone can restore without doing setup first.
- Math/checks in `app/lib/backup.ts` (`makeBackup`, `parseBackup`, `backupCounts`, `backupFileName`);
  photo helpers `allPhotos()` / `putPhotos()` in `app/lib/photos.ts`. Wrong or broken files are
  refused with "ไฟล์นี้ไม่ใช่ไฟล์สำรองของ SnapCal" (nothing is changed).
- Tested: `npm test` 35 pass (4 new). Browser at iPhone size: made a backup (meal + photo + weight +
  profile), wiped everything like a new phone, restored from the setup screen → Today showed
  "สวัสดี Yani", 600 / 1,500 kcal, photo and weight back. Wrong file → message. English OK. Build passes.
- **Not tested:** the real iPhone share sheet / "Save to Files", and picking the file back from Files
  on the phone. She should try once: Profile → Save a backup → Save to Files.
- Ideas: a gentle "last backup was 2+ weeks ago" reminder on Today.

## Small add (2026-11-12) — link preview card for sharing
- `app/opengraph-image.tsx` makes a 1200×630 picture (plate + "SnapCal / Snap your food. Know your
  calories."); `openGraph` + `twitter` metadata in `app/layout.tsx` (title SnapCal, Thai description).
- She shared the link with her mom. Mom's data stays on mom's phone, but mom's AI calls use Yani's credit.
- Heads-up: after many quick `curl` checks, Vercel showed a "Security Checkpoint" (403) to this Mac's
  internet for a while — WhatsApp link previews from this Mac failed meanwhile. Check the live site
  in the browser pane instead of looping curl.
- WhatsApp remembers old previews; a fresh card may need the link sent again (or with `?v=2` at the end).

## Small fixes (2026-11-12, from her iPhone screenshots) ✅
- Setup/Profile: "เพศที่ใช้ในสมการ" → **"เพศของคุณ" / "Your sex"** (helper line removed); Profile row → "เพศ".
- "น้ำหนักที่อยากเป็น" → **"น้ำหนักที่ต้องการ"** everywhere (label, error, BMI warning).
- **BMI card** on the body step (setup + Profile edit): `BmiCard` in `profileFields.tsx`, math
  `bmiInfo()` / `bmiLevel()` in `energy.ts`. Asian/Thai cut-offs: <18.5 น้ำหนักน้อย, 18.5–22.9 ปกติ,
  23–24.9 น้ำหนักเกิน, 25–29.9 อ้วนระดับ 1, ≥30 อ้วนระดับ 2. Hidden until height + weight make sense.
- Recipe ingredient cards: the egg icon / ingredient photo is **removed** (view + edit). Just name,
  amount, kcal. Old ingredient photos stay stored but are no longer shown.
- Her question "why 343 (AI photo) vs 306 (recipe) for the same omelette?": the AI number includes
  HER +15% safety margin (≈298 × 1.15 ≈ 343); recipes get no margin. Nothing changed — explained.
- Tested: `npm test` 31 pass (1 new BMI test). Browser at iPhone size: 150 cm / 79.3 kg → BMI 35.2,
  อ้วนระดับ 2; goal label shows น้ำหนักที่ต้องการ; recipe page shows 306 with no pictures. Build passes.

## Round 6 (2026-11-12) — four meals: เช้า · กลางวัน · เย็น · ของว่าง ✅

- Meal slots are now `breakfast | lunch | dinner | snack` (was `brunch | dinner | snack`).
  Labels: มื้อเช้า / มื้อกลางวัน / มื้อเย็น / ของว่าง (Breakfast / Lunch / Dinner / Snack).
- Auto-pick by Thai time (`guessSlot`): 05–11 breakfast, 11–15 lunch, 16–22 dinner, else snack.
- Old saved "brunch" meals are split once on load (`upgradeSlot` in `app/lib/date.ts`, used in
  `store.tsx`): saved before 11:00 → breakfast, otherwise → lunch. Then saved back.
- Meal pickers (review screen + recipe "log it") are a 2×2 grid now.
- Tested: `npm test` 30 pass (1 new). Browser at iPhone size: old 9:00 brunch → มื้อเช้า,
  13:00 brunch → มื้อกลางวัน, Today shows the 4 groups, edit screen picker OK.

## Round 5 (2026-11-12) — weight + steps tracker, and the new name SnapCal ✅

- **New name: SnapCal** (her pick). Changed: page title, iPhone home-screen title, manifest
  name/short_name, description. NOT changed (on purpose): the web address, GitHub repo and
  folder stay `yani-food-diary`, so her saved data on the phone keeps working.
  To see the new name under the icon she must delete the old icon and "Add to Home Screen"
  again (data is kept — it belongs to the web address, not the icon).
- **New tab ⚖️ น้ำหนัก / Weight → `/body`** (`app/body/page.tsx`). Day switch ‹ › like Today.
  - Weight card: type kg (20–300), save / remove.
  - Steps card: type steps, OR "📸 อ่านจากภาพหน้าจอ" → AI reads ONE day's step count + date from
    a Health-app screenshot (`/api/steps`, `readSteps()` in `app/lib/server/ai.ts`, image sent at
    1600 px). A sheet shows the number + date to check/edit before saving. If the AI finds no
    number, she types it. Pretend AI answers 8,432 for today.
  - This week (Mon–Sun): average weight + days weighed, change vs last week's average
    (olive/blue when moving toward the goal, amber when away), average steps a day + total,
    progress bar from the FIRST logged weight (or profile weight) to the Profile target weight.
  - Weight line chart: 14 d / 30 d / 3 mo; zooms on her weights; the goal is a dashed line
    when close, else a small "goal 70 ↓" note. Tap a dot → go to that day.
  - Steps bars for the last 7 days (tap → that day).
- Data: `localStorage` key `yfd:v1:body` = `[{date, weightKg, steps, updatedAt}]`;
  math in `app/lib/body.ts` (`upsertLog`, `weekStart`, `summary`, `lastDays`); `setBody()` in store.
- Logging a weight does NOT change the Profile weight / kcal target (kept simple; could be a
  later "update my profile weight?" button).
- Tested: `npm test` 29 pass (4 new). Browser at iPhone size with the pretend AI: saved a
  weight, screenshot → 8,432 steps → saved; weekly numbers checked by hand; Thai + English;
  no console errors. Production build passes.
- **Not tested:** the REAL AI reading a real iPhone Health screenshot (costs credit) — she
  tries it on her phone. Steps from an Apple Shortcut was NOT built (screenshot chosen instead).

## Small fix (2026-11-12): "keep this page open" warning
- Analyze waiting screen (`app/add/[mode]/page.tsx`) and AI-chat sending (`MealReview.tsx`) now say:
  don't close this page or switch apps, or you may need to start again. Checked in the test app.

## ▶ NEXT: nothing agreed yet

Ask her what she'd like next. Ideas: try the real AI milk warning + passcode on her phone first;
more foods to avoid (only if she asks); a small 🥛 mark on Today's meal list; protein in the weekly chart.

## Older ideas (nothing agreed yet)

- Try Round 4 on her iPhone: Profile → English, then one real photo/text AI check
- Re-try the "700 vs 520 kcal" meal photo after the calorie-prompt fix; if still low, tune the prompt again
  (should answer in English).
- Try Round 3 on her real iPhone: her saved data should send her through setup once,
  with old values filled in.
- Still not tested: real phone-camera food photos; home-screen install; storage after
  closing Safari.
- Ideas from the brief: weekly charts · allergy warnings ·
  a simple passcode so strangers with the link can't spend AI credit.

## Fix (2026-11-12) — photo calorie guesses came out low
- Her report: one meal photo was 700 kcal in another app, 520 kcal in ours.
- Nothing in the app lowers the AI's numbers; the gap came from the AI prompt.
- Changed `app/lib/server/ai.ts` (ANALYZE_SYSTEM + item schema):
  - AI now estimates grams eaten first (new optional `grams` field, placed before kcal), judged against plate size, then kcal from cooked-dish values.
  - Counts hidden oil / coconut milk / sugar (in the dish OR as one "extra", never both).
  - When unsure between two sizes, picks the larger typical shop portion.
  - Checks kcal ≈ P×4 + C×4 + F×9.
- Her rule (same day): when exact numbers aren't known, over-estimate by 15–20%, and be generous with oil.
  - `AI_MARGIN = 0.15` + `withMargin()` in `app/lib/nutrition.ts`; applied on the server to every analyze item and to refine "adds" (refine edits scale from numbers that already include it — the prompt says so).
  - Recipes, labels and hand-typed meals get NO margin.
  - Review screen shows "AI numbers include a +15% safety margin" (`marginNote` prop) for photo/text meals.
  - Prompt: assume a bit MORE oil for fried/stir-fried dishes.
  - Checked with the pretend AI: 485 → 558 kcal. Test added (25 pass).
- NOT tested with a real (paid) AI call yet. Next: she re-takes / re-adds the same 700-kcal photo and compares.
- Neither number is "the truth": photo guesses are usually ±20–30%.

## Round 4 (2026-11-12) — Thai / English language switch ✅

- **Switch:** "ภาษา / Language" with two buttons (ไทย | English) on the first setup screen
  (`/welcome`, step 1) and on the Profile page. Thai is the default. The choice is saved on
  the phone (`localStorage` key `yfd:v1:lang`) and sets `<html lang>`.
- **How text works:** every sentence is a Thai/English pair where it is used:
  `tr("วันนี้", "Today")`. Core in `app/lib/i18n.ts` (`trFor`, `pickAll`, type `L`), React
  side in `app/lib/lang.tsx` (`LangProvider`, `useLang()`, `LangToggle`). Label lists
  (meal slots, units, reasons, activity, durations) are now `{ th, en }` objects.
- **Math files take a `lang` (default "th"):** `estimateEnergy`, `validateProfile`,
  `ingredientMacros`, `recipeTotals`, `totalsForRecipe`, `thaiDateLabel`, `bodyProblem`,
  `reasonProblem`. The numbers never depend on language (tested).
- **AI answers in the app language:** the app sends `lang` to `/api/analyze` and
  `/api/refine`; the prompt says "write in Thai" or "write in simple English". Server error
  messages are in the chosen language too.
- **Not translated (on purpose):** food/meal names already saved stay as they were written;
  the pretend AI (`npm run dev:mock`) always answers in Thai.
- Tested: `npm test` 24 pass (3 new). Browser at iPhone size: Profile → English → Profile,
  Today, add-by-text, review screen and setup screen all English (only her name and the
  "ไทย" button stay Thai); switched back to Thai fine; no console errors. Build passes.
- **Not tested:** a real (paid) AI call in English — to save credit. Try one on the phone.

## Round 3 (2026-11-12) — first-run setup + Profile page ✅

- **Locked setup (`/welcome`)**: `app/components/OnboardingGate.tsx` sends every screen
  here until a profile with a `name` and a `reason` is saved (`isOnboarded()` in
  `app/lib/profile.ts`). Five screens: name → body (age/height/weight/sex) → daily life +
  exercise → reason (ลดน้ำหนัก / เพิ่มกล้ามเนื้อ / เพิ่มน้ำหนัก / รักษาน้ำหนัก; lose/gain ask
  target weight + time with the Round 2 safe-pace warnings) → ONE big suggested number
  (tap to type your own) → "เริ่มใช้งาน". No pregnancy question here.
- **Old saved profiles** (no name/reason): go through setup once; `fillProfile()` pre-fills
  the old values and guesses the reason from the old target weight.
- **Reason math** (`app/lib/energy.ts`): maintain = maintenance; build muscle = +10% and
  protein 1.6 g/kg (ISSN, Jäger 2017: 1.4–2.0); lose/gain = Round 2 plan, and must point
  the right way. `macroTargets(kcal, proteinG)`: muscle → protein fixed, fat 30%, carbs rest;
  otherwise 20/50/30.
- **Profile page (`/profile`)** replaces the เป้าหมาย tab (`/goals` now just redirects).
  Big target number (tap to edit, then บันทึก), info list, "แก้ข้อมูล" edits everything;
  a new suggestion waits for "บันทึก และใช้ X kcal" or "บันทึก แต่ใช้เป้าเดิม".
  Small "ตั้งครรภ์หรือให้นมลูก" checkbox only here (ticked → no automatic suggestion).
  Method + references in a folded section. The maintenance number is no longer shown.
- **Today** greets "สวัสดี <name> 🌿" and uses the muscle protein target on the cards.
- Tested: `npm test` 21 pass (5 new). In the browser at iPhone size with an old profile:
  setup lock → pre-filled → build muscle 1,880 kcal + 127 g protein → typed 1,800 →
  Today shows greeting + 1,800 + protein 127 g; Profile → แก้ข้อมูล → ลดน้ำหนัก → 1,320
  waited for confirm, then saved. Production build passes.
- Not checked in the browser: the pregnancy checkbox (covered by the math test).

## Round 2 (2026-11-13) — weight goal as "target weight + time"

Yani's feedback from her iPhone: pick the weight she hopes to reach and how long
(days / weeks / months) instead of fixed speeds.
- `weightPlan()` in `app/lib/energy.ts`: kg ÷ weeks → kcal/day (× 7,700 ÷ 7).
- Safe pace cap: lose ≤ 1 kg/week and ≤ 1% body weight/week; gain ≤ 0.5 kg/week.
  Too fast → warning, shows the shortest safe time + "เปลี่ยนเป็น N เดือน" button.
- Plan card shows kg to change, kg/week, and the Thai date the goal is reached.
- BMI < 18.5 target → warning to see a doctor. 1,200/1,500 kcal floor still applies.
- Old saved profiles (with the old speed choice) open fine: target starts at current
  weight, 3 months.
- Tests: 16 pass (4 new). Checked in browser at iPhone size.

## Where we are (Round 1 — built 2026-11-12)

Built and tested on the Mac:

- **วันนี้ (Today):** kcal eaten vs daily target (ring), protein/carbs/fat pastel
  cards, meals grouped มื้อสาย / มื้อเย็น / ของว่าง, day back/forward, Thai time
  (Asia/Bangkok). "+ เพิ่มอาหาร" → ถ่ายรูป / พิมพ์ให้ AI ช่วย / เลือกสูตรของฉัน / กรอกเอง.
  Tap a meal to edit or delete it; totals update right away.
- **Photo flow:** camera or gallery → optional note → วิเคราะห์ → results page with the
  real photo on top, a label (name · kcal) on each food the AI could locate, meal name,
  amounts, big total, macro cards, tappable items (name/amount/unit/numbers),
  "อธิบายเพิ่ม" chat that edits only the items mentioned, extras (oil/sauce) shown
  with "เพิ่มเติม" / "ประมาณ" badges, one short question if unclear.
  Text-only start works too. Saves only when the save button is pressed.
- **สูตรของฉัน:** cover photo, name, servings, optional cooked weight, ingredient cards
  (g / ml / ฟอง / ชิ้น, label values per 100 g or per unit, weight-per-unit asked when
  units don't match, built-in estimates only when no label), optional steps,
  horizontal ingredient and step cards, totals per recipe and per serving.
  "บันทึกว่ากิน" → servings (0.5 etc.) or grams (when cooked weight is set), meal-only
  ingredient tweaks; the original recipe and old diary entries are never changed.
- **เป้าหมายของฉัน:** Mifflin–St Jeor + 5 standard activity factors (daily life +
  exercise frequency), maintenance shown separately from the chosen target, steps and
  references shown, new results wait for confirmation, manual kcal/day any time,
  skip option, no automatic estimate for under 18 / pregnant / breastfeeding.
- **AI:** OpenRouter through server routes (`/api/analyze`, `/api/refine`, `/api/status`),
  model `google/gemini-3.8-flash`, key `OPENROUTER_API_KEY` in `.env.local` (set 2026-11-12). Switched from the Claude API on 2026-11-12, then to gemini-3.8-flash, both at Yani's choice.

## Tested for real (2026-11-12)

- `npm test`: 12 math checks pass (recipe quarter, label-first, unit mismatch,
  Mifflin formula, activity levels, safety floor, Thai date, half portion).
- In the browser (iPhone size), with the FAKE AI (`npm run dev:mock`):
  1. Photo → chat "ไก่กินครึ่งชิ้น แต่ผักกินหมด" → only chicken changed (290→145),
     total 485→340 → saved to today with the photo. ✅
  2. ไข่เจียวแหนม, 2 servings (526.49 kcal) → log 0.5 serving → +131.62 kcal = exactly ¼
     (protein/carbs/fat also ¼). Recipe unchanged. ✅
  3. Manual target 1,650 → fresh page → target 1,650 and both meals still there. ✅
- With no key: the app shows the real "not set up" message and offers manual entry. ✅
- **With the REAL AI (gemini-3.8-flash, 2026-11-12)**, using a drawn plate photo:
  - Photo → rice 150 + fried chicken 260 + green beans 35 = 445 kcal; boxes landed on
    the right foods. ✅
  - Chat "ไก่กินครึ่งชิ้น แต่ผักกินหมด" → only chicken changed (260→130), total 445→315,
    saved to today. ✅
  - Text only "ผัดกะเพรา… ใส่น้ำมันเยอะ" → oil listed as its own "extra", marked estimate
    with a note. ✅ Takes ~10–15 seconds per call.
  - Fixed: photo labels were cut off on small boxes; kcal now always shows.
- Delete a meal → total updates. Production build (`next build`) passes.

## NOT tested yet

- Real phone-camera food photos (only a drawn plate was tested so far).
- On a real iPhone: camera, home-screen install, storage after closing Safari.

## Next round ideas (from the brief, deliberately left out)

- Auto ingredient image search · allergy warnings · detailed health settings ·
  weekly charts. Also: backup/export of local data.

## Round 42 (2026-11-16) — Smart Ingredient Search ✅ BUILT, committed locally, NOT pushed/deployed
Design: docs/round42-design.md. Search-first sheet `app/components/AddIngredientSheet.tsx` (search → pick → amount → Add;
"+ สร้างวัตถุดิบเอง" always visible). Logic: app/lib/ingredientSearch.ts, customIngredients.ts, ingredientUsda.ts.
Saved custom ingredients (yfd:v1:customIngredients) + usual picks (yfd:v1:ingredientPrefs) are in backup; restore keeps
current ones if the file has none. Old USDA/AI buttons moved under "ตัวเลือกขั้นสูง" in each ingredient card (nothing deleted).
Checks: 261 tests pass, tsc clean, lint 0 errors (2 old warnings), build OK, mock browser check at phone width OK.
NOT verified: real USDA/passcode flow, real iPhone, "weight of one piece"/"density" questions in the sheet.
Next: she tries it (mock first or after her OK to deploy), then Recipe Library. Do not push without her clear OK.

### Round 42 DEPLOYED (2026-11-16, b572ec7, Vercel success) with her explicit OK
Live checks: home 200, edit page 200, /api/status usda:true, /api/food/usda 401 without passcode, live JS has the new
"สร้างวัตถุดิบเอง" and NO key/USDA address. NOT checked: real USDA search (needs her passcode), real iPhone.
She tries on iPhone: egg rows; "chicken breast" USDA row; custom ingredient save+reuse; airplane mode still allows manual entry.
Do NOT start the next round until she says.

## Round 43 (2026-11-17) — many photos for one meal ✅ BUILT, committed locally, NOT deployed
Photo add page: up to 4 photos (camera adds one at a time, gallery multi-select), thumbnails with x, first = cover.
`/api/analyze` takes `images[]` (old `image` still works), one AI call. >1 photo → item boxes dropped; 1 photo = as before.
Entry.photoId = cover; others in optional `extraPhotoIds` (helpers in app/lib/mealPhotos.ts). Delete/eat-again handle extras.
268 tests pass, tsc clean, lint 0 errors, build OK, mock browser check OK. NOT verified: real camera/gallery, real AI with
several photos, backup+restore with extras. Needs her OK before pushing.

### Round 43 DEPLOYED (2026-11-17, b3ab42e, Vercel success) with her OK
Live: home 200, status ok, /api/analyze 401 without passcode, live add-photo code has extraPhotoIds + multi inputs.
She tries on iPhone: pick 3 photos from album, remove one, analyze, save, view extras; one photo still shows labels.

✅ Round 43 tried on her iPhone (2026-11-17): she said "ลองแล้ว ใช้ได้เลย" (works). Details of what she tried are not known.

## Fix (2026-11-17): add-ingredient sheet sank behind the iPhone keyboard — built, committed locally, NOT deployed
`Sheet` in app/components/ui.tsx has new `keyboardSafe` prop: fixed height inside window.visualViewport (the part the keyboard
does not cover); used by AddIngredientSheet, search box is sticky at the top. Browser check: sheet size constant while typing/deleting.
NOT verified on a real iPhone keyboard. Needs her OK before push.

### Keyboard fix DEPLOYED (2026-11-17, f74e979, Vercel success) with her OK. Live code has the new visualViewport sheet. She tries on iPhone.

## Round 44 (2026-11-17) — "ค้นหาอาหาร" tile: add ONE food straight to the diary ✅ BUILT, committed locally, NOT deployed
New tile in Today's Add food sheet → /add/search (reuses IngredientSearch from AddIngredientSheet) → Add → normal MealReview → save.
app/lib/searchFood.ts converts Ingredient→FoodItem (saved as kind "manual"). Buffer only when the unit is a counted one
(AI guessed piece weight); typed g/ml = no buffer (her Round 40 rule). 277 tests, tsc, lint 0 errors, build OK, mock browser OK.
Not verified: iPhone/real keyboard, AI/USDA rows by hand. Add-food sheet has an empty cell (6–7 tiles).
NEXT WISH (not started): "ask first" chat — type a food, get kcal + advice, add to diary only if she wants. Ask her design questions one at a time.

### Round 44 DEPLOYED (2026-11-17, 4212b6a, Vercel success) with her OK. Live: home 200, /add/search 200, new search code present. She tries on iPhone.

## Round 45 (2026-11-17) — "บันทึกเป็นวัตถุดิบของฉัน" on /add/search ✅ BUILT, committed locally, NOT deployed
After "+ สร้างวัตถุดิบเอง" the manual editor has a Save-as-my-ingredient button (g/ml → per 100; other units → per 1 unit; empty = unknown).
Saved ones come first in later searches (search page + recipe sheet, "ของฉัน" tag, Manage to edit/delete). Duplicate name → "use the one I already have".
In the create-custom flow protein/carbs/fat now start as unknown. 289 tests, tsc, lint 0 errors, build OK. Not verified: Manage edit/delete clicks, iPhone.
NEXT (she picked layout A, 2026-11-17): simplify Add food sheet — one search box on top (typing → /add/search with the text), 2 big tiles (ถ่ายรูป, บาร์โค้ด), small links "กินซ้ำ · สูตรของฉัน · กรอกเอง". The old "พิมพ์ให้ AI ช่วย" tile goes away; it becomes the last row in search results when nothing is found (the AI row already exists).

## Round 46 (2026-11-17) — Add food sheet = layout A (search first) ✅ BUILT, committed locally, NOT deployed
Search box + go arrow (→ /add/search?q=), 2 tiles (ถ่ายรูป, บาร์โค้ด), small links กินซ้ำ · สูตรของฉัน · กรอกเอง. Old "พิมพ์ให้ AI ช่วย"
and "ค้นหาอาหาร" tiles removed; /add/text kept and reached via "ให้ AI ดูทั้งจาน" link in search results (prefilled). Sheet is keyboardSafe.
294 tests, tsc, lint 0 errors, build OK, mock browser OK. Not verified: iPhone keyboard, English text. Rounds 45+46 deploy together after her OK.

### Rounds 45 + 46 DEPLOYED (2026-11-17, 85561d2, Vercel success) with her OK. Live: home 200, /add/search 200, new sheet text present. She tries on iPhone.

## Round 47 (2026-11-17) — smoother Add food sheet + "วัตถุดิบของฉัน" tab + one-tap AI ✅ BUILT, committed locally, NOT deployed
Her feedback on 45+46: (1) Enter → page jumped home then to search. Now live results INSIDE the Add food sheet as she types; one navigation
only when she taps Add (hand-off via sessionStorage `sheetHandoff`, 10 min expiry, one use). (2) Saved custom ingredients were hidden in "Manage":
now "สูตรของฉัน" has a switch สูตร | วัตถุดิบ with search, edit, delete (CustomIngredientList shared with Manage). (3) From 2 typed chars ONE pinned row
"ให้ AI คำนวณ “…”" → /add/text?q=…&auto → analysis starts on its own (never before the tap). In the sheet the single-ingredient AI-estimate row is hidden (only one AI button);
it still exists on /add/search. 310 tests, tsc, lint 0 errors, build OK, mock browser OK. Not verified: real iPhone keyboard, real USDA in sheet.

### Round 47 DEPLOYED (2026-11-17, 9b2f26a, Vercel success) with her OK. Live: home 200, recipes?tab=ingredients 200, new sheet code present. She tries on iPhone.

## Round 48 (2026-11-17) — no white frame around the search box + tidier USDA results ✅ BUILT, committed locally, NOT deployed
Her iPhone screenshots: (1) white rectangle around the search box (sticky strip colour ≠ sheet) → strip now transparent, box fill bg-white/95.
(2) Thai dish "ข้าวผัดกะเพรา" showed many English USDA "fried rice" rows marked "name differs" (USDA has no Thai dishes; AI row is the right answer for dishes)
→ non-close rows go behind one link "ดูผลใกล้เคียงอื่น (N)", identical name+numbers de-duplicated; close/custom/recent/reference rows never hidden.
317 tests, tsc, lint 0 errors, build OK, mock browser OK. Not verified: real iPhone, real USDA, sticky box with a long scrolled list.

### Round 48 DEPLOYED (2026-11-17, 83c5d6e, Vercel success) with her OK. Live: home 200, new "ดูผลใกล้เคียงอื่น" code present. She tries on iPhone.
Open idea (she said "not now"): email Mahidol INMU for Thai Food Composition permission. App has no Thai dish database (39 basic ingredients; AI covers dishes).
