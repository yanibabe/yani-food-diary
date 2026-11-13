# NEXT_STEPS — SnapCal (folder/repo/URL still "yani-food-diary")

**This file is the handoff.** Read it first in every chat about this app.

**To resume in a fresh chat, Yani types:** `continue yani-food-diary`

---

## LIVE (updated 2026-11-13, Round 18b — tried on iPhone ✓)

- **App:** https://yani-food-diary.vercel.app  (Vercel, exm-labs account, free)
- **Code:** https://github.com/yanibabe/yani-food-diary  (private; pushes auto-deploy)
- `OPENROUTER_API_KEY` is set in Vercel (Production + Preview), encrypted.
- Checked live: home, manifest, icon load; `/api/status` says configured; one real AI
  call ("กล้วยหอม 1 ลูก" → 120 kcal) worked.
- Sharing the link: each person's diary, recipes and profile live ONLY on their own
  phone (localStorage + IndexedDB). Nobody sees anyone else's data. But everyone with
  the link uses Yani's OpenRouter key, so their AI photo/text checks spend HER credit.
  Since Round 8 the AI needs a passcode (typed once per phone), so strangers can't spend it.

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
