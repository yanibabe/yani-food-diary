import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatContext, buildChatRequest, ChatReplySchema, ChatRequestSchema, cleanQuickReplies, cleanSuggestions, parseChat, pickReplyLang, shownDishes, type ChatMsg } from "../app/lib/foodChat.ts";
import { detectStyle, mockChat } from "../app/lib/server/chatMock.ts";

const eaten = { kcal: 1100, protein: 40, carbs: 140, fat: 55 };
const ctx = buildChatContext({ lang: "en", targetKcal: 1800, proteinTarget: 90, carbsTarget: 224.6, fatTarget: 50, eaten });
const req = (texts: string[], extra: Partial<ReturnType<typeof buildChatRequest>> = {}) =>
  ({ messages: texts.map((t, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", text: t })), context: ctx, ...extra });

test("old single suggestion becomes a one-item array; several cards are kept (max 4, no duplicate names)", () => {
  const old = ChatReplySchema.parse({ reply: "ok", suggestion: { name: "A", kcal: 100 } });
  assert.deepEqual(old.suggestions.map((s) => s.name), ["A"]);
  const many = ChatReplySchema.parse({ reply: "ok", suggestions: ["A", "B", "b", "C", "D", "E"].map((name) => ({ name, kcal: 100 })) });
  assert.deepEqual(many.suggestions.map((s) => s.name), ["A", "B", "C", "D"]);
});

test("broken cards are dropped, never the reply", () => {
  const r = ChatReplySchema.parse({ reply: "ok", suggestions: [{ name: "Good", kcal: 200, protein: "x" }, null, 5, { name: "", kcal: 5 }, { name: "Bad", kcal: -1 }], quickReplies: "nope" });
  assert.deepEqual(r.suggestions.map((s) => s.name), ["Good"]);
  assert.equal(r.suggestions[0].protein, null);
  assert.deepEqual(r.quickReplies, []);
  assert.deepEqual(ChatReplySchema.parse({ reply: "ok", suggestions: "bad" }).suggestions, []);
});

test("chips are trimmed, de-duplicated, short, max 6, and never look like contact details", () => {
  const chips = cleanQuickReplies([" ซุป/ต้ม ", "ซุป/ต้ม", "Soup", "soup", "x".repeat(25), "a@b.com", "call 0812345678", "https://x.co", 5, null, "", "ผัก", "ของว่าง", "ของหวาน", "เครื่องดื่ม", "โปรตีน", "ข้าว"]);
  assert.deepEqual(chips, ["ซุป/ต้ม", "Soup", "ผัก", "ของว่าง", "ของหวาน", "เครื่องดื่ม"]);
  assert.deepEqual(cleanQuickReplies(undefined), []);
  assert.equal(cleanQuickReplies(["x".repeat(24)]).length, 1);
});

test("old saved chats (single suggestion) are read into suggestions; chips survive; junk is dropped", () => {
  const raw = JSON.stringify([
    { id: "a", role: "assistant", text: "hi", suggestion: { name: "Soup", kcal: 100 } },
    { id: "b", role: "assistant", text: "new", suggestions: [{ name: "X", kcal: 50 }, { name: "", kcal: 1 }], quickReplies: ["ซุป", "ซุป", 3] },
    { id: "c", role: "user", text: "q", suggestions: [{ name: "no", kcal: 1 }], quickReplies: ["no"] },
  ]);
  const out = parseChat(raw);
  assert.deepEqual(out[0].suggestions?.map((s) => s.name), ["Soup"]);
  assert.equal(out[0].suggestion, undefined);
  assert.deepEqual(out[1].suggestions?.map((s) => s.name), ["X"]);
  assert.deepEqual(out[1].quickReplies, ["ซุป"]);
  assert.equal(out[2].suggestions, undefined);
  assert.equal(out[2].quickReplies, undefined);
});

test("context carries carbs and fat targets; they are left out when missing or zero", () => {
  assert.equal(ctx.carbsTarget, 225);
  assert.equal(ctx.fatTarget, 50);
  const bare = buildChatContext({ lang: "th", targetKcal: 1800, eaten, carbsTarget: null, fatTarget: 0 });
  assert.equal("carbsTarget" in bare, false);
  assert.equal("fatTarget" in bare, false);
  const parsed = ChatRequestSchema.parse({ messages: [{ role: "user", text: "hi" }], context: { ...ctx, carbsTarget: -4, fatTarget: "lots" } });
  assert.equal(parsed.context.carbsTarget, undefined);
  assert.equal(parsed.context.fatTarget, undefined);
});

test("dishes already suggested go along (names only, no repeats) and survive the server schema", () => {
  const msgs: ChatMsg[] = [
    { id: "1", role: "user", text: "soup" },
    { id: "2", role: "assistant", text: "a", suggestions: [{ name: "Tom yum", amountText: "", kcal: 1 }, { name: "Clear soup", amountText: "", kcal: 1 }] },
    { id: "3", role: "assistant", text: "b", suggestions: [{ name: "tom yum", amountText: "", kcal: 1 }], quickReplies: ["more"] },
    { id: "4", role: "assistant", text: "old", suggestion: { name: "Old one", amountText: "", kcal: 1 } },
  ];
  assert.deepEqual(shownDishes(msgs), ["Tom yum", "Clear soup", "Old one"]);
  const r = buildChatRequest(msgs, ctx);
  assert.deepEqual(r.shownDishes, ["Tom yum", "Clear soup", "Old one"]);
  assert.equal(JSON.stringify(r.messages).includes("more"), false); // chips are not sent
  assert.deepEqual(ChatRequestSchema.parse(r).shownDishes, r.shownDishes);
  assert.equal("shownDishes" in buildChatRequest([{ id: "1", role: "user", text: "hi" }], ctx), false);
});

test("reply language follows the LATEST message, the app language only breaks ties", () => {
  assert.equal(pickReplyLang("วันนี้ควรกินอะไรเพิ่ม", "en"), "th");
  assert.equal(pickReplyLang("What should I eat?", "th"), "en");
  assert.equal(pickReplyLang("ข้าวหน้าเนื้อ beef bowl กี่แคล", "en"), "th");
  assert.equal(pickReplyLang("Is pad kra pao OK ไหม", "th"), "en"); // more English letters than Thai
  assert.equal(pickReplyLang("123", "en"), "en");
  assert.equal(pickReplyLang("🍜", "th"), "th");
  assert.equal(pickReplyLang("", "en"), "en");
  assert.equal(pickReplyLang(null, "th"), "th");
  assert.equal(pickReplyLang("ok", "th"), "en");
});

test("mock: open question → status + chips, NO cards", () => {
  const r = mockChat(req(["วันนี้ควรกินอะไรเพิ่ม"]));
  assert.equal(r.suggestions.length, 0);
  assert.ok(r.quickReplies.length >= 3 && r.quickReplies.length <= 6);
  assert.ok(/โปรตีน/.test(r.reply) && /ไขมัน/.test(r.reply) && /คาร์บ/.test(r.reply));
  assert.ok(/ขาด/.test(r.reply)); // protein 40/90
  assert.ok(/เกินเป้า/.test(r.reply)); // fat 55/50
  assert.equal(r.quickReplies[0], "โปรตีนล้วน"); // protein short → protein first
});

test("mock: Thai question with the app in English gets a Thai reply; English question gets English", () => {
  assert.ok(/[฀-๿]/.test(mockChat(req(["วันนี้ควรกินอะไรเพิ่ม"])).reply));
  const en = mockChat(req(["What should I eat more of today?"]));
  assert.ok(!/[฀-๿]/.test(en.reply));
  assert.ok(en.quickReplies.every((c) => !/[฀-๿]/.test(c)));
});

test("mock: a style chip gives 3 different cards; 'anything else' gives NEW ones (none repeated)", () => {
  const first = mockChat(req(["ซุป/ต้ม"]));
  assert.equal(first.suggestions.length, 3);
  assert.equal(new Set(first.suggestions.map((s) => s.name)).size, 3);
  assert.ok(first.suggestions.every((s) => s.kcal > 0 && s.protein != null && s.carbs != null && s.fat != null));
  const shown = first.suggestions.map((s) => s.name);
  const more = mockChat(req(["ซุป/ต้ม", first.reply, "มีอย่างอื่นไหม"], { shownDishes: shown }));
  assert.ok(more.suggestions.length >= 2 && more.suggestions.length <= 3);
  for (const s of more.suggestions) assert.equal(shown.includes(s.name), false, s.name);
  // typed style
  assert.equal(mockChat(req(["อยากกินซุป"])).suggestions.length, 3);
  assert.equal(detectStyle("ของหวาน"), "sweet");
  // protein short → protein-forward first
  const p = mockChat(req(["โปรตีนล้วน"]));
  assert.ok(p.suggestions[0].protein! >= p.suggestions[2].protein!);
});

test("mock: when every dish of a style was shown, it says so and offers other styles", () => {
  const all = mockChat(req(["ซุป/ต้ม"], {})).suggestions.map((s) => s.name);
  const r = mockChat(req(["ซุป/ต้ม", "x", "มีอย่างอื่นไหม"], { shownDishes: [...all, "แกงจืดวุ้นเส้น", "ต้มยำปลา", "ซุปไก่ผักรวม", "ต้มข่าไก่", "แกงเลียงกุ้ง", "ต้มจืดเต้าหู้หมูสับ"] }));
  assert.equal(r.suggestions.length, 0);
  assert.ok(r.quickReplies.length > 0);
});
