const EMBED_MODEL = "google/gemini-embedding-001";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول بعد قليل");
      if (res.status === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي");
      throw new Error(`Embedding failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}
