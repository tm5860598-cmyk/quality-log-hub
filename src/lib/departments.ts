export type Department = {
  key: string;
  title_ar: string;
  title_en: string;
  desc_ar: string;
  desc_en: string;
  gradient: string;
  emoji: string;
};

export const DEPARTMENTS: Department[] = [
  {
    key: "juice-production",
    title_ar: "إنتاج العصائر", title_en: "Juice Production",
    desc_ar: "طرق تشغيل ووصفات العصائر بمعايير NFSA", desc_en: "Juice recipes & NFSA-grade processes",
    gradient: "from-orange-500 to-rose-500", emoji: "🥤",
  },
  {
    key: "juice-quality",
    title_ar: "جودة العصائر", title_en: "Juice Quality",
    desc_ar: "جميع اختبارات المعمل وصالة الإنتاج", desc_en: "All lab & floor QC tests",
    gradient: "from-rose-500 to-fuchsia-500", emoji: "🧪",
  },
  {
    key: "dairy-production",
    title_ar: "إنتاج الألبان", title_en: "Dairy Production",
    desc_ar: "تصنيع اللبن والزبادي والجبن والمعدات", desc_en: "Milk, yogurt, cheese processes",
    gradient: "from-sky-500 to-cyan-500", emoji: "🥛",
  },
  {
    key: "dairy-quality",
    title_ar: "جودة الألبان", title_en: "Dairy Quality",
    desc_ar: "تحاليل الدهن والبروتين والميكروبيولوجي", desc_en: "Fat, protein & micro tests",
    gradient: "from-cyan-500 to-teal-500", emoji: "🔬",
  },
  {
    key: "bakery-production",
    title_ar: "إنتاج البيكري", title_en: "Bakery Production",
    desc_ar: "وصفات المخبوزات وخطوات الإنتاج", desc_en: "Baker's percentages & steps",
    gradient: "from-amber-500 to-orange-500", emoji: "🥐",
  },
  {
    key: "bakery-quality",
    title_ar: "جودة البيكري", title_en: "Bakery Quality",
    desc_ar: "تحاليل الجلوتين والرطوبة وأجهزة المعمل", desc_en: "Gluten, moisture & lab kit",
    gradient: "from-yellow-500 to-amber-500", emoji: "🧫",
  },
];

export const DEPT_MAP: Record<string, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.key, d]),
);

export const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d.title_ar])),
  "quality-reports": "تقارير الجودة",
};
