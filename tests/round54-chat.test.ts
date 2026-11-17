import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatContext, buildChatRequest, capMessages, ChatReplySchema, ChatRequestSchema, MAX_SENT, MAX_STORED, parseChat, serializeChat, splitAmount, suggestionToItem, type ChatMsg } from "../app/lib/foodChat.ts";
import { BACKUP_KEYS, makeBackup, parseBackup, restoreAction } from "../app/lib/backup.ts";
import { canBuffer } from "../app/lib/calorieBuffer.ts";
import { itemProvenance, isEstimated } from "../app/lib/provenance.ts";

const msgs = (n: number): ChatMsg[] => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", text: `t${i}` }));

test("only the newest 30 messages are kept; only the last 10 are sent", () => {
  const all = msgs(45);
  assert.equal(capMessages(all).length, MAX_STORED);
  assert.equal(capMessages(all)[0].id, "m15");
  const ctx = buildChatContext({ lang: "th", targetKcal: 1800, eaten: { kcal: 0, protein: 0, carbs: 0, fat: 0 } });
  const req = buildChatRequest(all, ctx);
  assert.equal(req.messages.length, MAX_SENT);
  assert.equal(req.messages[MAX_SENT - 1].text, "t44");
});

test("parseChat: broken text, wrong shapes and bad messages never throw", () => {
  assert.deepEqual(parseChat(null), []);
  assert.deepEqual(parseChat("{{{"), []);
  assert.deepEqual(parseChat('{"a":1}'), []);
  const raw = JSON.stringify([{ role: "user", text: "hi", id: "a" }, { role: "robot", text: "x" }, { role: "user", text: "   " }, null, 5, { role: "assistant", text: "ok", suggestion: { name: "x", kcal: -5 } }]);
  const out = parseChat(raw);
  assert.deepEqual(out.map((m) => m.role), ["user", "assistant"]);
  assert.equal(out[1].suggestion, undefined);
  assert.equal(parseChat(serializeChat(msgs(50))).length, MAX_STORED);
});

test("the request has only the allowed fields; missing values are left out, never 0", () => {
  const full = buildChatContext({
    lang: "en", targetKcal: 1800.4, proteinTarget: 90.2, eaten: { kcal: 612.7, protein: 30.1, carbs: 80.5, fat: 20.4 },
    age: 34, sex: "female", heightCm: 160, weightKg: 58.46, goal: "lose", avoidDairy: true,
    todayFoods: [{ name: "ข้าวไข่เจียว", kcal: 420.4 }, { name: "  ", kcal: 5 }],
  });
  assert.deepEqual(full, {
    lang: "en", kcalTarget: 1800, proteinTarget: 90, eatenKcal: 613, protein: 30, carbs: 81, fat: 20, remainingKcal: 1188,
    age: 34, sex: "female", heightCm: 160, weightKg: 58.5, goal: "lose", avoidDairy: true, todayMeals: [{ name: "ข้าวไข่เจียว", kcal: 420 }],
  });
  const bare = buildChatContext({ lang: "th", targetKcal: 1800, proteinTarget: null, eaten: { kcal: 2000, protein: 0, carbs: 0, fat: 0 }, age: 0, sex: "x", heightCm: null, weightKg: NaN, goal: "bulk", avoidDairy: false, todayFoods: [] });
  for (const k of ["proteinTarget", "age", "sex", "heightCm", "weightKg", "goal", "avoidDairy", "todayMeals"]) assert.equal(k in bare, false, k);
  assert.equal(bare.remainingKcal, -200);
});

test("nothing personal can be sent: no name, email, photos, notes or old days; only allowed keys survive", () => {
  const ctx = buildChatContext({ lang: "en", targetKcal: 1800, eaten: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, age: 30 });
  const req = buildChatRequest([{ id: "x", role: "user", text: "hi", suggestion: { name: "secret meal", amountText: "", kcal: 5 } }], ctx);
  assert.deepEqual(Object.keys(req).sort(), ["context", "messages"]);
  assert.deepEqual(req.messages[0], { role: "user", text: "hi" });
  const dirty = {
    name: "Yani", photos: ["data:x"],
    context: { ...ctx, name: "Yani", email: "a@b.c", notes: "n", photo: "p", mealTitles: ["a"], history: [1], yesterday: { kcal: 1 }, todayMeals: [{ name: "rice", kcal: 100, note: "secret", photoId: "ph1" }] },
    messages: [{ role: "user", text: "hi", photo: "x" }],
  };
  const out = JSON.stringify(ChatRequestSchema.parse(dirty));
  for (const bad of ["Yani", "a@b.c", "notes", "photo", "mealTitles", "history", "yesterday", "secret", "ph1", "email"]) assert.equal(out.includes(bad), false, bad);
  assert.ok(out.includes("rice"));
  assert.equal(JSON.parse(out).context.age, 30);
});

test("bad optional values in the context are dropped (not zeros) and the avoidDairy flag passes", () => {
  const ctx = buildChatContext({ lang: "th", targetKcal: 1800, eaten: { kcal: 0, protein: 0, carbs: 0, fat: 0 } });
  const p = ChatRequestSchema.parse({ messages: [{ role: "user", text: "hi" }], context: { ...ctx, age: -3, sex: "alien", heightCm: "tall", goal: "bulk", avoidDairy: true } });
  assert.equal(p.context.age, undefined);
  assert.equal(p.context.sex, undefined);
  assert.equal(p.context.heightCm, undefined);
  assert.equal(p.context.goal, undefined);
  assert.equal(p.context.avoidDairy, true);
  const off = ChatRequestSchema.parse({ messages: [{ role: "user", text: "hi" }], context: { ...ctx, avoidDairy: false } });
  assert.equal(off.context.avoidDairy, undefined);
  const many = Array.from({ length: 30 }, (_, i) => ({ name: `f${i}`, kcal: 1 }));
  assert.equal(buildChatContext({ lang: "th", targetKcal: 1, eaten: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, todayFoods: many }).todayMeals?.length, 20);
});

test("the request schema rejects empty or bad requests and trims to the last 10", () => {
  const ctx = buildChatContext({ lang: "th", targetKcal: 1800, eaten: { kcal: 0, protein: 0, carbs: 0, fat: 0 } });
  assert.equal(ChatRequestSchema.safeParse({ messages: [], context: ctx }).success, false);
  assert.equal(ChatRequestSchema.safeParse({ messages: [{ role: "user", text: "   " }], context: ctx }).success, false);
  assert.equal(ChatRequestSchema.safeParse({ messages: [{ role: "system", text: "hi" }], context: ctx }).success, false);
  assert.equal(ChatRequestSchema.safeParse({ messages: [{ role: "user", text: "x".repeat(1001) }], context: ctx }).success, false);
  assert.equal(ChatRequestSchema.safeParse({ messages: [{ role: "user", text: "hi" }], context: { ...ctx, kcalTarget: "lots" } }).success, false);
  assert.equal(ChatRequestSchema.safeParse({ messages: [{ role: "user", text: "hi" }] }).success, false);
  const many = Array.from({ length: 25 }, (_, i) => ({ role: "user" as const, text: `m${i}` }));
  const ok = ChatRequestSchema.parse({ messages: many, context: ctx });
  assert.equal(ok.messages.length, MAX_SENT);
  assert.equal(ok.messages[9].text, "m24");
});

test("answer schema: good, with suggestion, bad suggestion dropped, empty / junk rejected", () => {
  const good = ChatReplySchema.safeParse({ reply: " About 700 kcal. ", suggestion: { name: "Beef bowl", amountText: "1 bowl", kcal: 700, protein: 28, carbs: 95, fat: 22 } });
  assert.ok(good.success);
  assert.equal(good.data.reply, "About 700 kcal.");
  assert.equal(good.data.suggestion?.kcal, 700);
  const noSug = ChatReplySchema.parse({ reply: "Hello" });
  assert.ok(noSug.suggestion == null);
  const badSug = ChatReplySchema.parse({ reply: "Hello", suggestion: { name: "", kcal: 0 } });
  assert.equal(badSug.reply, "Hello");
  assert.equal(badSug.suggestion, null);
  assert.equal(ChatReplySchema.parse({ reply: "x", suggestion: { name: "a", kcal: 99999 } }).suggestion, null);
  assert.equal(ChatReplySchema.parse({ reply: "x", suggestion: { name: "a", kcal: "abc" } }).suggestion, null);
  const partial = ChatReplySchema.parse({ reply: "x", suggestion: { name: "a", amountText: "1", kcal: 200 } });
  assert.equal(partial.suggestion?.protein, undefined);
  for (const bad of [{}, { reply: "" }, { reply: "   " }, { reply: 5 }, null, "text", []]) assert.equal(ChatReplySchema.safeParse(bad).success, false, JSON.stringify(bad));
});

test("amount text: '1 ชาม' splits; words only become one serving with a note", () => {
  assert.deepEqual(splitAmount("1 ชาม", "th"), { amount: 1, unit: "ชาม", note: null });
  assert.deepEqual(splitAmount("1.5 bowls", "en"), { amount: 1.5, unit: "bowls", note: null });
  assert.deepEqual(splitAmount("ชามกลาง", "th"), { amount: 1, unit: "ที่", note: "ชามกลาง" });
  assert.deepEqual(splitAmount("", "en"), { amount: 1, unit: "serving", note: null });
  assert.deepEqual(splitAmount("200", "en"), { amount: 200, unit: "serving", note: null });
});

test("suggestion → one item: an AI estimate, buffer applies, missing nutrients stay unknown", () => {
  const s = { name: "ข้าวหน้าเนื้อ", amountText: "1 ชาม", kcal: 700, protein: 28, carbs: 95, fat: 22 };
  const plain = suggestionToItem(s, "it1", "th", 0);
  assert.equal(plain.estimated, true);
  assert.deepEqual(plain.prov, { source: "ai", verification: "estimated", via: "guess" });
  assert.equal(isEstimated(plain), true);
  assert.equal(itemProvenance(plain).source, "ai");
  assert.equal(plain.kcal, 700);
  assert.equal(plain.missing, undefined);
  assert.equal(plain.kind, "food");
  assert.equal(canBuffer(plain), true);

  const buf = suggestionToItem(s, "it2", "th", 10);
  assert.equal(buf.aiKcal, 700);
  assert.equal(buf.bufferPct, 10);
  assert.equal(buf.kcal, 770);
  assert.equal(buf.protein, 28); // buffer is kcal only
  assert.equal(buf.carbs, 95);
  assert.equal(suggestionToItem(s, "it3", "th", 7).kcal, 700); // not a real choice → 0%

  const partial = suggestionToItem({ name: "ผลไม้", amountText: "1 จาน", kcal: 120, protein: 1, carbs: null }, "it4", "th", 0);
  assert.deepEqual(partial.missing, ["carbs", "fat"]);
  assert.equal(partial.protein, 1);
  assert.equal(partial.carbs, 0);
});

test("backup: the chat is included, and old backups without it still restore and keep the current chat", () => {
  assert.equal(BACKUP_KEYS.chat, "yfd:v1:chat");
  const base = { entries: null, recipes: null, goals: null, body: null, water: null, labelFixes: null, buddy: null, lang: null };
  const b = makeBackup({ ...base, chat: JSON.stringify([{ role: "user", text: "hi" }]) }, {}, 1);
  const res = parseBackup(JSON.stringify(b));
  assert.ok(res.ok);
  assert.equal(res.backup.data.chat, JSON.stringify([{ role: "user", text: "hi" }]));
  // an old file has no "chat" at all
  const old = JSON.parse(JSON.stringify(makeBackup(base, {}, 1)));
  delete old.data.chat;
  const res2 = parseBackup(JSON.stringify(old));
  assert.ok(res2.ok);
  assert.equal(res2.backup.data.chat, null);
  assert.equal(restoreAction("chat", null), "keep");
  assert.equal(restoreAction("chat", "[]"), "set");
  // a damaged chat part is refused (it would break the app after restoring)
  const broken = JSON.parse(JSON.stringify(b));
  broken.data.chat = "{oops";
  assert.equal(parseBackup(JSON.stringify(broken)).ok, false);
});
