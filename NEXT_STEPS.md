# NEXT_STEPS — Yani Food Diary

**This file is the handoff.** Read it first in every chat about this app.

**To resume in a fresh chat, Yani types:** `continue yani-food-diary`

---

## Where we are (Round 1 — built 2026-11-12, local only)

Built and tested on the Mac (not deployed, not on GitHub yet):

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
  model `google/gemini-3.5-flash`, key `OPENROUTER_API_KEY` in `.env.local` (not set yet —
  ask Machina). Switched from the Claude API on 2026-11-12 at Yani's choice.

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
- Delete a meal → total updates. Production build (`next build`) passes.

## NOT tested yet

- Real AI answers (needs `OPENROUTER_API_KEY` from Machina). Photo labels (boxes) depend on
  how well Gemini places them — check on real photos.
- On a real iPhone: camera, home-screen install, storage after closing Safari.
- Deploy (Vercel) and GitHub repo — not done this round.

## Next round ideas (from the brief, deliberately left out)

- Auto ingredient image search · allergy warnings · detailed health settings ·
  weekly charts. Also: backup/export of local data.
