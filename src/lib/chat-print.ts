/** Ids to print for one answer: the user question that triggered it plus every assistant reply to that question. */
export function printScope(messages: ReadonlyArray<{ id: string; role: string }>, answerId: string): Set<string> {
  const idx = messages.findIndex((x) => x.id === answerId);
  if (idx < 0) return new Set();
  let q = idx;
  while (q >= 0 && messages[q].role !== "user") q--;
  const ids = new Set<string>();
  if (q >= 0) ids.add(messages[q].id);
  for (let i = q + 1; i < messages.length && messages[i].role !== "user"; i++) ids.add(messages[i].id);
  return ids;
}
