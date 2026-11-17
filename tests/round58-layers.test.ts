import { test } from "node:test";
import assert from "node:assert/strict";
import { closeAddLayerAction, layerMode, openAddLayer } from "../app/lib/addLayer.ts";
import type { Ingredient } from "../app/lib/types.ts";

const ing = { name: "egg", amount: 1, unit: "piece" } as unknown as Ingredient;

test("photo, barcode and manual tiles open a layer and add one history step", () => {
  for (const kind of ["photo", "barcode", "manual"] as const) {
    const r = openAddLayer(null, { kind });
    assert.deepEqual(r.layer, { kind });
    assert.equal(r.push, true);
  }
});

test("each layer kind shows the matching screen", () => {
  assert.equal(layerMode({ kind: "ai", text: "x" }), "text");
  assert.equal(layerMode({ kind: "review", ing }), "search");
  assert.equal(layerMode({ kind: "photo" }), "photo");
  assert.equal(layerMode({ kind: "barcode" }), "barcode");
  assert.equal(layerMode({ kind: "manual" }), "manual");
});

test("a second tap while one of these layers is open is ignored", () => {
  const first = openAddLayer(null, { kind: "photo" });
  const second = openAddLayer(first.layer, { kind: "barcode" });
  assert.equal(second.push, false);
  assert.deepEqual(second.layer, { kind: "photo" });
});

test("these layers close by going back one history step", () => {
  assert.equal(closeAddLayerAction({ kind: "manual" }), "history-back");
});
