export type ExtractedPage = { page: number; text: string };

/** Split pages into ~1200-char chunks, keeping the source page number. */
export function chunkPages(pages: ExtractedPage[]): Array<{ page: number; text: string }> {
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
        buf = buf.slice(-30);
        len = buf.join(" ").length;
      }
    }
    if (buf.length && buf.join(" ").trim().length > 40) out.push({ page: p.page, text: buf.join(" ") });
  }
  return out;
}