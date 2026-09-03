-- ============ RECIPES ============
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  recipe_name TEXT NOT NULL,
  base_quantity NUMERIC NOT NULL DEFAULT 0,
  base_unit TEXT NOT NULL DEFAULT 'kg',
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipes_insert" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE POLICY "recipes_update" ON public.recipes FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE POLICY "recipes_delete" ON public.recipes FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']));
CREATE TRIGGER recipes_touch BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RECIPE VERSIONS ============
CREATE TABLE public.recipe_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  change_note TEXT,
  current_recipe JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.recipe_versions TO authenticated;
GRANT ALL ON public.recipe_versions TO service_role;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_versions_select" ON public.recipe_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipe_versions_insert" ON public.recipe_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- ============ CALCULATION HISTORY ============
CREATE TABLE public.calculation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID,
  recipe_id UUID,
  department TEXT,
  recipe_version INTEGER NOT NULL DEFAULT 1,
  batch_size NUMERIC,
  batch_unit TEXT,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output NUMERIC,
  expected_output_unit TEXT,
  waste_loss NUMERIC,
  waste_loss_unit TEXT,
  total_cost NUMERIC,
  cost_per_unit NUMERIC,
  currency TEXT DEFAULT 'EGP',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.calculation_history TO authenticated;
GRANT ALL ON public.calculation_history TO service_role;
ALTER TABLE public.calculation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_history_select" ON public.calculation_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "calc_history_insert" ON public.calculation_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "calc_history_delete" ON public.calculation_history FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_any_role(auth.uid(), ARRAY['owner','admin']));

-- ============ UNIT CONVERSIONS ============
CREATE TABLE public.unit_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  conversion_factor NUMERIC NOT NULL DEFAULT 1,
  base_unit TEXT NOT NULL DEFAULT 'kg',
  department TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_conversions TO authenticated;
GRANT ALL ON public.unit_conversions TO service_role;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_conv_select" ON public.unit_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY "unit_conv_write" ON public.unit_conversions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE TRIGGER unit_conversions_touch BEFORE UPDATE ON public.unit_conversions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MATERIAL DENSITY ============
CREATE TABLE public.material_density (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_name TEXT NOT NULL,
  density_value NUMERIC NOT NULL DEFAULT 1,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  department TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_density TO authenticated;
GRANT ALL ON public.material_density TO service_role;
ALTER TABLE public.material_density ENABLE ROW LEVEL SECURITY;
CREATE POLICY "density_select" ON public.material_density FOR SELECT TO authenticated USING (true);
CREATE POLICY "density_write" ON public.material_density FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE TRIGGER material_density_touch BEFORE UPDATE ON public.material_density
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COST DATA ============
CREATE TABLE public.cost_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_name TEXT NOT NULL,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  currency TEXT NOT NULL DEFAULT 'EGP',
  department TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_data TO authenticated;
GRANT ALL ON public.cost_data TO service_role;
ALTER TABLE public.cost_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_select" ON public.cost_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_write" ON public.cost_data FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE TRIGGER cost_data_touch BEFORE UPDATE ON public.cost_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MANUFACTURING PARAMETERS ============
CREATE TABLE public.manufacturing_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL UNIQUE,
  default_waste_percent NUMERIC NOT NULL DEFAULT 0,
  min_batch_size NUMERIC,
  max_batch_size NUMERIC,
  batch_size_unit TEXT DEFAULT 'kg',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_parameters TO authenticated;
GRANT ALL ON public.manufacturing_parameters TO service_role;
ALTER TABLE public.manufacturing_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mfg_params_select" ON public.manufacturing_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "mfg_params_write" ON public.manufacturing_parameters FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE TRIGGER manufacturing_parameters_touch BEFORE UPDATE ON public.manufacturing_parameters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MATERIAL SUBSTITUTION ============
CREATE TABLE public.material_substitution (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  primary_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  substitute_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  conversion_factor NUMERIC NOT NULL DEFAULT 1,
  quality_notes TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  department TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_substitution TO authenticated;
GRANT ALL ON public.material_substitution TO service_role;
ALTER TABLE public.material_substitution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select" ON public.material_substitution FOR SELECT TO authenticated USING (true);
CREATE POLICY "subs_write" ON public.material_substitution FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager']));
CREATE TRIGGER material_substitution_touch BEFORE UPDATE ON public.material_substitution
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();