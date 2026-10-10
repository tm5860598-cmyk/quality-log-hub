// Fully local (browser-only) file -> text -> speech -> video pipeline.
// No AI API / credits: pdf.js, fflate, tesseract.js (OCR wasm), Piper TTS (wasm), Canvas + MediaRecorder.

export type Progress = (pct: number, label: string) => void;
export type Segment = { text: string; page: number };

const clean = (s: string) => s.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const checkAbort = (s: AbortSignal) => {
  if (s.aborted) throw new DOMException("تم إلغاء العملية", "AbortError");
};
const xmlText = (xml: string, para: RegExp) =>
  xml
    .replace(para, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function ocrCanvasOrBlob(src: HTMLCanvasElement | Blob, signal: AbortSignal): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["ara", "eng"]);
  const onAbort = () => worker.terminate();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const { data } = await worker.recognize(src as any);
    return clean(data.text || "");
  } finally {
    signal.removeEventListener("abort", onAbort);
    await worker.terminate().catch(() => {});
  }
}

async function extractPdf(bytes: Uint8Array, signal: AbortSignal, onP: Progress): Promise<Segment[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const out: Segment[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    checkAbort(signal);
    onP((i / pdf.numPages) * 100, `قراءة الصفحة ${i} من ${pdf.numPages}`);
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let text = clean(tc.items.map((it: any) => (it.str ?? "") + (it.hasEOL ? "\n" : " ")).join(""));
    if (text.length < 20) {
      // scanned page -> local OCR
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      onP((i / pdf.numPages) * 100, `قراءة صفحة مصوّرة ${i} (OCR)`);
      text = await ocrCanvasOrBlob(c, signal);
      c.width = 0; c.height = 0; page.cleanup();
    }
    if (text) out.push({ page: i, text });
  }
  return out;
}

async function extractOffice(name: string, bytes: Uint8Array): Promise<Segment[]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  if (name.endsWith(".docx")) {
    const e = files["word/document.xml"];
    if (!e) throw new Error("ملف Word تالف");
    return [{ page: 1, text: clean(xmlText(strFromU8(e), /<\/w:p>|<w:br[^>]*\/>/g)) }];
  }
  if (name.endsWith(".pptx")) {
    const slides = Object.keys(files)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    return slides.map((k, i) => ({ page: i + 1, text: clean(xmlText(strFromU8(files[k]), /<\/a:p>/g)) }));
  }
  // xlsx
  const ss = files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : "";
  const shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1], /$^/g));
  const sheets = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
  return sheets.map((k, i) => {
    const xml = strFromU8(files[k]);
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
      [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map((c) => {
          const v = c[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? xmlText(c[2], /$^/g);
          return /t="s"/.test(c[1]) ? shared[Number(v)] ?? "" : v;
        })
        .filter(Boolean)
        .join(" ، "),
    );
    return { page: i + 1, text: clean(rows.filter(Boolean).join("\n")) };
  });
}

export async function extractFile(file: File, signal: AbortSignal, onP: Progress): Promise<Segment[]> {
  const name = file.name.toLowerCase();
  if (file.size > 50 * 1024 * 1024) throw new Error("حجم الملف أكبر من 50 ميجابايت");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let segs: Segment[];
  if (name.endsWith(".pdf")) segs = await extractPdf(bytes, signal, onP);
  else if (/\.(docx|pptx|xlsx)$/.test(name)) segs = await extractOffice(name, bytes);
  else if (/\.(doc|ppt|xls)$/.test(name)) throw new Error("الصيغ القديمة (doc/ppt/xls) غير مدعومة — احفظ الملف بالصيغة الحديثة (docx/pptx/xlsx) أو PDF");
  else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/.test(name)) {
    onP(30, "قراءة النص من الصورة (OCR محلي)…");
    segs = [{ page: 1, text: await ocrCanvasOrBlob(file, signal) }];
  } else if (file.type.startsWith("text/") || /\.(txt|md|csv|json|html?|xml|srt)$/.test(name)) {
    segs = [{ page: 1, text: clean(new TextDecoder().decode(bytes)) }];
  } else throw new Error("صيغة غير مدعومة");
  segs = segs.filter((s) => s.text.length > 0);
  if (!segs.length) throw new Error("لم يتم العثور على نص داخل الملف");
  return segs;
}

/** Split into speakable chunks (~350 chars) keeping page numbers. */
export function splitSegments(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const sentences = s.text.split(/(?<=[.!?؟。\n])\s+/);
    let buf = "";
    for (const sen of sentences) {
      if (buf && (buf + " " + sen).length > 350) { out.push({ page: s.page, text: buf.trim() }); buf = sen; }
      else buf = buf ? buf + " " + sen : sen;
      while (buf.length > 500) { out.push({ page: s.page, text: buf.slice(0, 450) }); buf = buf.slice(450); }
    }
    if (buf.trim()) out.push({ page: s.page, text: buf.trim() });
  }
  return out;
}

export type Voice = "ar-eg" | "ar" | "en";
const VOICE_ID: Record<Voice, string> = { "ar-eg": "ar_JO-kareem-medium", ar: "ar_JO-kareem-medium", en: "en_US-hfc_female-medium" };

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

export type SpeechResult = { wav: Blob; pcm: Int16Array; rate: number; duration: number; timings: Array<{ seg: Segment; start: number; end: number }> };

export async function synthesize(segs: Segment[], voice: Voice, signal: AbortSignal, onP: Progress): Promise<SpeechResult> {
  const tts = await import("@mintplex-labs/piper-tts-web");
  const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
  (tts.TtsSession.WASM_LOCATIONS as any).onnxWasm = ORT;
  const ortMod: any = await import("onnxruntime-web/wasm");
  const ort = ortMod.default || ortMod;
  if (ort?.env?.wasm) { ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = 1; }
  onP(0, "تحميل محرك الصوت المحلي (مرة واحدة فقط)…");
  if (tts.TtsSession._instance && tts.TtsSession._instance.voiceId !== VOICE_ID[voice]) tts.TtsSession._instance = null;
  const session =
    tts.TtsSession._instance ??
    (await tts.TtsSession.create({
      voiceId: VOICE_ID[voice] as any,
      progress: (p: any) => p?.total && onP((p.loaded / p.total) * 100, "تحميل نموذج الصوت…"),
      wasmPaths: { ...tts.TtsSession.WASM_LOCATIONS, onnxWasm: ORT },
    }));
  let fallbackCtx: AudioContext | null = null;
  const parts: Int16Array[] = [];
  let rate = 0;
  try {
    for (let i = 0; i < segs.length; i++) {
      checkAbort(signal);
      onP((i / segs.length) * 100, i === 0 ? "تحميل محرك الصوت المحلي (مرة واحدة فقط)…" : `توليد الصوت ${i + 1} من ${segs.length}`);
      const ab = await (await session.predict(segs[i].text)).arrayBuffer();
      let p = parseWav(ab);
      if (!p) {
        fallbackCtx ??= new AudioContext({ sampleRate: rate || 22050 });
        const b = await fallbackCtx.decodeAudioData(ab);
        const f = b.getChannelData(0), pcm = new Int16Array(f.length);
        for (let k = 0; k < f.length; k++) pcm[k] = Math.max(-1, Math.min(1, f[k])) * 0x7fff;
        p = { pcm, rate: b.sampleRate };
      }
      rate ||= p.rate;
      parts.push(p.pcm);
      // yield so the page stays responsive on phones
      await new Promise((r) => setTimeout(r, 0));
    }
    const gap = Math.round(rate * 0.25);
    const total = parts.reduce((n, b) => n + b.length + gap, 0);
    const pcm = new Int16Array(total);
    const timings: SpeechResult["timings"] = [];
    let off = 0;
    parts.forEach((b, i) => {
      pcm.set(b, off);
      timings.push({ seg: segs[i], start: off / rate, end: (off + b.length + gap) / rate });
      off += b.length + gap;
      parts[i] = new Int16Array(0);
    });
    return { wav: encodeWav(pcm, rate), pcm, rate, duration: total / rate, timings };
  } finally {
    fallbackCtx?.close().catch(() => {});
  }
}

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

export function pickVideoMime(): { mime: string; ext: string } {
  const opts = [
    { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return opts.find((o) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) ?? { mime: "", ext: "webm" };
}

export async function renderVideo(sp: SpeechResult, ratio: "16:9" | "9:16", title: string, signal: AbortSignal, onP: Progress) {
  if (typeof MediaRecorder === "undefined") throw new Error("المتصفح لا يدعم تسجيل الفيديو");
  // Lower resolution/fps keeps memory low on phones (prevents the browser from reloading the tab)
  const [W, H] = ratio === "16:9" ? [960, 540] : [540, 960];
  const FPS = 15;
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
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const duration = sp.duration;

  // Pre-render the slide (background + text) once per segment; per frame only blit + progress bar.
  const slide = document.createElement("canvas");
  slide.width = W; slide.height = H;
  const s = slide.getContext("2d")!;
  let curIdx = -1;
  const paintSlide = (idx: number) => {
    const cur = sp.timings[idx];
    const grd = s.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#0f2a44"); grd.addColorStop(1, "#134e4a");
    s.fillStyle = grd; s.fillRect(0, 0, W, H);
    const rtl = /[\u0600-\u06FF]/.test(cur.seg.text);
    s.direction = rtl ? "rtl" : "ltr";
    s.textAlign = rtl ? "right" : "left";
    const pad = W * 0.07, x = rtl ? W - pad : pad;
    s.fillStyle = "#99f6e4"; s.font = `bold ${Math.round(W * 0.028)}px Tahoma, Arial`;
    s.fillText(`${title} — صفحة ${cur.seg.page}`, x, H * 0.09);
    const fs = Math.round(Math.min(W, H) * 0.048);
    s.font = `${fs}px Tahoma, Arial`; s.fillStyle = "#ffffff";
    const lines = wrap(s, cur.seg.text, W - pad * 2).slice(0, Math.floor((H * 0.72) / (fs * 1.6)));
    lines.forEach((l, i) => s.fillText(l, x, H * 0.18 + fs + i * fs * 1.6));
  };
  const draw = (t: number) => {
    let idx = sp.timings.findIndex((x) => t >= x.start && t < x.end);
    if (idx < 0) idx = sp.timings.length - 1;
    if (idx !== curIdx) { curIdx = idx; paintSlide(idx); }
    g.drawImage(slide, 0, 0);
    g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(0, H - 10, W, 10);
    g.fillStyle = "#2dd4bf"; g.fillRect(0, H - 10, W * Math.min(1, t / duration), 10);
  };

  draw(0);
  return await new Promise<{ blob: Blob; ext: string }>((resolve, reject) => {
    let raf = 0;
    const finish = () => { cancelAnimationFrame(raf); clearInterval(iv); stream.getTracks().forEach((t) => t.stop()); ac.close().catch(() => {}); };
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
    const tick = () => {
      const wall = (performance.now() - w0) / 1000;
      const t = ac.state === "running" ? Math.max(ac.currentTime - t0, 0) : wall;
      draw(Math.min(t, duration));
      onP((t / duration) * 100, "إنشاء الفيديو…");
      if (t >= duration + 0.5 || wall >= duration + 3) stopRec();
    };
    const iv = setInterval(tick, 1000 / FPS);
    srcNode.onended = () => setTimeout(stopRec, 300);
    rec.start(1000);
    srcNode.start();
    ac.resume().catch(() => {});
  });
}
