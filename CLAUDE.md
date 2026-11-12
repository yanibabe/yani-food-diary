@AGENTS.md

# Yani Food Diary — rules for this app

A Thai-language food diary, iPhone-first. Read `NEXT_STEPS.md` first in every chat.

## Design (binding)
- Warm cream background, olive green for main buttons, soft pastel cards for
  protein (rose), carbs (butter) and fat (sky). Big, easy-to-read numbers.
  Big tap targets (48px+). Colors live as tokens in `app/globals.css`.
- This app uses its OWN look (Yani's spec), not the playground liquid-glass look.
- Every screen must work at iPhone width (375px) and respect safe areas.

## Data
- Everything is saved on the device: diary, recipes, goals in localStorage
  (`app/lib/store.tsx`), photos in IndexedDB (`app/lib/photos.ts`). No backend.

## AI (OpenRouter, model google/gemini-3.8-flash — Yani's choice for this app)
- All AI calls go through the server (`app/lib/server/ai.ts`, routes in `app/api/`).
- Key: `OPENROUTER_API_KEY` in `.env.local` only (Machina gives it). NEVER commit it,
  NEVER paste it in chat. If it's missing, ask Machina — never sign up for anything paid.
- Free tier only. Anything that costs money needs Yani's OK first.
- No key → the app says so honestly and lets her enter food by hand.
- `npm run dev:mock` = test mode with a fake AI answer (shows an "AI จำลอง" badge).

## Math lives in code, not in AI
- Recipe math: `app/lib/recipe.ts` (label values first, then estimates; asks for
  weight per unit when units don't match).
- Energy math: `app/lib/energy.ts` (Mifflin–St Jeor + standard activity factors).
- Tests: `npm test` (Node's built-in runner, `tests/`).

## Git and honesty
- Claude owns git: narrate each step in one plain sentence; never force-push.
- Show real errors in plain words; never fake a working step.
