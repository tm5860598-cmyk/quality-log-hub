import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDeptPermissions } from "@/lib/permissions";
import { QUALITY_HUB_KEY, QUALITY_REFERENCE_KEY, useDepartment } from "@/lib/departments";
import { ArrowRight, Clock } from "lucide-react";

export const Route = createFileRoute("/quality-hub")({
  ssr: false,
  component: QualityHub,
  head: () => ({
    meta: [
      { title: "الجودة العام | My Favourite Project" },
      { name: "description", content: "مركز الجودة العام: التقارير والمراجع والمستندات وسجلات عدم المطابقة والإجراءات التصحيحية." },
      { property: "og:title", content: "الجودة العام | My Favourite Project" },
      { property: "og:description", content: "التقارير والمراجع والمستندات وسجلات الجودة في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function QualityHub() {
  const { status } = useAuth();
  const { can, loading: permLoading } = useDeptPermissions();
  const { dept } = useDepartment(QUALITY_HUB_KEY);
  const [stats, setStats] = useState({ reports: 0, refs: 0, ncr: 0, updated: "—" });

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const [r, d, n, last] = await Promise.all([
        supabase.from("reports").select("id", { count: "exact", head: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("category", QUALITY_REFERENCE_KEY),
        supabase.from("ncr_reports").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("updated_at").order("updated_at", { ascending: false }).limit(1),
      ]);
      setStats({
        reports: r.count ?? 0,
        refs: d.count ?? 0,
        ncr: n.count ?? 0,
        updated: last.data?.[0]?.updated_at
          ? new Date(last.data[0].updated_at as string).toLocaleDateString("ar-EG")
          : "—",
      });
    })();
  }, [status]);

  if (permLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جاري التحقق من الصلاحيات...</div>;
  }
  if (!can(QUALITY_HUB_KEY).view) {
    return (
      <div dir="rtl" className="min-h-screen grid place-items-center p-6 text-center bg-background">
        <div className="max-w-md space-y-3">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">لا تملك صلاحية الدخول لقسم الجودة العام</h1>
          <Link to="/" className="text-primary underline text-sm">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  const gradient = dept?.gradient ?? "from-emerald-500 to-teal-600";

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          الرئيسية <ArrowRight className="h-4 w-4" />
        </Link>

        <div className={`rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-xl`}>
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-white/20 text-4xl">{dept?.emoji ?? "📋"}</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">{dept?.title_ar ?? "الجودة العام"}</h1>
              <p className="text-sm opacity-90 mt-1">مركز عام للتقارير والمراجع وسجلات الجودة لكل الأقسام.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-3 text-center">
            <Stat value={String(stats.reports)} label="تقرير" />
            <Stat value={String(stats.refs)} label="مرجع" />
            <Stat value={String(stats.ncr)} label="عدم مطابقة" />
            <div className="rounded-xl bg-white/15 p-3">
              <div className="text-sm font-bold mt-1 flex items-center justify-center gap-1"><Clock className="size-3.5" />{stats.updated}</div>
              <div className="text-xs opacity-90">آخر تحديث</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HubCard to="/" search={{ view: "reports" as const }} emoji="🗒️" title="التقارير"
            desc="إنشاء وحفظ تقارير المشاكل والإجراءات المتخذة مع الإمضاءات والطباعة." gradient={gradient} />
          <HubCard to="/documents/$category" params={{ category: QUALITY_REFERENCE_KEY }} emoji="📚" title="المراجع والمستندات"
            desc="رفع أي نوع ملف كمرجع دائم، مع الفتح والمعاينة والبحث داخل المحتوى." gradient={gradient} />
          <HubCard to="/ncr" emoji="⚠️" title="عدم المطابقة NCR / CAPA"
            desc="تسجيل ومتابعة حالات عدم المطابقة والإجراءات التصحيحية." gradient={gradient} />
          <HubCard to="/chat" search={{ category: QUALITY_HUB_KEY }} emoji="💬" title="الدردشة"
            desc="بحث ذكي داخل مراجع ومستندات الجودة مع ذكر اسم الملف ورقم الصفحة." gradient={gradient} />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/15 p-3">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs opacity-90">{label}</div>
    </div>
  );
}

function HubCard({
  to, params, search, emoji, title, desc, gradient,
}: {
  to: string; params?: Record<string, string>; search?: Record<string, string>;
  emoji: string; title: string; desc: string; gradient: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className={`inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-2xl text-white shadow`}>
        {emoji}
      </div>
      <h2 className="mt-3 font-extrabold text-lg">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        فتح <ArrowRight className="size-4 rotate-180 transition group-hover:-translate-x-1" />
      </span>
    </Link>
  );
}
