/**
 * Indexes (into `messages`) to print for one answer: the user question that triggered it plus every assistant
 * reply to that question. Index-based on purpose: message ids can repeat in stored threads, which used to pull
 * other questions into the "single question" report.
 */
export function printScope(messages: ReadonlyArray<{ role: string }>, answerIndex: number): Set<number> {
  if (answerIndex < 0 || answerIndex >= messages.length) return new Set();
  let q = answerIndex;
  while (q >= 0 && messages[q].role !== "user") q--;
  const idx = new Set<number>();
  if (q >= 0) idx.add(q);
  for (let i = q + 1; i < messages.length && messages[i].role !== "user"; i++) idx.add(i);
  return idx;
}

/**
 * Print-only cleanup of a question: drops the request wording ("اشرحلي …", "… بالاستيكرات", "بشكل بصري")
 * so the report shows just the topic. Falls back to the original text if nothing would be left.
 */
export function cleanQuestion(text: string): string {
  const original = text.replace(/\s+/g, " ").trim();
  let t = original;
  const lead = /^(?:(?:لو سمحت|من فضلك|ممكن|عايز(?:ك)?|عاوز(?:ك)?|محتاج|أريد|اريد|عايزك|اعمل(?:ي)?(?:لي|لى|لنا)?|قوللي|قولي|قل لي|اشرح(?:ي)?\s*(?:لي|لى|لنا|ليا)?|وضح(?:ي)?\s*(?:لي|لى|لنا|ليا)?|فسر(?:ي)?\s*(?:لي|لى|لنا|ليا)?|إشرح(?:ي)?\s*(?:لي|لى|لنا|ليا)?)\s+)+/u;
  t = t.replace(lead, "");
  const style = /\s*(?:(?:في\s*شكل|بشكل|على\s*شكل|بطريقة|بأسلوب|باسلوب|ب)\s*)?(?:ال)?(?:[اإأ]?[سص]تيكر(?:ات|ز)?|ملصقات?|مذكرة\s*(?:بصرية|تعليمية|تفاعلية)|(?:ال)?[اإ]نفوجراف(?:يك|ك)?|بصري(?:ة)?|visual\s*learning|infographics?|stickers?)\s*/giu;
  t = t.replace(style, " ").replace(/\s+/g, " ").replace(/^[\s:،,\-–—]+|[\s:،,\-–—]+$/g, "");
  return t.length >= 3 ? t : original;
}
