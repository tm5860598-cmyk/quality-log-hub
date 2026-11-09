// Per-account profile preferences: the project name shown on the home page and the profile photo.
// Stored in the auth user's metadata (short strings only) + the private `report-branding` bucket for the photo,
// so no database migration is needed. If the photo cannot be uploaded, it is kept on this device only.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const DEFAULT_PROJECT_NAME = { ar: "مشروعي المفضل", en: "My Favourite Project" };

type Override = { userId: string; projectName?: string; avatarPath?: string | null };
let override: Override | null = null;
const bus = new EventTarget();
const emit = () => bus.dispatchEvent(new Event("change"));
const localKey = (id: string) => `profile-avatar:${id}`;
const readLocal = (id: string) => { try { return localStorage.getItem(localKey(id)); } catch { return null; } };
const writeLocal = (id: string, v: string | null) => { try { v ? localStorage.setItem(localKey(id), v) : localStorage.removeItem(localKey(id)); } catch { /* ignore */ } };

const urlCache = new Map<string, string>();
async function signedAvatar(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit) return hit;
  const { data, error } = await supabase.storage.from("report-branding").createSignedUrl(path, 3600);
  if (error || !data) return null;
  urlCache.set(path, data.signedUrl);
  return data.signedUrl;
}

export function useProfilePrefs() {
  const { session, userId } = useAuth();
  const [, force] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const on = () => force((n) => n + 1);
    bus.addEventListener("change", on);
    return () => bus.removeEventListener("change", on);
  }, []);

  const meta = (session?.user?.user_metadata ?? {}) as { project_name?: string; avatar_path?: string | null };
  const ov = override && override.userId === userId ? override : null;
  const projectName = (ov?.projectName ?? meta.project_name ?? "").trim();
  const avatarPath = ov && "avatarPath" in ov ? ov.avatarPath ?? null : meta.avatar_path ?? null;
  const local = userId ? readLocal(userId) : null;

  useEffect(() => {
    let alive = true;
    if (!avatarPath) { setAvatarUrl(local); return; }
    void signedAvatar(avatarPath).then((u) => { if (alive) setAvatarUrl(u ?? local); });
    return () => { alive = false; };
  }, [avatarPath, local]);

  return { projectName, avatarUrl, hasAvatar: !!avatarUrl, avatarIsLocal: !avatarPath && !!local };
}

export async function saveProjectName(userId: string, name: string) {
  const clean = name.trim().slice(0, 60);
  const { error } = await supabase.auth.updateUser({ data: { project_name: clean || null } });
  if (error) throw error;
  override = { ...(override?.userId === userId ? override : { userId }), userId, projectName: clean };
  emit();
}

/** Square-crops and downsizes the photo so it stays small and sharp. */
async function resizeAvatar(file: File, size: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("تعذّر معالجة الصورة"))), "image/jpeg", quality));
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

/** Returns "cloud" when stored in the account, or "device" when it could only be kept on this device. */
export async function saveAvatar(userId: string, file: File): Promise<"cloud" | "device"> {
  const big = await resizeAvatar(file, 320, 0.88);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const up = await supabase.storage.from("report-branding").upload(path, big, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
  if (up.error) {
    writeLocal(userId, await blobToDataUrl(await resizeAvatar(file, 160, 0.82)));
    override = { ...(override?.userId === userId ? override : { userId }), userId, avatarPath: null };
    emit();
    return "device";
  }
  const { error } = await supabase.auth.updateUser({ data: { avatar_path: path } });
  if (error) throw error;
  writeLocal(userId, null);
  override = { ...(override?.userId === userId ? override : { userId }), userId, avatarPath: path };
  emit();
  return "cloud";
}

export async function removeAvatar(userId: string, currentPath?: string | null) {
  await supabase.auth.updateUser({ data: { avatar_path: null } });
  writeLocal(userId, null);
  if (currentPath) void supabase.storage.from("report-branding").remove([currentPath]);
  override = { ...(override?.userId === userId ? override : { userId }), userId, avatarPath: null };
  emit();
}
