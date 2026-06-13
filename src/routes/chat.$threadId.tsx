import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThread,
});

function getText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function ChatThread() {
  const { threadId } = Route.useParams();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!cancelled) setToken(s.session?.access_token ?? null);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("message, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) { toast.error(error.message); setInitial([]); return; }
      setInitial((data ?? []).map((r) => r.message as unknown as UIMessage));
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  if (initial === null || token === null) {
    return <div className="flex-1 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }

  return <ChatInner threadId={threadId} initial={initial} token={token} />;
}

function ChatInner({ threadId, initial, token }: { threadId: string; initial: UIMessage[]; token: string }) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => { inputRef.current?.focus(); }, [threadId, status]);

  const isBusy = status === "submitted" || status === "streaming";

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Sparkles className="size-10 mx-auto mb-3 text-primary" />
              <p>ابدأ المحادثة — اسأل عن أي شيء</p>
            </div>
          )}
          {messages.map((m) => {
            const text = getText(m);
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                <div className={`size-8 shrink-0 rounded-full grid place-items-center ${isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-primary to-accent text-primary-foreground"}`}>
                  {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-2">
                      <ReactMarkdown>{text || "..."}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {status === "submitted" && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground"><Sparkles className="size-4" /></div>
              <div className="bg-card border rounded-2xl px-4 py-3 inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="size-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="size-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive text-center">{error.message}</p>}
        </div>
      </div>
      <form onSubmit={submit} className="border-t bg-card p-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="اكتب رسالتك..."
            rows={1}
            className="resize-none min-h-[44px] max-h-40"
            disabled={isBusy}
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={isBusy || !input.trim()}>
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}