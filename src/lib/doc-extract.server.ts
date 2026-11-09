import type { ExtractedPage } from "./doc-chunk";
export type { ExtractedPage };

const clean = (s: string) => s.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

async function extractPdf(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [String(text)];
  return pages.map((t, i) => ({ page: i + 1, text: clean(t ?? "") })).filter((p) => p.text.length > 20);
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const entry = files["word/document.xml"];
  if (!entry) throw new Error("ملف Word غير صالح أو تالف");
  const raw = clean(xmlToText(strFromU8(entry)));
  if (raw.length < 20) throw new Error("لم يتم العثور على نص داخل ملف Word");
  // Word has no fixed pagination in XML: approximate ~2500 chars per page.
  const paras = raw.split("\n").filter((p) => p.trim());
  const pages: ExtractedPage[] = [];
  let cur = "";
  let page = 1;
  for (const p of paras) {
    if (cur && (cur + p).length > 2500) {
      pages.push({ page, text: cur.trim() });
      page += 1;
      cur = p;
    } else {
      cur += "\n" + p;
    }
  }
  if (cur.trim()) pages.push({ page, text: cur.trim() });
  return pages;
}

export async function extractPages(fileName: string, bytes: Uint8Array): Promise<ExtractedPage[]> {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(bytes);
  if (name.endsWith(".docx")) return extractDocx(bytes);
  if (name.endsWith(".doc")) throw new Error("صيغة .doc القديمة غير مدعومة — احفظ الملف كـ .docx أو PDF");
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    const { strFromU8 } = await import("fflate");
    return [{ page: 1, text: clean(strFromU8(bytes)) }];
  }
  throw new Error("صيغة غير مدعومة. ارفع PDF أو DOCX أو TXT");
}

export { chunkPages } from "./doc-chunk";
