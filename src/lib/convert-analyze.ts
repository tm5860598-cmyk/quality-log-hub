// Optional AI analysis step of the converter: the text is understood and rewritten for listening.
// Cost control: one request per BATCH_CHARS characters, at most MAX_BATCHES requests per conversion.
import type { SectionInput } from "./convert-speech";

export type AnalyzeMode = "off" | "explain" | "summary";
export const BATCH_CHARS = 18_000;
export const MAX_BATCHES = 3;

/** Groups sections into batches of at most `max` characters (splitting oversized sections at line/space boundaries). */
export function planBatches(sections: SectionInput[], max = BATCH_CHARS): string[] {
  const pieces: string[] = [];
  for (const s of sections) {
    let t = s.text.trim();
    while (t.length > max) {
      let cut = t.lastIndexOf("\n", max);
      if (cut < max * 0.5) cut = t.lastIndexOf(" ", max);
      if (cut < max * 0.5) cut = max;
      pieces.push(t.slice(0, cut).trim());
      t = t.slice(cut).trim();
    }
    if (t) pieces.push(t);
  }
  const batches: string[] = [];
  let cur = "";
  for (const p of pieces) {
    if (cur && cur.length + p.length + 2 > max) { batches.push(cur); cur = ""; }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) batches.push(cur);
  return batches;
}

export type AnalyzeResult = { sections: SectionInput[]; skippedChars: number };

/** Sends the batches (sequentially) to /api/analyze-text. Text past the batch cap is read as-is. */
export async function analyzeText(
  sections: SectionInput[], mode: Exclude<AnalyzeMode, "off">, token: string, signal: AbortSignal,
  onP: (pct: number, label: string) => void,
): Promise<AnalyzeResult> {
  const all = planBatches(sections);
  const use = all.slice(0, MAX_BATCHES);
  const skipped = all.slice(MAX_BATCHES);
  const out: SectionInput[] = [];
  for (let i = 0; i < use.length; i++) {
    onP((i / use.length) * 100, `تحليل وفهم النص (${i + 1} من ${use.length})…`);
    const res = await fetch("/api/analyze-text", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: use[i], mode }),
    });
    if (!res.ok) throw new Error(res.status === 401 ? "سجّل الدخول لاستخدام تحليل النص" : `تعذّر تحليل النص (${res.status})`);
    const j = (await res.json()) as { text?: string };
    if (!j.text) throw new Error("رد التحليل فارغ");
    out.push({ label: use.length > 1 ? `${mode === "summary" ? "ملخص" : "شرح"} ${i + 1}/${use.length}` : mode === "summary" ? "ملخص" : "شرح", text: j.text });
  }
  for (const t of skipped) out.push({ label: "باقي الملف", text: t });
  return { sections: out, skippedChars: skipped.reduce((n, t) => n + t.length, 0) };
}
