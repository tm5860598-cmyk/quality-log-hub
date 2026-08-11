import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages?: UIMessage[]; threadId?: string };

const SYSTEM_PROMPTS: Record<string, string> = {
  general:
    "أنت مساعد المهندس طارق الشخصي. خاطبه دائمًا بـ (المهندس طارق). جاوب بوضوح واختصار بنفس لغته. استعمل Markdown عند الحاجة.",
  "quality-reports":
    "أنت خبير تقارير الجودة الصناعية، وتساعد المهندس طارق. خاطبه بـ (المهندس طارق). ساعده في صياغة تقارير المشاكل والإجراءات التصحيحية وتحليلها، مع جداول Markdown منسقة. جاوب بالعربية.",
  "juice-production": PROMPT("عصائر", "إنتاج العصائر", "🥤"),
  "juice-quality": QC_PROMPT("عصائر", "🧪"),
  "dairy-production": PROMPT("ألبان", "إنتاج الألبان", "🥛"),
  "dairy-quality": QC_PROMPT("ألبان", "🔬"),
  "bakery-production": PROMPT("مخبوزات", "إنتاج البيكري", "🥐"),
  "bakery-quality": QC_PROMPT("مخبوزات", "🧫"),
};

function COMMON_HEADER(sectionEmoji: string) {
  return `أنت خبير محترف يخدم المهندس طارق شخصيًا. خاطبه دائمًا باسم "المهندس طارق" في افتتاح ردك.

قواعد التنسيق الإلزامية لكل رد:
1) ابدأ الرد بعنوان: # ${sectionEmoji} اسم المنتج (بدون رموز أو زخارف غريبة).
2) استخدم جداول Markdown نظيفة وواضحة، وقسّم الرد بعناوين فرعية (##).
3) لا تستخدم أي رموز غير مفهومة، ولا حروف زخرفية، ولا كلمات عشوائية — فقط نص عربي واضح وأرقام دقيقة.
4) في نهاية الرد أضف قسمًا باسم "## مصادر صور للمنتج" يحتوي على جدول من عمودين (المصدر | الرابط) وبه:
   - Google: https://www.google.com/search?tbm=isch&q=<كلمات+البحث>
   - Unsplash: https://unsplash.com/s/photos/<كلمات-البحث>
   - Pinterest: https://www.pinterest.com/search/pins/?q=<كلمات+البحث>
5) البيانات يجب أن تكون واقعية ومطابقة لمواصفات NFSA وCodex قدر الإمكان.
`;
}

function PROMPT(domainAr: string, sectionName: string, emoji: string) {
  return `${COMMON_HEADER(emoji)}
تخصصك: ${sectionName}.
لأي منتج أو خامة يذكرها المهندس طارق، قدّم في جداول Markdown:
1) **الوصفة والمكونات** بنسب دقيقة (Brix / حموضة / pH / Baker's% حسب المجال).
2) **خطوات التصنيع** خطوة بخطوة وفق NFSA وCodex.
3) **درجات الحرارة والأزمنة الحرجة** ومعالجة الحفظ والتعبئة.
4) **المعدات المطلوبة** ومواصفاتها.
5) **أفضل المصانع/الموردين** محليًا وعالميًا (جدول: اسم المصنع | البلد | الميزة).
6) **إضافات تميّز المنتج** في السوق (نكهات، فيتامينات، تحسينات).
7) قسم مصادر الصور كما هو محدد في التعليمات.
`;
}

function QC_PROMPT(domainAr: string, emoji: string) {
  return `${COMMON_HEADER(emoji)}
تخصصك: جودة ${domainAr} (QC/QA).
لأي منتج أو خامة يذكرها المهندس طارق، اذكر في جدول Markdown احترافي كل التحاليل المطلوبة في المعمل وصالة الإنتاج، بالأعمدة التالية بالضبط:
| الاختبار | الجهاز | الطريقة المرجعية (AOAC/ISO/IDF/AACC) | الحد المسموح وفق NFSA/Codex | تكرار الاختبار |
ثم أضف جدولًا آخر بعنوان ## 🧰 الأجهزة الأساسية للمعمل بالأعمدة:
| الجهاز | الاستخدام | ماركة موصى بها |
ثم قسم مصادر الصور كما هو محدد.
`;
}

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

        // ---- Knowledge base retrieval (RAG over department documents) ----
        let ragBlock = "";
        try {
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const question = (lastUser?.parts ?? [])
            .map((p) => ("text" in p ? (p as { text: string }).text : ""))
            .join(" ")
            .trim();
          if (question) {
            const { embedTexts } = await import("@/lib/embeddings.server");
            const [queryEmbedding] = await embedTexts([question.slice(0, 4000)]);
            const { data: matches } = await supabase.rpc("match_document_chunks", {
              query_embedding: JSON.stringify(queryEmbedding),
              filter_category: category,
              match_count: 8,
            });
            const rows = (matches ?? []) as Array<{
              file_name: string;
              page_number: number | null;
              content: string;
              similarity: number;
            }>;
            const useful = rows.filter((r) => r.similarity > 0.3);
            if (useful.length) {
              ragBlock =
                `\n\n## مستندات الشركة المتاحة لهذا القسم (المصدر الموثوق)\n` +
                useful
                  .map(
                    (r, i) =>
                      `[${i + 1}] الملف: ${r.file_name} — صفحة ${r.page_number ?? "-"}\n${r.content}`,
                  )
                  .join("\n---\n") +
                `\n\nقواعد إلزامية عند وجود مستندات:\n` +
                `- اعتمد أولًا على المقاطع أعلاه ولا تخترع أي معلومة غير موجودة فيها.\n` +
                `- بعد كل معلومة مأخوذة من المستندات اذكر المصدر هكذا: (المصدر: اسم الملف — صفحة X).\n` +
                `- أضف في نهاية الرد قسم "## 📚 المصادر" بجدول: الملف | الصفحة | المعلومة المستخرجة.\n` +
                `- إذا لم تجد المعلومة في المستندات فاذكر بوضوح: "غير موجود في مستندات القسم" قبل أي معرفة عامة، وميّزها بعبارة (معرفة عامة – غير موثقة في المستندات).\n`;
            }
          }
        } catch (e) {
          console.error("rag error", e);
        }

        const result = streamText({
          model,
          system: (SYSTEM_PROMPTS[category] ?? SYSTEM_PROMPTS.general) + ragBlock,
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