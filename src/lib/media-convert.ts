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

function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.getChannelData(0);
  const ab = new ArrayBuffer(44 + ch.length * 2);
  const v = new DataView(ab);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + ch.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, ch.length * 2, true);
  for (let i = 0; i < ch.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, ch[i])) * 0x7fff, true);
  return new Blob([ab], { type: "audio/wav" });
}

export type SpeechResult = { wav: Blob; buffer: AudioBuffer; timings: Array<{ seg: Segment; start: number; end: number }> };

export async function synthesize(segs: Segment[], voice: Voice, signal: AbortSignal, onP: Progress): Promise<SpeechResult> {
  const tts = await import("@mintplex-labs/piper-tts-web");
  const ctx = new AudioContext();
  const parts: AudioBuffer[] = [];
  try {
    for (let i = 0; i < segs.length; i++) {
      checkAbort(signal);
      onP((i / segs.length) * 100, i === 0 ? "تحميل محرك الصوت المحلي (مرة واحدة فقط)…" : `توليد الصوت ${i + 1} من ${segs.length}`);
      const blob = await tts.predict({ text: segs[i].text, voiceId: VOICE_ID[voice] as any }, (p: any) => {
        if (i === 0 && p?.total) onP((p.loaded / p.total) * 100, "تحميل نموذج الصوت…");
      });
      parts.push(await ctx.decodeAudioData(await blob.arrayBuffer()));
    }
    const rate = parts[0].sampleRate;
    const gap = Math.round(rate * 0.25);
    const total = parts.reduce((n, b) => n + b.length + gap, 0);
    const out = ctx.createBuffer(1, total, rate);
    const data = out.getChannelData(0);
    const timings: SpeechResult["timings"] = [];
    let off = 0;
    parts.forEach((b, i) => {
      data.set(b.getChannelData(0), off);
      timings.push({ seg: segs[i], start: off / rate, end: (off + b.length + gap) / rate });
      off += b.length + gap;
    });
    return { wav: encodeWav(out), buffer: out, timings };
  } finally {
    ctx.close().catch(() => {});
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
  const [W, H] = ratio === "16:9" ? [1280, 720] : [720, 1280];
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d")!;
  const ac = new AudioContext();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const srcNode = ac.createBufferSource();
  srcNode.buffer = sp.buffer;
  srcNode.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const { mime, ext } = pickVideoMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const duration = sp.buffer.duration;

  const draw = (t: number) => {
    const cur = sp.timings.find((x) => t >= x.start && t < x.end) ?? sp.timings[sp.timings.length - 1];
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#0f2a44"); grd.addColorStop(1, "#134e4a");
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const rtl = /[\u0600-\u06FF]/.test(cur.seg.text);
    g.direction = rtl ? "rtl" : "ltr";
    g.textAlign = rtl ? "right" : "left";
    const pad = W * 0.07, x = rtl ? W - pad : pad;
    g.fillStyle = "#99f6e4"; g.font = `bold ${Math.round(W * 0.028)}px Tahoma, Arial`;
    g.fillText(`${title} — صفحة ${cur.seg.page}`, x, H * 0.09);
    const fs = Math.round(Math.min(W, H) * 0.048);
    g.font = `${fs}px Tahoma, Arial`; g.fillStyle = "#ffffff";
    const lines = wrap(g, cur.seg.text, W - pad * 2).slice(0, Math.floor((H * 0.72) / (fs * 1.6)));
    lines.forEach((l, i) => g.fillText(l, x, H * 0.18 + fs + i * fs * 1.6));
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
    const t0 = ac.currentTime;
    // interval keeps drawing even when the tab is in background (rAF pauses)
    const tick = () => { const t = ac.currentTime - t0; draw(t); onP((t / duration) * 100, "إنشاء الفيديو…"); };
    const iv = setInterval(tick, 1000 / 30);
    srcNode.onended = () => setTimeout(() => rec.state !== "inactive" && rec.stop(), 300);
    rec.start(1000);
    srcNode.start();
  });
}
