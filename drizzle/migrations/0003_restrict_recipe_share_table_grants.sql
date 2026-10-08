REVOKE ALL ON public.recipe_qr_shares FROM anon, authenticated;
GRANT ALL ON public.recipe_qr_shares TO service_role;