import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "./chat";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/chat" }) as { category?: string };
  const category = search.category && CATEGORIES[search.category] ? search.category : "general";
  const cat = CATEGORIES[category];
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
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
        .insert({ user_id: s.session.user.id, title: `محادثة ${cat.label}`, category } as never)
        .select("id").single();
      if (error || !data) { toast.error(error?.message ?? "Error"); return; }
      navigate({ to: "/chat/$threadId", params: { threadId: data.id }, search: { category }, replace: true });
    })();
  }, [category, cat.label, navigate]);

  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="text-center space-y-3 text-muted-foreground">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground">
          <Sparkles className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{cat.emoji} {cat.label}</h2>
        <div className="inline-flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> جاري تحضير المحادثة...</div>
      </div>
    </div>
  );
}