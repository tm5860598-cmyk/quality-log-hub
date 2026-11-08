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
  "(9) أخرج النص النهائي فقط، بلا مقدمة ولا تعليق.";

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
        const { text, mode } = (await request.json().catch(() => ({}))) as { text?: string; mode?: string };
        if (typeof text !== "string" || !text.trim()) return new Response("Text required", { status: 400 });
        if (text.length > MAX_INPUT) return new Response("Text too long", { status: 413 });
        const system = MODES[mode ?? "explain"];
        if (!system) return new Response("Bad mode", { status: 400 });

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
