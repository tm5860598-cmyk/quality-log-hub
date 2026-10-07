import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SharedRecipe = {
  name: string; code: string | null; description: string | null; department: string;
  product_type: string | null; package_size: string | null; base_quantity: number; base_unit: string;
  ingredients: { name: string; amount: number; unit: string; percentage?: number | null }[];
  spec: Record<string, string> | null;
  recipe: { steps?: { order: number; description: string; ingredient_ref?: string; quantity?: string; stir_speed?: string; stir_time?: string; temperature?: string; pressure?: string; notes?: string }[]; parameters?: Record<string, string> } | null;
  notes: string | null; updated_at: string;
};

export const getSharedRecipe = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data?.token ?? "") ? data.token : null }))
  .handler(async ({ data }): Promise<SharedRecipe | null> => {
    if (!data.token) return null;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("تعذر تحميل الوصفة، حاول مرة أخرى.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: recipe, error } = await client.rpc("read_recipe_qr_share", { _token: data.token });
    if (error) throw new Error("تعذر تحميل الوصفة، حاول مرة أخرى.");
    return recipe as unknown as SharedRecipe | null;
  });