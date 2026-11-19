// Round 82: a translation that swaps the meat (pork → ไก่) is never kept or reused.
import test from "node:test";
import assert from "node:assert/strict";
import { parseNameTr } from "../app/lib/nameTr.ts";
import { parseTranslateReply } from "../app/lib/translateNames.ts";

const n = "Fried fermented pork rib cartilage (Naem kradook oon)";

test("a saved pair whose meats disagree is forgotten, so it is translated again", () => {
  const raw = JSON.stringify({ [n]: { th: "แหนมเอ็นข้อไก่/ซี่โครงอ่อนทอด", en: n }, "Sticky rice": { th: "ข้าวเหนียว", en: "Sticky rice" } });
  const c = parseNameTr(raw);
  assert.equal(c[n], undefined);
  assert.deepEqual(c["Sticky rice"], { th: "ข้าวเหนียว", en: "Sticky rice" });
});

test("the AI's answer is dropped when it changes the meat, kept when it matches", () => {
  assert.equal(parseTranslateReply({ names: [{ src: n, th: "แหนมเอ็นไก่ทอด", en: n }] }, [n]).length, 0);
  assert.equal(parseTranslateReply({ names: [{ src: n, th: "แหนมกระดูกอ่อนหมูทอด", en: n }] }, [n]).length, 1);
});
