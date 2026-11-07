import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDeptPermissions } from "@/lib/permissions";
import { useDepartment } from "@/lib/departments";
import { ArrowRight, Boxes, FileText, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/dept/$category")({
  ssr: false,
  component: DeptPage,
  head: () => ({
    meta: [
      { title: "الأقسام | مشروعي المفضل" },
      { name: "description", content: "مساحة العمل والمنتجات والمستندات الخاصة بأقسام مشروعي المفضل." },
      { property: "og:title", content: "الأقسام | مشروعي المفضل" },
      { property: "og:description", content: "مساحة العمل والمنتجات والمستندات الخاصة بأقسام مشروعي المفضل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DeptPage() {
  const { category } = Route.useParams();
  const { status } = useAuth();
  const { can, loading: permLoading } = useDeptPermissions();
  const { dept, loading: deptLoading } = useDepartment(category);
  const [stats, setStats] = useState({ products: 0, documents: 0, updated: "" });

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const [p, d, last] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("category", category),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("category", category),
        supabase.from("documents").select("updated_at").eq("category", category).order("updated_at", { ascending: false }).limit(1),
      ]);
      setStats({
        products: p.count ?? 0,
        documents: d.count ?? 0,
        updated: last.data?.[0]?.updated_at ? new Date(last.data[0].updated_at as string).toLocaleDateString("ar-EG") : "—",
      });
    })();
  }, [category, status]);

  if (permLoading || deptLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جاري التحقق من الصلاحيات...</div>;
  }
  if (!can(category).view) {
    return (
      <div dir="rtl" className="min-h-screen grid place-items-center p-6 text-center bg-background">
        <div className="max-w-md space-y-3">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">لا تملك صلاحية الدخول لهذا القسم</h1>
          <p className="text-sm text-muted-foreground">اطلب من المالك منحك صلاحية «عرض» لهذا القسم من صفحة الإعدادات.</p>
          <Link to="/" className="text-primary underline text-sm">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }
  if (!dept) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Link to="/" className="text-primary underline">القسم غير موجود — العودة للرئيسية</Link>
      </div>
    );
  }

  const cards = [
    { to: "/products/$category" as const, params: { category }, emoji: "📦", title: "المنتجات والحاسبة", desc: "مكتبة المنتجات والوصفات وحاسبة الخامات حسب الكمية المطلوبة", icon: Boxes },
    { to: "/documents/$category" as const, params: { category }, emoji: "📄", title: "مستندات القسم", desc: "ملفات القسم ومراجع المنتجات في مساحة واحدة", icon: FileText },
  ];

  const accent = {
    "juice-production": "border-orange-400/40 shadow-orange-500/10 hover:shadow-orange-500/20",
    "juice-quality": "border-fuchsia-400/40 shadow-fuchsia-500/10 hover:shadow-fuchsia-500/20",
    "dairy-production": "border-cyan-400/40 shadow-cyan-500/10 hover:shadow-cyan-500/20",
    "dairy-quality": "border-teal-400/40 shadow-teal-500/10 hover:shadow-teal-500/20",
    "bakery-production": "border-amber-400/40 shadow-amber-500/10 hover:shadow-amber-500/20",
    "bakery-quality": "border-yellow-400/40 shadow-yellow-500/10 hover:shadow-yellow-500/20",
    "quality-reports": "border-emerald-400/40 shadow-emerald-500/10 hover:shadow-emerald-500/20",
    "quality-reference": "border-indigo-400/40 shadow-indigo-500/10 hover:shadow-indigo-500/20",
  }[category] ?? "border-primary/30 shadow-primary/10 hover:shadow-primary/20";

  return (
    <div dir="rtl" className="dash-scope dash-dots min-h-screen p-4 text-right md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white">
          <ArrowRight className="size-4" /> الرئيسية
        </Link>

        <section className={`relative overflow-hidden rounded-2xl border bg-white/[0.06] p-4 shadow-lg backdrop-blur-xl sm:p-5 ${accent}`}>
          <div className={`absolute inset-y-0 right-0 w-1 bg-gradient-to-b ${dept.gradient}`} />
          <div className="flex items-center gap-4">
            <div className={`grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${dept.gradient} text-2xl shadow-lg sm:size-14`}>
              {dept.emoji}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-white sm:text-2xl">{dept.title_ar}</h1>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-300">{dept.desc_ar}</p>
            </div>
          </div>
        </section>

        <section aria-label="إحصائيات القسم" className="grid grid-cols-3 divide-x divide-x-reverse divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl">
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <div className="text-lg font-extrabold text-white sm:text-xl">{stats.products}</div>
            <div className="mt-1 text-xs text-slate-400 sm:text-sm">عدد المنتجات</div>
          </div>
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <div className="text-lg font-extrabold text-white sm:text-xl">{stats.documents}</div>
            <div className="mt-1 text-xs text-slate-400 sm:text-sm">عدد المستندات</div>
          </div>
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <div className="flex min-h-7 items-center justify-center gap-1.5 text-sm font-bold text-white sm:text-base">
              <Clock className="size-3.5 shrink-0 text-slate-400" />
              <span>{stats.updated || "—"}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400 sm:text-sm">آخر تحديث</div>
          </div>
        </section>

        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              params={c.params as never}
              search={c.search as never}
              className={`group relative flex min-h-52 flex-col overflow-hidden rounded-2xl border bg-white/[0.06] p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.09] ${accent}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${dept.gradient} text-2xl text-white shadow-lg transition-transform duration-300 group-hover:rotate-[10deg]`}>
                  {c.emoji}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="size-3.5" /> مفعل
                </span>
              </div>
              <h2 className="mt-4 text-lg font-extrabold text-white">{c.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-slate-300">{c.desc}</p>
              <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3.5 py-2 text-sm font-bold text-white transition-colors group-hover:border-white/30 group-hover:bg-white/[0.12]">
                فتح <ArrowRight className="size-4 transition-transform group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
