import { createFileRoute, Link, Outlet, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, ArrowLeft, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type Thread = { id: string; title: string; updated_at: string; category: string };

export const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  general: { label: "المساعد العام", emoji: "✨" },
  "quality-reports": { label: "تقارير الجودة", emoji: "📋" },
  "juice-production": { label: "إنتاج العصائر", emoji: "🥤" },
  "juice-quality": { label: "جودة العصائر", emoji: "🧪" },
  "dairy-production": { label: "إنتاج الألبان", emoji: "🥛" },
  "dairy-quality": { label: "جودة الألبان", emoji: "🔬" },
  "bakery-production": { label: "إنتاج البيكري", emoji: "🥐" },
  "bakery-quality": { label: "جودة البيكري", emoji: "🧫" },
};

const searchSchema = z.object({ category: z.string().optional() });

export const Route = createFileRoute("/chat")({
  component: ChatLayout,
  validateSearch: (s) => searchSchema.parse(s),
  errorComponent: ({ error }) => (
    <div className="p-6 text-center text-sm text-destructive">{String(error?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
});

function ChatLayout() {
  const { session, ready: authReady } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const search = useSearch({ from: "/chat" }) as { category?: string };
  const activeId = params.threadId;
  const category = search.category && CATEGORIES[search.category] ? search.category : "general";
  const cat = CATEGORIES[category];

  const loadThreads = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, updated_at, category")
      .eq("category", category)
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setThreads((data ?? []) as Thread[]);
  }, [session, category]);

  useEffect(() => { loadThreads(); }, [loadThreads, activeId]);

  const newChat = async () => {
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: session!.user.id, title: "محادثة جديدة", category } as never)
      .select("id").single();
    if (error || !data) { toast.error(error?.message ?? "Error"); return; }
    setOpen(false);
    navigate({ to: "/chat/$threadId", params: { threadId: data.id }, search: { category } });
  };

  const deleteThread = async (id: string) => {
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    setThreads((t) => t.filter((x) => x.id !== id));
    if (activeId === id) navigate({ to: "/chat", search: { category } });
  };

  if (!authReady) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-semibold">سجّل الدخول لاستخدام الشات</h2>
          <Link to="/" className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <ArrowLeft className="size-4" /> الرجوع لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  const Sidebar = (
    <aside className="w-72 shrink-0 border-l bg-card flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Link to="/" className="inline-flex items-center justify-center rounded-md border w-9 h-9 hover:bg-accent" aria-label="Home">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">قسم</div>
            <div className="font-semibold truncate">{cat.emoji} {cat.label}</div>
          </div>
          <button onClick={() => setOpen(false)} className="md:hidden inline-flex items-center justify-center rounded-md border w-9 h-9">
            <X className="size-4" />
          </button>
        </div>
        <Button onClick={newChat} className="w-full gap-2"><Plus className="size-4" /> محادثة جديدة</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.length === 0 && (
          <p className="text-center text-xs text-muted-foreground p-4">لا توجد محادثات في هذا القسم</p>
        )}
        {threads.map((t) => (
          <div key={t.id} className={`group flex items-center gap-1 rounded-md px-2 py-2 hover:bg-accent ${activeId === t.id ? "bg-accent" : ""}`}>
            <Link to="/chat/$threadId" params={{ threadId: t.id }} search={{ category }} onClick={() => setOpen(false)} className="flex-1 flex items-center gap-2 min-w-0 text-sm">
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t.title || "محادثة"}</span>
            </Link>
            <button onClick={() => deleteThread(t.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive" aria-label="delete">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-background to-accent/5" dir="rtl">
      <div className="hidden md:flex">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72">{Sidebar}</div>
        </div>
      )}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 p-3 border-b bg-card">
          <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center rounded-md border w-9 h-9">
            <Menu className="size-4" />
          </button>
          <h1 className="font-semibold">{cat.emoji} {cat.label}</h1>
        </header>
        <Outlet />
      </main>
    </div>
  );
}