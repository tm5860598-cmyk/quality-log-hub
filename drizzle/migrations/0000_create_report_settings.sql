CREATE TABLE public.report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'My Favourite Project',
  logo_path TEXT,
  default_report_title TEXT NOT NULL DEFAULT 'تقرير رسمي',
  company_extra_data TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_company_data BOOLEAN NOT NULL DEFAULT true,
  style_mode TEXT NOT NULL DEFAULT 'formal' CHECK (style_mode IN ('formal', 'simple')),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_settings TO authenticated;
GRANT ALL ON public.report_settings TO service_role;

ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_settings_read_auth" ON public.report_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "report_settings_insert_admin" ON public.report_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = updated_by
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  );

CREATE POLICY "report_settings_update_admin" ON public.report_settings
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (
    auth.uid() = updated_by
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  );

CREATE POLICY "report_settings_delete_owner" ON public.report_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE UNIQUE INDEX report_settings_singleton_idx ON public.report_settings ((true));

CREATE TRIGGER trg_report_settings_touch BEFORE UPDATE ON public.report_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();