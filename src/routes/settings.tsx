import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Palette, Users, ShieldCheck, UserPlus, Trash2, Save, Check, LayoutGrid, Plus } from "lucide-react";
import { useDepartments, type Department } from "@/lib/departments";
import { ROLE_OPTIONS, roleLabel } from "@/lib/roles";
import { applyTheme, readTheme, THEMES, type ThemeMode } from "@/lib/theme";
import { MANAGER_ROLES } from "@/lib/permissions";
import { createAppUser, updateAppUser, deleteAppUser, setDeptPermissions } from "@/lib/users.functions";

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "الإعدادات | My Favourite Project" },
      { name: "description", content: "مركز التحكم في مظهر المشروع والمستخدمين وصلاحيات الأقسام والملفات." },
      { property: "og:title", content: "الإعدادات | My Favourite Project" },
      { property: "og:description", content: "مركز التحكم في المظهر والمستخدمين والصلاحيات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type AppUser = { id: string; username: string; job_title: string | null; role: string };
type PermRow = { view: boolean; upload: boolean; edit: boolean; delete: boolean };

function SettingsPage() {
  const { status, role } = useAuth();
  const isManager = MANAGER_ROLES.includes(role);
  const [tab, setTab] = useState<"theme" | "users" | "perms" | "depts">("theme");
  const isOwner = role === "owner";

  if (status === "loading") {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جاري التحميل...</div>;
  }
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Link to="/" className="text-primary underline">سجّل الدخول للمتابعة</Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">⚙️ الإعدادات</h1>
            <p className="text-sm text-muted-foreground mt-1">
              مركز التحكم في المظهر والمستخدمين وصلاحيات الأقسام والملفات.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            الرئيسية <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabBtn active={tab === "theme"} onClick={() => setTab("theme")} icon={<Palette className="size-4" />}>المظهر</TabBtn>
          {isManager && (
            <>
              <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="size-4" />}>إدارة المستخدمين</TabBtn>
              <TabBtn active={tab === "perms"} onClick={() => setTab("perms")} icon={<ShieldCheck className="size-4" />}>الصلاحيات</TabBtn>
            </>
          )}
          {isOwner && (
            <TabBtn active={tab === "depts"} onClick={() => setTab("depts")} icon={<LayoutGrid className="size-4" />}>إدارة الأقسام</TabBtn>
          )}
        </div>

        {tab === "theme" && <AppearanceSection />}
        {tab === "users" && isManager && <UsersSection callerRole={role} />}
        {tab === "perms" && isManager && <PermissionsSection callerRole={role} />}
        {tab === "depts" && isOwner && <DepartmentsSection />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition border ${
        active ? "bg-primary text-primary-foreground border-transparent shadow" : "bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
      }`}>
      {icon} {children}
    </button>
  );
}

/* ------------------------------- Appearance ------------------------------ */

function AppearanceSection() {
  const [mode, setMode] = useState<ThemeMode>("light");
  useEffect(() => { setMode(readTheme()); }, []);

  const pick = (m: ThemeMode) => {
    setMode(m);
    applyTheme(m);
    toast.success("تم تطبيق المظهر وحفظه");
  };

  return (
    <div className="rounded-2xl bg-card border shadow-sm p-5 space-y-4">
      <h2 className="font-bold flex items-center gap-2"><Palette className="h-4 w-4" /> مظهر المشروع</h2>
      <p className="text-sm text-muted-foreground">
        يُطبَّق المظهر على كل الصفحات: الأزرار والجداول والكروت والقوائم والتنبيهات — ويُحفظ اختيارك على هذا الجهاز.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {THEMES.map((t) => (
          <button key={t.value} onClick={() => pick(t.value)}
            className={`text-start rounded-2xl border-2 p-4 transition hover:shadow-lg ${
              mode === t.value ? "border-primary shadow-md" : "border-border"
            }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xl">{t.emoji}</span>
              {mode === t.value && <Check className="h-4 w-4 text-primary" />}
            </div>
            <div className="font-bold mt-2">{t.label_ar}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.desc_ar}</p>
            <div className="mt-3 flex gap-1.5">
              {(t.value === "light"
                ? ["#ffffff", "#e2e8f0", "#1e293b", "#4f46e5"]
                : t.value === "dark"
                  ? ["#0b1220", "#1e293b", "#e2e8f0", "#38bdf8"]
                  : ["#f3e8ff", "#a855f7", "#22d3ee", "#10b981"]
              ).map((c) => (
                <span key={c} className="h-5 w-5 rounded-full border" style={{ backgroundColor: c }} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Users section ----------------------------- */

function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const load = useCallback(async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, username, job_title").order("username"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));
    setUsers((profiles ?? []).map((p) => ({
      id: p.id, username: p.username, job_title: (p as { job_title: string | null }).job_title ?? null,
      role: roleMap.get(p.id) ?? "user",
    })));
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { users, reload: load };
}

function UsersSection({ callerRole }: { callerRole: string }) {
  const { users, reload } = useUsers();
  const create = useServerFn(createAppUser);
  const update = useServerFn(updateAppUser);
  const remove = useServerFn(deleteAppUser);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", jobTitle: "", role: "user" });
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [edit, setEdit] = useState({ username: "", password: "", jobTitle: "", role: "user" });

  const locked = (u: AppUser) =>
    callerRole !== "owner" && (u.role === "owner" || u.role === "admin");

  const addUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return toast.error("اسم المستخدم وكلمة السر مطلوبان");
    setBusy(true);
    try {
      await create({ data: { username: form.username, password: form.password, role: form.role, jobTitle: form.jobTitle } });
      toast.success("تم إنشاء المستخدم");
      setForm({ username: "", password: "", jobTitle: "", role: "user" });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const startEdit = (u: AppUser) => {
    setEditing(u);
    setEdit({ username: u.username, password: "", jobTitle: u.job_title ?? "", role: u.role });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await update({
        data: {
          userId: editing.id,
          username: edit.username !== editing.username ? edit.username : undefined,
          password: edit.password || undefined,
          jobTitle: edit.jobTitle,
          role: editing.role === "owner" || edit.role === editing.role ? undefined : edit.role,
        },
      });
      toast.success("تم حفظ بيانات المستخدم");
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const removeUser = async (u: AppUser) => {
    if (!confirm(`حذف المستخدم "${u.username}" نهائيًا؟`)) return;
    setBusy(true);
    try {
      await remove({ data: { userId: u.id } });
      toast.success("تم حذف المستخدم");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const roleChoices = callerRole === "owner" ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value !== "admin");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-card border shadow-sm p-5">
        <h2 className="font-bold flex items-center gap-2 mb-4"><UserPlus className="h-4 w-4" /> إضافة مستخدم</h2>
        <form onSubmit={addUser} className="space-y-3">
          <div><Label className="mb-1 block">اسم المستخدم</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div><Label className="mb-1 block">كلمة السر</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><Label className="mb-1 block">الوظيفة</Label>
            <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="مثال: مهندس جودة العصائر" /></div>
          <div><Label className="mb-1 block">الدور (Role)</Label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm">
              {roleChoices.map((r) => <option key={r.value} value={r.value}>{r.label_ar}</option>)}
            </select></div>
          <Button type="submit" disabled={busy} className="w-full"><UserPlus className="size-4" /> إضافة</Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          بعد الإضافة، حدّد صلاحيات الأقسام من تبويب «الصلاحيات» — المستخدم الجديد لا يرى أي قسم قبل منحه صلاحية.
        </p>
      </div>

      <div className="rounded-2xl bg-card border shadow-sm p-5">
        <h2 className="font-bold flex items-center gap-2 mb-4"><Users className="h-4 w-4" /> المستخدمون ({users.length})</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{u.username}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.job_title || "—"} · {roleLabel(u.role)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" disabled={locked(u)} onClick={() => startEdit(u)}>تعديل</Button>
                  <Button size="sm" variant="ghost" className="text-destructive"
                    disabled={busy || u.role === "owner" || locked(u)} onClick={() => removeUser(u)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {editing?.id === u.id && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 border-t pt-3">
                  <div><Label className="mb-1 block text-xs">اسم المستخدم</Label>
                    <Input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs">كلمة سر جديدة (اختياري)</Label>
                    <Input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs">الوظيفة</Label>
                    <Input value={edit.jobTitle} onChange={(e) => setEdit({ ...edit, jobTitle: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs">الدور</Label>
                    <select value={edit.role} disabled={u.role === "owner"}
                      onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-60">
                      {u.role === "owner"
                        ? <option value="owner">المالك</option>
                        : roleChoices.map((r) => <option key={r.value} value={r.value}>{r.label_ar}</option>)}
                    </select></div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button size="sm" disabled={busy} onClick={saveEdit}><Save className="size-4" /> حفظ</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Permissions section -------------------------- */

function PermissionsSection({ callerRole }: { callerRole: string }) {
  const { users } = useUsers();
  const { departments } = useDepartments();
  const permCategories = departments
    .filter((d) => d.is_active !== false)
    .map((d) => ({ key: d.key, label: `${d.emoji} ${d.title_ar}` }));
  const save = useServerFn(setDeptPermissions);
  const [selected, setSelected] = useState<string>("");
  const [matrix, setMatrix] = useState<Record<string, PermRow>>({});
  const [busy, setBusy] = useState(false);

  const selectableUsers = users.filter((u) =>
    u.role !== "owner" && (callerRole === "owner" || u.role !== "admin"));

  useEffect(() => {
    if (!selected) return;
    void (async () => {
      const { data } = await supabase
        .from("dept_permissions")
        .select("category, can_view, can_upload, can_edit, can_delete")
        .eq("user_id", selected);
      const next: Record<string, PermRow> = {};
      for (const c of permCategories) next[c.key] = { view: false, upload: false, edit: false, delete: false };
      for (const r of data ?? []) {
        next[r.category] = { view: !!r.can_view, upload: !!r.can_upload, edit: !!r.can_edit, delete: !!r.can_delete };
      }
      setMatrix(next);
    })();
  }, [selected, departments.length]);

  const toggle = (cat: string, key: keyof PermRow) =>
    setMatrix((m) => ({ ...m, [cat]: { ...m[cat], [key]: !m[cat]?.[key] } }));

  const persist = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await save({
        data: {
          userId: selected,
          permissions: permCategories.map((c) => ({
            category: c.key,
            view: !!matrix[c.key]?.view,
            upload: !!matrix[c.key]?.upload,
            edit: !!matrix[c.key]?.edit,
            delete: !!matrix[c.key]?.delete,
          })),
        },
      });
      toast.success("تم حفظ الصلاحيات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-card border shadow-sm p-5 space-y-4">
      <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> صلاحيات الأقسام والملفات</h2>
      <p className="text-sm text-muted-foreground">
        لكل مستخدم صلاحية منفصلة في كل قسم: عرض / رفع / تعديل / حذف. الصلاحية تُطبَّق على قاعدة البيانات والملفات معًا،
        فلا يستطيع المستخدم فتح أو تحميل أو حذف ملف قسم غير مسموح له به حتى لو امتلك رابطه.
        المالك ومدير النظام لهم صلاحية كاملة دائمًا.
      </p>

      <div className="max-w-sm">
        <Label className="mb-1 block">اختر المستخدم</Label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="w-full h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">— اختر —</option>
          {selectableUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.username} · {roleLabel(u.role)}</option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-start py-2">القسم</th>
                  <th className="py-2">عرض</th><th className="py-2">رفع</th>
                  <th className="py-2">تعديل</th><th className="py-2">حذف</th>
                </tr>
              </thead>
              <tbody>
                {permCategories.map((c) => (
                  <tr key={c.key} className="border-b last:border-0">
                    <td className="py-2 font-medium">{c.label}</td>
                    {(["view", "upload", "edit", "delete"] as const).map((k) => (
                      <td key={k} className="py-2 text-center">
                        <input type="checkbox" className="size-4 accent-[var(--primary)]"
                          checked={!!matrix[c.key]?.[k]} onChange={() => toggle(c.key, k)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={persist} disabled={busy}><Save className="size-4" /> حفظ الصلاحيات</Button>
        </>
      )}
    </div>
  );
}

/* --------------------------- Departments section -------------------------- */

const GRADIENT_CHOICES = [
  "from-orange-500 to-rose-500",
  "from-rose-500 to-fuchsia-500",
  "from-sky-500 to-cyan-500",
  "from-cyan-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-violet-600",
  "from-slate-500 to-slate-700",
];

const slugify = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9\u0621-\u064A]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Owner-only department manager. Every department created here automatically
 * gets the full workspace structure (products, documents, chat, manufacturing,
 * permissions) because all of those screens are driven by the department key.
 */
function DepartmentsSection() {
  const { departments, reload } = useDepartments();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ key: "", title_ar: "", title_en: "", desc_ar: "", desc_en: "", emoji: "🏭", gradient: GRADIENT_CHOICES[0] });
  const [editing, setEditing] = useState<Department | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const key = slugify(form.key || form.title_en || form.title_ar);
    if (!key || !form.title_ar.trim()) return toast.error("اكتب اسم القسم بالعربية على الأقل");
    setBusy(true);
    const maxOrder = Math.max(0, ...departments.map((d) => d.sort_order ?? 0));
    const { error } = await supabase.from("departments").insert({
      key,
      title_ar: form.title_ar.trim(),
      title_en: form.title_en.trim() || form.title_ar.trim(),
      desc_ar: form.desc_ar.trim(),
      desc_en: form.desc_en.trim() || form.desc_ar.trim(),
      emoji: form.emoji || "🏭",
      gradient: form.gradient,
      sort_order: maxOrder + 10,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم إضافة القسم بكل مكوناته (منتجات · مستندات · دردشة · تصنيع)");
    setForm({ key: "", title_ar: "", title_en: "", desc_ar: "", desc_en: "", emoji: "🏭", gradient: GRADIENT_CHOICES[0] });
    await reload();
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    setBusy(true);
    const { error } = await supabase.from("departments").update({
      title_ar: editing.title_ar,
      title_en: editing.title_en,
      desc_ar: editing.desc_ar,
      desc_en: editing.desc_en,
      emoji: editing.emoji,
      gradient: editing.gradient,
      is_active: editing.is_active !== false,
    }).eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ تعديلات القسم");
    setEditing(null);
    await reload();
  };

  const remove = async (d: Department) => {
    if (!d.id) return;
    if (d.is_system) return toast.error("هذا قسم أساسي في النظام — يمكن إخفاؤه فقط");
    if (!confirm(`حذف قسم "${d.title_ar}"؟ ستبقى بياناته المحفوظة في قاعدة البيانات.`)) return;
    setBusy(true);
    const { error } = await supabase.from("departments").delete().eq("id", d.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم حذف القسم");
    await reload();
  };

  const toggleActive = async (d: Department) => {
    if (!d.id) return;
    const { error } = await supabase.from("departments").update({ is_active: d.is_active === false }).eq("id", d.id);
    if (error) return toast.error(error.message);
    await reload();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-card border shadow-sm p-5">
        <h2 className="font-bold flex items-center gap-2 mb-1"><Plus className="h-4 w-4" /> إضافة قسم جديد</h2>
        <p className="text-xs text-muted-foreground mb-4">
          أي قسم جديد يظهر فورًا في الرئيسية ويحصل تلقائيًا على نفس الهيكل: المنتجات والحاسبة، المستندات، الدردشة الذكية،
          محرك التصنيع، ومصفوفة الصلاحيات.
        </p>
        <form onSubmit={add} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="mb-1 block">الاسم بالعربية *</Label>
              <Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} placeholder="مثال: إنتاج الآيس كريم" /></div>
            <div><Label className="mb-1 block">الاسم بالإنجليزية</Label>
              <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} placeholder="Ice Cream Production" /></div>
            <div><Label className="mb-1 block">وصف مختصر (عربي)</Label>
              <Input value={form.desc_ar} onChange={(e) => setForm({ ...form, desc_ar: e.target.value })} /></div>
            <div><Label className="mb-1 block">Description (EN)</Label>
              <Input value={form.desc_en} onChange={(e) => setForm({ ...form, desc_en: e.target.value })} /></div>
            <div><Label className="mb-1 block">المُعرّف (اختياري)</Label>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="icecream-production" /></div>
            <div><Label className="mb-1 block">الأيقونة</Label>
              <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} /></div>
          </div>
          <div>
            <Label className="mb-1 block">اللون</Label>
            <div className="flex flex-wrap gap-2">
              {GRADIENT_CHOICES.map((g) => (
                <button type="button" key={g} onClick={() => setForm({ ...form, gradient: g })}
                  className={`h-8 w-12 rounded-lg bg-gradient-to-br ${g} ${form.gradient === g ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  aria-label={g} />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full"><Plus className="size-4" /> إضافة القسم</Button>
        </form>
      </div>

      <div className="rounded-2xl bg-card border shadow-sm p-5">
        <h2 className="font-bold flex items-center gap-2 mb-4"><LayoutGrid className="h-4 w-4" /> الأقسام ({departments.length})</h2>
        <div className="space-y-2">
          {departments.map((d) => (
            <div key={d.key} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${d.gradient} text-lg text-white`}>{d.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.title_ar}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.key}{d.is_system ? " · أساسي" : ""}{d.is_active === false ? " · مخفي" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing(d)}>تعديل</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                    {d.is_active === false ? "إظهار" : "إخفاء"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy || d.is_system} onClick={() => remove(d)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {editing?.key === d.key && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 border-t pt-3">
                  <div><Label className="mb-1 block text-xs">الاسم بالعربية</Label>
                    <Input value={editing.title_ar} onChange={(e) => setEditing({ ...editing, title_ar: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs">الاسم بالإنجليزية</Label>
                    <Input value={editing.title_en} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs">وصف (عربي)</Label>
                    <Input value={editing.desc_ar} onChange={(e) => setEditing({ ...editing, desc_ar: e.target.value })} /></div>
                  <div><Label className="mb-1 block text-xs">الأيقونة</Label>
                    <Input value={editing.emoji} maxLength={4} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} /></div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1 block text-xs">اللون</Label>
                    <div className="flex flex-wrap gap-2">
                      {GRADIENT_CHOICES.map((g) => (
                        <button type="button" key={g} onClick={() => setEditing({ ...editing, gradient: g })}
                          className={`h-7 w-10 rounded-md bg-gradient-to-br ${g} ${editing.gradient === g ? "ring-2 ring-primary ring-offset-2" : ""}`}
                          aria-label={g} />
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button size="sm" disabled={busy} onClick={saveEdit}><Save className="size-4" /> حفظ</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
