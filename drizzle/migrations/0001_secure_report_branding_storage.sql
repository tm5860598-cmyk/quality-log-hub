CREATE POLICY "report_branding_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'report-branding');

CREATE POLICY "report_branding_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-branding'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  );

CREATE POLICY "report_branding_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'report-branding'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  )
  WITH CHECK (
    bucket_id = 'report-branding'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  );

CREATE POLICY "report_branding_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'report-branding'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  );