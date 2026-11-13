/**
 * "Save as PDF" that does not depend on the browser's print dialog (which phones and in-app browsers often block).
 *
 * The `.print-root` report is laid out at A4 width in a hidden iframe (with the print CSS applied on screen),
 * page breaks are chosen between rows/paragraphs, every page is rendered through SVG <foreignObject> to a canvas
 * (the browser itself shapes the Arabic text) and the JPEG pages are written into a PDF file, entirely locally.
 */

const PAGE_W = 794; // A4 @96dpi
const PAGE_H = 1123;
const MARGIN_X = 0; // the report is already centred at 170mm
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 62;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
const SCALE = 2;
const FONT_BUDGET = 6 * 1024 * 1024;


async function toDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  } catch { return null; }
}

/** @font-face blocks of the page with their font files inlined as data URIs (the SVG image cannot fetch anything). */
async function inlineFontFaces(): Promise<string> {
  const blocks: Array<{ css: string; base: string }> = [];
  for (const sheet of Array.from(document.styleSheets)) {
    const base = sheet.href ?? location.href;
    try {
      for (const r of Array.from(sheet.cssRules)) if (r instanceof CSSFontFaceRule) blocks.push({ css: r.cssText, base });
    } catch {
      if (!sheet.href) continue; // cross-origin stylesheet (Google Fonts): read its text directly
      try {
        const text = await (await fetch(sheet.href)).text();
        for (const m of text.match(/@font-face\s*\{[^}]*\}/g) ?? []) blocks.push({ css: m, base });
      } catch { /* ignore */ }
    }
  }
  let used = 0;
  const cache = new Map<string, string | null>();
  const out: string[] = [];
  for (const b of blocks) {
    let css = b.css;
    const urls = Array.from(css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)).map((m) => m[1]);
    let skip = false;
    for (const u of urls) {
      if (/^data:/.test(u)) continue;
      const abs = new URL(u, b.base).href;
      if (!cache.has(abs)) cache.set(abs, used > FONT_BUDGET ? null : await toDataUrl(abs));
      const d = cache.get(abs);
      if (!d) { skip = true; break; }
      used += d.length;
      css = css.split(u).join(d);
    }
    if (!skip) out.push(css);
  }
  return out.join("\n");
}

/** Page CSS with the `@media print` rules applied on screen (so the layout equals the printed report). */
function printCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSFontFaceRule || r instanceof CSSPageRule || r instanceof CSSImportRule) continue;
      if (r instanceof CSSMediaRule && /print/.test(r.conditionText || r.media.mediaText)) {
        out.push(`@media all {${Array.from(r.cssRules).filter((x) => !(x instanceof CSSPageRule)).map((x) => x.cssText).join("\n")}}`);
      } else out.push(r.cssText);
    }
  }
  return out.join("\n");
}

type Frame = { frame: HTMLIFrameElement; doc: Document; root: HTMLElement; breaks: number[]; height: number };

async function layout(source: HTMLElement, css: string, fonts: string): Promise<Frame> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;border:0;pointer-events:none`;
  const loaded = new Promise<void>((res) => { frame.onload = () => res(); });
  frame.srcdoc =
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${fonts}</style><style>${css}</style>` +
    `<style>html,body{margin:0!important;padding:0!important;background:#fff!important;min-width:0!important;width:${PAGE_W}px!important;overflow:visible!important}` +
    `body{display:block!important}.print-root{display:block!important;position:static!important;margin:0 auto!important}</style></head><body></body></html>`;
  document.body.appendChild(frame);
  await Promise.race([loaded, new Promise((r) => setTimeout(r, 8000))]);
  const doc = frame.contentDocument!;
  const root = doc.importNode(source, true) as HTMLElement;
  doc.body.appendChild(root);
  // Inline images (logo): a detached SVG image cannot download them.
  await Promise.all(Array.from(root.querySelectorAll("img")).map(async (img) => {
    const d = await toDataUrl(img.currentSrc || img.src);
    if (d) { img.setAttribute("src", d); img.removeAttribute("srcset"); img.removeAttribute("loading"); } else img.remove();
  }));
  try { await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
  await Promise.all(Array.from(root.querySelectorAll("img")).map((img) => (img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); }))));
  await new Promise((r) => setTimeout(r, 120));

  const top = root.getBoundingClientRect().top;
  const candidates = new Set<number>();
  root.querySelectorAll<HTMLElement>("tr, p, li, h1, h2, h3, h4, h5, img, pre, blockquote, hr, .md-kv-wrap, .print-card, .md-card").forEach((el) => {
    if (el.tagName !== "TR" && el.closest("td, th")) return; // never cut through a table cell
    const r = el.getBoundingClientRect();
    if (/^H[1-5]$/.test(el.tagName)) candidates.add(Math.round(r.top - top)); // break BEFORE a heading, never right after it
    else candidates.add(Math.round(r.bottom - top));
  });
  const height = Math.ceil(root.getBoundingClientRect().height);
  const sorted = [...candidates].filter((y) => y > 0 && y < height).sort((a, b) => a - b);
  const breaks: number[] = [0];
  let y0 = 0;
  while (height - y0 > CONTENT_H) {
    const limit = y0 + CONTENT_H;
    let best = -1;
    for (const c of sorted) { if (c <= limit && c > y0 + 160) best = c; else if (c > limit) break; }
    y0 = best > 0 ? best : limit;
    breaks.push(y0);
  }
  return { frame, doc, root, breaks, height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { (i.decode ? i.decode() : Promise.resolve()).catch(() => undefined).then(() => res(i)); }; i.onerror = () => rej(new Error("تعذّر رسم الصفحة (المتصفح رفض رسم التقرير)")); i.src = src; });
}

async function renderPage(f: Frame, css: string, fonts: string, y0: number, y1: number, pageNo: number, pages: number): Promise<Blob> {
  const markup = new XMLSerializer().serializeToString(f.root);
  const h = y1 - y0;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}"><foreignObject x="0" y="0" width="${PAGE_W}" height="${PAGE_H}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="width:${PAGE_W}px;height:${PAGE_H}px;position:relative;background:#fff;overflow:hidden">` +
    `<style><![CDATA[${fonts}\n${css}\nhtml,body{margin:0}]]></style>` +
    `<div style="position:absolute;left:${MARGIN_X}px;top:${MARGIN_TOP}px;width:${PAGE_W - 2 * MARGIN_X}px;height:${h}px;overflow:hidden">` +
    `<div style="position:absolute;left:0;top:${-y0}px;width:100%">${markup}</div></div></div></foreignObject></svg>`;
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  const c = document.createElement("canvas");
  c.width = PAGE_W * SCALE; c.height = PAGE_H * SCALE;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  await new Promise((r) => setTimeout(r, 60));
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height); // Safari can paint foreignObject blank on the first draw
  g.fillStyle = "#64748b"; g.font = `${11 * SCALE}px Tahoma, Arial, sans-serif`; g.textAlign = "center";
  g.fillText(`${pageNo} / ${pages}`, c.width / 2, (PAGE_H - 28) * SCALE);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("تعذّر إنشاء الصفحة"))), "image/jpeg", 0.92));
}

/** Minimal PDF writer: one full-page JPEG per A4 page. */
function buildPdf(pages: Array<{ jpeg: Uint8Array; w: number; h: number }>): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (d: Uint8Array | string) => { const b = typeof d === "string" ? enc.encode(d) : d; parts.push(b); pos += b.length; };
  const obj = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body); else body.forEach((p) => push(p));
    push("\nendobj\n");
  };
  const W = 595.28, H = 841.89;
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, content = pg + 1, image = pg + 2;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    const stream = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(content, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    obj(image, [enc.encode(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`), p.jpeg, enc.encode("\nendstream")]);
  });
  const count = 3 + pages.length * 3;
  const xref = pos;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

export type PdfProgress = (done: number, total: number) => void;

/** Builds the PDF of the `.print-root` report currently mounted in the page. */
export async function buildReportPdf(onProgress?: PdfProgress): Promise<Blob> {
  const source = document.querySelector<HTMLElement>(".print-root");
  if (!source) throw new Error("لا يوجد تقرير جاهز للحفظ");
  const [fonts] = await Promise.all([inlineFontFaces()]);
  const css = printCss();
  const f = await layout(source, css, fonts);
  try {
    const ends = [...f.breaks.slice(1), f.height];
    // Safari often draws the first foreignObject without its fonts/images: render page 1 once and discard it.
    try { await renderPage(f, css, fonts, 0, Math.min(ends[0], CONTENT_H), 1, ends.length); } catch { /* ignore */ }
    const pages: Array<{ jpeg: Uint8Array; w: number; h: number }> = [];
    for (let i = 0; i < ends.length; i++) {
      const blob = await renderPage(f, css, fonts, f.breaks[i], ends[i], i + 1, ends.length);
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: PAGE_W * SCALE, h: PAGE_H * SCALE });
      onProgress?.(i + 1, ends.length);
    }
    return buildPdf(pages);
  } finally {
    f.frame.remove();
  }
}

/** Saves/shares the PDF: share sheet on phones (Save to Files, Print…), a normal download elsewhere. */
export async function savePdfFile(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return "shared"; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "shared"; /* otherwise fall through to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

export const pdfFileName = (title: string) =>
  `${(title || "report").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;


/** One call for the "Save as PDF" buttons: builds the report PDF and saves/shares it. Returns false on failure. */
export async function exportReportPdf(title: string, notify: (msg: string, kind: "info" | "success" | "error") => void): Promise<boolean> {
  try {
    notify("جاري إنشاء ملف PDF…", "info");
    const blob = await buildReportPdf((d, t) => { if (t > 1) notify(`جاري إنشاء ملف PDF… ${d}/${t}`, "info"); });
    const how = await savePdfFile(blob, pdfFileName(title));
    notify(how === "shared" ? "اختر «حفظ في الملفات» لحفظ الملف على جهازك" : "تم تنزيل ملف PDF", "success");
    return true;
  } catch (e) {
    notify(`تعذّر إنشاء ملف PDF: ${e instanceof Error ? e.message : "خطأ غير معروف"}`, "error");
    return false;
  }
}
