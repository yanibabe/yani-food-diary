# NEXT_STEPS — SnapCal (folder/repo/URL still "yani-food-diary")

**This file is the handoff.** Read it first in every chat about this app.

**To resume in a fresh chat, Yani types:** `continue yani-food-diary`

---

## LIVE (updated 2026-11-12, Round 4)

- **App:** https://yani-food-diary.vercel.app  (Vercel, exm-labs account, free)
- **Code:** https://github.com/yanibabe/yani-food-diary  (private; pushes auto-deploy)
- `OPENROUTER_API_KEY` is set in Vercel (Production + Preview), encrypted.
- Checked live: home, manifest, icon load; `/api/status` says configured; one real AI
  call ("กล้วยหอม 1 ลูก" → 120 kcal) worked.
- Sharing the link: each person's diary, recipes and profile live ONLY on their own
  phone (localStorage + IndexedDB). Nobody sees anyone else's data. But everyone with
  the link uses Yani's OpenRouter key, so their AI photo/text checks spend HER credit.
  A simple passcode could be a later round.

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

## ▶ NEXT: ideas for a later round (nothing agreed yet)

- Try Round 4 on her iPhone: Profile → English, then one real photo/text AI check
- Re-try the "700 vs 520 kcal" meal photo after the calorie-prompt fix; if still low, tune the prompt again
  (should answer in English).
- Try Round 3 on her real iPhone: her saved data should send her through setup once,
  with old values filled in.
- Still not tested: real phone-camera food photos; home-screen install; storage after
  closing Safari.
- Ideas from the brief: weekly charts · backup/export of local data · allergy warnings ·
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
