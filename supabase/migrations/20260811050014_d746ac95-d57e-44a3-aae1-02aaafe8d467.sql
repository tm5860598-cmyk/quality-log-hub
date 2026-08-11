create extension if not exists vector;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  title text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  page_count integer,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_auth" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert_privileged" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by AND has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));
CREATE POLICY "documents_update_privileged" ON public.documents FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));
CREATE POLICY "documents_delete_privileged" ON public.documents FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));

CREATE TRIGGER documents_touch BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX documents_category_idx ON public.documents(category);

CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  category text NOT NULL,
  page_number integer,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_select_auth" ON public.document_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "chunks_insert_privileged" ON public.document_chunks FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));
CREATE POLICY "chunks_delete_privileged" ON public.document_chunks FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));

CREATE INDEX document_chunks_document_idx ON public.document_chunks(document_id);
CREATE INDEX document_chunks_category_idx ON public.document_chunks(category);
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(3072),
  filter_category text DEFAULT NULL,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  file_name text,
  title text,
  page_number integer,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, d.id, d.file_name, d.title, c.page_number, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND (filter_category IS NULL OR c.category = filter_category)
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, text, int) TO authenticated, service_role;

CREATE POLICY "docs_bucket_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'department-docs');
CREATE POLICY "docs_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'department-docs' AND has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));
CREATE POLICY "docs_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'department-docs' AND has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));