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

## Set up the Claude API (needed for photo and chat analysis)

The Claude API is a paid service, billed per use.

1. Get an API key from the Anthropic Console (console.anthropic.com → API keys).
2. Create a file named `.env.local` in this folder with one line:

   ```
   ANTHROPIC_API_KEY=your-key-here
   ```

   This file is never saved to git.
3. Restart `npm run dev`.
4. Optional: choose another model with a second line, e.g. `CLAUDE_MODEL=claude-sonnet-5-5`.
   The default is `claude-opus-5-5`.

When deployed (e.g. Vercel), add `ANTHROPIC_API_KEY` in the host's environment
variables. The key stays on the server; the phone never sees it.

Without a key, the app clearly says "ยังไม่ได้ตั้งค่า Claude API" and you can still
add food by hand, use recipes, and set goals.
