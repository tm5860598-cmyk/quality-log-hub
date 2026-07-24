
-- ==================== NCR reports ====================
CREATE TABLE public.ncr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_number SERIAL,
  title TEXT NOT NULL,
  category TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  batch_number TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  source TEXT,
  description TEXT NOT NULL,
  root_cause TEXT,
  immediate_action TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','action','closed')),
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncr_reports TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE ncr_reports_ncr_number_seq TO authenticated;
GRANT ALL ON public.ncr_reports TO service_role;
GRANT ALL ON SEQUENCE ncr_reports_ncr_number_seq TO service_role;

ALTER TABLE public.ncr_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ncr_select_all_auth" ON public.ncr_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ncr_insert_auth" ON public.ncr_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "ncr_update_privileged" ON public.ncr_reports
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));

CREATE POLICY "ncr_delete_admin" ON public.ncr_reports
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));

CREATE TRIGGER trg_ncr_reports_touch BEFORE UPDATE ON public.ncr_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==================== CAPA actions ====================
CREATE TABLE public.capa_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_id UUID NOT NULL REFERENCES public.ncr_reports(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'corrective' CHECK (action_type IN ('corrective','preventive')),
  description TEXT NOT NULL,
  responsible UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  effectiveness TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','verified')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_actions TO authenticated;
GRANT ALL ON public.capa_actions TO service_role;

ALTER TABLE public.capa_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capa_select_all_auth" ON public.capa_actions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "capa_insert_privileged" ON public.capa_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer'])
  );

CREATE POLICY "capa_update_privileged" ON public.capa_actions
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));

CREATE POLICY "capa_delete_admin" ON public.capa_actions
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));

CREATE TRIGGER trg_capa_actions_touch BEFORE UPDATE ON public.capa_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ==================== Storage policies: product-images bucket ====================
CREATE POLICY "product_images_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_privileged" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager'])
  );

CREATE POLICY "product_images_update_privileged" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager'])
  );

CREATE POLICY "product_images_delete_privileged" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager'])
  );
