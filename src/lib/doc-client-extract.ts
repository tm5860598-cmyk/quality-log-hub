// Browser-side text extraction for the department knowledge base.
// Covers what the server cannot read: scanned PDFs / images (local OCR), Excel, PowerPoint, OpenDocument, HTML, ...
// Fully local (pdf.js, fflate, tesseract.js) — no AI credits.
import type { ExtractedPage } from "./doc-chunk";

const PAGE_CHARS = 2500;

/** Extensions the browser extractor understands. */
export const LOCAL_EXT = ["pdf", "docx", "odt", "xlsx", "ods", "pptx", "odp", "png", "jpg", "jpeg", "webp", "gif", "bmp", "txt", "md", "csv", "tsv", "json", "html", "htm", "xml", "srt", "vtt", "log"];
/** Extensions the server can read without OCR (tried first: faster, no heavy work on the phone). */
export const SERVER_EXT = ["pdf", "docx", "txt", "md", "csv"];

export async function extractPagesLocal(file: File, onP: (pct: number, label: string) => void, signal = new AbortController().signal): Promise<ExtractedPage[]> {
  const { extractFile } = await import("./media-convert");
  const sections = await extractFile(file, signal, onP);
  const pages: ExtractedPage[] = [];
  let seq = 0;
  for (const s of sections) {
    const m = /^صفحة\s+(\d+)/.exec(s.title);
    // Long sections (plain text, Word, big sheets) are split into page-sized parts so citations stay useful.
    const parts: string[] = [];
    let cur = "";
    for (const line of s.text.split("\n")) {
      if (cur && cur.length + line.length > PAGE_CHARS) { parts.push(cur); cur = line; } else cur += (cur ? "\n" : "") + line;
    }
    if (cur.trim()) parts.push(cur);
    parts.forEach((t, j) => {
      seq++;
      const label = !m && s.title && s.title !== "النص" && j === 0 ? `${s.title}\n` : "";
      pages.push({ page: m ? Number(m[1]) : seq, text: label + t });
    });
  }
  return pages.filter((p) => p.text.trim().length > 0);
}
