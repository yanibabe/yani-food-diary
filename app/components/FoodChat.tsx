"use client";
// Round 54: "ask before eating". A chat with the AI, used BEFORE eating. Nothing is logged unless she taps
// "Add to my day" on a suggestion and saves in the review step. The layer itself (history, review) is owned by ChatFab.

import { useEffect, useMemo, useRef, useState } from "react";
import { aiFetch } from "../lib/aiFetch";
import { buildChatContext, cleanSuggestion, buildChatRequest, CHAT_KEY, MAX_TEXT, parseChat, serializeChat, type ChatMsg, type Suggestion } from "../lib/foodChat";
import { thaiDateKey } from "../lib/date";
import { validWeight } from "../lib/body";
import { proteinTargetG } from "../lib/energy";
import { useLang } from "../lib/lang";
import { newId, pickMacros, sumMacros } from "../lib/nutrition";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";

function latestWeight(logs: { date: string; weightKg: number | null }[], today: string): number | null {
  const l = logs.filter((x) => x.date <= today && validWeight(x.weightKg)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return l ? (l.weightKg as number) : null;
}

export function FoodChat({ onBack, onAdd }: { onBack: () => void; onAdd: (s: Suggestion) => void }) {
  const { tr, lang } = useLang();
  const { entries, goals, bodyLogs } = useStore();
  // The current conversation lives on this phone (last ~30 messages).
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => {
    try {
      return parseChat(localStorage.getItem(CHAT_KEY));
    } catch {
      return [];
    }
  });
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const msgsRef = useRef(msgs); // only save() changes the list, and it updates this too

  // Keep the whole layer inside the part of the screen the phone keyboard does not cover.
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setVv({ top: v.offsetTop, height: v.height });
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
    };
  }, []);

  function save(next: ChatMsg[]) {
    msgsRef.current = next;
    setMsgs(next);
    try {
      if (next.length) localStorage.setItem(CHAT_KEY, serializeChat(next));
      else localStorage.removeItem(CHAT_KEY);
    } catch {
      /* the chat still works, it just is not remembered */
    }
  }

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, loading, error, vv?.height]);

  // Today so far: numbers only. Computed fresh each time she sends.
  const today = thaiDateKey();
  const todayItems = useMemo(() => entries.filter((e) => e.date === today).flatMap((e) => e.items), [entries, today]);
  const eaten = useMemo(() => sumMacros(todayItems.map(pickMacros)), [todayItems]);

  async function ask(list: ChatMsg[]) {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const p = goals.profile;
      const ctx = buildChatContext({ lang, targetKcal: goals.targetKcal, proteinTarget: proteinTargetG(goals.profile),
        eaten,
        age: p?.age,
        sex: p?.sex,
        heightCm: p?.heightCm,
        weightKg: latestWeight(bodyLogs, today) ?? p?.weightKg,
        goal: p?.reason,
        avoidDairy: goals.avoidDairy === true,
        todayFoods: todayItems.map((i) => ({ name: i.name, kcal: i.kcal })),
      });
      const res = await aiFetch("/api/chat", buildChatRequest(list, ctx), lang);
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.reply !== "string" || !data.reply.trim()) {
        setError(data?.message ?? `${tr("เซิร์ฟเวอร์ตอบกลับ", "Server replied")} ${res.status}`);
        return;
      }
      const reply: ChatMsg = { id: newId("cm"), role: "assistant", text: data.reply };
      if (data.suggestion && typeof data.suggestion === "object") {
        const s = cleanSuggestion(data.suggestion);
        if (s) reply.suggestion = s;
      }
      save([...msgsRef.current, reply]);
    } catch (e) {
      setError(`${tr("เชื่อมต่อไม่ได้", "Couldn't connect")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  function send(raw: string) {
    const t = raw.trim().slice(0, MAX_TEXT);
    if (!t || busyRef.current) return;
    const next = [...msgsRef.current, { id: newId("cm"), role: "user" as const, text: t }];
    save(next);
    setText("");
    void ask(next);
  }

  function newChat() {
    save([]);
    setError(null);
    setConfirmNew(false);
    setText("");
  }

  const last = msgs[msgs.length - 1];
  const waitingForAnswer = !loading && !error && last?.role === "user"; // e.g. she closed the chat before the answer came
  const examples = [
    tr("ข้าวหน้าเนื้อกี่แคล กินดีไหม", "How many calories in a beef rice bowl? Is it OK to eat?"),
    tr("วันนี้ควรกินอะไรเพิ่ม", "What should I eat more of today?"),
    tr("เหลืออีกเท่าไหร่ กินอะไรดี", "How much is left today? What should I eat?"),
  ];

  return (
    <div
      className="add-layer fixed inset-x-0 z-[45] flex flex-col"
      style={vv ? { top: vv.top, height: vv.height } : { top: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={tr("ถามก่อนกิน", "Ask before eating")}
      data-testid="food-chat"
    >
      <header className="mx-auto flex w-full max-w-[560px] shrink-0 items-center gap-2 px-4 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper" onClick={onBack} aria-label={tr("กลับ", "Back")} data-testid="chat-back">
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold">{tr("ถามก่อนกิน", "Ask before eating")}</h1>
        <button className="shrink-0 rounded-full bg-white/60 px-3 py-2 text-[13px] text-muted disabled:opacity-40" onClick={() => (msgs.length ? setConfirmNew(true) : newChat())} disabled={!msgs.length && !text} data-testid="chat-new">
          {tr("เริ่มใหม่", "New chat")}
        </button>
      </header>

      {confirmNew && (
        <div className="mx-auto mb-2 flex w-full max-w-[560px] items-center gap-2 px-4 text-[14px]" data-testid="chat-new-confirm">
          <span className="flex-1 text-muted">{tr("ล้างบทสนทนานี้และเริ่มใหม่?", "Clear this chat and start over?")}</span>
          <button className="rounded-full bg-white/70 px-3 py-2" onClick={() => setConfirmNew(false)}>
            {tr("ยกเลิก", "Cancel")}
          </button>
          <button className="rounded-full bg-ink px-3 py-2 text-white" onClick={newChat} data-testid="chat-new-yes">
            {tr("เริ่มใหม่", "Start over")}
          </button>
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="chat-list">
        <div className="mx-auto w-full max-w-[560px] space-y-3 px-4 py-2">
          {msgs.length === 0 && (
            <div className="space-y-3 pt-4" data-testid="chat-empty">
              <p className="text-[15px] text-muted">
                {tr("ถามก่อนกินได้เลย เช่น อยากกินอะไร กี่แคล กินดีไหม ยังไม่บันทึกอะไรจนกว่าจะกดเพิ่มเอง", "Ask before you eat: what you want, how many calories, is it OK. Nothing is saved until you choose to add it.")}
              </p>
              <p className="text-[12.5px] text-muted" data-testid="chat-sees">
                {tr(
                  "AI เห็น: อายุ น้ำหนัก ส่วนสูง เป้า และสิ่งที่กินวันนี้ (ไม่ส่งชื่อ รูป หรือประวัติเก่า)",
                  "AI sees: age, weight, height, targets and what you ate today (not your name, photos or older history)",
                )}
              </p>
              {examples.map((q) => (
                <button key={q} className="block w-full rounded-2xl border border-white/80 bg-white/55 px-4 py-3 text-left text-[15px]" onClick={() => send(q)} data-testid="chat-example">
                  {q}
                </button>
              ))}
            </div>
          )}

          {msgs.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white" data-testid="chat-user">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col items-start gap-2">
                <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-[20px] rounded-bl-md border border-white/80 bg-white/60 px-4 py-2.5 text-[15px]" data-testid="chat-ai">
                  {m.text}
                </div>
                {m.suggestion && (
                  <div className="max-w-[88%] rounded-2xl border border-white/80 bg-white/45 px-4 py-3 text-[14px]" data-testid="chat-suggestion">
                    <div className="font-medium">
                      {m.suggestion.name}
                      {m.suggestion.amountText ? <span className="text-muted"> · {m.suggestion.amountText}</span> : null}
                    </div>
                    <div className="mt-0.5 text-muted">
                      {tr("ประมาณ", "About")} <span className="num">{Math.round(m.suggestion.kcal)}</span> kcal
                      {[
                        m.suggestion.protein != null ? `${tr("โปรตีน", "protein")} ${Math.round(m.suggestion.protein)} g` : null,
                        m.suggestion.carbs != null ? `${tr("คาร์บ", "carbs")} ${Math.round(m.suggestion.carbs)} g` : null,
                        m.suggestion.fat != null ? `${tr("ไขมัน", "fat")} ${Math.round(m.suggestion.fat)} g` : null,
                      ]
                        .filter(Boolean)
                        .map((x) => ` · ${x}`)
                        .join("")}
                    </div>
                    <button className="btn-soft mt-2 w-full" onClick={() => onAdd(m.suggestion!)} data-testid="chat-add">
                      {tr("เพิ่มลงบันทึก", "Add to my day")}
                    </button>
                  </div>
                )}
              </div>
            ),
          )}

          {loading && (
            <div className="flex items-center gap-2 text-[14px] text-muted" role="status" data-testid="chat-loading">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden />
              {tr("กำลังคิด…", "Thinking…")}
            </div>
          )}
          {(error || waitingForAnswer) && (
            <div className="rounded-2xl bg-[#f6e1dc] px-4 py-3 text-[14px] text-danger" role="alert" data-testid="chat-error">
              <p>{error ?? tr("ยังไม่ได้คำตอบ ลองอีกครั้งนะ", "No answer yet. Please try again.")}</p>
              <button className="mt-2 rounded-full bg-white/80 px-4 py-2 text-ink" onClick={() => void ask(msgsRef.current)} data-testid="chat-retry">
                {tr("ลองอีกครั้ง", "Try again")}
              </button>
            </div>
          )}
        </div>
      </div>

      <form
        className="shrink-0 border-t border-white/70 bg-[rgba(250,246,240,0.85)]"
        style={{ paddingBottom: vv && typeof window !== "undefined" && vv.height < window.innerHeight - 120 ? 8 : "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="mx-auto flex w-full max-w-[560px] items-end gap-2 px-4 pt-2">
          <textarea
            className="field max-h-[120px] min-h-[48px] flex-1 resize-none text-[16px]"
            rows={1}
            value={text}
            maxLength={MAX_TEXT}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia?.("(hover: hover)").matches) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={tr("พิมพ์ถามได้เลย เช่น ข้าวหน้าเนื้อกี่แคล", "Ask anything, e.g. calories in a beef rice bowl")}
            aria-label={tr("ข้อความ", "Message")}
            data-testid="chat-input"
          />
          <button className="btn-primary h-12 shrink-0 px-5" disabled={!text.trim() || loading} data-testid="chat-send">
            {tr("ส่ง", "Send")}
          </button>
        </div>
        {msgs.length > 0 && (
          <p className="mx-auto max-w-[560px] px-4 pt-1.5 text-[11.5px] text-muted">
            {tr("AI เห็น: อายุ น้ำหนัก ส่วนสูง เป้า และสิ่งที่กินวันนี้ (ไม่ส่งชื่อ รูป หรือประวัติเก่า)", "AI sees: age, weight, height, targets and what you ate today (not your name, photos or older history)")}
          </p>
        )}
      </form>
    </div>
  );
}
