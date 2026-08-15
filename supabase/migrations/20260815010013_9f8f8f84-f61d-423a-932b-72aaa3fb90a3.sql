
-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  contact text,
  email text,
  phone text,
  rating numeric,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','warehouse']));
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','warehouse']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','warehouse']));
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RAW MATERIALS ============
CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  category text,
  unit text NOT NULL DEFAULT 'كجم',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  shelf_life_days integer,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_materials TO authenticated;
GRANT ALL ON public.raw_materials TO service_role;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY rm_select ON public.raw_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY rm_insert ON public.raw_materials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','warehouse','laboratory']));
CREATE POLICY rm_update ON public.raw_materials FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','warehouse','laboratory']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','warehouse','laboratory']));
CREATE POLICY rm_delete ON public.raw_materials FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));
CREATE TRIGGER raw_materials_touch BEFORE UPDATE ON public.raw_materials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PRODUCT VERSIONS ============
CREATE TABLE public.product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  category text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);
GRANT SELECT, INSERT ON public.product_versions TO authenticated;
GRANT ALL ON public.product_versions TO service_role;
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pv_select ON public.product_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY pv_insert ON public.product_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer']));

-- ============ QC BATCHES ============
CREATE TABLE public.qc_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  category text NOT NULL,
  quantity numeric,
  unit text,
  production_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'in_progress',
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_batches TO authenticated;
GRANT ALL ON public.qc_batches TO service_role;
ALTER TABLE public.qc_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY qb_select ON public.qc_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY qb_insert ON public.qc_batches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (public.can_dept(auth.uid(), category, 'upload') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory'])));
CREATE POLICY qb_update ON public.qc_batches FOR UPDATE TO authenticated
  USING (public.can_dept(auth.uid(), category, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory']))
  WITH CHECK (public.can_dept(auth.uid(), category, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory']));
CREATE POLICY qb_delete ON public.qc_batches FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));
CREATE TRIGGER qc_batches_touch BEFORE UPDATE ON public.qc_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_qc_batches_product ON public.qc_batches(product_id);
CREATE INDEX idx_qc_batches_category ON public.qc_batches(category);

-- ============ BATCH MATERIALS ============
CREATE TABLE public.batch_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.qc_batches(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_batch text,
  quantity numeric,
  unit text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_materials TO authenticated;
GRANT ALL ON public.batch_materials TO service_role;
ALTER TABLE public.batch_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY bm_select ON public.batch_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY bm_insert ON public.batch_materials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory','warehouse']));
CREATE POLICY bm_update ON public.batch_materials FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory','warehouse']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory','warehouse']));
CREATE POLICY bm_delete ON public.batch_materials FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));

-- ============ QC RESULTS ============
CREATE TABLE public.qc_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.qc_batches(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  category text NOT NULL,
  test_name text NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text,
  min_value numeric,
  max_value numeric,
  target_text text,
  result text NOT NULL DEFAULT 'pass',
  deviation_note text,
  tested_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_results TO authenticated;
GRANT ALL ON public.qc_results TO service_role;
ALTER TABLE public.qc_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_select ON public.qc_results FOR SELECT TO authenticated USING (true);
CREATE POLICY qr_insert ON public.qc_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (public.can_dept(auth.uid(), category, 'upload') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory'])));
CREATE POLICY qr_update ON public.qc_results FOR UPDATE TO authenticated
  USING (public.can_dept(auth.uid(), category, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','qa_engineer','laboratory']))
  WITH CHECK (public.can_dept(auth.uid(), category, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','qa_engineer','laboratory']));
CREATE POLICY qr_delete ON public.qc_results FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));
CREATE TRIGGER qc_results_touch BEFORE UPDATE ON public.qc_results FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_qc_results_batch ON public.qc_results(batch_id);
CREATE INDEX idx_qc_results_product ON public.qc_results(product_id);

-- ============ QUALITY ALERTS ============
CREATE TABLE public.quality_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  message text,
  category text,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.qc_batches(id) ON DELETE CASCADE,
  qc_result_id uuid REFERENCES public.qc_results(id) ON DELETE CASCADE,
  ncr_id uuid REFERENCES public.ncr_reports(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_alerts TO authenticated;
GRANT ALL ON public.quality_alerts TO service_role;
ALTER TABLE public.quality_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_select ON public.quality_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_insert ON public.quality_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY qa_update ON public.quality_alerts FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','qa_engineer','production_engineer','laboratory']));
CREATE POLICY qa_delete ON public.quality_alerts FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));
CREATE TRIGGER quality_alerts_touch BEFORE UPDATE ON public.quality_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_alerts_status ON public.quality_alerts(status);
CREATE INDEX idx_alerts_category ON public.quality_alerts(category);

-- ============ PRODUCT EVENTS (TIMELINE) ============
CREATE TABLE public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  category text,
  event_type text NOT NULL,
  title text NOT NULL,
  detail text,
  ref_table text,
  ref_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.product_events TO authenticated;
GRANT ALL ON public.product_events TO service_role;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pe_select ON public.product_events FOR SELECT TO authenticated USING (true);
CREATE POLICY pe_insert ON public.product_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
CREATE INDEX idx_product_events_product ON public.product_events(product_id, created_at DESC);

-- ============ DOCUMENT EXPIRY ============
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS expires_at date;

-- ============ DEVIATION DETECTION TRIGGER ============
CREATE OR REPLACE FUNCTION public.detect_qc_deviation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  out_of_spec boolean := false;
BEGIN
  IF NEW.value_numeric IS NOT NULL THEN
    IF (NEW.min_value IS NOT NULL AND NEW.value_numeric < NEW.min_value)
       OR (NEW.max_value IS NOT NULL AND NEW.value_numeric > NEW.max_value) THEN
      out_of_spec := true;
    END IF;
  END IF;

  IF out_of_spec THEN
    NEW.result := 'fail';
  ELSIF NEW.result IS NULL THEN
    NEW.result := 'pass';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER qc_results_detect_deviation
BEFORE INSERT OR UPDATE ON public.qc_results
FOR EACH ROW EXECUTE FUNCTION public.detect_qc_deviation();

CREATE OR REPLACE FUNCTION public.raise_qc_deviation_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.result = 'fail' THEN
    INSERT INTO public.quality_alerts (alert_type, severity, title, message, category, product_id, batch_id, qc_result_id)
    VALUES ('deviation', 'high',
      'نتيجة خارج المواصفة: ' || NEW.test_name,
      COALESCE(NEW.deviation_note, 'القيمة المسجلة ' || COALESCE(NEW.value_numeric::text, NEW.value_text, '-') || ' خارج الحدود المسموحة.'),
      NEW.category, NEW.product_id, NEW.batch_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER qc_results_raise_alert
AFTER INSERT ON public.qc_results
FOR EACH ROW EXECUTE FUNCTION public.raise_qc_deviation_alert();

-- ============ QUALITY SCORE ============
CREATE OR REPLACE FUNCTION public.product_quality_score(_product_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (
    SELECT count(*) FILTER (WHERE result = 'pass') AS passed, count(*) AS total
    FROM public.qc_results WHERE product_id = _product_id
  ),
  n AS (
    SELECT count(*) AS open_ncr FROM public.ncr_reports
    WHERE product_id = _product_id AND status <> 'closed'
  ),
  c AS (
    SELECT count(*) AS late_capa FROM public.capa_actions a
    JOIN public.ncr_reports nr ON nr.id = a.ncr_id
    WHERE nr.product_id = _product_id AND a.status <> 'closed'
      AND a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE
  )
  SELECT GREATEST(0, LEAST(100,
    CASE WHEN r.total = 0 THEN 100 ELSE round(100.0 * r.passed / r.total) END
    - (n.open_ncr * 5) - (c.late_capa * 5)
  ))::numeric
  FROM r, n, c;
$$;
GRANT EXECUTE ON FUNCTION public.product_quality_score(uuid) TO authenticated;
