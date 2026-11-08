// Fully local (browser-only) file -> text -> speech -> video pipeline.
// No AI API / credits: pdf.js, fflate, tesseract.js (OCR wasm), Piper TTS (wasm), Canvas + MediaRecorder.
// Pure text helpers live in ./convert-text (unit-testable, no DOM).

import { normalizePeak, normalizeForSpeech, polishClip, splitSegments, timeStretch, type Segment, type SectionInput } from "./convert-speech";
import {
  clean, decodeText, detectKind, dominantScript, hasArabic, htmlToText, looksGarbled, markdownToText, parseCsv, parseDocx,
  parseOpenDocument, parsePptx, parseXlsx, subtitleToText, tabularToSpeech,
  type RawSection, type ZipLike,
} from "./convert-text";

export type Progress = (pct: number, label: string) => void;
/** A speakable chunk. `label` is the human location ("صفحة 3", "شريحة 2", "ورقة: المنتجات"). */
export type { Segment, SectionInput };
export { splitSegments };
export type ExtractOptions = { forceOcr?: boolean; includeNotes?: boolean };

const MAX_FILE = 50 * 1024 * 1024;
const checkAbort = (s: AbortSignal) => {
  if (s.aborted) throw new DOMException("تم إلغاء العملية", "AbortError");
};
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/* ------------------------------------------------------------------ OCR --- */

// One OCR worker is reused across pages/files (creating it is the slowest step).
let ocrWorker: Promise<any> | null = null;
const getOcr = async () => {
  if (!ocrWorker) {
    ocrWorker = import("tesseract.js").then(({ createWorker }) => createWorker(["ara", "eng"]));
    ocrWorker.catch(() => (ocrWorker = null));
  }
  return ocrWorker;
};

async function ocrCanvas(src: HTMLCanvasElement, signal: AbortSignal): Promise<string> {
  const worker = await getOcr();
  checkAbort(signal);
  const onAbort = () => { worker.terminate(); ocrWorker = null; };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const { data } = await worker.recognize(src);
    return clean(data.text || "");
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** Decodes any browser-supported image and downsizes huge photos (keeps OCR fast and memory low). */
async function imageToCanvas(file: Blob, maxSide = 2600): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error("تعذّر فتح الصورة — استخدم PNG أو JPG أو WebP"); }
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); // flatten transparency for OCR
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

/* ------------------------------------------------------------ extraction --- */

async function extractPdf(bytes: Uint8Array, signal: AbortSignal, onP: Progress, opts: ExtractOptions): Promise<RawSection[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  let pdf;
  try { pdf = await pdfjs.getDocument({ data: bytes }).promise; }
  catch (e: any) {
    if (e?.name === "PasswordException") throw new Error("ملف PDF محمي بكلمة مرور — أزل الحماية ثم أعد المحاولة");
    throw new Error("تعذّر فتح ملف PDF (قد يكون تالفًا)");
  }
  const out: RawSection[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    checkAbort(signal);
    onP((i / pdf.numPages) * 100, `قراءة الصفحة ${i} من ${pdf.numPages}`);
    const page = await pdf.getPage(i);
    let text = "";
    if (!opts.forceOcr) {
      const tc = await page.getTextContent();
      text = clean(tc.items.map((it: any) => (it.str ?? "") + (it.hasEOL ? "\n" : " ")).join(""));
    }
    if (opts.forceOcr || text.length < 20 || looksGarbled(text)) {
      // Scanned page or broken font mapping -> local OCR
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, 2400 / Math.max(base.width, base.height));
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext("2d")!;
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      onP((i / pdf.numPages) * 100, `قراءة الصفحة ${i} بالتعرف الضوئي (OCR)`);
      text = await ocrCanvas(c, signal);
      c.width = 0; c.height = 0;
    }
    page.cleanup();
    if (text) out.push({ title: `صفحة ${i}`, text });
    await tick();
  }
  return out;
}

async function openZip(bytes: Uint8Array): Promise<ZipLike> {
  const { unzipSync, strFromU8 } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error("الملف تالف أو ليس بصيغة مدعومة"); }
  return { list: () => Object.keys(files), read: (p) => (files[p] ? strFromU8(files[p]) : undefined) };
}

export async function extractFile(file: File, signal: AbortSignal, onP: Progress, opts: ExtractOptions = {}): Promise<RawSection[]> {
  const name = file.name.toLowerCase();
  const kind = detectKind(file.name, file.type);
  if (!kind) throw new Error("صيغة غير مدعومة");
  if (kind === "legacy") throw new Error("الصيغ القديمة (doc / xls / ppt) غير مدعومة — احفظ الملف بصيغة docx أو xlsx أو pptx أو PDF ثم أعد رفعه");
  if (file.size > MAX_FILE) throw new Error("حجم الملف أكبر من 50 ميجابايت");
  if (file.size === 0) throw new Error("الملف فارغ");

  let sections: RawSection[];
  if (kind === "image") {
    onP(20, "قراءة النص من الصورة بالتعرف الضوئي (OCR)…");
    const c = await imageToCanvas(file);
    const text = await ocrCanvas(c, signal);
    c.width = 0; c.height = 0;
    sections = [{ title: "الصورة", text }];
  } else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    onP(10, "قراءة الملف…");
    if (kind === "pdf") sections = await extractPdf(bytes, signal, onP, opts);
    else if (kind === "word") sections = name.endsWith(".odt") ? parseOpenDocument("odt", await openZip(bytes)) : parseDocx(await openZip(bytes));
    else if (kind === "excel") sections = name.endsWith(".ods") ? parseOpenDocument("ods", await openZip(bytes)) : parseXlsx(await openZip(bytes));
    else if (kind === "powerpoint") sections = name.endsWith(".odp") ? parseOpenDocument("odp", await openZip(bytes)) : parsePptx(await openZip(bytes), { notes: opts.includeNotes });
    else {
      const raw = decodeText(bytes);
      let text: string;
      if (/\.(html?|xml)$/.test(name)) text = htmlToText(raw);
      else if (/\.(srt|vtt)$/.test(name)) text = subtitleToText(raw);
      else if (/\.md$/.test(name)) text = markdownToText(raw);
      else if (/\.(csv|tsv)$/.test(name)) text = tabularToSpeech(parseCsv(raw));
      else text = raw;
      sections = [{ title: "النص", text }];
    }
  }
  sections = sections.map((s) => ({ ...s, text: clean(s.text) })).filter((s) => s.text.length > 0);
  if (!sections.length) throw new Error("لم يتم العثور على نص داخل الملف");
  return sections;
}

/* ---------------------------------------------------------------- speech --- */

export type Voice = "auto" | "ar" | "en";
type Lang = "ar" | "en";
export type EnVoice = "hfc_female" | "lessac" | "hfc_male";
const EN_VOICES: Record<EnVoice, string> = { hfc_female: "en_US-hfc_female-medium", lessac: "en_US-lessac-high", hfc_male: "en_US-hfc_male-medium" };
const AR_VOICE = "ar_JO-kareem-medium";

function encodeWav(pcm: Int16Array, rate: number): Blob {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length * 2, true);
  return new Blob([header, pcm.buffer as ArrayBuffer], { type: "audio/wav" });
}

/** Parse a 16-bit PCM mono WAV directly (low memory, no AudioContext). */
function parseWav(ab: ArrayBuffer): { pcm: Int16Array; rate: number } | null {
  const v = new DataView(ab);
  if (ab.byteLength < 44 || v.getUint32(0, false) !== 0x52494646) return null;
  let off = 12, rate = 0, bits = 0, chans = 0;
  while (off + 8 <= ab.byteLength) {
    const id = v.getUint32(off, false), size = v.getUint32(off + 4, true);
    if (id === 0x666d7420) { chans = v.getUint16(off + 10, true); rate = v.getUint32(off + 12, true); bits = v.getUint16(off + 22, true); }
    if (id === 0x64617461) {
      if (bits !== 16 || chans !== 1 || !rate) return null;
      const len = Math.min(size, ab.byteLength - off - 8) >> 1;
      return { pcm: new Int16Array(ab.slice(off + 8, off + 8 + len * 2)), rate };
    }
    off += 8 + size + (size & 1);
  }
  return null;
}

function resample(pcm: Int16Array, from: number, to: number): Int16Array {
  if (from === to) return pcm;
  const n = Math.round((pcm.length * to) / from), out = new Int16Array(n), k = from / to;
  for (let i = 0; i < n; i++) {
    const p = i * k, i0 = Math.floor(p), i1 = Math.min(i0 + 1, pcm.length - 1), f = p - i0;
    out[i] = pcm[i0] * (1 - f) + pcm[i1] * f;
  }
  return out;
}

export type Timing = { seg: { text: string; label: string; section: number }; start: number; end: number; group: number };
export type SpeechResult = { wav: Blob; pcm: Int16Array; rate: number; duration: number; timings: Timing[] };
/** pause: scale of natural pauses (0.4 = default). speed: 0.7–1.3, pitch preserved. */
export type SpeechOptions = { pause?: number; speed?: number; enVoice?: EnVoice };

export async function synthesize(segs: Segment[], voice: Voice, signal: AbortSignal, onP: Progress, opts: SpeechOptions = {}): Promise<SpeechResult> {
  // The local engine (Piper + onnxruntime) sizes its thread pool from
  // navigator.hardwareConcurrency. On PCs with many cores that exhausts memory
  // (std::bad_alloc in OrtRun). Pin it to one thread while the engine runs.
  let savedConc: PropertyDescriptor | null = null;
  try {
    savedConc =
      Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency") ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), "hardwareConcurrency") ??
      null;
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 1 });
  } catch { savedConc = null; }
  const restoreThreads = () => {
    try { delete (navigator as any).hardwareConcurrency; } catch {}
    if (savedConc) { try { Object.defineProperty(navigator, "hardwareConcurrency", savedConc); } catch {} }
  };

  let fallbackCtx: AudioContext | null = null;
  try {
    const tts = await import("@mintplex-labs/piper-tts-web");
    const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
    (tts.TtsSession.WASM_LOCATIONS as any).onnxWasm = ORT;
    const ortMod: any = await import("onnxruntime-web/wasm");
    const ort = ortMod.default || ortMod;
    if (ort?.env?.wasm) { ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; }

    const langOf = (s: Segment): Lang => (voice === "auto" ? dominantScript(s.text) : voice);
    const langs = segs.map(langOf);
    const pcms: Array<Int16Array | null> = new Array(segs.length).fill(null);
    let rate = 0, done = 0;

    const toPcm = async (ab: ArrayBuffer): Promise<{ pcm: Int16Array; rate: number }> => {
      const p = parseWav(ab);
      if (p) return p;
      fallbackCtx ??= new AudioContext();
      const b = await fallbackCtx.decodeAudioData(ab);
      const f = b.getChannelData(0), pcm = new Int16Array(f.length);
      for (let k = 0; k < f.length; k++) pcm[k] = Math.max(-1, Math.min(1, f[k])) * 0x7fff;
      return { pcm, rate: b.sampleRate };
    };

    const speed = Math.min(1.5, Math.max(0.6, opts.speed ?? 1));
    for (const lang of ["ar", "en"] as const) {
      const idxs = langs.map((l, i) => (l === lang ? i : -1)).filter((i) => i >= 0);
      if (!idxs.length) continue;
      onP((done / segs.length) * 100, lang === "ar" ? "تحميل صوت اللغة العربية (مرة واحدة فقط)…" : "تحميل صوت اللغة الإنجليزية (مرة واحدة فقط)…");
      const wanted = lang === "ar" ? AR_VOICE : EN_VOICES[opts.enVoice ?? "hfc_female"];
      const open = (voiceId: string) =>
        tts.TtsSession.create({
          voiceId: voiceId as any,
          progress: (p: any) => p?.total && onP((p.loaded / p.total) * 100, "تحميل نموذج الصوت…"),
          wasmPaths: { ...tts.TtsSession.WASM_LOCATIONS, onnxWasm: ORT },
        });
      if (tts.TtsSession._instance && tts.TtsSession._instance.voiceId !== wanted) tts.TtsSession._instance = null;
      let session = tts.TtsSession._instance;
      if (!session) {
        try { session = await open(wanted); }
        catch (e) {
          if (lang !== "en" || wanted === EN_VOICES.hfc_female) throw e;
          tts.TtsSession._instance = null;
          session = await open(EN_VOICES.hfc_female); // chosen voice unavailable: use the default
        }
      }
      checkAbort(signal);

      // Synthesize one chunk. If the engine fails (e.g. out of memory), split the
      // text in half and retry each half instead of losing the whole conversion.
      const synthOne = async (text: string, depth: number): Promise<Array<{ pcm: Int16Array; rate: number }>> => {
        try {
          checkAbort(signal);
          const ab = await (await session.predict(text)).arrayBuffer();
          return [await toPcm(ab)];
        } catch (err) {
          if (signal.aborted || depth >= 2 || text.length <= 80) throw err;
          let mid = text.lastIndexOf(" ", Math.ceil(text.length / 2));
          if (mid < 40) mid = Math.ceil(text.length / 2);
          await new Promise((r) => setTimeout(r, 120)); // let the engine release memory
          return [...(await synthOne(text.slice(0, mid).trim(), depth + 1)), ...(await synthOne(text.slice(mid).trim(), depth + 1))];
        }
      };

      for (const i of idxs) {
        checkAbort(signal);
        onP((done / segs.length) * 100, `توليد الصوت ${done + 1} من ${segs.length}`);
        const text = normalizeForSpeech(segs[i].text, lang);
        if (/[\p{L}\p{N}]/u.test(text)) {
          const got = await synthOne(text, 0);
          if (!rate) rate = got[0].rate;
          const parts = got.map((g) => polishClip(resample(g.pcm, g.rate, rate), rate));
          const merged = new Int16Array(parts.reduce((n, p) => n + p.length, 0));
          let o = 0;
          for (const p of parts) { merged.set(p, o); o += p.length; }
          // Arabic voice reads a little fast; slow it slightly by default.
          pcms[i] = timeStretch(merged, rate, speed * (lang === "ar" ? 0.95 : 1));
        }
        done++;
        await tick(); // keep the page responsive on phones
      }
    }

    if (!rate) throw new Error("لا يوجد نص قابل للنطق في الأقسام المحددة");
    const scale = Math.max(0, opts.pause ?? 0.4) / 0.4;
    const gaps = segs.map((sg) => Math.round(rate * sg.pause * scale));
    const total = pcms.reduce((n, p, i) => n + (p ? p.length + gaps[i] : 0), 0);
    const pcm = new Int16Array(total);
    const timings: Timing[] = [];
    let off = 0;
    pcms.forEach((p, i) => {
      if (!p) return;
      pcm.set(p, off);
      const start = off / rate, end = (off + p.length + gaps[i]) / rate;
      const prev = timings[timings.length - 1];
      if (prev && prev.seg.section === segs[i].section && prev.group === segs[i].group) {
        prev.seg.text += " " + segs[i].text; prev.end = end; // same slide: extend it
      } else {
        timings.push({ seg: { text: segs[i].text, label: segs[i].label, section: segs[i].section }, start, end, group: segs[i].group });
      }
      off += p.length + gaps[i];
      pcms[i] = null; // free each part after merging
    });
    normalizePeak(pcm);
    return { wav: encodeWav(pcm, rate), pcm, rate, duration: total / rate, timings };
  } finally {
    restoreThreads();
    (fallbackCtx as AudioContext | null)?.close().catch(() => {});
  }
}

/* ----------------------------------------------------------------- video --- */

export type ThemeKey = "ocean" | "midnight" | "paper" | "sunset";
export type VideoQuality = "standard" | "hd";
export type VideoOptions = { ratio: "16:9" | "9:16"; title: string; theme: ThemeKey; quality: VideoQuality };

export const THEMES: Record<ThemeKey, { name: string; bg: [string, string]; text: string; accent: string; sub: string; bar: string }> = {
  ocean: { name: "أزرق مخضر", bg: ["#0f2a44", "#134e4a"], text: "#ffffff", accent: "#2dd4bf", sub: "#99f6e4", bar: "rgba(255,255,255,.18)" },
  midnight: { name: "ليلي", bg: ["#0b1020", "#2e1065"], text: "#f8fafc", accent: "#a78bfa", sub: "#c4b5fd", bar: "rgba(255,255,255,.16)" },
  paper: { name: "فاتح", bg: ["#ffffff", "#e2e8f0"], text: "#0f172a", accent: "#0f766e", sub: "#475569", bar: "rgba(15,23,42,.12)" },
  sunset: { name: "غروب", bg: ["#7c2d12", "#1e293b"], text: "#fff7ed", accent: "#fb923c", sub: "#fed7aa", bar: "rgba(255,255,255,.18)" },
};

const FONT = '"Cairo", Tahoma, Arial, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? line + " " + word : word;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Largest font size (within bounds) at which the whole text fits the box. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, maxFs: number, minFs: number) {
  for (let fs = maxFs; fs >= minFs; fs -= 2) {
    ctx.font = `${fs}px ${FONT}`;
    const lines = wrap(ctx, text, maxW);
    if (lines.length * fs * 1.55 <= maxH) return { fs, lines };
  }
  ctx.font = `${minFs}px ${FONT}`;
  const all = wrap(ctx, text, maxW);
  return { fs: minFs, lines: all.slice(0, Math.max(1, Math.floor(maxH / (minFs * 1.55)))) };
}

export function pickVideoMime(): { mime: string; ext: string } {
  const opts = [
    { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return opts.find((o) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) ?? { mime: "", ext: "webm" };
}

const LEAD = 2.5; // seconds of title slide before the narration starts

export async function renderVideo(sp: SpeechResult, o: VideoOptions, signal: AbortSignal, onP: Progress) {
  if (typeof MediaRecorder === "undefined") throw new Error("المتصفح لا يدعم تسجيل الفيديو");
  const th = THEMES[o.theme] ?? THEMES.ocean;
  // Lower resolution/fps keeps memory low on phones (prevents the browser from reloading the tab).
  const base = o.quality === "hd" ? 720 : 540;
  const long = Math.round((base * 16) / 9);
  const [W, H] = o.ratio === "16:9" ? [long, base] : [base, long];
  const FPS = o.quality === "hd" ? 20 : 15;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d")!;
  const ac = new AudioContext({ sampleRate: sp.rate });
  await Promise.race([ac.resume().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  const dest = ac.createMediaStreamDestination();
  const audioBuf = ac.createBuffer(1, sp.pcm.length, sp.rate);
  const ch = audioBuf.getChannelData(0);
  for (let i = 0; i < sp.pcm.length; i++) ch[i] = sp.pcm[i] / 0x7fff;
  const srcNode = ac.createBufferSource();
  srcNode.buffer = audioBuf;
  srcNode.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const { mime, ext } = pickVideoMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: o.quality === "hd" ? 2_500_000 : 1_200_000, audioBitsPerSecond: 96_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const duration = sp.duration;
  const total = LEAD + duration;
  const pad = W * 0.07;

  const paintBg = (c: CanvasRenderingContext2D) => {
    const grd = c.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, th.bg[0]); grd.addColorStop(1, th.bg[1]);
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    // soft accent glow
    const glow = c.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, Math.max(W, H) * 0.6);
    glow.addColorStop(0, th.accent + "33"); glow.addColorStop(1, "transparent");
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
  };

  // Title slide (pre-rendered once)
  const titleSlide = document.createElement("canvas");
  titleSlide.width = W; titleSlide.height = H;
  {
    const c = titleSlide.getContext("2d")!;
    paintBg(c);
    c.textAlign = "center"; c.direction = hasArabic(o.title) ? "rtl" : "ltr";
    const fit = fitText(c, o.title, W * 0.8, H * 0.4, Math.round(W * 0.06), Math.round(W * 0.03));
    c.fillStyle = th.text; c.font = `bold ${fit.fs}px ${FONT}`;
    const y0 = H * 0.5 - (fit.lines.length * fit.fs * 1.4) / 2;
    fit.lines.forEach((l, i) => c.fillText(l, W / 2, y0 + fit.fs + i * fit.fs * 1.4));
    c.fillStyle = th.accent; c.fillRect(W / 2 - W * 0.06, y0 + fit.lines.length * fit.fs * 1.4 + H * 0.04, W * 0.12, 4);
    c.fillStyle = th.sub; c.font = `${Math.round(W * 0.026)}px ${FONT}`; c.direction = "rtl";
    const mins = Math.max(1, Math.round(duration / 60));
    c.fillText(`${sp.timings.length} مقطع • حوالي ${mins} دقيقة`, W / 2, H * 0.88);
  }

  // Pre-render each content slide once per segment; per frame only blit + progress.
  const slide = document.createElement("canvas");
  slide.width = W; slide.height = H;
  const s = slide.getContext("2d")!;
  let curIdx = -1;
  const paintSlide = (idx: number) => {
    const cur = sp.timings[idx];
    paintBg(s);
    const rtl = hasArabic(cur.seg.text);
    s.direction = rtl ? "rtl" : "ltr";
    s.textAlign = rtl ? "right" : "left";
    const x = rtl ? W - pad : pad;
    // header: document title on one side, location chip on the other
    s.fillStyle = th.sub; s.font = `600 ${Math.round(W * 0.026)}px ${FONT}`;
    s.fillText(o.title.length > 48 ? o.title.slice(0, 47) + "…" : o.title, x, H * 0.075);
    s.fillStyle = th.accent; s.textAlign = rtl ? "left" : "right";
    s.fillText(cur.seg.label, rtl ? pad : W - pad, H * 0.075);
    s.fillStyle = th.bar; s.fillRect(pad, H * 0.095, W - pad * 2, 2);
    // body
    s.textAlign = rtl ? "right" : "left";
    const fit = fitText(s, cur.seg.text, W - pad * 2, H * 0.66, Math.round(Math.min(W, H) * 0.062), Math.round(Math.min(W, H) * 0.032));
    s.fillStyle = th.text; s.font = `${fit.fs}px ${FONT}`;
    const y0 = H * 0.5 - (fit.lines.length * fit.fs * 1.55) / 2;
    fit.lines.forEach((l, i) => s.fillText(l, x, y0 + fit.fs + i * fit.fs * 1.55));
    // footer: counter
    s.fillStyle = th.sub; s.font = `${Math.round(W * 0.022)}px ${FONT}`; s.textAlign = rtl ? "left" : "right";
    s.fillText(`${idx + 1} / ${sp.timings.length}`, rtl ? pad : W - pad, H - 26);
  };
  const draw = (t: number) => {
    if (t < LEAD) g.drawImage(titleSlide, 0, 0);
    else {
      const tt = t - LEAD;
      let idx = sp.timings.findIndex((x) => tt >= x.start && tt < x.end);
      if (idx < 0) idx = sp.timings.length - 1;
      if (idx !== curIdx) { curIdx = idx; paintSlide(idx); }
      g.drawImage(slide, 0, 0);
    }
    g.fillStyle = th.bar; g.fillRect(0, H - 8, W, 8);
    g.fillStyle = th.accent; g.fillRect(0, H - 8, W * Math.min(1, t / total), 8);
  };

  draw(0);
  return await new Promise<{ blob: Blob; ext: string }>((resolve, reject) => {
    const finish = () => { clearInterval(iv); stream.getTracks().forEach((t) => t.stop()); ac.close().catch(() => {}); };
    const onAbort = () => { try { srcNode.stop(); } catch {} ; rec.onstop = null; if (rec.state !== "inactive") rec.stop(); finish(); reject(new DOMException("تم إلغاء العملية", "AbortError")); };
    signal.addEventListener("abort", onAbort, { once: true });
    rec.onstop = () => { finish(); signal.removeEventListener("abort", onAbort); resolve({ blob: new Blob(chunks, { type: mime.split(";")[0] || "video/webm" }), ext }); };
    rec.onerror = () => { finish(); reject(new Error("فشل تسجيل الفيديو")); };
    let wake: any = null;
    (navigator as any).wakeLock?.request?.("screen").then((w: any) => (wake = w)).catch(() => {});
    const stopRec = () => { try { wake?.release?.(); } catch {} ; if (rec.state !== "inactive") { try { rec.requestData(); } catch {} ; rec.stop(); } };
    const w0 = performance.now();
    const t0 = ac.currentTime;
    // Use audio clock when running, fall back to wall clock (iOS/mobile may keep AudioContext suspended)
    const frame = () => {
      const wall = (performance.now() - w0) / 1000;
      const t = ac.state === "running" ? Math.max(ac.currentTime - t0, 0) : wall;
      draw(Math.min(t, total));
      onP((t / total) * 100, "إنشاء الفيديو…");
      if (t >= total + 0.5 || wall >= total + 3) stopRec();
    };
    const iv = setInterval(frame, 1000 / FPS);
    srcNode.onended = () => setTimeout(stopRec, 300);
    rec.start(1000);
    srcNode.start(ac.currentTime + LEAD); // narration begins after the title slide
    ac.resume().catch(() => {});
  });
}
