import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ClipboardPaste, Clock, Download, Film, Loader2, RefreshCw,
  ShieldCheck, Sparkles, Subtitles, Trash2, Upload, Volume2, X,
} from "lucide-react";
import type { EnVoice, SpeechResult, ThemeKey, Voice, VideoQuality } from "@/lib/media-convert";
import { ACCEPT, KIND_LABEL, buildSrt, detectKind, estimateSeconds, formatBytes, formatDuration, hasArabic, type FileKind } from "@/lib/convert-text";
import { supabase } from "@/integrations/supabase/client";
import type { AnalyzeMode } from "@/lib/convert-analyze";
import { Card, Field, KindBadge, Segmented, StepPill, Switch } from "@/components/convert/parts";

export const Route = createFileRoute("/convert")({
  head: () => ({
    meta: [
      { title: "تحويل الملفات إلى صوت وفيديو" },
      { name: "description", content: "حوّل PDF وWord وExcel وPowerPoint والصور والملفات النصية إلى صوت وفيديو محليًا داخل المتصفح، بدون أي رصيد ذكاء اصطناعي." },
      { property: "og:title", content: "تحويل الملفات إلى صوت وفيديو" },
      { property: "og:description", content: "تحويل محلي للملفات إلى صوت وفيديو بالعربية والإنجليزية بدون ذكاء اصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConvertPage,
});

/* --------------------------------- types --------------------------------- */

type Stage = "idle" | "extract" | "audio" | "video";
type Item = { id: string; name: string; size: number; kind: FileKind | "paste"; status: "reading" | "done" | "error"; error?: string; file?: File; count?: number };
type Sec = { id: string; itemId: string; fileName: string; title: string; text: string; enabled: boolean };
type Settings = { analyze: AnalyzeMode; voice: Voice; enVoice: EnVoice; speed: number; pause: number; ratio: "16:9" | "9:16"; theme: ThemeKey; quality: VideoQuality; forceOcr: boolean; includeNotes: boolean };

const DEFAULTS: Settings = { analyze: "explain", voice: "auto", enVoice: "hfc_female", speed: 1, pause: 0.4, ratio: "16:9", theme: "ocean", quality: "standard", forceOcr: false, includeNotes: false };
const STORE = "convert-settings-v1";
const MAX_CHARS = 200_000;

const uid = () => Math.random().toString(36).slice(2, 10);
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return `${s.length}:${h.toString(36)}`; };
const baseOf = (n: string) => n.replace(/\.[^.]+$/, "");
const FORMATS: Array<{ kind: FileKind; hint: string }> = [
  { kind: "pdf", hint: "pdf" }, { kind: "word", hint: "docx • odt" }, { kind: "excel", hint: "xlsx • ods • csv" },
  { kind: "powerpoint", hint: "pptx • odp" }, { kind: "image", hint: "png • jpg • webp" }, { kind: "text", hint: "txt • md • html • srt" },
];

function loadSettings(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") }; } catch { return DEFAULTS; }
}

const THEME_SWATCH: Record<ThemeKey, string> = {
  ocean: "linear-gradient(135deg,#0f2a44,#134e4a)", midnight: "linear-gradient(135deg,#0b1020,#2e1065)",
  paper: "linear-gradient(135deg,#ffffff,#cbd5e1)", sunset: "linear-gradient(135deg,#7c2d12,#1e293b)",
};
const THEME_NAME: Record<ThemeKey, string> = { ocean: "أزرق مخضر", midnight: "ليلي", paper: "فاتح", sunset: "غروب" };

/* ---------------------------------- page ---------------------------------- */

function ConvertPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [secs, setSecs] = useState<Sec[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [videoTitle, setVideoTitle] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [audio, setAudio] = useState<{ url: string; sp: SpeechResult; key: string } | null>(null);
  const [script, setScript] = useState<{ key: string; sections: { label: string; text: string }[] } | null>(null);
  const [notice, setNotice] = useState("");
  const [video, setVideo] = useState<{ url: string; ext: string; size: number; key: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  const secsRef = useRef<Sec[]>([]);
  const busy = stage !== "idle";

  useEffect(() => { setSettings(loadSettings()); }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch { /* private mode */ } }, [settings]);
  useEffect(() => () => { abortRef.current?.abort(); urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const onP = (p: number, l: string) => { setPct(Math.max(0, Math.min(100, Math.round(p)))); setLabel(l); };
  const track = (blob: Blob) => { const u = URL.createObjectURL(blob); urls.current.push(u); return u; };
  const drop = (u?: string) => { if (u) { URL.revokeObjectURL(u); urls.current = urls.current.filter((x) => x !== u); } };

  /* ------------------------------ derived data ------------------------------ */
  secsRef.current = secs;
  const enabled = useMemo(() => secs.filter((s) => s.enabled && s.text.trim()), [secs]);
  const chars = enabled.reduce((n, s) => n + s.text.length, 0);
  const est = estimateSeconds(chars);
  const multi = items.filter((i) => i.status === "done").length > 1;
  const sectionInputs = () => enabled.map((s) => ({ label: multi ? `${s.fileName.slice(0, 18)} • ${s.title}` : s.title, text: s.text }));
  const textKey = hash(enabled.map((s) => s.text).join("\u0001"));
  const audioKey = `${textKey}|${settings.analyze}|${settings.voice}|${settings.enVoice}|${settings.speed}|${settings.pause}|${multi}`;
  const title = videoTitle.trim() || baseOf(items.find((i) => i.status === "done")?.name ?? "تحويل الملفات");
  const videoKey = `${audioKey}|${settings.ratio}|${settings.theme}|${settings.quality}|${title}`;
  const audioStale = !!audio && audio.key !== audioKey;
  const videoStale = !!video && video.key !== videoKey;
  const hasText = enabled.length > 0;
  const step = video || audio ? 4 : hasText ? 3 : items.length ? 2 : 1;

  /* ------------------------------ file handling ----------------------------- */
  async function addFiles(list: File[]) {
    if (!list.length || busy) return;
    const m = await import("@/lib/media-convert");
    const ac = new AbortController();
    abortRef.current = ac;
    setError(""); setStage("extract"); onP(0, "بدء القراءة…");
    for (const f of list) {
      if (ac.signal.aborted) break;
      await readOne(m, f, ac.signal);
    }
    setStage("idle"); abortRef.current = null;
  }

  async function readOne(m: typeof import("@/lib/media-convert"), f: File, signal: AbortSignal, existing?: string) {
    const id = existing ?? uid();
    const kind = detectKind(f.name, f.type);
    const base: Item = { id, name: f.name, size: f.size, kind: kind ?? "text", status: "reading", file: f };
    if (!kind) {
      setItems((a) => [...a, { ...base, status: "error", error: "صيغة غير مدعومة" }]);
      return;
    }
    setItems((a) => (existing ? a.map((i) => (i.id === id ? { ...base } : i)) : [...a, base]));
    try {
      const raw = await m.extractFile(f, signal, (p, l) => onP(p, `${f.name} — ${l}`), { forceOcr: settings.forceOcr, includeNotes: settings.includeNotes });
      const room = Math.max(0, MAX_CHARS - secsRef.current.filter((s) => s.itemId !== id).reduce((n, s) => n + s.text.length, 0));
      let used = 0;
      const mapped: Sec[] = raw.flatMap((r, i) => {
        if (used >= room) return [];
        const text = r.text.slice(0, room - used);
        used += text.length;
        return [{ id: `${id}-${i}`, itemId: id, fileName: f.name, title: r.title, text, enabled: true }];
      });
      setSecs((a) => [...a.filter((s) => s.itemId !== id), ...mapped]);
      setItems((a) => a.map((i) => (i.id === id ? { ...i, status: "done", count: mapped.length, error: mapped.length < raw.length ? "تم اقتطاع جزء من النص لتجاوز الحد الأقصى" : undefined } : i)));
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      setItems((a) => a.map((i) => (i.id === id ? { ...i, status: "error", error: aborted ? "تم إلغاء القراءة" : e?.message || "تعذّرت القراءة" } : i)));
    }
  }

  async function reread(item: Item) {
    if (!item.file || busy) return;
    const m = await import("@/lib/media-convert");
    const ac = new AbortController();
    abortRef.current = ac;
    setError(""); setStage("extract"); onP(0, "بدء القراءة…");
    setSecs((a) => a.filter((s) => s.itemId !== item.id));
    await readOne(m, item.file, ac.signal, item.id);
    setStage("idle"); abortRef.current = null;
  }

  function addPasted() {
    const text = pasteText.trim();
    if (!text) return;
    const id = uid();
    setItems((a) => [...a, { id, name: "نص مُدخل", size: text.length, kind: "paste", status: "done", count: 1 }]);
    setSecs((a) => [...a, { id: `${id}-0`, itemId: id, fileName: "نص مُدخل", title: "النص", text: text.slice(0, MAX_CHARS), enabled: true }]);
    setPasteText(""); setPasteOpen(false);
  }

  const removeItem = (id: string) => { setItems((a) => a.filter((i) => i.id !== id)); setSecs((a) => a.filter((s) => s.itemId !== id)); };
  const clearAll = () => { setItems([]); setSecs([]); setOpen(null); };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); };

  /* ------------------------------- generation ------------------------------- */
  async function run<T>(s: Stage, fn: (sig: AbortSignal) => Promise<T>): Promise<T | null> {
    const ac = new AbortController();
    abortRef.current = ac;
    setError(""); setStage(s); onP(0, "بدء…");
    try { return await fn(ac.signal); }
    catch (e: any) { setError(e?.name === "AbortError" ? "تم إلغاء العملية" : e?.message || "حدث خطأ غير متوقع"); return null; }
    finally { setStage("idle"); abortRef.current = null; }
  }

  async function makeAudio(): Promise<SpeechResult | null> {
    if (!hasText) return null;
    const m = await import("@/lib/media-convert");
    const key = audioKey;
    const sp = await run("audio", async (sig) => {
      setNotice("");
      let input = sectionInputs();
      if (settings.analyze !== "off") {
        const akey = `${textKey}|${settings.analyze}|${multi}`;
        if (script?.key === akey) input = script.sections;
        else {
          try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) throw new Error("سجّل الدخول لاستخدام تحليل النص");
            const { analyzeText } = await import("@/lib/convert-analyze");
            const r = await analyzeText(input, settings.analyze, token, sig, onP);
            input = r.sections;
            setScript({ key: akey, sections: r.sections });
            if (r.skippedChars) setNotice(`حُلّل الجزء الأول من الملف فقط للحفاظ على الرصيد، وقُرئ الباقي (${r.skippedChars.toLocaleString("ar-EG")} حرف) كما هو.`);
          } catch (e: any) {
            if (e?.name === "AbortError") throw e;
            setNotice(`${e?.message || "تعذّر تحليل النص"} — تمت القراءة كما هو بدون تحليل.`);
          }
        }
      }
      return m.synthesize(m.splitSegments(input), settings.voice, sig, onP, { pause: settings.pause, speed: settings.speed, enVoice: settings.enVoice });
    });
    if (sp) { drop(audio?.url); setAudio({ url: track(sp.wav), sp, key }); }
    return sp;
  }

  async function makeVideo() {
    const sp = audio && !audioStale ? audio.sp : await makeAudio();
    if (!sp) return;
    const m = await import("@/lib/media-convert");
    const key = videoKey;
    const r = await run("video", (sig) => m.renderVideo(sp, { ratio: settings.ratio, title, theme: settings.theme, quality: settings.quality }, sig, onP));
    if (r) { drop(video?.url); setVideo({ url: track(r.blob), ext: r.ext, size: r.blob.size, key }); }
  }

  const save = (blob: Blob, name: string) => {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  const exportSrt = () => audio && save(new Blob([buildSrt(audio.sp.timings.map((t) => ({ text: t.seg.text, start: t.start, end: t.end })))], { type: "text/plain;charset=utf-8" }), `${title}.srt`);
  const exportTxt = () => save(new Blob([enabled.map((s) => `${s.title}\n${s.text}`).join("\n\n")], { type: "text/plain;charset=utf-8" }), `${title}.txt`);

  const stageText = stage === "extract" ? "قراءة الملفات واستخراج النص" : stage === "audio" ? "توليد الصوت" : stage === "video" ? "إنشاء الفيديو" : "";
  const anyOcrKind = items.some((i) => i.kind === "pdf" || i.kind === "image");
  const anyPpt = items.some((i) => i.kind === "powerpoint");

  /* --------------------------------- render --------------------------------- */
  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 text-foreground">
      {busy && (
        <div className="fixed inset-x-0 top-0 z-50 border-b bg-card/95 shadow-md backdrop-blur" role="status" aria-live="polite">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2 text-xs font-semibold sm:text-sm">
                <span className="truncate">{stageText}… <span className="font-normal text-muted-foreground">{label}</span></span>
                <span className="shrink-0 tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
            <button onClick={() => abortRef.current?.abort()} className="shrink-0 rounded-lg border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">إيقاف</button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-5 px-3 pb-36 pt-4 sm:px-6 sm:pt-6">
        {/* hero */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-5 text-white shadow-lg sm:p-7">
          <div className="pointer-events-none absolute -left-10 -top-10 size-48 rounded-full bg-teal-400/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">استوديو تحويل الملفات إلى صوت وفيديو</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-200">ارفع ملفاتك، راجع النص، واختر الصوت والتصميم — وخذ صوتًا بصيغة WAV وفيديو جاهزًا للمشاركة مع ترجمة SRT.</p>
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><ShieldCheck className="size-3.5" /> يعمل داخل جهازك فقط</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Sparkles className="size-3.5" /> بدون أي رصيد ذكاء اصطناعي</span>
              </div>
            </div>
            <Link to="/" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"><ArrowRight className="size-4" /> الرئيسية</Link>
          </div>
        </header>

        <ol className="flex gap-2 rounded-2xl border bg-card p-3 shadow-sm" aria-label="مراحل التحويل">
          <StepPill n={1} label="الملفات" state={step > 1 ? "done" : "active"} />
          <StepPill n={2} label="مراجعة النص" state={step > 2 ? "done" : step === 2 ? "active" : "todo"} />
          <StepPill n={3} label="الإعدادات" state={step > 3 ? "done" : step === 3 ? "active" : "todo"} />
          <StepPill n={4} label="النتائج" state={step === 4 ? "active" : "todo"} />
        </ol>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{error}</span>
            <button onClick={() => setError("")} aria-label="إغلاق" className="shrink-0"><X className="size-4" /></button>
          </div>
        )}

        {notice && (
          <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{notice}</span>
            <button onClick={() => setNotice("")} aria-label="إغلاق" className="shrink-0"><X className="size-4" /></button>
          </div>
        )}

        {/* 1. files */}
        <Card
          title="١. الملفات"
          subtitle="يمكنك رفع أكثر من ملف ودمجها في صوت أو فيديو واحد"
          action={items.length > 0 && <button disabled={busy} onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="size-3.5" /> مسح الكل</button>}
        >
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-muted/40"} ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            <input type="file" multiple className="sr-only" disabled={busy} accept={ACCEPT}
              onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Upload className="size-7" /></span>
            <span className="text-base font-bold">اسحب الملفات وأفلتها هنا</span>
            <span className="text-sm text-muted-foreground">أو اضغط للاختيار من جهازك • حتى 50 ميجابايت للملف</span>
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {FORMATS.map((f) => (
              <div key={f.kind} className="flex items-center gap-2 rounded-xl border bg-background px-2.5 py-2">
                <span className="scale-75"><KindBadge kind={f.kind} /></span>
                <div className="min-w-0 leading-tight"><div className="truncate text-xs font-bold">{KIND_LABEL[f.kind]}</div><div className="truncate text-[11px] text-muted-foreground" dir="ltr">{f.hint}</div></div>
              </div>
            ))}
          </div>

          <div>
            <button type="button" disabled={busy} onClick={() => setPasteOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-muted/50 disabled:opacity-50">
              <ClipboardPaste className="size-4" /> أو الصق نصًا مباشرة
            </button>
            {pasteOpen && (
              <div className="mt-3 space-y-2">
                <textarea dir="auto" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} placeholder="اكتب أو الصق النص هنا…"
                  className="w-full rounded-xl border bg-background p-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-primary" />
                <button type="button" onClick={addPasted} disabled={!pasteText.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">إضافة النص</button>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                  <KindBadge kind={it.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" dir="auto">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {KIND_LABEL[it.kind === "paste" ? "text" : it.kind]} • {it.kind === "paste" ? `${it.size.toLocaleString("ar-EG")} حرف` : formatBytes(it.size)}
                      {it.status === "done" && it.count !== undefined && ` • ${it.count.toLocaleString("ar-EG")} قسم`}
                    </div>
                    {it.status === "error" && <div className="mt-0.5 text-xs text-destructive">{it.error}</div>}
                    {it.status === "done" && it.error && <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{it.error}</div>}
                  </div>
                  {it.status === "reading" && <Loader2 className="size-4 animate-spin text-primary" aria-label="جاري القراءة" />}
                  {it.status === "done" && <CheckCircle2 className="size-5 text-emerald-500" aria-label="تمت القراءة" />}
                  {it.file && it.status !== "reading" && (
                    <button onClick={() => void reread(it)} disabled={busy} title="إعادة القراءة بالخيارات الحالية" aria-label="إعادة القراءة" className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"><RefreshCw className="size-4" /></button>
                  )}
                  <button onClick={() => removeItem(it.id)} disabled={it.status === "reading"} title="حذف" aria-label="حذف" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}

          {(anyOcrKind || anyPpt || items.length === 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Switch checked={settings.forceOcr} onChange={(v) => set("forceOcr", v)} label="فرض التعرف الضوئي (OCR) على PDF"
                hint="استخدمه إذا ظهر النص مشوّهًا أو مقلوبًا. أبطأ لكنه أدق مع الملفات الممسوحة. اضغط «إعادة القراءة» بعد التغيير." />
              <Switch checked={settings.includeNotes} onChange={(v) => set("includeNotes", v)} label="تضمين ملاحظات المتحدث في PowerPoint"
                hint="تُقرأ بعد نص كل شريحة. اضغط «إعادة القراءة» بعد التغيير." />
            </div>
          )}
        </Card>

        {/* 2. review */}
        {secs.length > 0 && (
          <Card
            title="٢. مراجعة النص"
            subtitle="عطّل الأقسام التي لا تريدها، أو عدّل النص قبل التحويل"
            action={
              <div className="flex items-center gap-1 text-xs font-semibold">
                <button onClick={() => setSecs((a) => a.map((s) => ({ ...s, enabled: true })))} className="rounded-lg px-2.5 py-1.5 hover:bg-muted">تحديد الكل</button>
                <button onClick={() => setSecs((a) => a.map((s) => ({ ...s, enabled: false })))} className="rounded-lg px-2.5 py-1.5 hover:bg-muted">إلغاء التحديد</button>
                <button onClick={exportTxt} disabled={!hasText} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 hover:bg-muted disabled:opacity-50"><Download className="size-3.5" /> TXT</button>
              </div>
            }
          >
            {chars > 40000 && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs leading-6 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                النص طويل ({chars.toLocaleString("ar-EG")} حرف) وقد يستغرق التحويل وقتًا طويلًا على الجهاز. يُفضّل تحديد الأقسام المهمة فقط.
              </div>
            )}
            <ul className="space-y-2">
              {secs.map((s) => {
                const isOpen = open === s.id;
                return (
                  <li key={s.id} className={`rounded-xl border transition ${s.enabled ? "bg-background" : "bg-muted/40 opacity-70"}`}>
                    <div className="flex items-center gap-3 p-3">
                      <input type="checkbox" checked={s.enabled} onChange={(e) => setSecs((a) => a.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)))}
                        aria-label={`تضمين ${s.title}`} className="size-4 shrink-0 accent-[var(--primary)]" />
                      <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
                            <span dir="auto">{s.title}</span>
                            {multi && <span className="truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground" dir="auto">{s.fileName}</span>}
                          </span>
                          {!isOpen && <span dir="auto" className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{s.text.replace(/\s+/g, " ")}</span>}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{s.text.length.toLocaleString("ar-EG")} حرف</span>
                        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t p-3">
                        <textarea dir="auto" value={s.text} rows={Math.min(14, Math.max(4, Math.ceil(s.text.length / 70)))}
                          onChange={(e) => setSecs((a) => a.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)))}
                          className="w-full rounded-lg border bg-background p-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* 3. settings */}
        {hasText && (
          <Card title="٣. الإعدادات" subtitle="تُحفظ اختياراتك تلقائيًا على هذا الجهاز">
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="تحليل النص قبل التحويل" hint={settings.analyze === "off" ? "يُقرأ النص كما هو بدون أي تعديل." : "يفهم الذكاء الاصطناعي المحتوى ثم يعيد كتابته للاستماع (يحذف الترويسات ويقرأ الجداول كجمل). طلب واحد لكل ~١٨ ألف حرف، بحد أقصى ٣ طلبات."}>
                <Segmented label="تحليل النص" value={settings.analyze} onChange={(v) => set("analyze", v)} disabled={busy}
                  options={[{ value: "explain", label: "فهم وإعادة صياغة" }, { value: "summary", label: "ملخص" }, { value: "off", label: "كما هو" }]} />
              </Field>
              <Field label="لغة الصوت" hint={settings.voice === "auto" ? "يختار الصوت المناسب لكل فقرة حسب لغتها — مناسب للملفات المختلطة." : "الصوت العربي موحّد للفصحى واللهجة المصرية."}>
                <Segmented label="لغة الصوت" value={settings.voice} onChange={(v) => set("voice", v)} disabled={busy}
                  options={[{ value: "auto", label: "تلقائي" }, { value: "ar", label: "عربي" }, { value: "en", label: "English" }]} />
              </Field>
              <Field label="سرعة الكلام" hint="تغيير السرعة لا يغيّر طبقة الصوت. الأبطأ أوضح للشرح.">
                <Segmented label="سرعة الكلام" value={String(settings.speed)} onChange={(v) => set("speed", Number(v))} disabled={busy}
                  options={[{ value: "0.85", label: "بطيئة" }, { value: "1", label: "عادية" }, { value: "1.15", label: "سريعة" }]} />
              </Field>
              {settings.voice !== "ar" && (
                <Field label="الصوت الإنجليزي" hint="الصوت عالي الجودة أوضح لكنه أكبر في التحميل (مرة واحدة).">
                  <Segmented label="الصوت الإنجليزي" value={settings.enVoice} onChange={(v) => set("enVoice", v)} disabled={busy}
                    options={[{ value: "hfc_female", label: "أنثى" }, { value: "hfc_male", label: "ذكر" }, { value: "lessac", label: "عالي الجودة" }]} />
                </Field>
              )}
              <Field label="الوقفة بين الجمل" hint="وقفة أطول تجعل الاستماع أهدأ وأوضح.">
                <Segmented label="الوقفة بين الجمل" value={String(settings.pause)} onChange={(v) => set("pause", Number(v))} disabled={busy}
                  options={[{ value: "0.15", label: "قصيرة" }, { value: "0.4", label: "متوسطة" }, { value: "0.8", label: "طويلة" }]} />
              </Field>
              <Field label="عنوان الفيديو" hint="يظهر في الشريحة الأولى وأعلى كل شريحة.">
                <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder={title} dir="auto" disabled={busy}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </Field>
              <Field label="مقاس الفيديو">
                <Segmented label="مقاس الفيديو" value={settings.ratio} onChange={(v) => set("ratio", v)} disabled={busy}
                  options={[{ value: "16:9", label: "أفقي 16:9" }, { value: "9:16", label: "رأسي 9:16" }]} />
              </Field>
              <Field label="تصميم الشرائح">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="تصميم الشرائح">
                  {(Object.keys(THEME_SWATCH) as ThemeKey[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={settings.theme === k} disabled={busy} onClick={() => set("theme", k)}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${settings.theme === k ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}>
                      <span className="size-6 rounded-md border" style={{ background: THEME_SWATCH[k] }} />{THEME_NAME[k]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="جودة الفيديو" hint="الجودة العالية أوضح لكنها تستهلك ذاكرة أكثر على الهاتف.">
                <Segmented label="جودة الفيديو" value={settings.quality} onChange={(v) => set("quality", v)} disabled={busy}
                  options={[{ value: "standard", label: "عادية 540p" }, { value: "hd", label: "عالية 720p" }]} />
              </Field>
            </div>
          </Card>
        )}

        {/* 4. results */}
        {(audio || video) && (
          <Card title="٤. النتائج" subtitle="الملفات جاهزة للتحميل — لا تُرفع لأي خادم">
            {audio && (
              <div className="space-y-3 rounded-xl border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold"><Volume2 className="size-5 text-primary" /> الصوت
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"><Clock className="size-3" />{formatDuration(audio.sp.duration)}</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{formatBytes(audio.sp.wav.size)}</span>
                  </div>
                  {audioStale && <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">النص أو الإعدادات تغيّرت — أعد التوليد</span>}
                </div>
                <audio controls src={audio.url} className="w-full" />
                {settings.analyze !== "off" && script && (
                  <details className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <summary className="cursor-pointer font-semibold">النص بعد التحليل (ما تم نطقه)</summary>
                    <div dir="auto" className="mt-2 max-h-72 space-y-2 overflow-auto whitespace-pre-wrap leading-7">{script.sections.map((x) => x.text).join("\n\n")}</div>
                  </details>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => save(audio.sp.wav, `${title}.wav`)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="size-4" /> تحميل الصوت (WAV)</button>
                  <button onClick={exportSrt} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted/50"><Subtitles className="size-4" /> الترجمة (SRT)</button>
                </div>
              </div>
            )}
            {video && (
              <div className="space-y-3 rounded-xl border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold"><Film className="size-5 text-primary" /> الفيديو
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" dir="ltr">{video.ext.toUpperCase()} • {formatBytes(video.size)}</span>
                  </div>
                  {videoStale && <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">النص أو الإعدادات تغيّرت — أعد التوليد</span>}
                </div>
                <video controls playsInline src={video.url} className={`mx-auto rounded-xl bg-black ${settings.ratio === "9:16" ? "max-h-[70vh]" : "w-full"}`} />
                <a href={video.url} download={`${title}.${video.ext}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="size-4" /> تحميل الفيديو</a>
              </div>
            )}
          </Card>
        )}

        <p className="px-1 text-center text-xs leading-6 text-muted-foreground">
          أول مرة تُحمَّل نماذج الصوت (والتعرف الضوئي عند الحاجة) من الإنترنت ثم تُحفظ في المتصفح. الملفات والنصوص لا تغادر جهازك أبدًا.
        </p>
      </div>

      {/* sticky action bar */}
      {hasText && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 shadow-[0_-6px_20px_rgba(0,0,0,.08)] backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-xs leading-5 text-muted-foreground">
              <span className="font-bold text-foreground">{enabled.length.toLocaleString("ar-EG")}</span> قسم •{" "}
              <span className="font-bold text-foreground">{chars.toLocaleString("ar-EG")}</span> حرف • مدة الصوت التقريبية{" "}
              <span className="font-bold text-foreground">{formatDuration(est)}</span>
              {enabled.some((s) => hasArabic(s.text)) && settings.voice === "en" && <span className="block text-amber-600 dark:text-amber-400">النص يحتوي عربيًا لكن الصوت المختار إنجليزي</span>}
            </div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => void makeAudio()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"><Volume2 className="size-4" /> توليد الصوت</button>
              <button disabled={busy} onClick={() => void makeVideo()} className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-bold transition hover:bg-muted disabled:opacity-50"><Film className="size-4" /> توليد الفيديو</button>
            </div>
          </div>
          {stage === "video" && <p className="pb-2 text-center text-[11px] text-muted-foreground">يُسجَّل الفيديو بالسرعة الطبيعية — اترك هذه الصفحة مفتوحة حتى ينتهي.</p>}
        </div>
      )}
    </div>
  );
}
