/**
 * Rebuilds readable text from pdf.js text items.
 *
 * pdf.js returns many PDFs (especially Arabic and subset-font ones) as one item per glyph or per word fragment.
 * Joining every item with a space turns "البكتيريا" into "ا ل ب ك ت ي ر ي ا", which a speech engine then reads letter
 * by letter. Here items are joined by their real positions: a space only where there is a real gap, a line break
 * only where the baseline changes.
 */
export type PdfTextItem = { str?: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean };

const WS_END = /\s$/, WS_START = /^\s/;

export function pdfItemsToText(items: PdfTextItem[]): string {
  let out = "";
  let prev: { x: number; y: number; w: number; h: number; eol: boolean } | null = null;
  for (const it of items) {
    const str = it.str ?? "";
    if (!str) { if (it.hasEOL && prev) prev.eol = true; continue; }
    const tr = it.transform ?? [1, 0, 0, 1, 0, 0];
    const x = tr[4] ?? 0, y = tr[5] ?? 0;
    const h = Math.abs(it.height || tr[3] || tr[0] || 10) || 10;
    const w = it.width ?? 0;
    if (prev) {
      const sameLine = Math.abs(y - prev.y) <= 0.55 * Math.max(h, prev.h);
      let sep = "";
      if (!sameLine || prev.eol) sep = "\n";
      else {
        const leftward = x < prev.x - 0.01; // right-to-left progression (Arabic)
        const gap = leftward ? prev.x - (x + w) : x - (prev.x + prev.w);
        if (gap > 0.2 * h || gap < -2 * h) sep = " "; // real word gap, or a jump back on the same line
      }
      if (sep && !(sep === " " && (WS_END.test(out) || WS_START.test(str)))) out += sep;
    }
    out += str;
    prev = { x, y, w, h, eol: !!it.hasEOL };
  }
  return out;
}

const SINGLE = /^\p{L}$/u;

/** True when most "words" are single letters, i.e. the text was extracted letter by letter. */
export function looksLetterSpaced(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 30) return false;
  return tokens.filter((t) => SINGLE.test(t)).length / tokens.length > 0.45;
}

/**
 * Repairs letter-spaced lines when word boundaries are still recognisable (a wider gap of 2+ spaces):
 * "ا ل ب ك ت  ر ي ا" -> "البكت ريا" style runs are re-joined per group. Lines without any wider gap are left alone.
 */
export function repairSpacedLetters(text: string): string {
  return text.split("\n").map((line) => {
    const tokens = line.split(/ +/).filter(Boolean);
    if (tokens.length < 6 || tokens.filter((t) => SINGLE.test(t)).length / tokens.length < 0.6 || !/ {2,}/.test(line)) return line;
    return line.trim().split(/ {2,}/).map((g) => g.replace(/ /g, "")).join(" ");
  }).join("\n");
}
