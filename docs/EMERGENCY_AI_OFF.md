# Emergency: switch the paid AI off / limit spending

SnapCal's paid AI calls (estimate, photo, refine, chat, ingredient, suggestions, label/barcode/pack photos, picture drawing,
meal-name check, name translation, USDA word translation) all pass through `app/lib/server/aiGuard.ts`.
When AI is off the app keeps working by hand (manual entry, own foods, recipes, backup, water, weight, sharing cards).

## Fastest stop (works instantly, no deploy)
OpenRouter website → Keys → open the SnapCal key → **lower the credit limit** (e.g. $5) or **disable / delete the key**.
(The key currently has a $1000 limit. Setting a small monthly limit there is the real hard cap on spending.)

## Switch AI off in the app (needs a redeploy, about 1 minute)
1. Vercel → project `yani-food-diary` → Settings → Environment Variables → add `AI_DISABLED` = `1` (Production) — or CLI: `vercel env add AI_DISABLED production`.
2. Redeploy: Deployments → latest → ⋯ → Redeploy (or CLI: `vercel redeploy <latest-production-url> --target production`).
3. Check: open `https://yani-food-diary.vercel.app/api/status` → it must show `"disabled":true`.
To turn AI back on: delete `AI_DISABLED` (or set it to `0`) and redeploy.

## Rate limits (defaults, per visitor IP, per server instance; all optional settings)
| Variable | Default | Meaning |
|---|---|---|
| `AI_MAX_PER_MIN` | 20 | paid calls per minute per visitor |
| `AI_MAX_PER_DAY` | 300 | paid calls per day per visitor |
| `AI_MAX_BG_PER_DAY` | 120 | background calls per day per visitor (picture drawing, meal names, name translation, USDA translation) |
| `AI_MAX_PER_DAY_ALL` | 3000 | paid calls per day per server instance |
Set a value to `0` to block that kind completely. Changing a variable needs a redeploy.
Honest limit: Vercel may run several server instances, so these limits are a best-effort fence; the spending limit on the OpenRouter key is the hard budget.

## Optional: passcode
`APP_PASSCODE` (not set today) makes every AI route ask for a passcode once per phone. Not changed by this release.

## What a refused call looks like
Server answers `503 {"error":"ai-off"}` (switched off) or `429 {"error":"rate-limit"}`; the app shows its normal "AI not available / try later" message. Logs contain only the route name and the reason.
