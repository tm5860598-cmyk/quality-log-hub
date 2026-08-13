ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;

CREATE TABLE IF NOT EXISTS public.dept_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_upload boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_permissions TO authenticated;
GRANT ALL ON public.dept_permissions TO service_role;
ALTER TABLE public.dept_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perm_select_self_or_admin" ON public.dept_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "perm_manage_admin" ON public.dept_permissions
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']));

CREATE TRIGGER dept_permissions_touch BEFORE UPDATE ON public.dept_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_dept(_user_id uuid, _category text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN public.has_any_role(_user_id, ARRAY['owner','admin']) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.dept_permissions p
      WHERE p.user_id = _user_id AND p.category = _category
        AND CASE _action
              WHEN 'view' THEN p.can_view
              WHEN 'upload' THEN p.can_upload
              WHEN 'edit' THEN p.can_edit
              WHEN 'delete' THEN p.can_delete
              ELSE false
            END
    )
  END
$$;

-- Seed existing users so current access is preserved
INSERT INTO public.dept_permissions (user_id, category, can_view, can_upload, can_edit, can_delete)
SELECT pr.id, c.category,
  true,
  ur.role::text IN ('qa_manager','production_manager','qa_engineer','production_engineer'),
  ur.role::text IN ('qa_manager','production_manager','qa_engineer','production_engineer'),
  ur.role::text IN ('qa_manager','production_manager')
FROM public.profiles pr
LEFT JOIN public.user_roles ur ON ur.user_id = pr.id
CROSS JOIN (VALUES
  ('juice-production'),('juice-quality'),('dairy-production'),('dairy-quality'),
  ('bakery-production'),('bakery-quality'),('quality-reports')
) AS c(category)
WHERE COALESCE(ur.role::text,'user') NOT IN ('owner','admin')
ON CONFLICT (user_id, category) DO NOTHING;

-- Documents access now follows department permissions
DROP POLICY IF EXISTS documents_select_auth ON public.documents;
DROP POLICY IF EXISTS documents_insert_privileged ON public.documents;
DROP POLICY IF EXISTS documents_update_privileged ON public.documents;
DROP POLICY IF EXISTS documents_delete_privileged ON public.documents;

CREATE POLICY documents_select_perm ON public.documents
FOR SELECT TO authenticated USING (public.can_dept(auth.uid(), category, 'view'));

CREATE POLICY documents_insert_perm ON public.documents
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by AND public.can_dept(auth.uid(), category, 'upload'));

CREATE POLICY documents_update_perm ON public.documents
FOR UPDATE TO authenticated
USING (public.can_dept(auth.uid(), category, 'edit'))
WITH CHECK (public.can_dept(auth.uid(), category, 'edit'));

CREATE POLICY documents_delete_perm ON public.documents
FOR DELETE TO authenticated USING (public.can_dept(auth.uid(), category, 'delete'));

DROP POLICY IF EXISTS chunks_select_auth ON public.document_chunks;
DROP POLICY IF EXISTS chunks_insert_privileged ON public.document_chunks;
DROP POLICY IF EXISTS chunks_delete_privileged ON public.document_chunks;

CREATE POLICY chunks_select_perm ON public.document_chunks
FOR SELECT TO authenticated USING (public.can_dept(auth.uid(), category, 'view'));

CREATE POLICY chunks_insert_perm ON public.document_chunks
FOR INSERT TO authenticated WITH CHECK (public.can_dept(auth.uid(), category, 'upload'));

CREATE POLICY chunks_delete_perm ON public.document_chunks
FOR DELETE TO authenticated USING (public.can_dept(auth.uid(), category, 'edit'));

-- Stored files: direct storage access follows the same permissions
DROP POLICY IF EXISTS docs_bucket_read ON storage.objects;
DROP POLICY IF EXISTS docs_bucket_insert ON storage.objects;
DROP POLICY IF EXISTS docs_bucket_delete ON storage.objects;

CREATE POLICY docs_bucket_read_perm ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'department-docs' AND public.can_dept(auth.uid(), split_part(name, '/', 1), 'view'));

CREATE POLICY docs_bucket_insert_perm ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'department-docs' AND public.can_dept(auth.uid(), split_part(name, '/', 1), 'upload'));

CREATE POLICY docs_bucket_delete_perm ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'department-docs' AND public.can_dept(auth.uid(), split_part(name, '/', 1), 'delete'));