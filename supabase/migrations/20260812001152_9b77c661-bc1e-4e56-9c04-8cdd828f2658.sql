ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS doc_group_id uuid,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

UPDATE public.documents SET doc_group_id = id WHERE doc_group_id IS NULL;
UPDATE public.documents SET status = 'completed' WHERE status = 'ready';

CREATE INDEX IF NOT EXISTS documents_group_idx ON public.documents (doc_group_id, version DESC);

DROP POLICY IF EXISTS chunks_delete_privileged ON public.document_chunks;
CREATE POLICY chunks_delete_privileged ON public.document_chunks
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));