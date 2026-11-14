import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDDY, LIBRARY, buddySvg, cleanBuddy, parseBuddy, partsOf, SHAPES, HEADS } from "../app/lib/buddy/parts.ts";
import { ELEMENT_TYPES, checkLibrary, elSvg, elTransform, mirrorX, newEl, partSvg, type El } from "../app/lib/buddy/elements.ts";
import shipped from "../app/lib/buddy/studio-parts.json" with { type: "json" };

test("nothing saved or broken text → null (app shows the default buddy)", () => {
  assert.equal(parseBuddy(null), null);
  assert.equal(parseBuddy(""), null);
  assert.equal(parseBuddy("{oops"), null);
  assert.equal(parseBuddy("[1,2]"), null);
});

test("a saved buddy comes back the same", () => {
  const b = { shape: "onigiri", color: "#F4C0D1", eyes: "wink", brows: "soft", nose: "heart", mouth: "cat", head: "strawberry", extras: ["blush", "coffee"] } as const;
  assert.deepEqual(parseBuddy(JSON.stringify(b)), { ...b, extras: ["blush", "coffee"] });
});

test("unknown parts fall back to the default, unknown extras are dropped", () => {
  const b = cleanBuddy({ shape: "dragon", color: "red", eyes: 5, mouth: "smile", head: "crown", extras: ["glasses", "laser", "glasses"] });
  assert.equal(b.shape, DEFAULT_BUDDY.shape);
  assert.equal(b.color, DEFAULT_BUDDY.color);
  assert.equal(b.eyes, DEFAULT_BUDDY.eyes);
  assert.equal(b.mouth, "smile");
  assert.equal(b.head, DEFAULT_BUDDY.head);
  assert.deepEqual(b.extras, ["glasses"]);
});

test("tricks in saved text never reach the drawing", () => {
  const svg = buddySvg(cleanBuddy({ color: '"/><script>alert(1)</script>', shape: "toString" }));
  assert.ok(!svg.includes("<script"));
  assert.ok(svg.includes(SHAPES.blob.d));
});

test("every shape and head add-on draws", () => {
  for (const shape of Object.keys(SHAPES)) {
    for (const head of Object.keys(HEADS)) {
      const svg = buddySvg(cleanBuddy({ shape, head, brows: "worried", nose: "button", extras: ["blush", "glasses", "earrings", "coffee"] }));
      assert.ok(svg.length > 100 && !svg.includes("NaN") && !svg.includes("undefined"), `${shape}/${head}`);
    }
  }
  // White buddy gets a faint edge so it shows on white.
  assert.ok(buddySvg({ ...DEFAULT_BUDDY, color: "#ffffff" }).includes('stroke="#e2ddd5"'));
});

test("the shipped parts file is valid and keeps every Round 20 id", () => {
  const v = checkLibrary(shipped);
  assert.ok(v.ok, v.ok ? "" : v.error);
  assert.equal(LIBRARY.parts.length, (shipped as { parts: unknown[] }).parts.length);
  for (const id of ["dot", "shine", "happy", "calm", "squint", "wink"]) assert.ok(partsOf(LIBRARY, "eyes").some((p) => p.id === id), id);
  for (const id of ["smile", "cat", "open", "o", "flat", "tongue"]) assert.ok(partsOf(LIBRARY, "mouth").some((p) => p.id === id), id);
});

test("an old Round 20 buddy (no brows/nose fields, nose as an extra) still opens", () => {
  const old = { shape: "bun", color: "#FAC775", eyes: "squint", mouth: "tongue", head: "bow", extras: ["nose", "blush"] };
  const b = cleanBuddy(old);
  assert.equal(b.eyes, "squint");
  assert.equal(b.mouth, "tongue");
  assert.equal(b.brows, "none");
  assert.equal(b.nose, "button");
  assert.deepEqual(b.extras, ["blush"]);
  assert.equal(cleanBuddy({ ...old, extras: [] }).nose, "none");
});

test("studio ids: unknown → default, none is fine for brows/nose but not eyes/mouth", () => {
  assert.equal(cleanBuddy({ eyes: "laser", mouth: "none" }).eyes, DEFAULT_BUDDY.eyes);
  assert.equal(cleanBuddy({ mouth: "none" }).mouth, DEFAULT_BUDDY.mouth);
  assert.equal(cleanBuddy({ brows: "zzz", nose: "none" }).brows, "none");
  // A part made in the studio works once it's in the library.
  const lib = { parts: [...LIBRARY.parts, { id: "eyes-new1", kind: "eyes" as const, name: { th: "ใหม่", en: "" }, visible: true, items: [newEl("heart", "eyes")] }] };
  assert.equal(cleanBuddy({ eyes: "eyes-new1" }, lib).eyes, "eyes-new1");
  assert.equal(cleanBuddy({ eyes: "eyes-new1" }).eyes, DEFAULT_BUDDY.eyes);
  // The default part was deleted: the first part she shows is used instead.
  const noShine = { parts: LIBRARY.parts.filter((p) => p.id !== "shine") };
  assert.equal(cleanBuddy({}, noShine).eyes, partsOf(noShine, "eyes", true)[0].id);
});

test("mirror math: the copy sits at 100−x and is flipped", () => {
  assert.equal(mirrorX(40), 60);
  assert.equal(mirrorX(30.5), 69.5);
  const el: El = { ...newEl("angle", "eyes"), x: 39.5, y: 52, rot: 10 };
  assert.equal(elTransform(el, false), "translate(39.5 52) rotate(10)");
  assert.equal(elTransform(el, true), "translate(60.5 52) scale(-1 1) rotate(10)");
  assert.equal((elSvg({ ...el, mirror: true }).match(/<path/g) ?? []).length, 2);
  assert.equal((elSvg({ ...el, mirror: false }).match(/<path/g) ?? []).length, 1);
});

test("every element draws, and bad values never reach the drawing", () => {
  for (const type of ELEMENT_TYPES) {
    for (const filled of [true, false]) {
      const s = elSvg({ ...newEl(type, "mouth"), filled });
      assert.ok(s.startsWith("<") && !s.includes("NaN") && !s.includes("undefined"), type);
    }
  }
  assert.equal(elSvg({ ...newEl("dot", "eyes"), color: 'red" onload="x' }), "");
  assert.equal(elSvg({ ...newEl("dot", "eyes"), size: Infinity }), "");
  assert.equal(partSvg({ items: [] }), "");
});

test("the parts file check catches mistakes", () => {
  assert.equal(checkLibrary({ parts: [{ id: "Bad Id!", kind: "eyes", name: { th: "x", en: "" }, visible: true, items: [] }] }).ok, false);
  assert.equal(checkLibrary({ parts: [{ id: "a", kind: "ears", name: { th: "x", en: "" }, visible: true, items: [] }] }).ok, false);
  const p = { id: "a", kind: "eyes", name: { th: "x", en: "" }, visible: true, items: [] };
  assert.equal(checkLibrary({ parts: [p, p] }).ok, false);
  assert.equal(checkLibrary({ parts: [p, { ...p, kind: "mouth" }] }).ok, true);
  assert.equal(checkLibrary("nope").ok, false);
});

test("hidden parts are not offered, but a saved buddy using one still draws", () => {
  const lib = { parts: LIBRARY.parts.map((p) => (p.id === "wink" ? { ...p, visible: false } : p)) };
  assert.ok(!partsOf(lib, "eyes", true).some((p) => p.id === "wink"));
  assert.equal(cleanBuddy({ eyes: "wink" }, lib).eyes, "wink");
  assert.ok(buddySvg({ ...DEFAULT_BUDDY, eyes: "wink" }, lib, "eyes").length < buddySvg({ ...DEFAULT_BUDDY, eyes: "wink" }, lib).length);
});
