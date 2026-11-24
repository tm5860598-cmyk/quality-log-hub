// Delivery of generated audio/video: save to the phone (share sheet on mobile) or keep on the project (private storage).
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "report-branding"; // private bucket, per-user folder (same policies as the avatar / logo uploads)
const FOLDER = "converted";

export type SavedFile = { name: string; path: string; size: number; createdAt: string };

const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "ملف";

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("سجّل الدخول لحفظ الملفات على المشروع");
  return id;
}

/** Saves on the device: the native share sheet on phones ("Save to Files"), a normal download elsewhere. */
export async function saveToDevice(blob: Blob, fileName: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));
  if (mobile && nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: fileName }); return "shared"; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "shared"; /* fall through to a download */ }
  }
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  return "downloaded";
}

export async function saveToProject(blob: Blob, fileName: string): Promise<SavedFile> {
  const uid = await userId();
  const name = safe(fileName);
  const path = `${uid}/${FOLDER}/${Date.now()}-${name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || undefined, upsert: false, cacheControl: "3600" });
  if (error) {
    const big = /size|exceed|too large|payload/i.test(error.message);
    throw new Error(big ? "حجم الملف أكبر من المسموح للتخزين على المشروع — حمّله على الجهاز بدلًا من ذلك." : `تعذّر الحفظ على المشروع: ${error.message}`);
  }
  return { name, path, size: blob.size, createdAt: new Date().toISOString() };
}

export async function listSaved(): Promise<SavedFile[]> {
  const uid = await userId();
  const { data, error } = await supabase.storage.from(BUCKET).list(`${uid}/${FOLDER}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((f) => f.name && !f.name.endsWith("/")).map((f) => ({
    name: f.name.replace(/^\d+-/, ""),
    path: `${uid}/${FOLDER}/${f.name}`,
    size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
    createdAt: f.created_at ?? "",
  }));
}

export async function savedUrl(path: string, downloadName: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600, { download: downloadName });
  if (error || !data) throw new Error("تعذّر إنشاء رابط التحميل");
  return data.signedUrl;
}

export async function removeSaved(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/** "Finished" signal: vibration + a system notification when the tab is in the background (toast is shown by the page). */
export function signalDone(title: string, body: string) {
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* unsupported */ }
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification(title, { body });
  } catch { /* unsupported (e.g. iOS outside an installed app) */ }
}

export function askNotificationPermission() {
  try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); } catch { /* ignore */ }
}
