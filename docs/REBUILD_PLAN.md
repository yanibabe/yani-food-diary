# SnapCal rebuild plan (draft, 2026-11-18, NOT approved yet)

Yani asked for a first-principles redesign: faster engine, precise food data, a modern
sleek "agent-first" look (inspiration: clean white cards, soft color glows, black pill
buttons, round icon tiles; take the feeling, never copy), a beautiful share-for-trainer
day, many more images, the lightest possible code. Research was done by 5 Sonnet helpers.

## Hard rules
- Same domain (yani-food-diary.vercel.app) so her localStorage + IndexedDB data stays.
- New app must read every `yfd:v1:*` key and the `yani-food-diary` IndexedDB `photos`
  store unchanged (shapes listed in app/lib/types.ts, customIngredients.ts, foodChat.ts, backup.ts).
  Backup files `snapcal-backup-*.json` (app "snapcal", version 1) must still restore.
- OpenRouter only. Free tiers only. Keys server-side only. Passcode stays.
- Git tag `before-rebuild` before any change; build on a branch; keep old app until she approves.

## Stack (helper 4)
Vite + Preact (preact/compat) SPA + Vercel Functions in /api, Tailwind 4, tiny store over
localStorage, idb for photos, hand-written service worker (offline shell; new feature),
lazy-loaded barcode scanner (BarcodeDetector if present, else zxing-wasm).
Functions region `sin1` (Singapore). Today: ~344 KB gzipped JS total, no service worker.

## Engine (helpers 1, 2, 3)
- Models: text = `deepseek/deepseek-v4.1-flash-1017` (reasoning off, provider sort latency,
  require_parameters, json_schema, max_tokens caps); vision = `google/gemini-3.8-flash`
  (reasoning effort low — cannot be turned off); images = `google/gemini-3.1-flash-lite-image`
  via POST /api/v1/images (1K, aspect ratios incl. 4:3, ~$0.03–0.04/image unverified).
- AI never invents numbers: (1) AI names items + grams + cooking state, (2) local lookup
  returns candidates, (3) AI picks a candidate id, (4) code computes nutrients. Every item
  keeps source + confidence marks.
- Data layers: bundled USDA Foundation + SR Legacy + FNDDS subset (~8k foods, 1–2 MB gz,
  CC0) → small personal Thai dish table (INMU values, credited, personal use) → Open Food
  Facts barcodes (cached forever per scan) → USDA live API fallback.
- INMU (Mahidol) full bundle needs written permission (kunchit.jud@mahidol.ac.th).
  Skip: Nutritionix, Passio, Edamam, Spoonacular, API Ninjas, CalorieNinjas (paid/card/closed).
- Speed: stream replies, shrink photos (food 1024px q0.7, labels 1280–1600px q0.8),
  parallel calls, cache repeated lookups.

## Images
Generate once → WebP ~768px → store (Vercel Blob free tier or committed to public/ for fixed
art) + IndexedDB copy on the phone. Never generate per view. Needs her OK on credit use.

## Open questions for Yani (one at a time)
1. ✅ 2026-11-18: she said use OpenRouter credit "as much as you need to build the app".
2. ✅ 2026-11-18 DROP: draggable chat button (chat stays, fixed spot) and Smart Calorie Buffer
   (old saved kcal numbers stay exactly as saved — never rewrite). KEEP: little character, water.
   Also drop dead code: dairy warning, steps, fatsecret source, chatFab key.
3. ⏸ 2026-11-18: she didn't like the 3 quick mockups (docs/mockups/index.html). Redesign PAUSED.
   She is fairly happy with the current Frosted Calm look but finds some parts plain; she
   will send reference examples of features/design she wants. Keep the current look as the
   base and add life (real food photos in rows, AI recipe covers, stronger accents).
3b. ✅ 2026-11-18 MEAL PICTURES: she picked AI-drawn pictures for every meal (her real photos
   look bad in the app; real photo stays saved, viewable). Style = "1B": overhead top-down
   close-up, dish fills the frame, smooth solid pastel background suited to the dish, soft
   studio light. Prompt + samples: docs/mockups/c1–c4.jpeg (gen script in REBUILD notes).
   Reuse one picture per dish name; draw from the saved items (e.g. no egg if none logged).
   ~$0.034 and ~5 s per picture, square 1:1.
   Unknown Thai dishes (she approved, tested with น้ำปลาพริก — Thai name alone drew well):
   (1) photo → Gemini writes a visual description for the picture prompt; (2) typed name →
   DeepSeek adds an English visual description next to the Thai name; (3) "วาดใหม่" button with
   a short hint, or "use my own photo"; remember the picture per dish name.
   Numbers never come from the picture: split into ingredients → database. Gentle high-sodium
   note for sauces like น้ำปลาพริก.
4. Share-for-trainer: what the trainer needs to see.
