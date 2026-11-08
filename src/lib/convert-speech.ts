// Speech planning for the local converter (pure, DOM-free, unit-testable).
// Goal: make synthesized speech sound natural by feeding the voice whole sentences,
// pausing according to punctuation, and reading numbers/symbols the way a person would.

import { dominantScript, speakable } from "./convert-text";

export type Lang = "ar" | "en";

/** One speech unit (≈ a sentence). `group` ties units that share one video slide. */
export type Segment = {
  text: string;
  label: string;
  section: number;
  group: number;
  /** Natural pause after this unit, in seconds (before the user's pause scale). */
  pause: number;
};
export type SectionInput = { label: string; text: string };

/* ------------------------------ pauses (seconds) ------------------------------ */
export const PAUSE = { sentence: 0.5, ellipsis: 0.6, colon: 0.3, semicolon: 0.3, clause: 0.2, heading: 0.7, paragraph: 0.9 } as const;

/* ---------------------------------- reflow ---------------------------------- */

const TERMINAL = /[.!?؟…:;؛"”»)\]]$/;
const LIST_ITEM = /^([-•●▪*–—]|\d+\s*[.)\-]|[٠-٩]+\s*[.)\-]|[a-zA-Zأ-ي]\s*[.)])\s+/;

/**
 * PDFs, Word and OCR give one text line per visual line. Reading them as separate
 * sentences makes the voice stop at every line break. This joins soft-wrapped lines
 * back into sentences, keeping real breaks (headings, list items, paragraphs).
 */
export function reflow(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
      const longest = Math.max(0, ...lines.map((l) => l.length));
      let out = "";
      let prevLen = 0;
      for (const line of lines) {
        if (!out) { out = line; prevLen = line.length; continue; }
        const prevEnds = TERMINAL.test(out);
        const headingLike = prevLen < 45 && prevLen < longest * 0.6 && !prevEnds; // clearly shorter than its neighbours, no punctuation: a title
        if (LIST_ITEM.test(line) || prevEnds || (headingLike && !/^[a-z]/.test(line))) out += "\n" + line;
        else if (/[A-Za-z]-$/.test(out) && /^[a-z]/.test(line)) out = out.slice(0, -1) + line; // hyphenated word
        else out += " " + line;
        prevLen = line.length;
      }
      return out;
    })
    .join("\n\n");
}

/* ------------------------------ sentence splitting ------------------------------ */

const ABBR = new Set(["e.g", "i.e", "etc", "vs", "dr", "mr", "mrs", "ms", "prof", "no", "fig", "approx", "inc", "ltd", "st", "jr", "sr", "al", "ca", "cf", "est", "max", "min", "ex", "د", "م", "أ"]);

type Piece = { text: string; end: string; paragraph: boolean };

/** Splits text into sentences without breaking on abbreviations or decimals. */
export function splitSentences(text: string): Piece[] {
  const pieces: Piece[] = [];
  const boundary = /([.!?؟…]+["'”»)\]]*)(\s+)|(\n+)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  const push = (raw: string, paragraph: boolean) => {
    const t = raw.trim();
    if (!t) return;
    const last = t.match(/[.!?؟…:;؛,،]+["'”»)\]]*$/)?.[0] ?? "";
    pieces.push({ text: t, end: last, paragraph });
  };
  while ((m = boundary.exec(text))) {
    if (m[1]) {
      const before = text.slice(start, m.index);
      const word = (before.match(/([\p{L}.]+)$/u)?.[1] ?? "").toLowerCase().replace(/\.$/, "");
      const next = text[m.index + m[0].length] ?? "";
      const abbreviation = m[1] === "." && (ABBR.has(word) || /^[a-z]$/i.test(word) || (/[a-z]/.test(next) && /^[a-z]/.test(next)));
      if (abbreviation) continue; // keep scanning: not a sentence end
      push(text.slice(start, m.index + m[1].length), false);
      start = m.index + m[0].length;
    } else {
      const raw = text.slice(start, m.index);
      push(raw, m[3].length > 1);
      start = m.index + m[0].length;
    }
  }
  push(text.slice(start), true);
  return pieces;
}

/** Breaks an over-long sentence at clause punctuation (then spaces) so each call stays short. */
function breakLong(piece: Piece, max: number): Piece[] {
  if (piece.text.length <= max) return [piece];
  const t = piece.text;
  const mid = t.length / 2;
  let cut = -1, best = Infinity;
  for (const m of t.matchAll(/[,،؛;:]\s+/g)) {
    const pos = m.index! + m[0].length;
    if (pos > 40 && t.length - pos > 40 && Math.abs(pos - mid) < best) { best = Math.abs(pos - mid); cut = pos; }
  }
  if (cut < 0) {
    cut = t.lastIndexOf(" ", Math.ceil(mid));
    if (cut < 40) cut = Math.ceil(mid);
  }
  const a: Piece = { text: t.slice(0, cut).trim(), end: ",", paragraph: false };
  const b: Piece = { ...piece, text: t.slice(cut).trim() };
  return [...breakLong(a, max), ...breakLong(b, max)];
}

function pauseFor(p: Piece): number {
  if (p.paragraph) return PAUSE.paragraph;
  if (/…$/.test(p.end)) return PAUSE.ellipsis;
  if (/[.!?؟]/.test(p.end)) return PAUSE.sentence;
  if (/:$/.test(p.end)) return PAUSE.colon;
  if (/[;؛]$/.test(p.end)) return PAUSE.semicolon;
  if (/[,،]$/.test(p.end)) return PAUSE.clause;
  return PAUSE.heading; // a line with no punctuation at all: a heading
}

/**
 * Plans the speech: reflows lines, splits into whole sentences (one voice call each),
 * assigns punctuation-aware pauses, and groups sentences into slides of ~230 characters.
 */
export function splitSegments(sections: SectionInput[], maxLen = 260, slideLen = 230): Segment[] {
  const out: Segment[] = [];
  let group = 0;
  sections.forEach((s, si) => {
    let pieces = splitSentences(reflow(s.text)).flatMap((p) => breakLong(p, maxLen));
    // Very short fragments ("نعم." / "OK.") sound choppy alone: attach them to the next sentence.
    const merged: Piece[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const nxt = pieces[i + 1];
      if (nxt && !p.paragraph && p.text.length < 16 && p.text.length + nxt.text.length + 1 <= maxLen) {
        pieces[i + 1] = { ...nxt, text: `${p.text} ${nxt.text}` };
      } else merged.push(p);
    }
    pieces = merged;
    let used = 0;
    group++; // each section starts a fresh slide
    pieces.forEach((p) => {
      if (used > 0 && used + p.text.length > slideLen) { group++; used = 0; }
      out.push({ text: p.text, label: s.label, section: si, group, pause: pauseFor(p) });
      used += p.text.length + 1;
      if (p.paragraph) { group++; used = 0; }
    });
  });
  return out;
}

/* --------------------------------- numbers --------------------------------- */

const ONES = ["صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100), r = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else {
      const t = Math.floor(r / 10), o = r % 10;
      parts.push(o ? `${ONES[o]} و${TENS[t]}` : TENS[t]);
    }
  }
  return parts.join(" و");
}

/** Integer -> spoken Arabic words (up to the billions). */
export function arabicNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n >= 1e12) return String(n);
  if (n === 0) return ONES[0];
  const scales: Array<[number, string, string, string]> = [
    [1e9, "مليار", "ملياران", "مليارات"],
    [1e6, "مليون", "مليونان", "ملايين"],
    [1e3, "ألف", "ألفان", "آلاف"],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [size, one, two, few] of scales) {
    const c = Math.floor(rest / size);
    rest %= size;
    if (!c) continue;
    if (c === 1) parts.push(one);
    else if (c === 2) parts.push(two);
    else if (c <= 10) parts.push(`${below1000(c)} ${few}`);
    else parts.push(`${below1000(c)} ${one}`);
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(" و");
}

const toWestern = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));

function arabicDecimal(intPart: string, frac: string): string {
  const lead = frac.match(/^0*/)![0].length;
  const rest = frac.slice(lead);
  const fracWords = (lead ? Array(lead).fill("صفر").join(" ") + " " : "") + (rest ? (rest.length <= 4 ? arabicNumber(Number(rest)) : [...rest].map((d) => ONES[Number(d)]).join(" ")) : "");
  return `${arabicNumber(Number(intPart))} فاصلة ${fracWords.trim()}`;
}

/* --------------------------- text normalisation --------------------------- */

function normalizeArabic(text: string): string {
  let t = toWestern(text).replace(/\[\d+\]/g, " ");
  t = t.replace(/(\d)[,٬](?=\d{3}\b)/g, "$1"); // 1,000 -> 1000
  t = t.replace(/(\d+)[.,٫](\d+)\s*%/g, (_, a, b) => `${arabicDecimal(a, b)} في المئة`);
  t = t.replace(/(\d+)\s*%/g, (_, a) => `${arabicNumber(Number(a))} في المئة`);
  t = t.replace(/(\d+)\s*°\s*[CcمM]?/g, (_, a) => `${arabicNumber(Number(a))} درجة مئوية`);
  t = t.replace(/(\d)\s*[-–]\s*(\d)/g, "$1 إلى $2");
  t = t.replace(/(\d+)[.,٫](\d+)/g, (_, a, b) => arabicDecimal(a, b));
  t = t.replace(/\d+/g, (d) => (d.length > 12 ? [...d].map((x) => ONES[Number(x)]).join(" ") : arabicNumber(Number(d))));
  return t.replace(/&/g, " و ").replace(/\+/g, " زائد ").replace(/=/g, " يساوي ");
}

const EN_ABBR: Array<[RegExp, string]> = [
  [/\be\.g\.?/gi, "for example"], [/\bi\.e\.?/gi, "that is"], [/\betc\.?/gi, "et cetera"], [/\bvs\.?(?=\s)/gi, "versus"],
  [/\bDr\.(?=\s)/g, "Doctor"], [/\bMr\.(?=\s)/g, "Mister"], [/\bMrs\.(?=\s)/g, "Missus"], [/\bProf\.(?=\s)/g, "Professor"],
  [/\bNo\.\s*(?=\d)/g, "Number "], [/\bFig\.\s*(?=\d)/g, "Figure "], [/\bapprox\.?(?=\s)/gi, "approximately"],
];

function normalizeEnglish(text: string): string {
  let t = text.replace(/\[\d+\]/g, " ");
  for (const [re, to] of EN_ABBR) t = t.replace(re, to);
  t = t
    .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/g, "$1 degrees Celsius")
    .replace(/(\d+(?:\.\d+)?)\s*°\s*F\b/g, "$1 degrees Fahrenheit")
    .replace(/(\d+(?:\.\d+)?)\s*°/g, "$1 degrees")
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "$1 percent")
    .replace(/(\d)\s*[-–]\s*(\d)/g, "$1 to $2")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/=/g, " equals ");
  return t;
}

/** Final text sent to the voice for one unit: symbols removed, numbers/units spoken, heading dot added. */
export function normalizeForSpeech(raw: string, lang: Lang = dominantScript(raw)): string {
  let t = speakable(lang === "ar" ? normalizeArabic(raw) : normalizeEnglish(raw));
  if (t && !/[.!?؟…:;؛,،]$/.test(t)) t += "."; // closing mark gives the voice a natural falling intonation
  return t;
}

/* ------------------------------- audio polish ------------------------------- */

/** Removes silence the voice adds at both ends of a clip, then fades the edges (no clicks at joins). */
export function polishClip(pcm: Int16Array, rate: number): Int16Array {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
  if (!peak) return pcm;
  const th = Math.max(40, peak * 0.012);
  let a = 0, b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < th) a++;
  while (b > a && Math.abs(pcm[b]) < th) b--;
  const pre = Math.round(rate * 0.04), post = Math.round(rate * 0.08);
  a = Math.max(0, a - pre); b = Math.min(pcm.length - 1, b + post);
  const out = pcm.slice(a, b + 1);
  const fade = Math.min(Math.round(rate * 0.008), out.length >> 1);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] = out[i] * g;
    out[out.length - 1 - i] = out[out.length - 1 - i] * g;
  }
  return out;
}

/** Scales the whole track so its loudest sample sits near full scale (never boosts more than 3x). */
export function normalizePeak(pcm: Int16Array, target = 0.92): void {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
  if (!peak) return;
  const k = Math.min(3, (target * 32767) / peak);
  if (Math.abs(k - 1) < 0.03) return;
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * k)));
}

/* ----------------------------- speed (WSOLA) ----------------------------- */

/**
 * Changes speaking speed without changing pitch (waveform-similarity overlap-add).
 * speed < 1 = slower, > 1 = faster. Local, no AI, ~O(n).
 */
export function timeStretch(pcm: Int16Array, rate: number, speed: number): Int16Array {
  if (!pcm.length || Math.abs(speed - 1) < 0.02) return pcm;
  const N = Math.max(256, Math.round(rate * 0.032) & ~1), hopS = N >> 1, hopA = hopS * speed;
  const seek = Math.round(rate * 0.012);
  const len = pcm.length;
  if (len < N * 3) return pcm;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); // periodic Hann: 50% overlap sums to 1
  const outLen = Math.ceil(len / speed) + N * 2;
  const out = new Float32Array(outLen), norm = new Float32Array(outLen);
  let prev = 0, k = 0, last = 0;
  for (;; k++) {
    const target = Math.round(k * hopA);
    if (target + N > len) break;
    let best = target;
    if (k > 0) {
      const ref = prev + hopS; // where the previous frame would naturally continue
      let bestScore = -Infinity;
      for (let d = -seek; d <= seek; d += 2) {
        const c = target + d;
        if (c < 0 || c + hopS > len || ref + hopS > len) continue;
        let dot = 0, e = 1e-9;
        for (let i = 0; i < hopS; i += 4) { const a = pcm[ref + i], b = pcm[c + i]; dot += a * b; e += b * b; }
        const score = dot / Math.sqrt(e);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best + N > len) best = Math.max(0, len - N);
    }
    const o = k * hopS;
    if (o + N > outLen) break;
    for (let i = 0; i < N; i++) { out[o + i] += pcm[best + i] * win[i]; norm[o + i] += win[i]; }
    prev = best; last = o + N;
  }
  const res = new Int16Array(last);
  for (let i = 0; i < last; i++) {
    const v = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
    res[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
  }
  return res;
}
