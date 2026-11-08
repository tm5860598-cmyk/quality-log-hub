// Pure (DOM-free) text extraction helpers for the local file -> speech converter.
// Nothing here talks to a network or an AI service, so it is safe to unit test in Node/Bun.

export type RawSection = { title: string; text: string };

/** Minimal read-only view of a ZIP package (docx/xlsx/pptx/odf), implemented on top of fflate in the browser. */
export type ZipLike = {
  list(): string[];
  read(path: string): string | undefined;
};

/* ------------------------------ text cleanup ------------------------------ */

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""; } catch { return ""; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Normalises whitespace and invisible characters while keeping paragraph breaks. */
export function clean(s: string): string {
  return s
    .replace(/\u0000/g, " ")
    .replace(/[​-‏‪-‮⁦-⁩﻿­]/g, "") // zero-width + bidi controls
    .normalize("NFKC") // Arabic presentation forms -> base letters
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text as fed to the speech engine: drops symbols a voice cannot pronounce. */
export function speakable(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/ـ+/g, "") // tatweel
    .replace(/^[\s]*[•●▪■◦○▫►▶✓✔★☆\-–—*]+\s+/gm, "")
    .replace(/[|_~^#*`<>[\]{}\\=+]+/g, " ")
    .replace(/[\p{Extended_Pictographic}️]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const xmlStrip = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, ""));

/* ------------------------------ plain-text kinds ------------------------------ */

/** Decodes bytes as UTF-8/UTF-16, falling back to Windows-1256 (Arabic) / 1252 for legacy files. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes);
  } catch {
    // Not valid UTF-8: legacy single-byte file. Arabic Windows files use cp1256.
    let high = 0;
    for (let i = 0; i < Math.min(bytes.length, 4000); i++) if (bytes[i] >= 0xc0) high++;
    try { return new TextDecoder(high ? "windows-1256" : "windows-1252").decode(bytes); }
    catch { return new TextDecoder("utf-8").decode(bytes); }
  }
}

export function htmlToText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return decodeEntities(
    body
      .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(td|th)>/gi, " ، ")
      .replace(/<(br|hr)\s*\/?>|<\/(p|div|li|tr|h[1-6]|section|article|table|ul|ol|blockquote|pre)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/ ، (?=\n|$)/g, "");
}

export function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, "$2")
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, "")
    .replace(/\|/g, " ، ");
}

/** SubRip / WebVTT -> plain sentences. */
export function subtitleToText(s: string): string {
  return s
    .replace(/^WEBVTT.*$/m, "")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/^\s*[\d:.,]+\s*-->\s*[\d:.,]+.*$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n");
}

/* --------------------------------- tables --------------------------------- */

export function parseCsv(text: string): string[][] {
  const first = text.split("\n", 1)[0] ?? "";
  const delim = [",", ";", "\t", "|"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const isNumberLike = (s: string) => /^[-+]?[\d٠-٩.,٫٬%/:\s-]+$/.test(s.trim());

/**
 * Turns a table into something that sounds natural when read aloud.
 * With a text header row: "الاسم: أحمد، العمر: 30." per row; otherwise cells joined with an Arabic comma.
 */
export function tabularToSpeech(input: string[][]): string {
  const rows = input.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  if (!rows.length) return "";
  const head = rows[0];
  const filled = head.filter(Boolean);
  const headerMode =
    rows.length > 1 && filled.length >= 2 && head.length <= 15 && filled.length >= head.length * 0.6 &&
    filled.every((h) => !isNumberLike(h)) && new Set(filled).size === filled.length;
  if (headerMode) {
    return rows.slice(1).map((r) => {
      const parts = r.map((v, i) => (v && head[i] ? `${head[i]}: ${v}` : v)).filter(Boolean);
      return parts.join("، ") + ".";
    }).join("\n");
  }
  return rows.map((r) => r.filter(Boolean).join(" ، ")).join("\n");
}

/* --------------------------------- OOXML ---------------------------------- */

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Resolves a relationship target relative to the part that owns the .rels file. */
function relTarget(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/");
  parts.pop();
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function readRels(z: ZipLike, relsPath: string, ownerPath: string): Map<string, string> {
  const map = new Map<string, string>();
  const xml = z.read(relsPath);
  if (!xml) return map;
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id"), target = attr(m[0], "Target");
    if (id && target && attr(m[0], "TargetMode") !== "External") map.set(id, relTarget(ownerPath, decodeEntities(target)));
  }
  return map;
}

const HEADING = /^(heading\s?[12]|title|subtitle|عنوان\s?[12]?)$/i;

export function parseDocx(z: ZipLike): RawSection[] {
  const xml = z.read("word/document.xml");
  if (!xml) throw new Error("ملف Word تالف أو غير مدعوم");
  const sections: RawSection[] = [];
  let title = "المستند", buf: string[] = [];
  let tableDepth = 0, row: string[] = [], cell: string[] = [];
  const flush = () => {
    const text = clean(buf.join("\n"));
    if (text) sections.push({ title, text });
    buf = [];
  };
  const tokens = /<w:tbl>|<\/w:tbl>|<\/w:tc>|<\/w:tr>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  for (const m of xml.matchAll(tokens)) {
    const t = m[0];
    if (t === "<w:tbl>") { tableDepth++; continue; }
    if (t === "</w:tbl>") { tableDepth = Math.max(0, tableDepth - 1); continue; }
    if (t === "</w:tc>") { row.push(cell.join(" ").trim()); cell = []; continue; }
    if (t === "</w:tr>") { const line = row.filter(Boolean).join(" ، "); if (line) buf.push(line); row = []; continue; }
    let text = "";
    for (const r of t.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\b[^>]*\/>/g)) {
      text += r[1] !== undefined ? decodeEntities(r[1]) : r[0].startsWith("<w:tab") ? " " : "\n";
    }
    text = text.trim();
    if (!text) continue;
    if (tableDepth > 0) { cell.push(text); continue; }
    const style = /<w:pStyle\b[^>]*w:val="([^"]+)"/.exec(t)?.[1] ?? "";
    if (HEADING.test(style)) { flush(); title = text.slice(0, 70); }
    buf.push(text);
  }
  flush();
  // Headings only make sense as separate sections when there are at least two of them.
  if (sections.length > 1) return sections;
  return sections.length ? [{ title: "المستند", text: sections[0].text }] : [];
}

export function parsePptx(z: ZipLike, opts: { notes?: boolean } = {}): RawSection[] {
  const paths = z.list();
  let slidePaths: string[] = [];
  const pres = z.read("ppt/presentation.xml");
  if (pres) {
    const rels = readRels(z, "ppt/_rels/presentation.xml.rels", "ppt/presentation.xml");
    for (const m of pres.matchAll(/<p:sldId\b[^>]*>/g)) {
      const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
      const p = rid && rels.get(rid);
      if (p && z.read(p) !== undefined) slidePaths.push(p);
    }
  }
  if (!slidePaths.length) {
    slidePaths = paths
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  }
  const paragraphs = (xml: string) => {
    const cleaned = xml.replace(/<a:fld\b[^>]*type="slidenum"[\s\S]*?<\/a:fld>/g, "");
    return [...cleaned.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
      .map((p) => [...p[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/?>/g)].map((t) => (t[1] !== undefined ? decodeEntities(t[1]) : "\n")).join("").trim())
      .filter(Boolean);
  };
  const out: RawSection[] = [];
  slidePaths.forEach((p, i) => {
    const xml = z.read(p) ?? "";
    const lines = paragraphs(xml);
    if (opts.notes) {
      const rels = readRels(z, p.replace(/([^/]+)$/, "_rels/$1.rels"), p);
      const notes = [...rels.values()].find((v) => /notesSlides\/notesSlide\d+\.xml$/.test(v));
      const nx = notes && z.read(notes);
      if (nx) {
        const nl = paragraphs(nx);
        if (nl.length) lines.push("ملاحظات المتحدث:", ...nl);
      }
    }
    const text = clean(lines.join("\n"));
    if (text) out.push({ title: `شريحة ${i + 1}`, text });
  });
  return out;
}

const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function excelDate(serial: number): string {
  const ms = Math.round(serial * 86400000);
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  const iso = d.toISOString();
  return serial % 1 === 0 ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

const colIndex = (ref: string) => {
  let n = 0;
  for (const c of /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A") n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
};

export function parseXlsx(z: ZipLike): RawSection[] {
  const wb = z.read("xl/workbook.xml");
  if (!wb) throw new Error("ملف Excel تالف أو غير مدعوم");
  const rels = readRels(z, "xl/_rels/workbook.xml.rels", "xl/workbook.xml");

  const shared: string[] = [];
  const ss = z.read("xl/sharedStrings.xml");
  if (ss) {
    for (const si of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const body = si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
      shared.push(decodeEntities([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
    }
  }

  // Which cell styles hold dates / percentages.
  const dateXf = new Set<number>(), pctXf = new Set<number>();
  const styles = z.read("xl/styles.xml");
  if (styles) {
    const custom = new Map<number, string>();
    for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
      const id = Number(attr(m[0], "numFmtId")), code = attr(m[0], "formatCode");
      if (!Number.isNaN(id) && code) custom.set(id, decodeEntities(code));
    }
    const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
    [...xfs.matchAll(/<xf\b[^>]*>/g)].forEach((m, i) => {
      const id = Number(attr(m[0], "numFmtId") ?? 0);
      const code = custom.get(id)?.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "") ?? "";
      if (BUILTIN_DATE_FMT.has(id) || (code && /[ymdhs]/i.test(code) && !/^general$/i.test(code))) dateXf.add(i);
      else if (id === 9 || id === 10 || /%/.test(code)) pctXf.add(i);
    });
  }

  const num = (v: string, s: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    if (dateXf.has(s)) return excelDate(n);
    if (pctXf.has(s)) return `${parseFloat((n * 100).toPrecision(10))}%`;
    return String(parseFloat(n.toPrecision(12)));
  };

  const out: RawSection[] = [];
  for (const sh of wb.matchAll(/<sheet\b[^>]*>/g)) {
    if (attr(sh[0], "state") && attr(sh[0], "state") !== "visible") continue; // hidden sheets
    const rid = /r:id="([^"]+)"/.exec(sh[0])?.[1];
    const path = rid && rels.get(rid);
    const xml = path && z.read(path);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], "r"), t = attr(c[1], "t"), s = Number(attr(c[1], "s") ?? 0);
        const inner = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
        let val = "";
        if (t === "s") val = shared[Number(v)] ?? "";
        else if (t === "inlineStr") val = decodeEntities([...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
        else if (t === "str") val = decodeEntities(v);
        else if (t === "b") val = v === "1" ? "نعم" : "لا";
        else if (t === "e") val = "";
        else if (v) val = num(v, s);
        if (ref) cells[colIndex(ref)] = val.trim();
        else cells.push(val.trim());
      }
      rows.push(Array.from(cells, (x) => x ?? ""));
    }
    const text = clean(tabularToSpeech(rows));
    if (text) out.push({ title: `ورقة: ${decodeEntities(attr(sh[0], "name") ?? `${out.length + 1}`)}`, text });
  }
  return out;
}

/* ---------------------------- OpenDocument (odf) ---------------------------- */

export function parseOpenDocument(kind: "odt" | "ods" | "odp", z: ZipLike): RawSection[] {
  const xml = z.read("content.xml");
  if (!xml) throw new Error("ملف OpenDocument تالف أو غير مدعوم");
  const toText = (s: string) =>
    clean(xmlStrip(
      s.replace(/<text:line-break\s*\/>/g, "\n").replace(/<text:tab\s*\/>/g, " ").replace(/<text:s\b[^>]*\/>/g, " ")
        .replace(/<\/table:table-cell>/g, " ، ").replace(/<\/table:table-row>/g, "\n")
        .replace(/<\/text:p>|<\/text:h>/g, "\n"),
    ).replace(/( ، )+\n/g, "\n"));
  const body = xml.match(/<office:body>([\s\S]*)<\/office:body>/)?.[1] ?? xml;
  if (kind === "odt") {
    const text = toText(body);
    return text ? [{ title: "المستند", text }] : [];
  }
  const re = kind === "ods" ? /<table:table\b[^>]*table:name="([^"]*)"[^>]*>([\s\S]*?)<\/table:table>/g : /<draw:page\b[^>]*>([\s\S]*?)<\/draw:page>/g;
  const out: RawSection[] = [];
  let i = 0;
  for (const m of body.matchAll(re)) {
    i++;
    const text = toText(kind === "ods" ? m[2] : m[1]);
    if (text) out.push({ title: kind === "ods" ? `ورقة: ${decodeEntities(m[1])}` : `شريحة ${i}`, text });
  }
  return out;
}

/* ------------------------------ quality checks ------------------------------ */

/** True when text extracted from a PDF looks like broken font mapping (needs OCR instead). */
export function looksGarbled(text: string): boolean {
  const t = text.replace(/\s/g, "");
  if (t.length < 20) return false;
  const bad = (t.match(/[-�\u0000-\u001F]/g) ?? []).length;
  return bad / t.length > 0.08;
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Dominant script of a text: used to pick the Arabic or English voice. */
export function dominantScript(s: string): "ar" | "en" {
  const ar = (s.match(/[؀-ۿ]/g) ?? []).length;
  const en = (s.match(/[A-Za-z]/g) ?? []).length;
  return ar >= en ? "ar" : "en";
}

/* --------------------------------- outputs ---------------------------------- */

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

const srtTime = (t: number) => {
  const ms = Math.round(t * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/** SubRip subtitles aligned with the generated audio. */
export function buildSrt(timings: Array<{ text: string; start: number; end: number }>): string {
  return timings.map((t, i) => `${i + 1}\n${srtTime(t.start)} --> ${srtTime(Math.max(t.end - 0.05, t.start + 0.1))}\n${t.text.trim()}\n`).join("\n");
}

/** Rough speaking-time estimate (Piper ≈ 14 characters per second incl. pauses). */
export function estimateSeconds(chars: number): number {
  return chars / 14;
}

/* ------------------------------ file kinds ------------------------------ */

export type FileKind = "pdf" | "word" | "excel" | "powerpoint" | "image" | "text" | "legacy";

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF", word: "Word", excel: "Excel", powerpoint: "PowerPoint", image: "صورة", text: "نص", legacy: "صيغة قديمة",
};

/** Extensions offered in the file picker (legacy doc/xls/ppt are detected but explained, not parsed). */
export const ACCEPT =
  ".pdf,.docx,.odt,.xlsx,.ods,.pptx,.odp,.csv,.tsv,.txt,.md,.json,.html,.htm,.xml,.srt,.vtt,.log,.doc,.xls,.ppt,image/png,image/jpeg,image/webp,image/bmp,image/gif";

export function detectKind(name: string, mime = ""): FileKind | null {
  const n = name.toLowerCase();
  if (/\.pdf$/.test(n)) return "pdf";
  if (/\.(docx|odt)$/.test(n)) return "word";
  if (/\.(xlsx|ods)$/.test(n)) return "excel";
  if (/\.(pptx|odp)$/.test(n)) return "powerpoint";
  if (/\.(doc|xls|ppt)$/.test(n)) return "legacy";
  if (/\.(png|jpe?g|webp|bmp|gif)$/.test(n) || /^image\/(png|jpeg|webp|bmp|gif)$/.test(mime)) return "image";
  if (/\.(txt|md|csv|tsv|json|html?|xml|srt|vtt|log)$/.test(n) || mime.startsWith("text/")) return "text";
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
