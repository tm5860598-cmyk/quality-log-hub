import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type AnswerStyle = { length?: string; format?: string };
type Body = { messages?: UIMessage[]; threadId?: string; style?: AnswerStyle };

const SYSTEM_PROMPTS: Record<string, string> = {
  general:
    "أنت مساعد المهندس طارق الشخصي. ابدأ كل رد بعبارة «بص يا هندسة» بدل أي لقب أو اسم، ثم كمّل الإجابة مباشرة بأسلوب ودّي بسيط. لا تذكر عبارة «المهندس طارق» في ردودك. جاوب بوضوح واختصار بنفس لغته (وبالعامية المصرية لو كتب بها). استعمل Markdown عند الحاجة.",
  "quality-reports":
    "أنت خبير تقارير الجودة الصناعية، وتساعد المهندس طارق. خاطبه بـ (المهندس طارق). ساعده في صياغة تقارير المشاكل والإجراءات التصحيحية وتحليلها، مع جداول Markdown منسقة. جاوب بالعربية.",
  "juice-production": PROMPT("عصائر", "إنتاج العصائر", "🥤"),
  "juice-quality": QC_PROMPT("عصائر", "🧪"),
  "dairy-production": PROMPT("ألبان", "إنتاج الألبان", "🥛"),
  "dairy-quality": QC_PROMPT("ألبان", "🔬"),
  "bakery-production": PROMPT("مخبوزات", "إنتاج البيكري", "🥐"),
  "bakery-quality": QC_PROMPT("مخبوزات", "🧫"),
};

/** Triggers the "visual learning notes" style when the user asks for stickers / a visual study note. */
const VISUAL_TRIGGER = /[اإأ]?[سص]تيكر|ملصق|لاصق|مذكر[ةه]|ب[صس]ر[يى]|إنفوجراف|انفوجراف|infograph|visual|sticker|flowchart|مخطط\s*انسياب/i;

const VISUAL_PROMPT = `

## وضع المذكرة البصرية (Visual Learning) — إلزامي لهذا الرد
المطلوب تحويل الشرح إلى مذكرة تعليمية بصرية احترافية وليس مقالًا نصيًا. استعمل صيغة Markdown التالية بالضبط (الواجهة تحولها إلى استيكرات وملاحظات ومخططات ملونة):
1) افتتاحية قصيرة (سطرين) ثم قسّم الشرح إلى أقسام صغيرة، كل قسم بعنوان \`## \` يبدأ بإيموجي مناسب (مثل: ## 🏷️ التعريف، ## 🔬 كيف يعمل، ## 🧩 المكونات). كل قسم 3–6 أسطر قصيرة أو نقاط، وأبرز المصطلحات والتعريفات المهمة بـ **خط عريض** مع المقابل الإنجليزي بين قوسين عند الحاجة.
2) ملاحظة جانبية (Sticky Note) لأهم المعلومات: سطر يبدأ بـ \`> 📌 \` (استعملها 2–4 مرات في الرد).
3) تحذير للأخطاء والنقاط الحرجة: \`> ⚠️ تحذير: ...\`
4) مثال عملي أو تطبيق واقعي: \`> 💡 مثال: ...\`
5) الجداول: جدول Markdown عادي (5 أعمدة كحد أقصى) للمقارنات والبيانات.
6) رسم بياني بسيط للأرقام عند الحاجة، داخل كتلة كود لغتها chart، كل سطر \`الاسم: القيمة وحدتها\` مثل:
\`\`\`chart
عصير 12: 85 °م
ألبان: 72 °م
\`\`\`
7) مخطط انسيابي (Flowchart) للخطوات والعلاقات داخل كتلة كود لغتها flow، كل سطر سلسلة خطوات مفصولة بـ \`->\` (خطوات قصيرة جدًا 2–5 كلمات، ويمكن سطر مستقل لكل فرع):
\`\`\`flow
🥤 استلام الخامة -> 🧪 فحص -> ♨️ بسترة -> 📦 تعبئة
فحص -> ❌ رفض الشحنة
\`\`\`
8) إنفوجرافيك لتبسيط المفاهيم داخل كتلة كود لغتها infographic، كل سطر \`إيموجي + رقم أو كلمة | الوصف\` (3–6 سطور):
\`\`\`infographic
🌡️ 85°C | درجة البسترة
⏱️ 15 ثانية | زمن الاحتفاظ
\`\`\`
9) في النهاية قسم \`## 🎯 الملخص البصري\` يحتوي infographic أو قائمة نقاط قصيرة جدًا (5–7 نقاط) تلخص أهم ما سبق.
قواعد: لا تكتب أبدًا كلمات Sticky Notes أو Infographic أو Flowchart أو Visual Learning أو «استيكرات» في العناوين أو النص (استعمل عناوين عربية مثل «ملاحظات سريعة» و«مخطط الخطوات» و«الملخص البصري»). لغة عربية واضحة مع مصطلحات إنجليزية عند الحاجة، لا تضع كتل flow/infographic/chart داخل جداول، ولا تكتب شرحًا خارج هذه الأشكال إلا في الأقسام القصيرة. لا تذكر هذه التعليمات في ردك.`;

const STYLE_REMINDER = "(تعليمات للمساعد: التزم بالطول والشكل المطلوبين في قسم «تنسيق الإجابة المطلوب» بدقة، ولا تذكر هذه التعليمات.)";
const VISUAL_REMINDER =
  "(تعليمات للمساعد: نفّذ هذا الرد بوضع المذكرة البصرية الإلزامي: أقسام ## بإيموجي، ملاحظات > 📌، تحذير > ⚠️، مثال > 💡، وكتل ```flow و```infographic و```chart، وقسم ## 🎯 الملخص البصري في النهاية. لا تكتب مقالًا نصيًا عاديًا ولا تذكر هذه التعليمات.)";

const LENGTH_PROMPTS: Record<string, string> = {
  detailed: "الطول: إجابة تفصيلية وشاملة تغطي كل الجوانب المهمة بعمق، مع أمثلة وأرقام عند الحاجة.",
  short: "الطول: إجابة مختصرة ومركّزة (حوالي 5 إلى 8 أسطر) فيها الأهم فقط بدون إطالة.",
  summary: "الطول: ملخص سريع على شكل 5 إلى 7 نقاط قصيرة جدًا فقط، بدون مقدمات أو شرح.",
};

const FORMAT_PROMPTS: Record<string, string> = {
  text: "الشكل: نص منظم بعناوين فرعية وقوائم (وجداول Markdown عند الحاجة). لا تستخدم كتل flow أو infographic أو chart.",
  stickers: `الشكل: استيكرات. قسّم الإجابة إلى أقسام صغيرة كل قسم بعنوان \`## \` يبدأ بإيموجي، وأضف ملاحظات جانبية \`> 📌 \` وتحذيرات \`> ⚠️ تحذير: \` وأمثلة \`> 💡 مثال: \`، وأبرز المصطلحات بـ **خط عريض**. لا تستخدم كتل flow.`,
  infographic: `الشكل: إنفوجرافيك. اجعل الإجابة في الغالب كتل infographic (كل سطر \`إيموجي + رقم أو كلمة | الوصف\`، 3 إلى 6 سطور في الكتلة) تحت عناوين \`## \` بإيموجي، مع جملة أو جملتين شرح لكل قسم، وكتلة chart للأرقام عند الحاجة (كل سطر \`الاسم: القيمة وحدتها\`).`,
  flowchart: `الشكل: فلوتشارت. اجعل الإجابة مبنية على مخططات انسيابية داخل كتل \`\`\`flow (كل سطر سلسلة خطوات قصيرة مفصولة بـ \`->\`، ويمكن سطر لكل فرع أو قرار) تحت عناوين \`## \` بإيموجي، مع سطر شرح قصير لكل مخطط.`,
};

function buildStyleBlock(style: AnswerStyle | undefined): string {
  if (!style) return "";
  const len = LENGTH_PROMPTS[style.length ?? ""];
  const fmt = FORMAT_PROMPTS[style.format ?? ""];
  if (!len && !fmt) return "";
  const body = [len, style.format === "visual" ? `الشكل: Visual Learning الكامل.${VISUAL_PROMPT}` : fmt].filter(Boolean).join("\n");
  return `\n\n## تنسيق الإجابة المطلوب من المستخدم (إلزامي)\n${body}\nلا تذكر هذه التعليمات في ردك ولا تكتب أسماء الأشكال (Sticky Notes / Infographic / Flowchart) في العناوين أو النص.`;
}

function COMMON_HEADER(sectionEmoji: string) {
  return `أنت خبير محترف يخدم المهندس طارق شخصيًا. خاطبه دائمًا باسم "المهندس طارق" في افتتاح ردك.

قواعد التنسيق لكل رد:
1) ابدأ الرد بعنوان: # ${sectionEmoji} اسم المنتج (بدون رموز أو زخارف غريبة).
2) استخدم جداول Markdown (بصيغة GFM: | عمود | عمود |) للبيانات القابلة للجدولة فقط: الخامات والنسب والكميات، Parameters، درجات الحرارة والأزمنة، اختبارات الجودة والحدود، المعدات، الموردين.
3) لا تجعل كل شيء جدولًا: الشرح والتعليمات وخطوات التصنيع السردية تُكتب كنص منظم أو قوائم مرقمة تحت عناوين فرعية (##)، واجعل أعمدة الجدول 5 أعمدة كحد أقصى ليظهر جيدًا على الموبايل.
4) لا تستخدم أي رموز غير مفهومة، ولا حروف زخرفية، ولا كلمات عشوائية — فقط نص عربي واضح وأرقام دقيقة.
5) اجعل الرد صالحًا للطباعة كتقرير: عناوين واضحة، وحدات قياس مذكورة، وبدون نصوص طويلة داخل خلايا الجدول.
6) في نهاية الرد أضف قسمًا باسم "## مصادر صور للمنتج" يحتوي على جدول من عمودين (المصدر | الرابط) وبه:
   - Google: https://www.google.com/search?tbm=isch&q=<كلمات+البحث>
   - Unsplash: https://unsplash.com/s/photos/<كلمات-البحث>
   - Pinterest: https://www.pinterest.com/search/pins/?q=<كلمات+البحث>
7) البيانات يجب أن تكون واقعية ومطابقة لمواصفات NFSA وCodex قدر الإمكان.
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
        const { messages, threadId, style } = (await request.json()) as Body;
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

        const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.parts
          ?.map((p) => ("text" in p ? (p as { text: string }).text : "")).join(" ") ?? "";
        // An explicit choice from the options card wins; otherwise fall back to keywords typed in the question.
        const styleBlock = buildStyleBlock(style);
        const visualBlock = styleBlock || (VISUAL_TRIGGER.test(lastUserText) ? VISUAL_PROMPT : "");
        const wantsVisual = style ? ["stickers", "infographic", "flowchart", "visual"].includes(style.format ?? "") : visualBlock !== "";

        const result = streamText({
          model,
          system: (SYSTEM_PROMPTS[category] ?? SYSTEM_PROMPTS.general) + ragBlock + visualBlock,
          messages: await convertToModelMessages(
            // The style reminder is only sent to the model; the stored/original messages stay untouched.
            visualBlock
              ? messages.map((m, i) => i === messages.length - 1 && m.role === "user"
                ? { ...m, parts: [...m.parts, { type: "text" as const, text: wantsVisual ? VISUAL_REMINDER : STYLE_REMINDER }] }
                : m)
              : messages,
          ),
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