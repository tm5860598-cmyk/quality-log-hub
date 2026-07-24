import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const cache = new Map<string, string>();

// image_url may be:
//  - a full http(s) URL (legacy / external) -> use as-is
//  - a storage path prefixed with "storage:<key>" -> resolve to signed URL
export async function resolveImageUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith("storage:")) return value;
  const key = value.slice("storage:".length);
  const cached = cache.get(key);
  if (cached) return cached;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) return null;
  cache.set(key, data.signedUrl);
  return data.signedUrl;
}

export async function uploadProductImage(file: File, userId: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  return `storage:${key}`;
}