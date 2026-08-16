-- ============ MANUFACTURING ENGINE SCHEMA ============

-- ============ UNIT CONVERSION TABLE ============
CREATE TABLE public.unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  conversion_factor numeric NOT NULL,
  base_unit text NOT NULL,
  department text,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_unit, to_unit, department)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_conversions TO authenticated;
GRANT ALL ON public.unit_conversions TO service_role;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY uc_select ON public.unit_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY uc_insert ON public.unit_conversions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE POLICY uc_update ON public.unit_conversions FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));

-- ============ MATERIAL DENSITY TABLE ============
CREATE TABLE public.material_density (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  density_value numeric NOT NULL COMMENT 'كيلوجرام/لتر',
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  department text,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, from_unit, to_unit)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_density TO authenticated;
GRANT ALL ON public.material_density TO service_role;
ALTER TABLE public.material_density ENABLE ROW LEVEL SECURITY;
CREATE POLICY md_select ON public.material_density FOR SELECT TO authenticated USING (true);
CREATE POLICY md_insert ON public.material_density FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer','laboratory']));

-- ============ RECIPES TABLE ============
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  department text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  recipe_name text NOT NULL,
  base_quantity numeric NOT NULL,
  base_unit text NOT NULL,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, department, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipes_select ON public.recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY recipes_insert ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (public.can_dept(auth.uid(), department, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer'])));
CREATE POLICY recipes_update ON public.recipes FOR UPDATE TO authenticated
  USING (public.can_dept(auth.uid(), department, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']))
  WITH CHECK (public.can_dept(auth.uid(), department, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE INDEX idx_recipes_product ON public.recipes(product_id);
CREATE INDEX idx_recipes_department ON public.recipes(department);
CREATE INDEX idx_recipes_status ON public.recipes(status);

-- ============ RECIPE VERSIONS (HISTORY) ============
CREATE TABLE public.recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version integer NOT NULL,
  change_note text,
  previous_recipe jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_recipe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version)
);
GRANT SELECT, INSERT ON public.recipe_versions TO authenticated;
GRANT ALL ON public.recipe_versions TO service_role;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rv_select ON public.recipe_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY rv_insert ON public.recipe_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE INDEX idx_recipe_versions_recipe ON public.recipe_versions(recipe_id);

-- ============ COST DATA TABLE ============
CREATE TABLE public.cost_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  department text,
  cost_per_unit numeric NOT NULL,
  unit text NOT NULL,
  currency text DEFAULT 'SAR',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_data TO authenticated;
GRANT ALL ON public.cost_data TO service_role;
ALTER TABLE public.cost_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY cd_select ON public.cost_data FOR SELECT TO authenticated USING (true);
CREATE POLICY cd_insert ON public.cost_data FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE INDEX idx_cost_data_material ON public.cost_data(material_id);
CREATE INDEX idx_cost_data_effective_date ON public.cost_data(effective_date);

-- ============ MATERIAL SUBSTITUTION TABLE ============
CREATE TABLE public.material_substitution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  substitute_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  department text,
  conversion_factor numeric NOT NULL DEFAULT 1.0,
  quality_notes text,
  approved_by uuid REFERENCES auth.users(id),
  approval_date date,
  is_approved boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_substitution TO authenticated;
GRANT ALL ON public.material_substitution TO service_role;
ALTER TABLE public.material_substitution ENABLE ROW LEVEL SECURITY;
CREATE POLICY ms_select ON public.material_substitution FOR SELECT TO authenticated USING (true);
CREATE POLICY ms_insert ON public.material_substitution FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE POLICY ms_update ON public.material_substitution FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE INDEX idx_material_substitution_primary ON public.material_substitution(primary_material_id);
CREATE INDEX idx_material_substitution_substitute ON public.material_substitution(substitute_material_id);

-- ============ CALCULATION HISTORY TABLE ============
CREATE TABLE public.calculation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  department text NOT NULL,
  recipe_version integer,
  batch_size numeric NOT NULL,
  batch_unit text NOT NULL,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_output numeric,
  expected_output_unit text,
  waste_loss numeric,
  waste_loss_unit text,
  total_cost numeric,
  cost_per_unit numeric,
  currency text DEFAULT 'SAR',
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.calculation_history TO authenticated;
GRANT ALL ON public.calculation_history TO service_role;
ALTER TABLE public.calculation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ch_select ON public.calculation_history FOR SELECT TO authenticated USING (true);
CREATE POLICY ch_insert ON public.calculation_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (public.can_dept(auth.uid(), department, 'edit') OR public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer'])));
CREATE INDEX idx_calculation_history_product ON public.calculation_history(product_id);
CREATE INDEX idx_calculation_history_created_at ON public.calculation_history(created_at DESC);

-- ============ EXTEND QC_BATCHES FOR MANUFACTURING ============
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS recipe_version integer;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS calculation_id uuid;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS batch_size numeric;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS expected_output numeric;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS expected_output_unit text;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS actual_output numeric;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS actual_output_unit text;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS waste_loss numeric;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS waste_loss_unit text;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS cost_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS manufacturing_params jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.qc_batches ADD COLUMN IF NOT EXISTS deviations jsonb DEFAULT '{}'::jsonb;

-- ============ MANUFACTURING PARAMETERS PER DEPARTMENT ============
CREATE TABLE public.manufacturing_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  default_waste_percent numeric DEFAULT 2.5,
  min_batch_size numeric,
  max_batch_size numeric,
  batch_size_unit text,
  quality_params jsonb DEFAULT '{}'::jsonb,
  standard_process jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_parameters TO authenticated;
GRANT ALL ON public.manufacturing_parameters TO service_role;
ALTER TABLE public.manufacturing_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY mp_select ON public.manufacturing_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY mp_insert ON public.manufacturing_parameters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE POLICY mp_update ON public.manufacturing_parameters FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));

-- ============ MANUFACTURING SIMULATIONS ============
CREATE TABLE public.manufacturing_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  batch_size numeric NOT NULL,
  batch_unit text NOT NULL,
  simulated_materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  simulated_output numeric,
  simulated_output_unit text,
  simulated_waste numeric,
  simulated_waste_unit text,
  simulated_cost numeric,
  quality_prediction jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.manufacturing_simulations TO authenticated;
GRANT ALL ON public.manufacturing_simulations TO service_role;
ALTER TABLE public.manufacturing_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ms_select ON public.manufacturing_simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY ms_insert ON public.manufacturing_simulations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer']));
CREATE INDEX idx_manufacturing_simulations_recipe ON public.manufacturing_simulations(recipe_id);

-- ============ DEVIATION LOGS ============
CREATE TABLE public.deviation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.qc_batches(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  deviation_type text NOT NULL,
  parameter_name text,
  expected_value text,
  actual_value text,
  deviation_percent numeric,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  root_cause text,
  corrective_action text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deviation_logs TO authenticated;
GRANT ALL ON public.deviation_logs TO service_role;
ALTER TABLE public.deviation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dl_select ON public.deviation_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY dl_insert ON public.deviation_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager','production_engineer','laboratory']));
CREATE INDEX idx_deviation_logs_batch ON public.deviation_logs(batch_id);
CREATE INDEX idx_deviation_logs_status ON public.deviation_logs(status);
