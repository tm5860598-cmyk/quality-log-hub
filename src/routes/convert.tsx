import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Segment, SpeechResult, Voice } from "@/lib/media-convert.client";

export const Route = createFileRoute("/convert")({
  head: () => ({
    meta: [
      { title: "تحويل الملفات إلى صوت وفيديو" },
      { name: "description", content: "حوّل PDF وWord وExcel وPowerPoint والصور إلى صوت وفيديو محليًا داخل المتصفح." },
      { property: "og:title", content: "تحويل الملفات إلى صوت وفيديو" },
      { property: "og:description", content: "تحويل محلي للملفات إلى صوت وفيديو بالعربية والإنجليزية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConvertPage,
});

type Stage = "idle" | "extract" | "audio" | "video";

function ConvertPage() {
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState<Voice>("ar-eg");
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9");
  const [segs, setSegs] = useState<Segment[] | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [audio, setAudio] = useState<{ url: string; sp: SpeechResult } | null>(null);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = stage !== "idle";

  useEffect(() => () => abortRef.current?.abort(), []);
  const onP = (p: number, l: string) => { setPct(Math.max(0, Math.min(100, Math.round(p)))); setLabel(l); };
  const baseName = (file?.name ?? "file").replace(/\.[^.]+$/, "");

  async function run<T>(s: Stage, fn: (sig: AbortSignal) => Promise<T>): Promise<T | null> {
    const ac = new AbortController();
    abortRef.current = ac;
    setError(""); setStage(s); onP(0, "بدء…");
    try { return await fn(ac.signal); }
    catch (e: any) { setError(e?.name === "AbortError" ? "تم إلغاء العملية" : e?.message || "حدث خطأ غير متوقع"); return null; }
    finally { setStage("idle"); abortRef.current = null; }
  }

  async function pick(f: File | null) {
    setFile(f); setSegs(null); setAudio(null); setVideo(null); setError("");
    if (!f) return;
    const m = await import("@/lib/media-convert.client");
    const r = await run("extract", (sig) => m.extractFile(f, sig, onP));
    if (r) { setSegs(r); if (!/[\u0600-\u06FF]/.test(r.map((x) => x.text).join(" "))) setVoice("en"); }
  }

  async function makeAudio(): Promise<SpeechResult | null> {
    if (!segs) return null;
    const m = await import("@/lib/media-convert.client");
    const sp = await run("audio", (sig) => m.synthesize(m.splitSegments(segs), voice, sig, onP));
    if (sp) { if (audio) URL.revokeObjectURL(audio.url); setAudio({ url: URL.createObjectURL(sp.wav), sp }); }
    return sp;
  }

  async function makeVideo() {
    const sp = audio?.sp ?? (await makeAudio());
    if (!sp) return;
    const m = await import("@/lib/media-convert.client");
    const r = await run("video", (sig) => m.renderVideo(sp, ratio, baseName, sig, onP));
    if (r) { if (video) URL.revokeObjectURL(video.url); setVideo({ url: URL.createObjectURL(r.blob), ext: r.ext }); }
  }

  const text = segs?.map((s) => s.text).join("\n\n") ?? "";
  const btn = "rounded-xl px-4 py-2.5 font-semibold text-sm disabled:opacity-50 transition";

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground p-3 sm:p-6" style={{ fontFamily: "Tahoma, Arial, sans-serif" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-extrabold">🎬 تحويل الملفات إلى صوت وفيديو</h1>
          <Link to="/" className="text-sm text-primary underline">الرئيسية</Link>
        </div>
        <p className="text-sm text-muted-foreground">كل المعالجة تتم داخل جهازك — بدون أي رصيد ذكاء اصطناعي. يدعم PDF وWord وExcel وPowerPoint والصور والملفات النصية.</p>

        <section className="rounded-2xl border bg-card p-4 space-y-4 shadow-sm">
          <label className="block rounded-xl border-2 border-dashed p-6 text-center cursor-pointer hover:bg-muted/50">
            <input type="file" className="hidden" disabled={busy}
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json,.html,.doc,.xls,.ppt,image/*,text/*"
              onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <div className="text-3xl">📄</div>
            <div className="font-semibold mt-1">{file ? file.name : "اضغط لاختيار ملف"}</div>
            {segs && <div className="text-xs text-muted-foreground mt-1">{segs.length} صفحة/قسم — {text.length.toLocaleString()} حرف</div>}
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-semibold mb-1">لغة الصوت</div>
              <div className="flex gap-2 flex-wrap">
                {([["ar-eg", "عربي مصري"], ["ar", "عربي"], ["en", "English"]] as const).map(([v, l]) => (
                  <button key={v} disabled={busy} onClick={() => { setVoice(v); setAudio(null); setVideo(null); }}
                    className={`${btn} border ${voice === v ? "bg-primary text-primary-foreground" : "bg-background"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">مقاس الفيديو</div>
              <div className="flex gap-2">
                {(["16:9", "9:16"] as const).map((r) => (
                  <button key={r} disabled={busy} onClick={() => { setRatio(r); setVideo(null); }}
                    className={`${btn} border ${ratio === r ? "bg-primary text-primary-foreground" : "bg-background"}`}>{r === "16:9" ? "16:9 أفقي" : "9:16 رأسي"}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button disabled={!segs || busy} onClick={makeAudio} className={`${btn} bg-primary text-primary-foreground`}>🔊 تحويل إلى صوت</button>
            <button disabled={!segs || busy} onClick={makeVideo} className={`${btn} bg-secondary text-secondary-foreground border`}>🎥 تحويل إلى فيديو</button>
          </div>

          {busy && (
            <div className="space-y-2" role="status">
              <div className="flex justify-between text-sm"><span>{label}</span><span>{pct}%</span></div>
              <div className="h-3 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              <button onClick={() => abortRef.current?.abort()} className={`${btn} border border-destructive text-destructive`}>إلغاء العملية</button>
              {stage === "video" && <p className="text-xs text-muted-foreground">يتم تسجيل الفيديو بالسرعة الطبيعية — اترك الصفحة مفتوحة حتى ينتهي.</p>}
            </div>
          )}
          {error && <div className="rounded-xl bg-destructive/10 text-destructive p-3 text-sm">⚠️ {error}</div>}
          {voice === "ar-eg" && <p className="text-xs text-muted-foreground">ملاحظة: المحرك المحلي يستخدم صوتًا عربيًا موحدًا للهجة المصرية والفصحى.</p>}
        </section>

        {(audio || video) && (
          <section className="rounded-2xl border bg-card p-4 space-y-4 shadow-sm">
            {audio && (
              <div className="space-y-2">
                <div className="font-semibold">🔊 الصوت</div>
                <audio controls src={audio.url} className="w-full" />
                <a href={audio.url} download={`${baseName}.wav`} className={`${btn} inline-block bg-primary text-primary-foreground`}>تحميل الصوت</a>
              </div>
            )}
            {video && (
              <div className="space-y-2">
                <div className="font-semibold">🎥 الفيديو</div>
                <video controls playsInline src={video.url} className={`rounded-xl bg-black mx-auto ${ratio === "9:16" ? "max-h-[70vh]" : "w-full"}`} />
                <a href={video.url} download={`${baseName}.${video.ext}`} className={`${btn} inline-block bg-primary text-primary-foreground`}>تحميل الفيديو</a>
              </div>
            )}
          </section>
        )}

        {segs && (
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="font-semibold mb-2">📝 النص المستخرج</div>
            <div dir="auto" className="max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-7">{text}</div>
          </section>
        )}
      </div>
    </div>
  );
}
