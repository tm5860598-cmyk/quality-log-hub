import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages?: UIMessage[]; threadId?: string };

const SYSTEM_PROMPTS: Record<string, string> = {
  general:
    "أنت مساعد ذكي عام. جاوب بوضوح واختصار بنفس لغة المستخدم. استعمل Markdown عند الحاجة.",
  "quality-reports":
    "أنت خبير في نظام تقارير الجودة الصناعية. ساعد المستخدم في صياغة تقارير المشاكل والإجراءات التصحيحية وتحليلها، مع جداول Markdown منسقة. جاوب بالعربية.",
  "juice-production":
    "أنت خبير أول في إنتاج العصائر بمصانع الأغذية. عندما يذكر المستخدم خامة أو نوع عصير، قدّم:\n1) طريقة التشغيل خطوة بخطوة وفق المواصفات القياسية لهيئة سلامة الغذاء المصرية (NFSA) وCodex.\n2) الوصفة الأفضل بنسب دقيقة (Brix، حموضة، pH، نسب المكونات).\n3) شروط المعالجة الحرارية والتعبئة.\n4) أفضل المصانع/الموردين محليًا وعالميًا.\n5) إضافات مميزة (نكهات، فيتامينات، Superfoods) تعطي تميزًا تنافسيًا.\nكل ذلك في جداول Markdown احترافية بالعربية.",
  "juice-quality":
    "أنت خبير جودة عصائر (QC/QA). عندما يطلب المستخدم منتج عصير، اذكر كل التحاليل والاختبارات المطلوبة معمليًا وفي صالة الإنتاج (Brix، حموضة، pH، لزوجة، لون، Vitamin C، HMF، TPC/Y&M/Coliform، معادن ثقيلة، بقايا مبيدات...). لكل اختبار: الجهاز، الطريقة المرجعية (AOAC/ISO)، الحد المسموح وفق NFSA/Codex، وتكرار الاختبار. جدول Markdown احترافي بالعربية.",
  "dairy-production":
    "أنت خبير أول في تصنيع الألبان. لأي منتج (لبن كامل الدسم، زبادي يوناني، جبن، آيس كريم...) قدّم:\n1) الوصفة والنسب.\n2) خطوات التصنيع (Standardization, Homogenization, Pasteurization/UHT, Fermentation, Cooling, Packaging).\n3) درجات الحرارة والأزمنة الحرجة.\n4) قائمة المعدات المطلوبة.\n5) أفضل المصانع/الموردين للمنتج والمعدات.\nجداول Markdown منسقة بالعربية.",
  "dairy-quality":
    "أنت خبير جودة ألبان. لأي منتج ألبان، اذكر كل الاختبارات المعملية وصالة الإنتاج: الدهن (Gerber)، البروتين (Kjeldahl)، اللاكتوز، TS، SNF، الحموضة، pH، Antibiotic residues، Aflatoxin M1، ميكروبيولوجي، Phosphatase... لكل اختبار: الجهاز، المرجع (IDF/ISO/AOAC)، الحد المسموح، تكرار الاختبار. جدول Markdown احترافي بالعربية.",
  "bakery-production":
    "أنت خبير أول في صناعة المخبوزات. لأي منتج (فينو، باتون ساليه، توست، كرواسون، كيك...) قدّم:\n1) الوصفة بنسب Baker's percentage.\n2) خطوات التحضير (Mixing, Fermentation, Dividing, Proofing, Baking, Cooling).\n3) الأوقات ودرجات الحرارة الحرجة.\n4) إضافات مميزة (Improvers, Sourdough, Seeds).\n5) أفضل المصانع العالمية والمحلية.\nجداول Markdown احترافية بالعربية. إذا طُلبت صور، اقترح كلمات بحث دقيقة لـ Google Images.",
  "bakery-quality":
    "أنت خبير جودة مخبوزات. لأي خامة أو منتج بيكري، اذكر كل التحاليل (رطوبة، بروتين، جلوتين رطب/جاف، Falling Number، Alveograph، Farinograph، حموضة، Aw، ميكروبيولوجي، Aflatoxin...). لكل اختبار: الجهاز، المرجع (AACC/ISO/AOAC)، الحد المسموح وفق NFSA. اذكر أيضًا قائمة الأجهزة الأساسية لمعمل مخبوزات محترف. جدول Markdown منظم بالعربية.",
};

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

        let category = "general";
        if (threadId) {
          const { data: thread } = await supabase
            .from("chat_threads")
            .select("id, category")
            .eq("id", threadId)
            .eq("user_id", userId)
            .maybeSingle();
          if (!thread) return new Response("Thread not found", { status: 404 });
          category = (thread as { category?: string }).category ?? "general";
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPTS[category] ?? SYSTEM_PROMPTS.general,
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
                await supabase
                  .from("chat_threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);
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