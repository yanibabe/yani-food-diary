import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Round 65: (1) the barcode screen always tells her what to do when a product is missing or the look-up fails (popup),
// (2) the camera is torn down completely, (3) My ingredients uses the same search as the recipes,
// (4) the build id is shown on the Profile page.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("popup after a failed or empty barcode look-up, with photo / label photo / retry / type buttons", () => {
  const src = read("../app/components/BarcodeLookup.tsx");
  for (const id of ["barcode-offer", "offer-photo-ai", "offer-label-photo", "offer-retry", "offer-manual", "offer-label-input"]) assert.ok(src.includes(`data-testid="${id}"`), id);
  // set on every way a look-up can end without a product: not found, server error, no connection
  assert.ok(src.includes('setOffer({ kind: "notfound" })'));
  assert.equal(src.split('setOffer({ kind: "error"').length - 1, 2, "server error + no connection");
});

test("a label she photographed for an unknown barcode is used the next time she scans it", () => {
  const src = read("../app/components/BarcodeLookup.tsx");
  assert.ok(src.includes("findFix(readFixes(), clean)") && src.includes("show(blankFood(clean"));
});

test("the camera is torn down completely when the scanner closes", () => {
  const src = read("../app/components/LiveBarcodeScanner.tsx");
  assert.ok(src.includes("v.pause()") && src.includes("v.load()") && src.includes("stopCamera()"));
});

test("My ingredients opens the same ingredient search as the recipes and saves the pick", () => {
  const src = read("../app/components/MyIngredients.tsx");
  assert.ok(src.includes("<AddIngredientSheet") && src.includes("customInputFromIngredient") && src.includes("ingredientToItem") && src.includes("gramsPerUnit: ing.gramsPerUnit"));
  assert.ok(src.includes("initialName={creating"), "the typed words carry over to the create-my-own form");
});

test("the Profile page shows a build id", () => {
  assert.ok(read("../app/profile/page.tsx").includes('data-testid="build-id"'));
  assert.ok(read("../next.config.ts").includes("NEXT_PUBLIC_BUILD"));
});
