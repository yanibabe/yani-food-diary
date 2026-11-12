# NEXT_STEPS — Yani Food Diary

**This file is the handoff.** Read it first in every chat about this app.

**To resume in a fresh chat, Yani types:** `continue yani-food-diary`

---

## LIVE (2026-11-12)

- **App:** https://yani-food-diary.vercel.app  (Vercel, exm-labs account, free)
- **Code:** https://github.com/yanibabe/yani-food-diary  (private; pushes auto-deploy)
- `OPENROUTER_API_KEY` is set in Vercel (Production + Preview), encrypted.
- Checked live: home, manifest, icon load; `/api/status` says configured; one real AI
  call ("กล้วยหอม 1 ลูก" → 120 kcal) worked.
- Note: anyone with the link can use the AI (spends key credit). Diary data stays on the
  phone. A simple passcode could be a later round.

## ▶ NEXT: Round 3 — first-run onboarding + Profile page (agreed 2026-11-13, NOT built yet)

Yani's request (from using it on her iPhone). The app is for HER OWN use, not other people —
keep it simple, don't over-engineer for "other users".

1. **Locked first-run onboarding.** If no completed profile is saved (no `name` yet), every
   screen redirects to an onboarding flow; she can't use the app until it's done. One step
   per screen, big buttons:
   1. Name (ชื่อ)
   2. Age, height, weight, sex (เพศที่ใช้ในสมการ)
   3. Daily activity + exercise frequency (same choices as now)
   4. Reason for using the app: ลดน้ำหนัก / เพิ่มกล้ามเนื้อ / เพิ่มน้ำหนัก / รักษาน้ำหนัก
      - lose / gain → ask target weight + time (reuse `weightPlan()`, safe-pace cap, warnings)
      - build muscle → small surplus (~+10% of maintenance) and protein target ~1.6 g/kg
        (cite ISSN position stand on protein, Jäger et al. 2017: 1.4–2.0 g/kg/day)
      - maintain → maintenance
   5. Result: ONE big "suggested target" number. Do NOT show the separate "maintenance"
      number anymore. Tap the number to edit it by hand. Button "เริ่มใช้งาน" saves.
   - **No pregnancy / breastfeeding question in onboarding.**
   - Under 18 still gets no automatic suggestion (enter own target).
   - Her existing phone data: profile without `name`/`reason` → she goes through onboarding
     once, with old values pre-filled.
2. **Profile page (โปรไฟล์)** replaces the "เป้าหมาย" tab: shows name, body info, activity,
   reason/plan, and the daily kcal target (tap to edit by hand any time). "แก้ข้อมูล" edits
   the same fields; a new suggestion still waits for her confirmation before replacing the
   target. Keep the method + references section (collapsed).
   - **Agreed middle path:** a small "ตั้งครรภ์หรือให้นมลูก" checkbox lives ONLY here,
     unticked by default (when ticked: no automatic suggestion). Low priority — she won't use it.
3. Today page: greet by name (e.g. "สวัสดี ยานี่").
4. Macro targets: keep 20/50/30 except "build muscle" uses the protein target above.
5. Tests for the new reason math; check onboarding gate + old-profile migration in the
   browser at iPhone size; deploy (push to GitHub auto-deploys) and confirm live.

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
