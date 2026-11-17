import { test } from "node:test";
import assert from "node:assert/strict";
import { closeAddLayerAction, isLayerHistoryState, layerAfterPop, layerHistoryState, openAddLayer } from "../app/lib/addLayer.ts";
import type { Ingredient } from "../app/lib/types.ts";

const ing = { name: "egg", amount: 1, unit: "piece" } as unknown as Ingredient;

test("tapping the AI row opens the layer with the cleaned text and adds one history step", () => {
  const r = openAddLayer(null, { kind: "ai", text: "  ข้าวกะเพรา \n " });
  assert.deepEqual(r.layer, { kind: "ai", text: "ข้าวกะเพรา" });
  assert.equal(r.push, true);
});

test("empty or blank AI text opens nothing", () => {
  assert.equal(openAddLayer(null, { kind: "ai", text: "   " }).push, false);
  assert.equal(openAddLayer(null, { kind: "ai", text: "   " }).layer, null);
});

test("picking a food opens the review layer with that food", () => {
  const r = openAddLayer(null, { kind: "review", ing });
  assert.equal(r.layer?.kind, "review");
  assert.equal(r.push, true);
});

test("a second tap while a layer is open is ignored (no second history step)", () => {
  const first = openAddLayer(null, { kind: "ai", text: "egg" });
  const second = openAddLayer(first.layer, { kind: "review", ing });
  assert.equal(second.push, false);
  assert.deepEqual(second.layer, first.layer);
});

test("Back closes the layer; buttons close by going back one step", () => {
  assert.equal(layerAfterPop(), null);
  assert.equal(closeAddLayerAction({ kind: "ai", text: "x" }), "history-back");
  assert.equal(closeAddLayerAction(null), "none");
});

test("our history mark is recognised, others are not", () => {
  assert.equal(isLayerHistoryState(layerHistoryState()), true);
  assert.equal(isLayerHistoryState(null), false);
  assert.equal(isLayerHistoryState({ other: 1 }), false);
  assert.equal(isLayerHistoryState("yfdAddLayer"), false);
});
