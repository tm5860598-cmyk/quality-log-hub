-- 1) add department_id to all department-scoped tables
ALTER TABLE public.products              ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.documents             ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.document_chunks       ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.recipes               ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.qc_batches            ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.qc_results            ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.calculation_history   ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.chat_threads          ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.quality_alerts        ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.ncr_reports           ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.product_events        ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 2) backfill from the existing text category / department key
UPDATE public.products p            SET department_id = d.id FROM public.departments d WHERE p.department_id IS NULL AND p.category = d.key;
UPDATE public.documents t           SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.document_chunks t     SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.recipes t             SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.department = d.key;
UPDATE public.qc_batches t          SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.qc_results t          SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.calculation_history t SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.department = d.key;
UPDATE public.chat_threads t        SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.quality_alerts t      SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.ncr_reports t         SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;
UPDATE public.product_events t      SET department_id = d.id FROM public.departments d WHERE t.department_id IS NULL AND t.category = d.key;

-- 3) keep department_id in sync automatically from the text key
CREATE OR REPLACE FUNCTION public.sync_department_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  key_val text;
BEGIN
  key_val := CASE TG_ARGV[0] WHEN 'department' THEN NEW.department ELSE NEW.category END;
  IF NEW.department_id IS NULL AND key_val IS NOT NULL THEN
    SELECT id INTO NEW.department_id FROM public.departments WHERE key = key_val;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_dept_id ON public.products;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.documents;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.document_chunks;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.document_chunks FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.recipes;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('department');
DROP TRIGGER IF EXISTS sync_dept_id ON public.qc_batches;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.qc_batches FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.qc_results;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.qc_results FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.calculation_history;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.calculation_history FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('department');
DROP TRIGGER IF EXISTS sync_dept_id ON public.chat_threads;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.quality_alerts;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.quality_alerts FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.ncr_reports;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.ncr_reports FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');
DROP TRIGGER IF EXISTS sync_dept_id ON public.product_events;
CREATE TRIGGER sync_dept_id BEFORE INSERT OR UPDATE ON public.product_events FOR EACH ROW EXECUTE FUNCTION public.sync_department_id('category');

-- 4) indexes for fast, isolated per-department reads
CREATE INDEX IF NOT EXISTS idx_products_dept            ON public.products(department_id);
CREATE INDEX IF NOT EXISTS idx_documents_dept           ON public.documents(department_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_dept     ON public.document_chunks(department_id);
CREATE INDEX IF NOT EXISTS idx_recipes_dept             ON public.recipes(department_id);
CREATE INDEX IF NOT EXISTS idx_qc_batches_dept          ON public.qc_batches(department_id);
CREATE INDEX IF NOT EXISTS idx_qc_results_dept          ON public.qc_results(department_id);
CREATE INDEX IF NOT EXISTS idx_calc_history_dept        ON public.calculation_history(department_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_dept        ON public.chat_threads(department_id);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_dept      ON public.quality_alerts(department_id);
CREATE INDEX IF NOT EXISTS idx_ncr_reports_dept         ON public.ncr_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_product_events_dept      ON public.product_events(department_id);