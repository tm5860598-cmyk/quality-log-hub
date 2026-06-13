import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages?: UIMessage[]; threadId?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, threadId } = (await request.json()) as Body;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        if (threadId) {
          const { data: thread } = await supabase
            .from("chat_threads").select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
          if (!thread) return new Response("Thread not found", { status: 404 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system:
            "You are a helpful, knowledgeable AI assistant. Answer clearly and concisely. Reply in the same language as the user (Arabic or English). Use markdown when helpful.",
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ messages: finalMessages }) => {
            if (!threadId) return;
            try {
              const last = finalMessages[finalMessages.length - 1];
              const userMsg = finalMessages[finalMessages.length - 2];
              const inserts: Array<{ thread_id: string; user_id: string; message: unknown }> = [];
              if (userMsg && userMsg.role === "user") {
                inserts.push({ thread_id: threadId, user_id: userId, message: userMsg });
              }
              if (last && last.role === "assistant") {
                inserts.push({ thread_id: threadId, user_id: userId, message: last });
              }
              if (inserts.length) {
                await supabase.from("chat_messages").insert(inserts);
                await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
              }
            } catch (e) {
              console.error("persist chat error", e);
            }
          },
        });
      },
    },
  },
});