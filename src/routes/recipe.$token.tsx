import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, ShieldCheck, FlaskConical, ListOrdered, Package, Clock } from "lucide-react";
import { getSharedRecipe } from "@/lib/recipe-share.functions";
import { Button } from "@/components/ui/button";

const recipeQuery = (token: string) => queryOptions({ queryKey: ["shared-recipe", token], queryFn: () => getSharedRecipe({ data: { token } }), staleTime: 0 });
const labels: Record<string, string> = { ph: "درجة الحموضة pH", brix: "المواد الصلبة Brix", viscosity: "اللزوجة", net_weight: "الوزن الصافي", shelf_life: "مدة الصلاحية", storage: "التخزين", allergens: "مسببات الحساسية", standard_spec: "المواصفة القياسية", pasteurization_time: "مدة البسترة", cooling_time: "مدة التبريد", filling_point: "نقطة التعبئة", special_instructions: "تعليمات خاصة" };

export const Route = createFileRoute("/recipe/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(recipeQuery(params.token)),
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.name ?? "الوصفة"} — My Favourite Project` },
    { name: "description", content: "الوصفة والخامات وخطوات التصنيع — نسخة للاطلاع فقط." },
    { property: "og:title", content: `${loaderData?.name ?? "الوصفة"} — مكتبة الوصفات` },
    { property: "og:description", content: "تفاصيل الوصفة ومواصفاتها وخطوات التصنيع للقراءة فقط." },
    { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" },
  ] }),
  pendingComponent: () => <Status title="جاري تحميل الوصفة…" />,
  notFoundComponent: () => <Status title="الوصفة غير متاحة" />,
  errorComponent: ({ reset }) => <Status title="تعذر تحميل الوصفة"><Button variant="outline" onClick={reset}>إعادة المحاولة</Button></Status>,
  component: RecipePage,
});

function Status({ title, children }: { title: string; children?: React.ReactNode }) {
  return <main dir="rtl" className="min-h-screen bg-background text-foreground grid place-items-center p-6"><div className="text-center space-y-4"><BookOpen className="size-12 mx-auto text-muted-foreground" /><h1 className="text-2xl font-bold">{title}</h1>{children}</div></main>;
}

function RecipePage() {
  const { token } = Route.useParams();
  const { data: p } = useSuspenseQuery(recipeQuery(token));
  if (!p) return <Status title="الوصفة غير متاحة أو تم حذفها" />;
  const steps = [...(p.recipe?.steps ?? [])].sort((a, b) => a.order - b.order);
  const specs = Object.entries(p.spec ?? {}).filter(([, value]) => value);
  const parameters = Object.entries(p.recipe?.parameters ?? {}).filter(([, value]) => value);
  return <main dir="rtl" lang="ar" className="min-h-screen bg-background text-foreground font-[Tahoma,Arial,sans-serif]">
    <header className="border-b bg-card"><div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><BookOpen className="size-6 text-primary" /><span className="font-bold">مكتبة المنتجات والوصفات</span></div><span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" />للاطلاع فقط</span></div></header>
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-9">
      <section className="space-y-4"><p className="text-sm text-muted-foreground">{p.department}{p.code ? ` / ${p.code}` : ""}</p><h1 className="text-3xl sm:text-4xl font-bold break-words leading-snug">{p.name}</h1>{p.description && <p className="text-muted-foreground leading-8 whitespace-pre-wrap">{p.description}</p>}<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[["الكمية الأساسية", `${p.base_quantity} ${p.base_unit}`], ["نوع المنتج", p.product_type || "—"], ["حجم العبوة", p.package_size || "—"], ["آخر تحديث", new Date(p.updated_at).toLocaleDateString("ar-EG")]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground mb-2">{label}</p><p className="font-bold break-words">{value}</p></div>)}</div></section>
      <section className="space-y-4"><h2 className="text-xl font-bold flex items-center gap-2"><FlaskConical className="size-5 text-primary" />الخامات والمقادير <span className="text-sm font-normal text-muted-foreground">({p.ingredients.length})</span></h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm text-right"><thead className="bg-muted"><tr>{["#", "الخامة", "الكمية", "الوحدة", "النسبة"].map(h => <th key={h} className="px-4 py-3 whitespace-nowrap font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y">{p.ingredients.map((i, index) => <tr key={index} className="even:bg-muted/40"><td className="px-4 py-4 text-muted-foreground">{index + 1}</td><td className="px-4 py-4 font-semibold min-w-36">{i.name}</td><td className="px-4 py-4 tabular-nums">{i.amount}</td><td className="px-4 py-4">{i.unit}</td><td className="px-4 py-4">{i.percentage != null ? `${i.percentage}%` : "—"}</td></tr>)}{!p.ingredients.length && <tr><td colSpan={5} className="p-6 text-muted-foreground text-center">لم تُضف خامات لهذه الوصفة.</td></tr>}</tbody></table></div></section>
      <section className="space-y-4"><h2 className="text-xl font-bold flex items-center gap-2"><ListOrdered className="size-5 text-primary" />خطوات التصنيع</h2><ol className="space-y-3">{steps.map((s, index) => <li key={index} className="border rounded-lg bg-card p-5 flex items-start gap-4"><span className="size-8 shrink-0 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">{index + 1}</span><div className="min-w-0 space-y-3"><p className="font-semibold leading-7 whitespace-pre-wrap break-words">{s.description}</p><dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">{[["الخامة", s.ingredient_ref], ["الكمية", s.quantity], ["سرعة التقليب", s.stir_speed], ["مدة التقليب", s.stir_time], ["درجة الحرارة", s.temperature], ["الضغط", s.pressure]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap gap-2"><dt className="text-muted-foreground">{label}:</dt><dd className="break-words">{value}</dd></div>)}</dl>{s.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-7">{s.notes}</p>}</div></li>)}</ol>{!steps.length && <p className="text-muted-foreground">لم تُضف خطوات تصنيع لهذه الوصفة.</p>}</section>
      {(specs.length > 0 || parameters.length > 0) && <section className="grid md:grid-cols-2 gap-8">{[["المواصفات القياسية", specs], ["معايير التشغيل", parameters]].map(([title, entries]) => <div key={String(title)} className="space-y-4"><h2 className="text-xl font-bold flex items-center gap-2"><Package className="size-5 text-primary" />{String(title)}</h2><dl className="border rounded-lg divide-y">{(entries as [string, string][]).map(([key, value]) => <div key={key} className="px-4 py-3 grid grid-cols-2 gap-4 text-sm"><dt className="text-muted-foreground">{labels[key] ?? key}</dt><dd className="whitespace-pre-wrap break-words font-medium">{value}</dd></div>)}</dl></div>)}</section>}
      {p.notes && <section className="border-t pt-6 space-y-3"><h2 className="text-xl font-bold">ملاحظات الوصفة</h2><p className="leading-8 whitespace-pre-wrap break-words text-muted-foreground">{p.notes}</p></section>}
      <footer className="border-t pt-5 flex flex-wrap gap-3 justify-between text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck className="size-4" />نسخة للقراءة فقط</span><span className="flex items-center gap-2"><Clock className="size-4" />آخر تحديث: {new Date(p.updated_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</span></footer>
    </div>
  </main>;
}