# Yani Food Diary

A Thai food diary for iPhone: Today page, photo → AI estimate → review → save,
"My recipes" with label values and per-serving math, and "My goals" with a
daily energy estimate. All data stays on the device.

## Run it on your Mac

```bash
cd ~/apps/yani-food-diary
npm run dev
```

Open http://localhost:3000 (on iPhone: same Wi-Fi, open `http://<your-mac-ip>:3000`).

Test mode with a fake AI (no key needed, shows an "AI จำลอง" badge):

```bash
npm run dev:mock
```

Run the math tests:

```bash
npm test
```

## Set up the AI (needed for photo and chat analysis)

AI goes through OpenRouter with the model `google/gemini-3.8-flash`, using the
key Machina gives you. Don't sign up for anything paid.

1. Create a file named `.env.local` in this folder with one line:

   ```
   OPENROUTER_API_KEY=the-key-from-machina
   ```

   This file is never saved to git. Never paste the key in chat.
2. Restart `npm run dev`.

When deployed (Vercel), add `OPENROUTER_API_KEY` with `vercel env add OPENROUTER_API_KEY`.
The key stays on the server; the phone never sees it.

Without a key, the app clearly says "ยังไม่ได้ตั้งค่า AI (OpenRouter)" and you can still
add food by hand, use recipes, and set goals.
