CREATE TABLE public.recipe_qr_shares (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recipe_qr_shares TO service_role;
ALTER TABLE public.recipe_qr_shares ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.ensure_recipe_qr_share(_product_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _category text; _token uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT category INTO _category FROM public.products WHERE id = _product_id;
 IF _category IS NULL OR NOT public.can_dept(auth.uid(), _category, 'view') THEN RAISE EXCEPTION 'Access denied'; END IF;
 INSERT INTO public.recipe_qr_shares(product_id, created_by) VALUES (_product_id, auth.uid()) ON CONFLICT (product_id) DO NOTHING;
 SELECT token INTO _token FROM public.recipe_qr_shares WHERE product_id = _product_id;
 RETURN _token;
END $$;
REVOKE ALL ON FUNCTION public.ensure_recipe_qr_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_recipe_qr_share(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.read_recipe_qr_share(_token uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object(
 'name', p.name, 'code', p.code, 'description', p.description,
 'product_type', p.product_type, 'package_size', p.package_size,
 'base_quantity', p.base_quantity, 'base_unit', p.base_unit,
 'spec', p.spec, 'recipe', p.recipe, 'notes', p.notes, 'updated_at', p.updated_at,
 'department', COALESCE(d.title_ar, p.category),
 'ingredients', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', i->>'name', 'amount', i->'amount', 'unit', i->>'unit', 'percentage', i->'percentage')) FROM jsonb_array_elements(COALESCE(p.ingredients, '[]'::jsonb)) i), '[]'::jsonb)
 ) FROM public.recipe_qr_shares s JOIN public.products p ON p.id = s.product_id
 LEFT JOIN public.departments d ON d.key = p.category WHERE s.token = _token;
$$;
REVOKE ALL ON FUNCTION public.read_recipe_qr_share(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_recipe_qr_share(uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.read_recipe_qr_share(uuid) IS 'Capability-scoped read-only recipe projection; excludes user identifiers, supplier and cost data. No public product listing.';