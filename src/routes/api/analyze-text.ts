import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// Optional, opt-in text analysis for the files -> audio/video converter.
// One short request per ~18k characters; the converter caps the number of requests per conversion.
const MAX_INPUT = 22_000;

const COMMON =
  "أنت محرر نصوص للقراءة الصوتية. افهم المستند أولًا ثم اكتب النص النهائي ليُقرأ بصوت عالٍ. " +
  "القواعد: (1) اكتب بنفس لغة المستند، وإن كان مختلط اللغة فاحتفظ بلغة كل جزء ولا تترجم. " +
  "(2) لا تضف أي معلومة غير موجودة في النص. (3) احذف أرقام الصفحات والترويسات والتذييلات وبقايا التعرّف الضوئي والتكرار. " +
  "(4) حوّل الجداول والقوائم إلى جمل متسلسلة واضحة تقرأ الصف كاملًا (مثل: المنتج كذا، درجة الحرارة كذا، الحد الأقصى كذا). " +
  "(5) اجعل كل عنوان جملة قصيرة تنتهي بنقطة. (6) استخدم جملًا متوسطة الطول بعلامات ترقيم صحيحة، وافصل الفقرات بسطر فارغ. " +
  "(7) بدون Markdown أو رموز أو إيموجي أو روابط. (8) اكتب الاختصارات كاملة عند أول ذكر إن كان معناها واضحًا من النص. " +
  "(9) إن كان النص المستخرج مقطّعًا إلى حروف أو أجزاء كلمات متفرقة (خلل استخراج) فأعد تجميعها إلى كلمات وجمل سليمة مفهومة قبل الكتابة. " +
  "(10) أخرج النص النهائي فقط، بلا مقدمة ولا تعليق.";

/** Piper's Arabic voice was trained on fully vowelled text: without harakat it guesses the vowels and sounds unnatural. */
const TASHKEEL =
  " (11) شكّل كل كلمة عربية في النص النهائي تشكيلًا كاملًا ودقيقًا (فتحة وضمة وكسرة وسكون وشدة وتنوين) وفق قواعد النحو والنطق، " +
  "بما في ذلك حرف آخر الكلمة بحسب موقعها في الجملة، ولا تُشكّل الكلمات الإنجليزية. اكتب الأرقام بالحروف العربية مُشكَّلة.";

/** Spoken Egyptian Arabic instead of formal Arabic: easier to follow when listened to. */
const EGYPTIAN =
  " استثناء من القاعدة (1): اكتب النص العربي بالعامية المصرية البسيطة المفهومة كما يشرحها مهندس مصري لزميله بصوت عالٍ " +
  "(مثل: ده، دي، إزاي، عشان، لازم، بيعمل، مفيش، كده)، بجمل قصيرة وواضحة، وأبقِ المصطلحات الفنية والأسماء والأرقام كما هي دون تغيير المعنى.";
const TASHKEEL_EG =
  " (11) شكّل الكلمات العربية تشكيلًا يطابق النطق المصري كما تُنطق فعلًا (وليس إعراب الفصحى)، مع السكون عند حذف الحركة، ولا تُشكّل الكلمات الإنجليزية، واكتب الأرقام بالحروف المصرية مُشكَّلة.";

/** Written slides (silent video): keep enumerations as one "label: text" line each instead of one run-on sentence. */
const SLIDES =
  " استثناء من القاعدتين (4) و(6): هذا النص سيُعرض مكتوبًا على شرائح فنسّقه للقراءة البصرية: كل بند أو نقطة أو خطوة أو تعداد " +
  "(مثل: البند الأول والثاني والثالث، أو الشروط، أو المراحل) في سطر مستقل بصيغة «العنوان: الشرح» " +
  "(مثال: البند الأول: النطاق — يحدد حدود تطبيق المعيار)، ولا تدمج عدة بنود في جملة واحدة ولا تضعها متجاورة، " +
  "واكتب سطرًا واحدًا لكل بند دون ترقيم أو رموز، واجعل الشرح بعد النقطتين قصيرًا ومفهومًا من النص نفسه. " +
  "افصل الموضوعات المختلفة بسطر فارغ، وابدأ كل موضوع بسطر عنوان قصير ينتهي بنقطتين إذا كان تحته بنود.";

const MODES: Record<string, string> = {
  explain:
    COMMON + " المطلوب: أعد صياغة كل المحتوى بوضوح وتسلسل منطقي كأنك تشرحه لمستمع، مع الإبقاء على كل الأرقام والأسماء والنتائج المهمة.",
  summary:
    COMMON + " المطلوب: لخّص المحتوى في حدود ربعه تقريبًا، مع الإبقاء على الأفكار الرئيسية والأرقام والقرارات المهمة، وبترتيب منطقي.",
};

export const Route = createFileRoute("/api/analyze-text")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { text, mode, diacritize, dialect, layout } = (await request.json().catch(() => ({}))) as { text?: string; mode?: string; diacritize?: boolean; dialect?: string; layout?: string };
        if (typeof text !== "string" || !text.trim()) return new Response("Text required", { status: 400 });
        if (text.length > MAX_INPUT) return new Response("Text too long", { status: 413 });
        const base = MODES[mode ?? "explain"];
        if (!base) return new Response("Bad mode", { status: 400 });
        const egyptian = dialect === "egyptian";
        const system = base + (layout === "slides" ? SLIDES : "") + (egyptian ? EGYPTIAN : "") + (diacritize ? (egyptian ? TASHKEEL_EG : TASHKEEL) : "");

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return new Response("Unauthorized", { status: 401 });

        try {
          const gateway = createLovableAiGatewayProvider(key);
          const out = await generateText({ model: gateway("google/gemini-3-flash-preview"), system, prompt: text, temperature: 0.2 });
          const result = out.text.trim();
          if (!result) return new Response("Empty result", { status: 502 });
          return Response.json({ text: result });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "AI error", { status: 502 });
        }
      },
    },
  },
});
