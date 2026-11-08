import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "./chat";
import { useDepartments } from "@/lib/departments";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/chat" }) as { category?: string };
  const { departments } = useDepartments();
  const known = new Set(departments.map((d) => d.key));
  const category = search.category && (known.has(search.category) || CATEGORIES[search.category])
    ? search.category
    : "general";
  const dept = departments.find((d) => d.key === category);
  const cat = dept
    ? { label: dept.title_ar, emoji: dept.emoji }
    : (CATEGORIES[category] ?? { label: "الدردشة", emoji: "💬" });
  const { session, status } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("category", category)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (existing && existing.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: existing[0].id }, search: { category }, replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: session.user.id, title: `محادثة ${cat.label}`, category } as never)
        .select("id").single();
      if (error || !data) { toast.error(error?.message ?? "Error"); return; }
      navigate({ to: "/chat/$threadId", params: { threadId: data.id }, search: { category }, replace: true });
    })();
  }, [category, cat.label, navigate, status, session]);

  return (
    <div className="wa-wallpaper flex-1 grid place-items-center p-8">
      <div className="text-center space-y-3" style={{ color: "var(--wa-muted)" }}>
        <div className="wa-avatar mx-auto !size-16 !text-3xl">
          <Sparkles className="size-8" />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--wa-text)" }}>{cat.emoji} {cat.label}</h2>
        <div className="inline-flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> جاري تحضير المحادثة...</div>
      </div>
    </div>
  );
}