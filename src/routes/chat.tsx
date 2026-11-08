import { createFileRoute, Link, Outlet, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Plus, Trash2, ArrowRight, Menu, X, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useDepartments } from "@/lib/departments";

type Thread = { id: string; title: string; updated_at: string; category: string };

/** Fallback labels; live labels come from the departments table. */
export const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  general: { label: "الدردشة العامة", emoji: "✨" },
};

const searchSchema = z.object({ category: z.string().optional() });

export const Route = createFileRoute("/chat")({
  ssr: false,
  component: ChatLayout,
  validateSearch: (s) => searchSchema.parse(s),
  errorComponent: ({ error }) => (
    <div className="p-6 text-center text-sm text-destructive">{String((error as Error)?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
});

/** WhatsApp-style list time: hour today, "أمس" yesterday, short date otherwise. */
function listTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric", year: "2-digit" });
}

function ChatLayout() {
  const { session, status } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const search = useSearch({ from: "/chat" }) as { category?: string };
  const activeId = params.threadId;
  const { departments } = useDepartments();
  const known = new Set(departments.map((d) => d.key));
  const category = search.category && (known.has(search.category) || CATEGORIES[search.category])
    ? search.category
    : "general";
  const dept = departments.find((d) => d.key === category);
  const cat = dept
    ? { label: dept.title_ar, emoji: dept.emoji }
    : (CATEGORIES[category] ?? { label: "الدردشة", emoji: "💬" });

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

  // The conversation header (mobile) asks the layout to open the chat list.
  useEffect(() => {
    const openList = () => setOpen(true);
    window.addEventListener("wa:open-list", openList);
    return () => window.removeEventListener("wa:open-list", openList);
  }, []);

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

  /** Opens the conversation and prints it as a full report. */
  const printThread = (id: string) => {
    setOpen(false);
    navigate({ to: "/chat/$threadId", params: { threadId: id }, search: { category, print: true } });
  };

  if (status === "loading") {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">...</div>;
  }

  if (status === "unauthenticated" || !session) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-semibold">سجّل الدخول لاستخدام الشات</h2>
          <Link to="/" className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <ArrowRight className="size-4" /> الرجوع لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  const filtered = threads.filter((t) => (t.title || "محادثة").toLowerCase().includes(query.trim().toLowerCase()));

  const Sidebar = (
    <aside className="wa-list">
      <div className="wa-list-head">
        <Link to="/" className="wa-icon-btn" aria-label="الرئيسية">
          <ArrowRight className="size-5" />
        </Link>
        <div className="wa-avatar">{cat.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="wa-title">{cat.label}</div>
          <div className="wa-sub">{threads.length} محادثة</div>
        </div>
        <button type="button" onClick={newChat} className="wa-icon-btn" title="محادثة جديدة" aria-label="محادثة جديدة">
          <Plus className="size-5" />
        </button>
        <button type="button" onClick={() => setOpen(false)} className="wa-icon-btn md:hidden" aria-label="إغلاق">
          <X className="size-5" />
        </button>
      </div>
      <div className="wa-search">
        <Search className="size-4 shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في المحادثات" aria-label="ابحث في المحادثات" />
      </div>
      <div className="wa-list-body">
        {filtered.length === 0 && (
          <p className="text-center text-xs p-6" style={{ color: "var(--wa-muted)" }}>
            {threads.length === 0 ? "لا توجد محادثات في هذا القسم" : "لا نتائج مطابقة"}
          </p>
        )}
        {filtered.map((t) => (
          <div key={t.id} className={`wa-row ${activeId === t.id ? "active" : ""}`}>
            <Link to="/chat/$threadId" params={{ threadId: t.id }} search={{ category }} onClick={() => setOpen(false)} className="wa-row-main">
              <div className="wa-avatar">{cat.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="wa-row-top">
                  <span className="wa-row-title">{t.title || "محادثة"}</span>
                  <span className="wa-row-time">{listTime(t.updated_at)}</span>
                </div>
                <div className="wa-row-sub">{cat.label}</div>
              </div>
            </Link>
            <div className="wa-row-actions">
              <button type="button" onClick={() => printThread(t.id)} className="wa-icon-btn" title="طباعة المحادثة" aria-label="طباعة المحادثة">
                <Printer className="size-4" />
              </button>
              <button type="button" onClick={() => deleteThread(t.id)} className="wa-icon-btn wa-danger" title="حذف المحادثة" aria-label="حذف المحادثة">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );

  return (
    <div className="wa-scope wa-app flex h-dvh" dir="rtl">
      <div className="hidden md:block w-[22rem] shrink-0">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[22rem] max-w-[90vw]">{Sidebar}</div>
        </div>
      )}
      <main className="wa-main">
        {!activeId && (
          <header className="wa-header md:hidden">
            <button type="button" onClick={() => setOpen(true)} className="wa-icon-btn" aria-label="المحادثات">
              <Menu className="size-5" />
            </button>
            <div className="wa-avatar">{cat.emoji}</div>
            <div className="wa-title">{cat.label}</div>
          </header>
        )}
        <Outlet />
      </main>
    </div>
  );
}
