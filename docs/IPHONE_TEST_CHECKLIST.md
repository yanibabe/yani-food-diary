# SnapCal — real iPhone test checklist (before any deploy)

Status key: [AUTO] = already covered by automated tests / simulated browser checks (still re-run before deploy) ·
[DEVICE] = needs a physical iPhone (Safari and the installed home-screen app) · [BOTH] = automated part + a device spot-check.

Test on: Safari tab AND the home-screen (installed) app · small iPhone (SE / mini) and a large one (Pro Max) · Thai and English · light room and dark room.
Use a TEST copy of the data (make a backup file first). Never test restore on the only copy of real data.

## 1. Navigation and swipe-back  [DEVICE]
- [ ] Today → Add food → swipe from the left edge: the sheet closes, you stay on Today.
- [ ] Add food → type "egg" → pick it → Meal Review → swipe back: the sheet returns with "egg" still typed → swipe back again: the sheet closes.
- [ ] Meal Review → Save: you land on Today (not on the sheet); one swipe back now leaves Today normally (no dead step).
- [ ] Add food → "My recipes" → swipe back: Today, sheet closed, no extra step.
- [ ] Bottom bar "Ask AI": tap it fast several times (one chat only); swipe back closes it and returns to the same page; previous messages are still there; chat → add → review → swipe back returns to the chat.
- [ ] Water / week / share sheets on Today: swipe back closes them.
- [ ] Known gap: Add food → "See all" (full eat-again list) → swipe back closes the whole sheet.
- [ ] Rotate the phone with a sheet open (if you use landscape).

## 2. Add Food and Meal Review  [BOTH]
- [AUTO] ranking, grouping (meals / recipes / ingredients), one-tap amounts, repeat + Undo, duplicate-tap guard.
- [DEVICE] [ ] Tap targets feel right with a thumb; "+" on a recent meal logs once even with a fast double tap.
- [DEVICE] [ ] Repeat meal on a past day saves to that day; Undo removes exactly that copy.
- [DEVICE] [ ] Thai and English long names wrap, nothing cut off.

## 3. Keyboard and sticky buttons  [DEVICE]
- [ ] Add food search: the search box stays visible with the keyboard up; results scroll.
- [ ] Meal Review: tap "Tell the AI more" → keyboard up → the text box is not hidden behind the Save bar; you can scroll to every field.
- [ ] Item editor: every field reachable with the keyboard open; "Done" visible after closing the keyboard.
- [ ] Recipe form: Save bar never covers a field; servings − / + work.
- [ ] Save bar sits above the home indicator (safe area), not under it.

## 4. AI food estimation  [BOTH]
- [AUTO] mock-mode flow: type → "Let AI estimate" → review → save; "Tell the AI more" reply handling.
- [DEVICE] [ ] REAL AI (needs her passcode, uses her OpenRouter credit — a few calls only): "banana 1" and "ข้าวมันไก่"; numbers are plausible, items marked "Estimate".
- [ ] Offline: a clear message, and manual entry still works.

## 5. Camera and image analysis  [DEVICE]
- [ ] Take a photo (camera permission prompt, rear camera), up to 4 photos, then "Let AI estimate".
- [ ] Choose from the photo library; a large HEIC photo works and is not slow.
- [ ] The saved meal keeps its photo; photo shows after closing/reopening the app.
- [ ] Deny camera permission: understandable message, library still works.

## 6. Barcode scanning  [DEVICE]
- [ ] Scan with the camera on a real packaged product (live scanner, torch/focus OK).
- [ ] Type the digits by hand; a product found by the look-up lands on Meal Review.
- [ ] Not found / offline: the fallbacks (photo, label photo, type it) appear.
- [ ] BLOCKER CHECK: in the local test server the look-up answered "not set up on the server" (503). Confirm the look-up works on the real server before deploy.

## 7. iOS sharing  [DEVICE]
- [ ] Share day / week card: the picture is made and the iOS share sheet opens (LINE, Messages, Save to Photos).
- [ ] Share a recipe link; open it on a second phone (read-only view, "save to my recipes").
- [AUTO] the card image is generated without errors.

## 8. Backup file download  [DEVICE]
- [ ] "Save a backup" gives a .json file in Files / Downloads (Safari and installed app behave differently — test both).
- [ ] The file opens as text and is not empty; the "Last backup" date updates.

## 9. Backup and restore  [BOTH]
- [AUTO] full cycle with synthetic data; failure half-way rolls back; broken/foreign files refused; images kept.
- [DEVICE] [ ] On a TEST phone/browser profile: restore the backup file picked from Files → counts shown on the confirm screen match → after restore meals, recipes, weight, water, goals, custom ingredients and photos are all there.
- [ ] Restore a damaged file (edit one character): refused with a message, nothing changed.

## 10. Safe-area handling  [DEVICE]
- [ ] Notch / Dynamic Island: titles not hidden. Home indicator: bottom bar and Save bar clear of it.
- [ ] Installed app (standalone) AND Safari tab (address bar moves while scrolling — sticky bars stay put).
- [ ] 320 / 360 / 375 / 390 / 430 pt wide phones (SE, mini, 15, Pro Max): no sideways scroll.

## 11. Nutrition accuracy  [AUTO + spot-check]
- [AUTO] 743 tests incl. ingredient maths, recipe totals, buffers, energy checks (unchanged by the redesign).
- [DEVICE] [ ] Pick 3 foods; compare kcal per 100 g with the source label; change amount/unit; totals add up on Today.
- [ ] A recipe: per-serving kcal × servings = whole recipe; edit servings and amounts.
- [ ] Items marked "Estimate" / "Incomplete" still show those marks after save and reload.

## 12. Data persistence  [DEVICE]
- [ ] Force-quit the app, reopen: meals, water, weight, recipes, language, goals all still there.
- [ ] Add to Home Screen, delete and re-add it: note that browser data may not follow — this is why backup matters (iOS can clear site data after ~7 days of non-use in Safari tabs; the installed app is safer).
- [ ] Low-storage warning shows if saving fails.

## Blockers to resolve before deploy
1. Real-iPhone pass of sections 1, 3, 5, 6, 8, 9, 10 (nothing here can be proven in a desktop browser).
2. Barcode look-up must be confirmed working on the real server.
3. (Done) AI chat now lives in the four-item bottom bar. On the phone, check: Ask AI opens the chat from Today / Recipes / Profile, swipe-back closes it and returns to the same page.
4. Decide on the "See all" Back gap (minor).
5. Contrast re-check on new screens (not re-measured since Phase 2A).
6. Commits are local only; nothing is pushed. Push = auto-deploy (see NEXT_STEPS), so push only after the device pass.
