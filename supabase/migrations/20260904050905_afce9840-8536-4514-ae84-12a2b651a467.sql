ALTER TABLE public.qc_batches
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_output numeric,
  ADD COLUMN IF NOT EXISTS expected_output_unit text,
  ADD COLUMN IF NOT EXISTS actual_output numeric,
  ADD COLUMN IF NOT EXISTS actual_output_unit text,
  ADD COLUMN IF NOT EXISTS waste_loss numeric,
  ADD COLUMN IF NOT EXISTS deviations jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.material_density
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL;

ALTER TABLE public.cost_data
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS effective_date date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.manufacturing_parameters
  ADD COLUMN IF NOT EXISTS quality_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS standard_process jsonb NOT NULL DEFAULT '[]'::jsonb;