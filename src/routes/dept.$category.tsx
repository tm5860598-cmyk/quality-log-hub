import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDeptPermissions } from "@/lib/permissions";
import { useDepartment } from "@/lib/departments";
import { ArrowRight, Boxes, FileText, Sparkles, Clock } from "lucide-react";

export const Route = createFileRoute("/dept/$category")({
  ssr: false,
  component: DeptPage,
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
    { to: "/chat" as const, search: { category }, emoji: "💬", title: "الدردشة", desc: "بحث متخصص داخل مستندات ومنتجات القسم مع ذكر المصدر", icon: Sparkles },
    { to: "/manufacturing" as const, search: { category }, emoji: "🏭", title: "التصنيع والحاسبة", desc: "الوصفات وإصداراتها، حساب التشغيلة، الفاقد والتكلفة — لهذا القسم فقط", icon: Boxes },
    { to: "/quality-hub" as const, emoji: "📋", title: "الجودة والتقارير", desc: "التقارير والمراجع وسجلات عدم المطابقة", icon: FileText },
    { to: "/documents/$category" as const, params: { category }, emoji: "📄", title: "المستندات", desc: "رفع ملفات PDF / Word وربطها بالقسم والمنتج كقاعدة معرفة", icon: FileText },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            الرئيسية <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className={`rounded-3xl bg-gradient-to-br ${dept.gradient} p-6 text-white shadow-xl`}>
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-white/20 text-4xl">{dept.emoji}</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">{dept.title_ar}</h1>
              <p className="text-sm opacity-90 mt-1">{dept.desc_ar}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-2xl font-extrabold">{stats.products}</div>
              <div className="text-xs opacity-90">منتج</div>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-2xl font-extrabold">{stats.documents}</div>
              <div className="text-xs opacity-90">مستند</div>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-sm font-bold mt-1 flex items-center justify-center gap-1"><Clock className="size-3.5" />{stats.updated || "—"}</div>
              <div className="text-xs opacity-90">آخر تحديث</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              params={c.params as never}
              search={c.search as never}
              className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className={`inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${dept.gradient} text-2xl text-white shadow`}>
                {c.emoji}
              </div>
              <h2 className="mt-3 font-extrabold text-lg">{c.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                فتح <ArrowRight className="size-4 rotate-180 transition group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
