// Client-side document text extraction (PDF + Word), keeping page numbers.

export type ParsedPage = { page: number; text: string };

export async function parsePdf(file: File): Promise<ParsedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: ParsedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push({ page: i, text });
  }
  return pages;
}

export async function parseDocx(file: File): Promise<ParsedPage[]> {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const result = await (mammoth as unknown as {
    extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  }).extractRawText({ arrayBuffer: buf });
  const clean = result.value.replace(/\r/g, "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  // Word has no fixed pagination in the raw text; approximate ~3000 chars per page.
  const pages: ParsedPage[] = [];
  let current = "";
  let page = 1;
  for (const para of clean) {
    if ((current + " " + para).length > 3000 && current) {
      pages.push({ page, text: current.trim() });
      page += 1;
      current = para;
    } else {
      current += "\n" + para;
    }
  }
  if (current.trim()) pages.push({ page, text: current.trim() });
  return pages;
}

export async function parseDocument(file: File): Promise<ParsedPage[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    return [{ page: 1, text }];
  }
  throw new Error("صيغة غير مدعومة. ارفع PDF أو DOCX أو TXT");
}

/** Split page text into ~1200-char chunks, preserving the page number. */
export function chunkPages(pages: ParsedPage[]): Array<{ page: number; text: string }> {
  const out: Array<{ page: number; text: string }> = [];
  for (const p of pages) {
    const words = p.text.split(/\s+/);
    let buf: string[] = [];
    let len = 0;
    for (const w of words) {
      buf.push(w);
      len += w.length + 1;
      if (len >= 1200) {
        out.push({ page: p.page, text: buf.join(" ") });
        buf = buf.slice(-30); // small overlap
        len = buf.join(" ").length;
      }
    }
    if (buf.length && buf.join(" ").trim().length > 40) out.push({ page: p.page, text: buf.join(" ") });
  }
  return out;
}
