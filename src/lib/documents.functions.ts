import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ProcessInput = { documentId: string; offset?: number };

const SLICE = 30; // chunks embedded + stored per request (keeps each call short)

/**
 * Downloads the already-uploaded file from storage, extracts its text server-side
 * (works identically on iPhone / desktop / any browser), embeds a slice of chunks
 * and stores them as the department knowledge base. Resumable via `offset`.
 */
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ProcessInput) => {
    if (!data?.documentId) throw new Error("documentId مطلوب");
    return { documentId: String(data.documentId), offset: Math.max(0, Number(data.offset ?? 0)) };
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, category, file_name, storage_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("المستند غير موجود");

    try {
      if (data.offset === 0) {
        await supabase.from("documents").update({ status: "processing", error_message: null }).eq("id", doc.id);
        await supabase.from("document_chunks").delete().eq("document_id", doc.id);
      }

      const dl = await supabase.storage.from("department-docs").download(doc.storage_path);
      if (dl.error || !dl.data) throw new Error("تعذر تحميل الملف من التخزين: " + (dl.error?.message ?? ""));
      const bytes = new Uint8Array(await dl.data.arrayBuffer());

      const { extractPages, chunkPages } = await import("./doc-extract.server");
      const pages = await extractPages(doc.file_name, bytes);
      if (!pages.length) {
        throw new Error("لم يتم استخراج أي نص من الملف (قد يكون ملفًا ممسوحًا ضوئيًا كصور)");
      }
      const chunks = chunkPages(pages);
      const slice = chunks.slice(data.offset, data.offset + SLICE);

      if (slice.length) {
        const { embedTexts } = await import("./embeddings.server");
        const vectors = await embedTexts(slice.map((c) => c.text.slice(0, 6000)));
        const rows = slice.map((c, i) => ({
          document_id: doc.id,
          category: doc.category,
          page_number: c.page,
          chunk_index: data.offset + i,
          content: c.text.slice(0, 6000),
          embedding: JSON.stringify(vectors[i]),
        }));
        const { error } = await supabase.from("document_chunks").insert(rows);
        if (error) throw new Error(error.message);
      }

      const next = data.offset + slice.length;
      const done = next >= chunks.length;
      if (done) {
        await supabase
          .from("documents")
          .update({
            status: "completed",
            page_count: pages.length,
            error_message: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
      }
      return { total: chunks.length, pages: pages.length, nextOffset: next, done };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل تحليل المستند";
      await supabase.from("documents").update({ status: "failed", error_message: msg }).eq("id", doc.id);
      throw new Error(msg);
    }
  });
