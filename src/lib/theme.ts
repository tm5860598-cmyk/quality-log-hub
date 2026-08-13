export type ThemeMode = "light" | "dark" | "vivid";

export const THEME_KEY = "theme";

export const THEMES: Array<{ value: ThemeMode; label_ar: string; emoji: string; desc_ar: string }> = [
  { value: "light", label_ar: "الوضع العادي", emoji: "☀️", desc_ar: "أبيض نظيف وتباين مريح للقراءة الطويلة" },
  { value: "dark", label_ar: "الوضع الليلي", emoji: "🌙", desc_ar: "خلفية داكنة هادئة للعين في الإضاءة المنخفضة" },
  { value: "vivid", label_ar: "الوضع الملون", emoji: "🎨", desc_ar: "ألوان بنفسجية/فيروزية حيوية بهوية المشروع" },
];

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "vivid" || v === "light" ? v : "light";
}

export function applyTheme(mode: ThemeMode) {
  const el = document.documentElement;
  el.classList.toggle("dark", mode === "dark");
  el.classList.toggle("theme-vivid", mode === "vivid");
  el.style.colorScheme = mode === "dark" ? "dark" : "light";
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
}
