import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addCustom, findByBarcode, makeCustom, parseCustom, serializeCustom } from "../app/lib/customIngredients.ts";
import { customInputFromItem } from "../app/lib/saveCustomFromItem.ts";
import { layerMode, openAddLayer } from "../app/lib/addLayer.ts";
import type { FoodItem } from "../app/lib/types.ts";

// Round 66: after the AI estimated a product from a photo, she can ask us to remember its barcode; scanning it again opens
// that food at once. The food is stored as one of her ingredients with a `barcode` on it.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const item = { id: "it1", name: "ขนมปังกรอบ", amount: 1, unit: "ห่อ", kcal: 140, protein: 2, carbs: 20, fat: 6, estimated: true, kind: "food", note: null, box: null } as unknown as FoodItem;

test("a barcode is kept only when it is 8–14 digits (spaces and dashes removed)", () => {
  const ok = makeCustom({ name: "x", kcal: 10, barcode: "885 4561-003794" }, "id1", 1);
  assert.ok(ok.ok && ok.item.barcode === "8854561003794");
  const short = makeCustom({ name: "x", kcal: 10, barcode: "123" }, "id2", 1);
  assert.ok(short.ok && short.item.barcode === undefined);
  const none = makeCustom({ name: "x", kcal: 10 }, "id3", 1);
  assert.ok(none.ok && "barcode" in none.item === false);
});

test("it survives saving and loading (old saved lists without it still load)", () => {
  const a = makeCustom({ name: "a", kcal: 5, barcode: "8854561003794" }, "ia", 1);
  assert.ok(a.ok);
  const back = parseCustom(serializeCustom([a.ok ? a.item : (null as never)]));
  assert.equal(back[0].barcode, "8854561003794");
  const old = parseCustom(JSON.stringify([{ id: "o1", name: "old", state: null, basis: "per100", per: "g", kcal: 100, protein: null, carbs: null, fat: null, gramsPerUnit: null, gPerMl: null, createdAt: 1, updatedAt: 1 }]));
  assert.equal(old.length, 1);
  assert.equal(old[0].barcode, undefined);
});

test("findByBarcode finds the food by its digits and ignores other codes", () => {
  const r = addCustom([], { name: "ขนม", kcal: 140, barcode: "8854561003794" }, 5);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(findByBarcode(r.list, "8854561003794")?.name, "ขนม");
  assert.equal(findByBarcode(r.list, "885-4561-003794")?.name, "ขนม");
  assert.equal(findByBarcode(r.list, "1234567890123"), null);
  assert.equal(findByBarcode(r.list, ""), null);
});

test("an AI-estimated item becomes a per-unit food with the barcode on it", () => {
  const base = customInputFromItem(item);
  assert.ok(base);
  const r = addCustom([], { ...base!, barcode: "8854561003794", unit: null }, 9);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.item.basis, "perUnit");
  assert.equal(Math.round(r.item.kcal), 140);
  assert.equal(r.item.barcode, "8854561003794");
});

test("the photo layer carries the barcode; other layers do not", () => {
  const r = openAddLayer(null, { kind: "photo", barcode: "8854561003794" });
  assert.deepEqual(r.layer, { kind: "photo", barcode: "8854561003794" });
  assert.equal(layerMode({ kind: "photo", barcode: "8854561003794" }), "photo");
});

test("wired: popup button passes the code, AddFlow shows the remember line and saves, scan checks her foods first", () => {
  const look = read("../app/components/BarcodeLookup.tsx");
  assert.ok(look.includes("onUsePhotoAi(cleanBarcode(code))") && look.includes("findByBarcode(loadCustom(), clean)"));
  const flow = read("../app/components/AddFlow.tsx");
  assert.ok(flow.includes('data-testid="remember-barcode"') && flow.includes("rememberProduct(oneFood(d), barcode)") && flow.includes("function oneFood"));
  assert.ok(read("../app/add/[mode]/page.tsx").includes("barcode={cleanBarcode("));
});
