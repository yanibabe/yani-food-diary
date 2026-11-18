"use client";
// Round 54: "ask before eating". A chat with the AI, used BEFORE eating. Nothing is logged unless she taps
// "Add to my day" on a suggestion and saves in the review step. The layer itself (history, review) is owned by ChatFab.

import { CharacterPicture } from "./Character";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiFetch } from "../lib/aiFetch";
import { buildChatContext, cleanSuggestions, cleanQuickReplies, buildChatRequest, CHAT_EXAMPLES, CHAT_PRIVACY, toggleInfo, CHAT_KEY, MAX_TEXT, parseChat, serializeChat, type ChatMsg, type Suggestion } from "../lib/foodChat";
import { thaiDateKey } from "../lib/date";
import { validWeight } from "../lib/body";
import { macroTargets, proteinTargetG } from "../lib/energy";
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
  const [infoOpen, setInfoOpen] = useState(false);
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
      const mt = macroTargets(goals.targetKcal, proteinTargetG(goals.profile, goals.targetKcal)); // the same targets the Today tiles use
      const ctx = buildChatContext({ lang, targetKcal: goals.targetKcal, proteinTarget: proteinTargetG(goals.profile, goals.targetKcal),
        carbsTarget: mt.carbs,
        fatTarget: mt.fat,
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
      // Round 57: several cards + tap-to-send chips. (An older server answer with one `suggestion` still reads.)
      const cards = cleanSuggestions([...(Array.isArray(data.suggestions) ? data.suggestions : []), ...(data.suggestion ? [data.suggestion] : [])]);
      if (cards.length) reply.suggestions = cards;
      const chips = cleanQuickReplies(data.quickReplies);
      if (chips.length) reply.quickReplies = chips;
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
  return (
    <>
    {/* Round 72: a tall cover behind the chat. When the iPhone keyboard opens, iOS scrolls the page and the
        visual-viewport size arrives late; without this the Today page peeked through between the input and the keyboard. */}
    <div className="add-layer fixed inset-x-0 z-[44]" style={{ top: "-50vh", height: "200vh" }} aria-hidden data-testid="chat-cover" />
    <div
      className="add-layer fixed inset-x-0 z-[45] flex flex-col"
      style={vv ? { top: vv.top, height: vv.height } : { top: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={tr("ถามผู้ช่วย", "Ask AI")}
      data-testid="food-chat"
    >
      <header className="mx-auto flex w-full max-w-[560px] shrink-0 items-center gap-2 px-4 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper" onClick={onBack} aria-label={tr("กลับ", "Back")} data-testid="chat-back">
          <Icon name="caret-left" className="h-5 w-5" />
        </button>
        <CharacterPicture size={30} />
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold">{tr("ถามผู้ช่วย", "Ask AI")}</h1>
        {msgs.length > 0 && (
          <button className="shrink-0 rounded-full bg-white/60 px-3 py-1.5 text-[12.5px] text-muted" onClick={() => setConfirmNew(true)} data-testid="chat-new">
            {tr("เริ่มใหม่", "New chat")}
          </button>
        )}
        <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/60 text-muted" onClick={() => setInfoOpen(toggleInfo)} aria-label={tr("ข้อมูลความเป็นส่วนตัว", "Privacy info")} aria-expanded={infoOpen} data-testid="chat-info">
          <Icon name="info" className="h-5 w-5" />
        </button>
      </header>

      {infoOpen && (
        <>
          <div className="fixed inset-0 z-0" onClick={() => setInfoOpen(false)} aria-hidden data-testid="chat-info-backdrop" />
          <div className="relative z-10 mx-auto w-full max-w-[560px] px-4 pb-2">
            <p className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-[13px] text-muted" role="note" data-testid="chat-sees">
              {tr(CHAT_PRIVACY.th, CHAT_PRIVACY.en)}
            </p>
          </div>
        </>
      )}

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
            <div className="space-y-4 pt-6" data-testid="chat-empty">
              <div className="space-y-1.5">
                <h2 className="text-[22px] font-semibold leading-snug">{tr("อยากกินอะไรวันนี้?", "What are you in the mood to eat?")}</h2>
                <p className="text-[14.5px] text-muted">{tr("ถามแคลอรี่ ขอไอเดียมื้ออาหาร หรือปรึกษาเรื่องกินได้เลย", "Ask about calories, get meal ideas, or talk through what to eat.")}</p>
              </div>
              <div className="space-y-2">
                {CHAT_EXAMPLES.map((x) => (
                  <button key={x.icon} className="flex w-full items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3 text-left text-[15px]" onClick={() => send(tr(x.th, x.en))} data-testid="chat-example">
                    <Icon name={x.icon} className="h-5 w-5 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">{tr(x.th, x.en)}</span>
                  </button>
                ))}
              </div>
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
                {(m.suggestions ?? (m.suggestion ? [m.suggestion] : [])).map((sg, i) => (
                  <div key={`${sg.name}-${i}`} className="w-full max-w-[88%] rounded-2xl border border-white/80 bg-white/45 px-4 py-3 text-[14px]" data-testid="chat-suggestion">
                    <div className="font-medium">
                      {sg.name}
                      {sg.amountText ? <span className="text-muted"> · {sg.amountText}</span> : null}
                    </div>
                    <div className="mt-0.5 text-muted">
                      {tr("ประมาณ", "About")} <span className="num">{Math.round(sg.kcal)}</span> kcal
                      {[
                        sg.protein != null ? `${tr("โปรตีน", "protein")} ${Math.round(sg.protein)} g` : null,
                        sg.carbs != null ? `${tr("คาร์บ", "carbs")} ${Math.round(sg.carbs)} g` : null,
                        sg.fat != null ? `${tr("ไขมัน", "fat")} ${Math.round(sg.fat)} g` : null,
                      ]
                        .filter(Boolean)
                        .map((x) => ` · ${x}`)
                        .join("")}
                    </div>
                    <button className="btn-soft mt-2 w-full" onClick={() => onAdd(sg)} data-testid="chat-add">
                      {tr("เพิ่มลงบันทึก", "Add to my day")}
                    </button>
                  </div>
                ))}
                {m === last && !loading && m.quickReplies && m.quickReplies.length > 0 && (
                  <div className="flex max-w-full flex-wrap gap-2" data-testid="chat-chips">
                    {m.quickReplies.map((q) => (
                      <button key={q} className="rounded-full border border-white/80 bg-white/60 px-3.5 py-2 text-[14px] leading-tight" onClick={() => send(q)} data-testid="chat-chip">
                        {q}
                      </button>
                    ))}
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
            placeholder={tr("พิมพ์ถามได้เลย", "Ask anything")}
            aria-label={tr("ข้อความ", "Message")}
            data-testid="chat-input"
          />
          <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40" disabled={!text.trim() || loading} aria-label={tr("ส่ง", "Send")} data-testid="chat-send">
            <Icon name="arrow-up" className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
    </>
  );
}
