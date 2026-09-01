import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Department = {
  id?: string;
  key: string;
  title_ar: string;
  title_en: string;
  desc_ar: string;
  desc_en: string;
  gradient: string;
  emoji: string;
  is_active?: boolean;
  is_system?: boolean;
  sort_order?: number;
};

/** Key of the general quality hub (reports + references + NCR). */
export const QUALITY_HUB_KEY = "quality-reports";
/** Key of the reference knowledge base living inside the quality hub. */
export const QUALITY_REFERENCE_KEY = "quality-reference";
/** Keys that are not rendered as standalone tiles on the home hub. */
export const HIDDEN_FROM_HUB = [QUALITY_REFERENCE_KEY];

/** Static fallback used before the database answers (and during SSR). */
export const DEPARTMENTS: Department[] = [
  { key: "juice-production", title_ar: "إنتاج العصائر", title_en: "Juice Production", desc_ar: "طرق تشغيل ووصفات العصائر بمعايير NFSA", desc_en: "Juice recipes & NFSA-grade processes", gradient: "from-orange-500 to-rose-500", emoji: "🥤", is_active: true, is_system: true, sort_order: 10 },
  { key: "juice-quality", title_ar: "جودة العصائر", title_en: "Juice Quality", desc_ar: "جميع اختبارات المعمل وصالة الإنتاج", desc_en: "All lab & floor QC tests", gradient: "from-rose-500 to-fuchsia-500", emoji: "🧪", is_active: true, is_system: true, sort_order: 20 },
  { key: "dairy-production", title_ar: "إنتاج الألبان", title_en: "Dairy Production", desc_ar: "تصنيع اللبن والزبادي والجبن والمعدات", desc_en: "Milk, yogurt, cheese processes", gradient: "from-sky-500 to-cyan-500", emoji: "🥛", is_active: true, is_system: true, sort_order: 30 },
  { key: "dairy-quality", title_ar: "جودة الألبان", title_en: "Dairy Quality", desc_ar: "تحاليل الدهن والبروتين والميكروبيولوجي", desc_en: "Fat, protein & micro tests", gradient: "from-cyan-500 to-teal-500", emoji: "🔬", is_active: true, is_system: true, sort_order: 40 },
  { key: "bakery-production", title_ar: "إنتاج البيكري", title_en: "Bakery Production", desc_ar: "وصفات المخبوزات وخطوات الإنتاج", desc_en: "Baker's percentages & steps", gradient: "from-amber-500 to-orange-500", emoji: "🥐", is_active: true, is_system: true, sort_order: 50 },
  { key: "bakery-quality", title_ar: "جودة البيكري", title_en: "Bakery Quality", desc_ar: "تحاليل الجلوتين والرطوبة وأجهزة المعمل", desc_en: "Gluten, moisture & lab kit", gradient: "from-yellow-500 to-amber-500", emoji: "🧫", is_active: true, is_system: true, sort_order: 60 },
  { key: QUALITY_HUB_KEY, title_ar: "الجودة العام", title_en: "General Quality", desc_ar: "التقارير والمراجع وسجلات الجودة", desc_en: "Reports, references & quality records", gradient: "from-emerald-500 to-teal-600", emoji: "📋", is_active: true, is_system: true, sort_order: 70 },
  { key: QUALITY_REFERENCE_KEY, title_ar: "المراجع والمستندات", title_en: "Reference Library", desc_ar: "مكتبة مراجع عامة لكل أنواع الملفات", desc_en: "General reference library", gradient: "from-indigo-500 to-violet-600", emoji: "📚", is_active: true, is_system: true, sort_order: 80 },
];

export const DEPT_MAP: Record<string, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.key, d]),
);

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.key, d.title_ar]),
);

/* ------------------------- live store (from the DB) ----------------------- */

let cache: Department[] = DEPARTMENTS;
let loaded = false;
let inflight: Promise<Department[]> | null = null;
const listeners = new Set<(d: Department[]) => void>();

async function fetchDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, key, title_ar, title_en, desc_ar, desc_en, emoji, gradient, is_active, is_system, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) return cache;
  return data as unknown as Department[];
}

export async function loadDepartments(force = false): Promise<Department[]> {
  if (loaded && !force) return cache;
  if (!inflight || force) {
    inflight = fetchDepartments().then((d) => {
      cache = d;
      loaded = true;
      inflight = null;
      listeners.forEach((l) => l(cache));
      return cache;
    });
  }
  return inflight;
}

/** Reactive list of departments coming from the database. */
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>(cache);
  const [loading, setLoading] = useState(!loaded);

  useEffect(() => {
    const listener = (d: Department[]) => setDepartments([...d]);
    listeners.add(listener);
    void loadDepartments().then(() => setLoading(false));
    return () => { listeners.delete(listener); };
  }, []);

  const reload = async () => { setLoading(true); await loadDepartments(true); setLoading(false); };

  return { departments, loading, reload };
}

/** Departments shown as workspaces (active, excluding internal ones). */
export function useWorkspaceDepartments() {
  const { departments, loading, reload } = useDepartments();
  return {
    departments: departments.filter((d) => d.is_active !== false && !HIDDEN_FROM_HUB.includes(d.key)),
    loading,
    reload,
  };
}

export function useDepartment(key: string | undefined) {
  const { departments, loading } = useDepartments();
  return { dept: departments.find((d) => d.key === key), loading };
}

export function useCategoryLabel(key: string | undefined) {
  const { dept } = useDepartment(key);
  return dept?.title_ar ?? CATEGORY_LABELS[key ?? ""] ?? key ?? "";
}
