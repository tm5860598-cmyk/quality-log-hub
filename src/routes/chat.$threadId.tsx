import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Send, Loader2, Printer, Menu, CheckCheck } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { PrintReport } from "@/components/PrintReport";
import { openPrintWindow, printReport } from "@/lib/print-frame";
import { printScope } from "@/lib/chat-print";
import { useCategoryLabel, useDepartment } from "@/lib/departments";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThread,
  validateSearch: (s: Record<string, unknown>) => ({
    category: typeof s.category === "string" ? s.category : undefined,
    print: s.print === true || s.print === "true" || s.print === 1 || s.print === "1" ? (true as const) : undefined,
  }),
  head: () => ({ meta: [
    { title: "الدردشة والتقارير | My Favourite Project" },
    { name: "description", content: "محادثات الأقسام وتقاريرها القابلة للطباعة." },
    { property: "og:title", content: "الدردشة والتقارير | My Favourite Project" },
    { property: "og:description", content: "محادثات الأقسام وتقاريرها القابلة للطباعة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

/* ------------------------------- helpers -------------------------------- */

function getText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

const fmtTime = (d: Date) => d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (d: Date) => d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function dayLabel(d: Date) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "اليوم";
  if (sameDay(d, yesterday)) return "أمس";
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

type Exchange = { id: string; question?: UIMessage; answers: UIMessage[] };

/** Groups a flat message list into question → answer(s) exchanges. */
function groupExchanges(msgs: UIMessage[]): Exchange[] {
  const out: Exchange[] = [];
  for (const m of msgs) {
    if (m.role === "user") out.push({ id: m.id, question: m, answers: [] });
    else if (m.role === "assistant") {
      const last = out[out.length - 1];
      if (last) last.answers.push(m);
      else out.push({ id: m.id, answers: [m] });
    }
  }
  return out;
}

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm;

/* ------------------------------ route shell ------------------------------ */

function ChatThread() {
  const { threadId } = Route.useParams();
  const { category, print } = Route.useSearch();
  const [loaded, setLoaded] = useState<{ messages: UIMessage[]; times: Record<string, string> } | null>(null);
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    (async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("message, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) { toast.error(error.message); setLoaded({ messages: [], times: {} }); return; }
      const messages = (data ?? []).map((r) => r.message as unknown as UIMessage);
      const times: Record<string, string> = {};
      (data ?? []).forEach((r, i) => { if (messages[i]?.id && r.created_at) times[messages[i].id] = r.created_at as string; });
      setLoaded({ messages, times });
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  if (loaded === null || token === null) {
    return <div className="wa-wallpaper flex-1 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }

  return (
    <ChatInner
      key={threadId}
      threadId={threadId}
      initial={loaded.messages}
      initialTimes={loaded.times}
      token={token}
      category={category}
      autoPrint={print === true}
    />
  );
}

/* ------------------------------ conversation ----------------------------- */

function ChatInner({ threadId, initial, initialTimes, token, category, autoPrint }: {
  threadId: string;
  initial: UIMessage[];
  initialTimes: Record<string, string>;
  token: string;
  category?: string;
  autoPrint: boolean;
}) {
  const navigate = useNavigate();
  const transport = new DefaultChatTransport({
    api: "/api/chat",
    headers: { Authorization: `Bearer ${token}` },
    body: { threadId },
  });
  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message),
  });
  const [input, setInput] = useState("");
  const [printIds, setPrintIds] = useState<Set<string> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timesRef = useRef<Map<string, Date>>(new Map(Object.entries(initialTimes).map(([id, iso]) => [id, new Date(iso)])));
  const autoPrinted = useRef(false);

  const isBusy = status === "submitted" || status === "streaming";
  const latest = useRef({ count: messages.length, busy: isBusy });
  latest.current = { count: messages.length, busy: isBusy };

  const { dept } = useDepartment(category);
  const deptLabel = useCategoryLabel(category) || "الدردشة";
  const avatar = dept?.emoji ?? "💬";

  /** Message time: stored time for loaded messages, "first seen" for new ones. */
  const timeOf = (id: string) => {
    let d = timesRef.current.get(id);
    if (!d) { d = new Date(); timesRef.current.set(id, d); }
    return d;
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => { inputRef.current?.focus(); }, [threadId, status]);
  useEffect(() => { if (!input && inputRef.current) inputRef.current.style.height = "auto"; }, [input]);

  /** Prints the whole thread (ids = null) or only the given messages. */
  const runPrint = useCallback(async (ids: Set<string> | null) => {
    if (latest.current.busy) { toast.info("انتظر حتى تنتهي الإجابة ثم اطبع"); return; }
    if (latest.current.count === 0) { toast.info("لا توجد رسائل للطباعة في هذه المحادثة"); return; }
    const popup = openPrintWindow(); // phones: needs the click gesture, so before any wait
    setPrintIds(ids);
    // Let the print layout mount, then wait for fonts and the company logo.
    await new Promise((r) => setTimeout(r, 450));
    try { await document.fonts?.ready; } catch { /* ignore */ }
    await printReport(popup);
    // Keep the chosen scope: some browsers still print the page itself after this returns.
  }, []);

  // Opened from the conversation list with ?print=1 → print once, then clean the URL.
  useEffect(() => {
    if (!autoPrint) { autoPrinted.current = false; return; }
    if (autoPrinted.current) return;
    autoPrinted.current = true;
    void runPrint(null).finally(() => {
      void navigate({ to: "/chat/$threadId", params: { threadId }, search: { category }, replace: true });
    });
  }, [autoPrint, runPrint, navigate, threadId, category]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    // Auto-title with first message
    if (messages.length === 0) {
      await supabase.from("chat_threads").update({ title: text.slice(0, 60) }).eq("id", threadId);
    }
    await sendMessage({ text });
  };

  const printSingle = (answerId: string) => void runPrint(printScope(messages, answerId));

  /* ------------------------------- print data ------------------------------ */
  const printMessages = printIds ? messages.filter((m) => printIds.has(m.id)) : messages;
  const exchanges = groupExchanges(printMessages);
  const firstQuestion = getText(printMessages.find((m) => m.role === "user") ?? ({ parts: [] } as unknown as UIMessage)).trim();
  const reportTitle = firstQuestion.slice(0, 80);
  const answerText = exchanges.flatMap((e) => e.answers.map(getText)).join("\n");
  const stats = {
    questions: exchanges.filter((e) => e.question).length,
    answers: exchanges.reduce((n, e) => n + e.answers.filter((a) => getText(a).trim()).length, 0),
    tables: (answerText.match(TABLE_SEPARATOR) ?? []).length,
    sections: (answerText.match(/^##\s+/gm) ?? []).length,
  };
  const firstAt = printMessages[0] ? timeOf(printMessages[0].id) : null;
  const lastAt = printMessages.length ? timeOf(printMessages[printMessages.length - 1].id) : null;
  const printMeta = [
    { label: "نطاق الطباعة", value: printIds ? "سؤال وإجابة محددة" : "المحادثة كاملة" },
    { label: "بداية المحادثة", value: firstAt ? fmtDateTime(firstAt) : "—" },
    { label: "آخر رسالة", value: lastAt ? fmtDateTime(lastAt) : "—" },
  ];

  return (
    <div className="wa-main">
      {/* Standalone A4 report layout (printed only; skipped while an answer streams). */}
      <PrintReport
        title={printIds ? "تقرير سؤال وإجابة" : "تقرير المحادثة"}
        department={deptLabel}
        product={reportTitle || undefined}
        reportNumber={`CHT-${threadId.slice(0, 8).toUpperCase()}`}
        meta={printMeta}
      >
        {!isBusy && (
          <>
            <div className="print-chat-summary">
              <div className="print-stat"><strong>{stats.questions}</strong><span>الأسئلة</span></div>
              <div className="print-stat"><strong>{stats.answers}</strong><span>الردود</span></div>
              <div className="print-stat"><strong>{stats.tables}</strong><span>الجداول</span></div>
              <div className="print-stat"><strong>{stats.sections}</strong><span>الأقسام</span></div>
            </div>

            {exchanges.length > 1 && (
              <div className="print-toc">
                <div className="print-toc-title">فهرس الأسئلة</div>
                <ol>
                  {exchanges.map((ex) => (
                    <li key={`toc-${ex.id}`}>{(ex.question ? getText(ex.question) : "—").replace(/\s+/g, " ").slice(0, 100)}</li>
                  ))}
                </ol>
              </div>
            )}

            {exchanges.map((ex, i) => (
              <div key={`ex-${ex.id}`} className="print-exchange">
                {ex.question && (
                  <div className="print-q">
                    <div className="print-q-head">
                      <span className="print-chip">سؤال {i + 1}</span>
                      <span className="print-time">{fmtDateTime(timeOf(ex.question.id))}</span>
                    </div>
                    <p className="print-q-text">{getText(ex.question)}</p>
                  </div>
                )}
                {ex.answers.filter((a) => getText(a).trim()).map((a) => (
                  <div key={`pa-${a.id}`} className="print-a">
                    <div className="print-a-head">
                      <span className="print-chip is-answer">الإجابة</span>
                      <span className="print-time">{fmtDateTime(timeOf(a.id))}</span>
                    </div>
                    <MarkdownView cards structured>{getText(a)}</MarkdownView>
                  </div>
                ))}
              </div>
            ))}

            <div className="print-approvals">
              <div><b>إعداد</b>الاسم: <br />التوقيع: <br />التاريخ:</div>
              <div><b>مراجعة</b>الاسم: <br />التوقيع: <br />التاريخ:</div>
              <div><b>اعتماد</b>الاسم: <br />التوقيع: <br />التاريخ:</div>
            </div>
          </>
        )}
      </PrintReport>

      <header className="wa-header print:hidden">
        <button type="button" className="wa-icon-btn md:hidden" aria-label="المحادثات" onClick={() => window.dispatchEvent(new Event("wa:open-list"))}>
          <Menu className="size-5" />
        </button>
        <div className="wa-avatar">{avatar}</div>
        <div className="min-w-0 flex-1">
          <div className="wa-title">{deptLabel}</div>
          <div className="wa-sub">{isBusy ? "يكتب الآن..." : "💾 تُحفظ تلقائيًا"}</div>
        </div>
        <button type="button" className="wa-print-btn" onClick={() => void runPrint(null)} disabled={isBusy || messages.length === 0} title="طباعة المحادثة كتقرير">
          <Printer className="size-4" />
          <span className="hidden sm:inline">طباعة المحادثة</span>
        </button>
      </header>

      <div ref={scrollRef} className="wa-wallpaper wa-scroll print:hidden">
        <div className="wa-thread">
          <div className="wa-notice">🔒 تُحفظ هذه المحادثة في قاعدة بياناتك، ويمكن طباعتها كتقرير رسمي بهوية الشركة.</div>
          {messages.length === 0 && (
            <div className="wa-day">ابدأ المحادثة — اسأل عن أي شيء</div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const text = getText(m);
            const at = timeOf(m.id);
            const prev = messages[i - 1];
            const showDay = !prev || !sameDay(timeOf(prev.id), at);
            const first = showDay || !prev || prev.role !== m.role;
            return (
              <Fragment key={m.id}>
                {showDay && <div className="wa-day">{dayLabel(at)}</div>}
                <div className={`wa-msg ${isUser ? "out" : "in"} ${first ? "first" : "grouped"}`}>
                  <div className={`wa-bubble ${isUser ? "out" : "in"} ${first ? "tail" : ""}`}>
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{text}</p>
                    ) : (
                      <MarkdownView cards>{text || "..."}</MarkdownView>
                    )}
                    <div className="wa-meta">
                      {!isUser && text && (
                        <button type="button" className="wa-mini-btn" onClick={() => printSingle(m.id)} title="طباعة هذا السؤال والإجابة" aria-label="طباعة هذا السؤال والإجابة">
                          <Printer className="size-3.5" />
                        </button>
                      )}
                      <span>{fmtTime(at)}</span>
                      {isUser && <CheckCheck className="size-4 wa-tick" />}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
          {status === "submitted" && (
            <div className="wa-msg in first">
              <div className="wa-bubble in tail">
                <span className="inline-flex items-center gap-1 py-1">
                  <span className="size-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
          {error && <div className="wa-day" style={{ color: "#ef4444" }}>{error.message}</div>}
        </div>
      </div>

      <form onSubmit={submit} className="wa-composer print:hidden">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
          }}
          placeholder="اكتب رسالتك..."
          rows={1}
          className="wa-input"
          disabled={isBusy}
        />
        <button type="submit" className="wa-send" disabled={isBusy || !input.trim()} aria-label="إرسال">
          {isBusy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5 -scale-x-100" />}
        </button>
      </form>
    </div>
  );
}
