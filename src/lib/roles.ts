export const ROLE_OPTIONS = [
  { value: "admin", label_ar: "مدير النظام" },
  { value: "qa_manager", label_ar: "مدير جودة" },
  { value: "production_manager", label_ar: "مدير إنتاج" },
  { value: "qa_engineer", label_ar: "مهندس جودة" },
  { value: "production_engineer", label_ar: "مهندس إنتاج" },
  { value: "laboratory", label_ar: "معمل" },
  { value: "maintenance", label_ar: "صيانة" },
  { value: "warehouse", label_ar: "مخازن" },
  { value: "viewer", label_ar: "مشاهد" },
  { value: "user", label_ar: "مستخدم" },
];

export function roleLabel(role: string): string {
  if (role === "owner") return "المالك";
  return ROLE_OPTIONS.find((r) => r.value === role)?.label_ar ?? role;
}
