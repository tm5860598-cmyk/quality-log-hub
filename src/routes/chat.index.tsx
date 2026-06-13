import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Plus } from "lucide-react";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground">
          <Sparkles className="size-8" />
        </div>
        <h2 className="text-2xl font-bold">المساعد الذكي</h2>
        <p className="text-muted-foreground">اسأل عن أي شيء — تقارير، أفكار، شرح، ترجمة، أو أي موضوع آخر.</p>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
          ابدأ بالضغط على <Plus className="size-4" /> محادثة جديدة
        </p>
      </div>
    </div>
  );
}