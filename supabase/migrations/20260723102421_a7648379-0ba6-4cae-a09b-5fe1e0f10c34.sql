
-- 1. Extend products with new columns (nullable, keep existing rows valid)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS package_size text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipe jsonb NOT NULL DEFAULT '{"steps":[],"parameters":{}}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS products_category_code_key
  ON public.products (category, lower(code))
  WHERE code IS NOT NULL AND code <> '';

-- 2. Expand app_role enum with the new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'qa_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'production_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'qa_engineer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'production_engineer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'laboratory';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'maintenance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- 3. Helper: check whether user has any of the given roles (by text name)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = ANY(_roles)
  )
$$;

-- 4. Rebuild product RLS policies with the new role matrix
DROP POLICY IF EXISTS "Authenticated can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can update products" ON public.products;
DROP POLICY IF EXISTS "Creator or owner can delete products" ON public.products;

CREATE POLICY "Privileged roles can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager'])
  );

CREATE POLICY "Privileged roles can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager'])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','qa_manager','production_manager'])
  );

CREATE POLICY "Owner or admin can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin'])
  );
