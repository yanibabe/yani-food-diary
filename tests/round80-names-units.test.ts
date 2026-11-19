// Round 80: edit boxes follow the app language, the title follows a renamed item, units follow the app language.
import { test } from "node:test";
import assert from "node:assert/strict";
import { editMainBox, editSmallBox, followRenames, nameBoxes, validAlt, type NameAlt } from "../app/lib/names.ts";
import { displayUnit } from "../app/lib/unitNames.ts";
import { FAIL_PAUSE_MS, parseRuns } from "../app/lib/nameTr.ts";
import { buildShareDay } from "../app/lib/shareDay.ts";
import type { Entry } from "../app/lib/types.ts";

const EN = "Grilled chicken skewers";
const TH_AUTO: NameAlt = { th: "ไก่ย่างเสียบไม้", src: EN };
const TH_MANUAL: NameAlt = { th: "ไก่ย่างเสียบไม้", src: EN, manual: true };

// ------------------------------------------------------------ boxes
test("boxes: Thai app + English original with a Thai alt → big box Thai, small box English", () => {
  assert.deepEqual(nameBoxes(EN, TH_AUTO, "th"), { main: "ไก่ย่างเสียบไม้", small: EN, smallLang: "en", mainIsAlt: true });
});
test("boxes: English app + English original → big box English, small box Thai alt", () => {
  assert.deepEqual(nameBoxes(EN, TH_AUTO, "en"), { main: EN, small: "ไก่ย่างเสียบไม้", smallLang: "th", mainIsAlt: false });
});
test("boxes: Thai app + Thai original + English alt → big Thai original, small English", () => {
  const b = nameBoxes("ปลาทู", { en: "Mackerel", src: "ปลาทู" }, "th");
  assert.deepEqual(b, { main: "ปลาทู", small: "Mackerel", smallLang: "en", mainIsAlt: false });
});
test("boxes: no alt → the original is big, the small box is empty and is the other language of the original", () => {
  assert.deepEqual(nameBoxes(EN, undefined, "th"), { main: EN, small: "", smallLang: "th", mainIsAlt: false });
  assert.deepEqual(nameBoxes("ปลาทู", undefined, "en"), { main: "ปลาทู", small: "", smallLang: "en", mainIsAlt: false });
});
test("boxes: a stale automatic alt is not shown", () => {
  assert.equal(nameBoxes("Fried pork", { th: "ไก่ทอด", src: "Fried chicken" }, "th").mainIsAlt, false);
});

// ------------------------------------------------------------ typing in the big box
test("main box that shows the original behaves as before (automatic alt dropped, manual alt kept)", () => {
  assert.deepEqual(editMainBox(EN, undefined, "th", "Fried pork"), { name: "Fried pork", alt: undefined });
  assert.equal(editMainBox("ปลาทู", { en: "Mackerel", src: "ปลาทู" }, "th", "ปลาทูทอด").alt, undefined);
  const manual: NameAlt = { en: "Mackerel", src: "ปลาทู", manual: true };
  assert.equal(editMainBox("ปลาทู", manual, "th", "ปลาทูทอด").alt, manual);
});
test("main box that shows the alt: typed Thai becomes the real name; an automatic English is dropped", () => {
  const r = editMainBox(EN, TH_AUTO, "th", "แหนมกระดูกอ่อนทอด");
  assert.deepEqual(r, { name: "แหนมกระดูกอ่อนทอด", alt: undefined });
});
test("main box that shows the alt: a manual alt keeps the old English as her own English name", () => {
  const r = editMainBox(EN, TH_MANUAL, "th", "แหนมกระดูกอ่อนทอด");
  assert.equal(r.name, "แหนมกระดูกอ่อนทอด");
  assert.deepEqual(r.alt, { en: EN, src: "แหนมกระดูกอ่อนทอด", manual: true });
  assert.equal(nameBoxes(r.name, r.alt, "th").small, EN);
});
test("main box that shows the alt: emptying it does not crash", () => {
  assert.deepEqual(editMainBox(EN, TH_MANUAL, "th", ""), { name: "", alt: undefined });
});

// ------------------------------------------------------------ typing in the small box
test("small box that holds the other language is her manual alt", () => {
  const r = editSmallBox(EN, undefined, "en", "ไก่ย่าง");
  assert.equal(r.name, EN);
  assert.deepEqual(r.alt, { th: "ไก่ย่าง", src: EN, manual: true });
  assert.equal(editSmallBox(EN, r.alt, "en", "").alt, undefined);
});
test("small box that holds the original edits the original and keeps the Thai alt on screen", () => {
  const r = editSmallBox(EN, TH_AUTO, "th", "Grilled chicken sticks");
  assert.equal(r.name, "Grilled chicken sticks");
  assert.deepEqual(r.alt, { th: "ไก่ย่างเสียบไม้", src: "Grilled chicken sticks", manual: true });
  assert.equal(nameBoxes(r.name, r.alt, "th").main, "ไก่ย่างเสียบไม้");
});
test("small box that holds the original, emptied → the Thai name becomes the original", () => {
  assert.deepEqual(editSmallBox(EN, TH_AUTO, "th", "  "), { name: "ไก่ย่างเสียบไม้", alt: undefined });
});

// ------------------------------------------------------------ title follows a renamed item
test("title: the old item name inside the title is replaced by the new name", () => {
  const r = followRenames("Grilled Chicken Skewers and Fried Chicken", undefined, [{ oldName: "Fried chicken", newName: "Fried naem cartilage" }]);
  assert.equal(r?.title, "Grilled Chicken Skewers and Fried naem cartilage");
});
test("title: the old item's Thai alt is found in a Thai title, and the new Thai name is used", () => {
  const r = followRenames(
    "ข้าวไก่ทอด",
    { en: "Fried chicken rice", src: "ข้าวไก่ทอด" },
    [{ oldName: "Fried chicken", oldAlt: { th: "ไก่ทอด", src: "Fried chicken" }, newName: "Fried naem cartilage", newAlt: { th: "แหนมกระดูกอ่อนทอด", src: "Fried naem cartilage" } }],
  );
  assert.equal(r?.title, "ข้าวแหนมกระดูกอ่อนทอด");
  assert.equal(r?.alt?.en, "Fried naem cartilage rice");
  // when the English side cannot be swapped (no new English name known) the alt is dropped and made again
  const r2 = followRenames("ข้าวไก่ทอด", { en: "Fried chicken rice", src: "ข้าวไก่ทอด" }, [{ oldName: "Fried chicken", oldAlt: { th: "ไก่ทอด", src: "Fried chicken" }, newName: "แหนมทอด" }]);
  assert.equal(r2?.title, "ข้าวแหนมทอด");
  assert.equal(r2?.alt, undefined);
});
test("title: both languages of the title are updated when both names are known", () => {
  const r = followRenames(
    "ข้าวไก่ทอด",
    { en: "Rice with fried chicken", src: "ข้าวไก่ทอด" },
    [{ oldName: "ไก่ทอด", oldAlt: { en: "fried chicken", src: "ไก่ทอด" }, newName: "แหนมทอด", newAlt: { en: "fried naem", src: "แหนมทอด" } }],
  );
  assert.equal(r?.title, "ข้าวแหนมทอด");
  assert.equal(r?.alt?.en, "Rice with fried naem");
  assert.equal(r?.alt?.src, "ข้าวแหนมทอด");
  assert.ok(validAlt(r!.title, r!.alt));
});
test("title: nothing changes when the title does not contain the old name (or the name is unchanged)", () => {
  assert.equal(followRenames("Lunch", undefined, [{ oldName: "Fried chicken", newName: "Salad" }]), null);
  assert.equal(followRenames("Fried chicken", undefined, [{ oldName: "Fried chicken", newName: "Fried chicken" }]), null);
});
test("title: several renames, and case does not matter", () => {
  const r = followRenames("FRIED CHICKEN with Rice", undefined, [
    { oldName: "fried chicken", newName: "Tofu" },
    { oldName: "Rice", newName: "Noodles" },
  ]);
  assert.equal(r?.title, "Tofu with Noodles");
});

// ------------------------------------------------------------ units
test("units: English → Thai in Thai mode, plurals too", () => {
  for (const [en, th] of [["skewer", "ไม้"], ["skewers", "ไม้"], ["Portion", "ที่"], ["piece", "ชิ้น"], ["pieces", "ชิ้น"], ["plate", "จาน"], ["bowl", "ชาม"], ["cup", "ถ้วย"], ["glass", "แก้ว"], ["glasses", "แก้ว"], ["tbsp", "ช้อนโต๊ะ"], ["teaspoon", "ช้อนชา"], ["g", "กรัม"], ["ml", "มล."], ["pack", "ห่อ"], ["sachet", "ซอง"], ["box", "กล่อง"], ["boxes", "กล่อง"], ["bottle", "ขวด"], ["can", "กระป๋อง"], ["serving", "เสิร์ฟ"], ["egg", "ฟอง"], ["ladle", "ทัพพี"]] as const) {
    assert.equal(displayUnit(en, "th"), th, en);
  }
});
test("units: Thai → English in English mode (plural when the amount is not 1)", () => {
  assert.equal(displayUnit("ไม้", "en", 1), "skewer");
  assert.equal(displayUnit("ไม้", "en", 3), "skewers");
  assert.equal(displayUnit("กล่อง", "en", 2), "boxes");
  assert.equal(displayUnit("กรัม", "en", 150), "g");
  assert.equal(displayUnit("มล.", "en", 200), "ml");
  assert.equal(displayUnit("ชิ้น", "en"), "piece");
  assert.equal(displayUnit("ลูก", "en", 1), "piece");
  assert.equal(displayUnit("ช้อนโต๊ะ", "en", 1), "tablespoon");
  assert.equal(displayUnit("ที่", "en", 1), "portion");
});
test("units: already in the app language, unknown units and empty text stay as they are", () => {
  assert.equal(displayUnit("ไม้", "th"), "ไม้");
  assert.equal(displayUnit("Skewers", "en"), "Skewers");
  assert.equal(displayUnit("ขีด", "en"), "ขีด");
  assert.equal(displayUnit("handful", "th"), "handful");
  assert.equal(displayUnit("", "th"), "");
  assert.equal(displayUnit("  ", "en"), "");
});
test("units: the share-day picture shows them in the app language", () => {
  const e: Entry = {
    id: "e", date: "2026-11-19", slot: "lunch", title: "Skewers", source: "text", photoId: null, recipe: null, createdAt: 1, updatedAt: 1,
    items: [
      { id: "a", name: "Chicken", amount: 2, unit: "skewer", kcal: 100, protein: 1, carbs: 1, fat: 1, estimated: false, kind: "food", note: null, box: null },
      { id: "b", name: "Rice", amount: 1, unit: "bowl", kcal: 100, protein: 1, carbs: 1, fat: 1, estimated: false, kind: "food", note: null, box: null },
    ],
  };
  const th = buildShareDay([e], "2026-11-19", {}, (n) => n, "th");
  assert.equal(th.slots.find((s) => s.meals.length)?.meals[0].detail, "Chicken 2 ไม้ · Rice 1 ชาม");
  const plain = buildShareDay([e], "2026-11-19");
  assert.equal(plain.slots.find((s) => s.meals.length)?.meals[0].detail, "Chicken 2 skewer · Rice 1 bowl");
});

// ------------------------------------------------------------ the pause after a failure survives midnight
test("runs: failedAt is kept on a new day, the call count is not", () => {
  const raw = JSON.stringify({ day: "2026-11-19", calls: 5, failedAt: 1234 });
  assert.deepEqual(parseRuns(raw, "2026-11-20"), { day: "2026-11-20", calls: 0, failedAt: 1234 });
  assert.deepEqual(parseRuns(raw, "2026-11-19"), { day: "2026-11-19", calls: 5, failedAt: 1234 });
  assert.deepEqual(parseRuns(JSON.stringify({ day: "2026-11-19", calls: 2, failed: true }), "2026-11-19"), { day: "2026-11-19", calls: 2, failedAt: 0 });
  assert.equal(FAIL_PAUSE_MS, 3600000);
});

test("Thai typed over an English item: the title switches to Thai, not half and half", () => {
  const out = followRenames(
    "Grilled Chicken Skewers and Fried Chicken",
    { th: "ไก่ย่างเสียบไม้และไก่ทอด", src: "Grilled Chicken Skewers and Fried Chicken" },
    [{ oldName: "Fried chicken", oldAlt: { th: "ไก่ทอด", src: "Fried chicken" }, newName: "แหนมกระดูกอ่อนทอด", newAlt: undefined }],
  );
  assert.equal(out?.title, "ไก่ย่างเสียบไม้และแหนมกระดูกอ่อนทอด");
  assert.equal(out?.alt, undefined);
});

test("a renamed item with a stale alt is still sent for translation", async () => {
  const { missingNames } = await import("../app/lib/names.ts");
  const e = { date: "2026-11-19", title: "x", items: [{ name: "Fried fermented pork rib cartilage", alt: { th: "ไก่ทอด", src: "Fried chicken" } }], recipe: null };
  assert.ok(missingNames({ entries: [e], recipes: [], custom: [] }, () => undefined).includes("Fried fermented pork rib cartilage"));
});

test("an old meal title is repaired from the item's left-over old name", async () => {
  const { repairTitle } = await import("../app/lib/names.ts");
  const e = {
    title: "Grilled Chicken Skewers and Fried Chicken",
    alt: { th: "ไก่ย่างเสียบไม้และไก่ทอด", src: "Grilled Chicken Skewers and Fried Chicken" },
    items: [{ name: "Fried fermented pork rib cartilage (Naem kradook oon)", alt: { th: "ไก่ทอด", src: "Fried chicken" } }],
    recipe: null,
  };
  const out = repairTitle(e);
  assert.ok(!/fried chicken/i.test(out.title), out.title);
  assert.match(out.title, /fermented pork/i);
  assert.ok(!out.alt || !/ไก่ทอด/.test(out.alt.th ?? ""));
  const typed = { ...e, alt: { th: "ของฉัน", manual: true } };
  assert.equal(repairTitle(typed), typed);
});
