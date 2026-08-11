import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type IngestInput = {
  documentId: string;
  category: string;
  startIndex: number;
  chunks: Array<{ page: number; text: string }>;
};

/** Embeds a batch of extracted chunks and stores them as the department knowledge base. */
export const ingestDocumentChunks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: IngestInput) => {
    if (!data?.documentId) throw new Error("documentId مطلوب");
    if (!Array.isArray(data.chunks) || data.chunks.length === 0) throw new Error("لا توجد مقاطع");
    if (data.chunks.length > 60) throw new Error("عدد المقاطع كبير جدًا في الطلب الواحد");
    return {
      documentId: String(data.documentId),
      category: String(data.category ?? "general"),
      startIndex: Number(data.startIndex ?? 0),
      chunks: data.chunks.map((c) => ({
        page: Number(c.page ?? 1),
        text: String(c.text ?? "").slice(0, 6000),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    const { embedTexts } = await import("./embeddings.server");
    const vectors = await embedTexts(data.chunks.map((c) => c.text));

    const rows = data.chunks.map((c, i) => ({
      document_id: data.documentId,
      category: data.category,
      page_number: c.page,
      chunk_index: data.startIndex + i,
      content: c.text,
      embedding: JSON.stringify(vectors[i]),
    }));

    const { error } = await context.supabase.from("document_chunks").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
