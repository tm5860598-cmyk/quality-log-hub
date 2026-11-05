import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Languages, Plus, Save, Printer, FileDown, Trash2,
  LogOut, FileText, LogIn, UserPlus, FolderOpen, Sparkles, Settings as SettingsIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDeptPermissions } from "@/lib/permissions";
import { useWorkspaceDepartments, QUALITY_HUB_KEY } from "@/lib/departments";
import { PrintReport } from "@/components/PrintReport";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  validateSearch: (s: Record<string, unknown>): { view?: "reports" | "editor" } =>
    s.view === "reports" || s.view === "editor" ? { view: s.view } : {},
  head: () => ({
    meta: [
      { title: "My Favourite Project | تقارير الجودة" },
      { name: "description", content: "إدارة تقارير الجودة والإنتاج والمنتجات والإجراءات التصحيحية." },
      { property: "og:title", content: "My Favourite Project | تقارير الجودة" },
      { property: "og:description", content: "إدارة تقارير الجودة والإنتاج والمنتجات والإجراءات التصحيحية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; problem: string; action: string; qualitySign: string; productionSign: string };
type Lang = "ar" | "en";
type Report = {
  id: string;
  report_number: number;
  title: string;
  details: string | null;
  report_date: string;
  rows: Row[];
  created_by: string;
  created_at: string;
};

let rowCounter = 0;
const emptyRow = (): Row => ({
  id: `row-${++rowCounter}`, problem: "", action: "", qualitySign: "", productionSign: "",
});

const T = {
  ar: {
    title: "تقارير المشاكل والإجراءات",
    appName: "My Favourite Project",
    date: "التاريخ", reportTitle: "عنوان التقرير", reportDetails: "تفاصيل التقرير",
    add: "إضافة صف", save: "حفظ", print: "طباعة كتقرير", pdf: "تصدير PDF", lang: "English",
    num: "#", problem: "المشكلة", action: "الإجراء المتخذ",
    quality: "إمضاء مهندس الجودة", production: "إمضاء مهندس الإنتاج", del: "حذف",
    saved: "تم حفظ التقرير بنجاح", exported: "تم تصدير التقرير كـ PDF",
    login: "تسجيل الدخول", logout: "خروج", username: "اسم المستخدم", password: "كلمة السر",
    signIn: "دخول", newReport: "تقرير جديد", savedReports: "التقارير المحفوظة",
    open: "فتح", reportNo: "رقم التقرير", createdBy: "بواسطة",
    manageUsers: "إدارة المستخدمين", addUser: "إضافة مستخدم", userAdded: "تم إنشاء المستخدم",
    deleteReport: "هل تريد حذف هذا التقرير؟", reportDeleted: "تم حذف التقرير",
    required: "هذا الحقل مطلوب", minRowError: "يجب إدخال مشكلة وإجراء واحد على الأقل",
    welcome: "مرحبا", role_owner: "المالك", role_user: "مستخدم",
    noReports: "لا توجد تقارير محفوظة بعد",
    usernameHelp: "", passwordHelp: "",
    invalidUsername: "ادخل اسم المستخدم", invalidPassword: "ادخل كلمة السر",
    titleRequired: "يجب إدخال عنوان للتقرير",
  },
  en: {
    title: "Problems & Actions Report", appName: "My Favourite Project",
    date: "Date", reportTitle: "Report Title", reportDetails: "Report Details",
    add: "Add Row", save: "Save", print: "Print", pdf: "Export PDF", lang: "عربي",
    num: "#", problem: "Problem", action: "Action Taken",
    quality: "Quality Engineer", production: "Production Engineer", del: "Delete",
    saved: "Report saved successfully", exported: "Report exported as PDF",
    login: "Sign In", logout: "Logout", username: "Username", password: "Password",
    signIn: "Sign In", newReport: "New Report", savedReports: "Saved Reports",
    open: "Open", reportNo: "Report #", createdBy: "by",
    manageUsers: "Manage Users", addUser: "Add User", userAdded: "User created",
    deleteReport: "Delete this report?", reportDeleted: "Report deleted",
    required: "Required", minRowError: "Add at least one problem and action",
    welcome: "Welcome", role_owner: "Owner", role_user: "User",
    noReports: "No saved reports yet",
    usernameHelp: "", passwordHelp: "",
    invalidUsername: "Enter a username", invalidPassword: "Enter a password",
    titleRequired: "Report title is required",
  },
};

const sanitizeUsername = (u: string) => u.trim().toLowerCase();
const userToEmail = (u: string) => `${sanitizeUsername(u)}@app.local`;

function Index() {
  const [lang, setLang] = useState<Lang>("ar");
  const { session, role, username, status } = useAuth();
  const t = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">...</div>;
  }

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      {status === "unauthenticated" ? (
        <AuthScreen lang={lang} setLang={setLang} t={t} />
      ) : (
        <AppScreen
          lang={lang} setLang={setLang} t={t} dir={dir}
          username={username} role={role as "owner" | "user"}
        />
      )}
    </div>
  );
}

function AuthScreen({ lang, setLang, t }: { lang: Lang; setLang: (l: Lang) => void; t: typeof T["ar"] }) {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [firstUser, setFirstUser] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from("user_roles").select("id", { count: "exact", head: true })
      .eq("role", "owner").then(({ count }) => setFirstUser((count ?? 0) === 0));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const uname = sanitizeUsername(u);
    if (!uname) return toast.error(t.invalidUsername);
    if (!p) return toast.error(t.invalidPassword);
    setLoading(true);
    const email = userToEmail(uname);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password: p,
        options: { data: { username: uname }, emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else toast.success(lang === "ar" ? "تم إنشاء الحساب" : "Account created");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: p });
      if (error) toast.error(lang === "ar" ? "بيانات غير صحيحة" : "Invalid credentials");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
            {t.appName}
          </h1>
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            <Languages className="size-4" /> {t.lang}
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="mb-1 block">{t.username}</Label>
            <Input value={u} onChange={(e) => setU(e.target.value)} required autoComplete="username" />
            {mode === "signup" && <p className="text-xs text-slate-500 mt-1">{t.usernameHelp}</p>}
          </div>
          <div>
            <Label className="mb-1 block">{t.password}</Label>
            <Input type="password" value={p} onChange={(e) => setP(e.target.value)} required autoComplete="current-password" />
            {mode === "signup" && <p className="text-xs text-slate-500 mt-1">{t.passwordHelp}</p>}
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 text-white">
            {mode === "login" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
            {mode === "login" ? t.signIn : (lang === "ar" ? "إنشاء حساب المالك" : "Create Owner Account")}
          </Button>
        </form>
        {firstUser && (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm text-indigo-600 hover:underline">
              {mode === "login"
                ? (lang === "ar" ? "أول مرة؟ أنشئ حساب المالك" : "First time? Create owner account")
                : (lang === "ar" ? "لدي حساب بالفعل" : "I already have an account")}
            </button>
          </div>
        )}
        {firstUser === false && mode === "signup" && (
          <p className="mt-4 text-xs text-amber-700 text-center">
            {lang === "ar"
              ? "المالك فقط يمكنه إنشاء حسابات جديدة من داخل التطبيق"
              : "Only the owner can create new accounts from inside the app"}
          </p>
        )}
      </div>
    </div>
  );
}

function AppScreen({
  lang, setLang, t, dir, username, role,
}: {
  lang: Lang; setLang: (l: Lang) => void; t: typeof T["ar"]; dir: "ltr" | "rtl";
  username: string; role: "owner" | "user";
}) {
  const { view } = Route.useSearch();
  const [tab, setTab] = useState<"hub" | "editor" | "list">(
    view === "reports" ? "list" : view === "editor" ? "editor" : "hub",
  );
  useEffect(() => {
    if (view === "reports") setTab("list");
    else if (view === "editor") setTab("editor");
  }, [view]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportNumber, setReportNumber] = useState<number | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [reports, setReports] = useState<Report[]>([]);
  const [saving, setSaving] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadReports = async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("report_number", { ascending: false });
    if (error) toast.error(error.message);
    else setReports((data ?? []) as unknown as Report[]);
  };
  useEffect(() => { loadReports(); }, []);

  const resetForm = () => {
    rowCounter = 0;
    setEditingId(null); setReportNumber(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTitle(""); setDetails("");
    setRows([emptyRow(), emptyRow(), emptyRow()]);
  };

  const openReport = (r: Report) => {
    setEditingId(r.id); setReportNumber(r.report_number);
    setDate(r.report_date); setTitle(r.title); setDetails(r.details ?? "");
    setRows(r.rows.length ? r.rows : [emptyRow()]);
    setTab("editor");
  };

  const updateRow = (id: string, f: keyof Row, v: string) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, [f]: v } : r)));
  const addRow = () => setRows((p) => [...p, emptyRow()]);
  const removeRow = (id: string) =>
    setRows((p) => (p.length > 1 ? p.filter((r) => r.id !== id) : p));

  const handleSave = async () => {
    if (!title.trim()) return toast.error(t.titleRequired);
    const hasContent = rows.some((r) => r.problem.trim() && r.action.trim());
    if (!hasContent) return toast.error(t.minRowError);

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return; }

    if (editingId) {
      const { error } = await supabase.from("reports").update({
        title: title.trim(), details: details.trim() || null,
        report_date: date, rows: rows as unknown as never,
      }).eq("id", editingId);
      if (error) toast.error(error.message); else toast.success(t.saved);
    } else {
      const { data, error } = await supabase.from("reports").insert({
        title: title.trim(), details: details.trim() || null,
        report_date: date, rows: rows as unknown as never, created_by: uid,
      }).select().single();
      if (error) toast.error(error.message);
      else { toast.success(t.saved); setEditingId(data.id); setReportNumber(data.report_number); }
    }
    setSaving(false);
    loadReports();
  };

  const deleteReport = async (id: string) => {
    if (!confirm(t.deleteReport)) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t.reportDeleted); if (editingId === id) resetForm(); loadReports(); }
  };

  const handlePrint = () => window.print();
  const handlePdf = () => {
    window.print();
    toast.success(lang === "ar" ? "اختر «حفظ كملف PDF» من نافذة الطباعة" : "Choose “Save as PDF” in the print window");
  };

  const { signOut } = useAuth();
  const logout = async () => { await signOut(); };

  return (
    <div className="p-4 md:p-6 print:p-0">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
              {t.appName}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t.welcome}, <span className="font-semibold">{username}</span>{" "}
              <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs">
                {role === "owner" ? t.role_owner : t.role_user}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
              <Languages className="size-4" /> {t.lang}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings"><SettingsIcon className="size-4" /> {lang === "ar" ? "الإعدادات" : "Settings"}</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" /> {t.logout}
            </Button>
          </div>
        </div>

        {/* Tabs — reports workspace only (reached from the General Quality hub) */}
        {tab !== "hub" && (
          <div className="mb-4 flex flex-wrap gap-2 print:hidden">
            <TabBtn active={false} onClick={() => setTab("hub")} icon={<Sparkles className="size-4" />}>
              {lang === "ar" ? "الرئيسية" : "Home"}
            </TabBtn>
            <TabBtn active={tab === "editor"} onClick={() => setTab("editor")} icon={<FileText className="size-4" />}>
              {editingId ? `${t.reportNo} ${reportNumber}` : t.newReport}
            </TabBtn>
            <TabBtn active={tab === "list"} onClick={() => setTab("list")} icon={<FolderOpen className="size-4" />}>
              {t.savedReports} ({reports.length})
            </TabBtn>
            {tab === "editor" && editingId && (
              <Button size="sm" variant="ghost" onClick={resetForm}>
                <Plus className="size-4" /> {t.newReport}
              </Button>
            )}
          </div>
        )}

        {tab === "hub" && <HubView lang={lang} username={username} />}
        {tab === "editor" && (
          <EditorView
            t={t} lang={lang} dir={dir}
            reportRef={reportRef}
            reportNumber={reportNumber}
            date={date} setDate={setDate}
            title={title} setTitle={setTitle}
            details={details} setDetails={setDetails}
            rows={rows} addRow={addRow} removeRow={removeRow} updateRow={updateRow}
            handleSave={handleSave} handlePrint={handlePrint} handlePdf={handlePdf}
            saving={saving}
          />
        )}
        {tab === "list" && (
          <ReportsList t={t} reports={reports} onOpen={openReport} onDelete={deleteReport} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-md"
               : "bg-white/70 text-slate-700 hover:bg-white border border-slate-200"
      }`}>
      {icon} {children}
    </button>
  );
}

function EditorView(props: {
  t: typeof T["ar"]; lang: Lang; dir: "ltr" | "rtl";
  reportRef: React.RefObject<HTMLDivElement | null>;
  reportNumber: number | null;
  date: string; setDate: (v: string) => void;
  title: string; setTitle: (v: string) => void;
  details: string; setDetails: (v: string) => void;
  rows: Row[]; addRow: () => void; removeRow: (id: string) => void;
  updateRow: (id: string, f: keyof Row, v: string) => void;
  handleSave: () => void; handlePrint: () => void; handlePdf: () => void;
  saving: boolean;
}) {
  const { t, lang, dir, reportRef, reportNumber, date, setDate, title, setTitle,
    details, setDetails, rows, addRow, removeRow, updateRow, handleSave, handlePrint, handlePdf, saving } = props;

  return (
    <>
      <PrintReport title={title || t.title} department={lang === "ar" ? "الجودة العام" : "General Quality"} reportNumber={reportNumber ? String(reportNumber) : undefined} meta={details ? [{ label: t.reportDetails, value: details }] : undefined}>
        <table>
          <thead><tr><th>{t.num}</th><th>{t.problem}</th><th>{t.action}</th><th>{t.quality}</th><th>{t.production}</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`print-${row.id}`}><td>{index + 1}</td><td>{row.problem || "—"}</td><td>{row.action || "—"}</td><td>{row.qualitySign || "—"}</td><td>{row.productionSign || "—"}</td></tr>)}</tbody>
        </table>
      </PrintReport>
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={addRow} className="border-emerald-200 bg-white/70 text-emerald-700">
          <Plus className="size-4" /> {t.add}
        </Button>
        <Button onClick={handleSave} disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-sky-600 text-white">
          <Save className="size-4" /> {t.save}
        </Button>
        <Button onClick={handlePrint} className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white">
          <Printer className="size-4" /> {t.print}
        </Button>
        <Button onClick={handlePdf} className="bg-gradient-to-r from-rose-500 to-orange-500 text-white">
          <FileDown className="size-4" /> {t.pdf}
        </Button>
      </div>

      <div ref={reportRef} dir={dir}
        className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-6 shadow-xl print:border-0 print:p-2 print:shadow-none print:bg-white">
        <div className="mb-4 grid gap-3 md:grid-cols-3 border-b border-indigo-100 pb-4">
          <div className="md:col-span-2">
            <Label className="text-xs text-slate-600">{t.reportTitle} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t.reportTitle} maxLength={200}
              className="font-bold text-indigo-900 mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">{t.date}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs text-slate-600">{t.reportDetails}</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)}
              maxLength={1000} rows={2} className="mt-1" />
          </div>
          {reportNumber && (
            <div className="md:col-span-3 text-sm text-slate-600">
              {t.reportNo}: <span className="font-bold text-indigo-700">#{reportNumber}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full border-collapse ${lang === "ar" ? "text-right" : "text-left"}`}>
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-sky-600 text-white">
                <th className="border border-indigo-300 p-2 text-sm font-semibold w-12">{t.num}</th>
                <th className="border border-indigo-300 p-2 text-sm font-semibold">{t.problem}</th>
                <th className="border border-indigo-300 p-2 text-sm font-semibold">{t.action}</th>
                <th className="border border-indigo-300 p-2 text-sm font-semibold">{t.quality}</th>
                <th className="border border-indigo-300 p-2 text-sm font-semibold">{t.production}</th>
                <th className="border border-indigo-300 p-2 text-sm font-semibold w-16 print:hidden">{t.del}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-indigo-50/40"}>
                  <td className="border border-indigo-100 p-2 text-center text-sm font-semibold text-indigo-700">{idx + 1}</td>
                  <td className="border border-indigo-100 p-1">
                    <Textarea value={row.problem} onChange={(e) => updateRow(row.id, "problem", e.target.value)}
                      rows={2} maxLength={500}
                      className="min-h-[60px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </td>
                  <td className="border border-indigo-100 p-1">
                    <Textarea value={row.action} onChange={(e) => updateRow(row.id, "action", e.target.value)}
                      rows={2} maxLength={500}
                      className="min-h-[60px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </td>
                  <td className="border border-indigo-100 p-1">
                    <Input value={row.qualitySign} onChange={(e) => updateRow(row.id, "qualitySign", e.target.value)}
                      maxLength={100}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </td>
                  <td className="border border-indigo-100 p-1">
                    <Input value={row.productionSign} onChange={(e) => updateRow(row.id, "productionSign", e.target.value)}
                      maxLength={100}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
                  </td>
                  <td className="border border-indigo-100 p-2 text-center print:hidden">
                    <button onClick={() => removeRow(row.id)}
                      className="text-rose-500 hover:text-rose-700 transition" aria-label={t.del}>
                      <Trash2 className="size-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ReportsList({
  t, reports, onOpen, onDelete,
}: { t: typeof T["ar"]; reports: Report[]; onOpen: (r: Report) => void; onDelete: (id: string) => void }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-10 text-center text-slate-500 shadow-xl">
        {t.noReports}
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl border border-white/60 bg-white/80 backdrop-blur p-4 shadow-md hover:shadow-lg transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-indigo-600 font-semibold">{t.reportNo} #{r.report_number}</div>
              <div className="font-bold text-slate-800 truncate">{r.title}</div>
              {r.details && <div className="text-sm text-slate-600 mt-1 line-clamp-2">{r.details}</div>}
              <div className="text-xs text-slate-500 mt-2">{r.report_date} · {r.rows.length} {t.problem}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="outline" onClick={() => onOpen(r)}>{t.open}</Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


/* ============================== Dashboard ============================== */

const DASH_FILE_STYLE: Record<string, { label: string; cls: string }> = {
  pdf: { label: "PDF", cls: "bg-rose-500/20 text-rose-300 border-rose-400/30" },
  doc: { label: "DOC", cls: "bg-sky-500/20 text-sky-300 border-sky-400/30" },
  docx: { label: "DOC", cls: "bg-sky-500/20 text-sky-300 border-sky-400/30" },
  xls: { label: "XLS", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" },
  xlsx: { label: "XLS", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" },
  csv: { label: "CSV", cls: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
  ppt: { label: "PPT", cls: "bg-orange-500/20 text-orange-300 border-orange-400/30" },
  pptx: { label: "PPT", cls: "bg-orange-500/20 text-orange-300 border-orange-400/30" },
};
const DASH_IMG_FILE = { label: "IMG", cls: "bg-violet-500/20 text-violet-300 border-violet-400/30" };
const DASH_FALLBACK_FILE = { label: "FILE", cls: "bg-slate-500/20 text-slate-300 border-slate-400/30" };

function dashFileMeta(name: string) {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) return DASH_IMG_FILE;
  return DASH_FILE_STYLE[e] ?? DASH_FALLBACK_FILE;
}

function dashSize(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
}

function dashRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.round(h / 24);
  if (d < 30) return `منذ ${d} يوم`;
  return new Date(iso).toLocaleDateString("ar-EG");
}

function dashFilesLabel(n: number, lang: Lang) {
  if (lang === "en") return `${n} file${n === 1 ? "" : "s"}`;
  if (n === 0) return "لا ملفات بعد";
  if (n === 1) return "ملف واحد";
  if (n === 2) return "ملفان";
  if (n <= 10) return `${n} ملفات`;
  return `${n} ملف`;
}

type DashDoc = {
  id: string;
  title: string;
  file_name: string;
  category: string;
  product_name: string | null;
  file_size: number | null;
  status: string;
  updated_at: string | null;
};

function Dashboard({
  lang, setLang, username,
}: { lang: Lang; setLang: (l: Lang) => void; username?: string }) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { can } = useDeptPermissions();
  const { departments } = useWorkspaceDepartments();
  const { signOut } = useAuth();
  const [docs, setDocs] = useState<DashDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const closeMenus = () => { setBellOpen(false); setMenuOpen(false); };

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, title, file_name, category, product_name, file_size, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      setDocs((data ?? []) as unknown as DashDoc[]);
      setLoaded(true);
    })();
  }, []);

  const visibleDepts = departments.filter((d) => can(d.key).view);
  const deptTitle = (key: string) => {
    const d = departments.find((x) => x.key === key);
    return d ? (lang === "ar" ? d.title_ar : d.title_en) : key;
  };

  const query = q.trim().toLowerCase();
  const results = query
    ? docs
        .filter((d) =>
          `${d.title} ${d.file_name} ${d.file_type ?? ""} ${d.product_name ?? ""} ${deptTitle(d.category)}`
            .toLowerCase()
            .includes(query))
        .slice(0, 8)
    : [];

  const scoped = filter ? docs.filter((d) => d.category === filter) : docs;
  const recent = scoped.slice(0, 5);
  const lastUpdate = docs.reduce<string | null>(
    (acc, d) => (d.updated_at && (!acc || d.updated_at > acc) ? d.updated_at : acc),
    null,
  );

  const cards = (filter ? visibleDepts.filter((d) => d.key === filter) : visibleDepts).map((d) => {
    const cat = docs.filter((x) => x.category === d.key);
    const processing = cat.some((x) => x.status === "processing" || x.status === "uploaded");
    const failed = cat.some((x) => x.status === "failed");
    const badge = processing ? t("جاري التحليل", "Analyzing")
      : failed ? t("يحتاج مراجعة", "Needs review")
      : cat.length > 0 ? t("جودة عالية", "High quality")
      : t("جديد", "New");
    const badgeCls = processing
      ? "bg-amber-400/15 text-amber-300 border-amber-300/30"
      : failed
        ? "bg-rose-400/15 text-rose-300 border-rose-300/30"
        : cat.length > 0
          ? "bg-emerald-400/15 text-emerald-300 border-emerald-300/30"
          : "bg-sky-400/15 text-sky-300 border-sky-300/30";
    return { ...d, count: cat.length, badge, badgeCls };
  });

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="dash-scope dash-dots -m-4 min-h-screen p-4 md:-m-6 md:p-6">
      {(bellOpen || menuOpen || fabOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { closeMenus(); setFabOpen(false); }} aria-hidden />
      )}
      <div className="relative mx-auto max-w-6xl space-y-6 pb-24">
        {/* ---------- Header ---------- */}
        <header className="relative overflow-hidden rounded-[20px] bg-gradient-to-l from-indigo-600 via-violet-600 to-blue-600 p-5 shadow-2xl">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
              backgroundSize: "34px 34px",
            }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl shadow-inner">✦</div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold text-white md:text-xl">{t("مشروعي المفضل", "My Favourite Project")}</h1>
                <p className="truncate text-xs text-white/75">
                  {t("أهلاً بك يا مهندس", "Welcome, Engineer")} {username || (lang === "ar" ? "طارق" : "Tarek")} 👋
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => { setBellOpen(!bellOpen); setMenuOpen(false); }}
                  aria-label={t("التنبيهات", "Notifications")}
                  className="grid size-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <Bell className="size-5" />
                </button>
                {bellOpen && (
                  <div className="absolute end-0 top-12 z-50 w-72 rounded-2xl border border-[var(--dash-border)] bg-[#111735] p-3 shadow-2xl">
                    <p className="mb-2 text-xs font-bold text-[var(--dash-muted)]">{t("آخر التحديثات", "Latest updates")}</p>
                    {docs.slice(0, 3).map((d) => (
                      <Link
                        key={d.id}
                        to="/documents/$category"
                        params={{ category: d.category }}
                        onClick={() => setBellOpen(false)}
                        className="block rounded-xl px-2 py-1.5 text-sm transition hover:bg-white/5"
                      >
                        <span className="block truncate">
                          {dashFileMeta(d.file_name).label} · {d.title}
                        </span>
                        <span className="block text-xs text-[var(--dash-muted)]">
                          {d.updated_at ? dashRelTime(d.updated_at) : ""}
                        </span>
                      </Link>
                    ))}
                    {docs.length === 0 && <p className="text-xs text-[var(--dash-muted)]">{t("لا تنبيهات بعد", "Nothing yet")}</p>}
                  </div>
                )}
              </div>
              <Link
                to="/settings"
                aria-label={t("الإعدادات", "Settings")}
                className="grid size-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <SettingsIcon className="size-5" />
              </Link>
              <div className="relative">
                <button
                  onClick={() => { setMenuOpen(!menuOpen); setBellOpen(false); }}
                  aria-label={t("حسابي", "My account")}
                  className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-extrabold text-white shadow-lg"
                >
                  {(username || "ط").slice(0, 1).toUpperCase()}
                </button>
                {menuOpen && (
                  <div className="absolute end-0 top-12 z-50 w-56 rounded-2xl border border-[var(--dash-border)] bg-[#111735] p-2 shadow-2xl">
                    <div className="px-3 py-2">
                      <div className="truncate text-sm font-bold">{username}</div>
                      <div className="text-xs text-[var(--dash-muted)]">{t("مسجل الدخول", "Signed in")}</div>
                    </div>
                    <Link to="/settings" onClick={closeMenus} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5">
                      <SettingsIcon className="size-4" /> {t("الإعدادات", "Settings")}
                    </Link>
                    <button
                      onClick={() => { closeMenus(); setLang(lang === "ar" ? "en" : "ar"); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5"
                    >
                      <Languages className="size-4" /> {lang === "ar" ? "English" : "عربي"}
                    </button>
                    <button
                      onClick={() => { closeMenus(); void signOut(); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <LogOut className="size-4" /> {t("خروج", "Logout")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ---------- Local search (project files only) ---------- */}
        <div className="relative z-10 mx-auto w-full max-w-2xl">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-card)] px-4 py-3 backdrop-blur-xl focus-within:ring-2 focus-within:ring-violet-500/50">
            <Search className="size-4 shrink-0 text-[var(--dash-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("بحث داخل ملفاتي — بحث في مشروعك فقط", "Search my files — project only")}
              className="w-full bg-transparent text-sm text-[var(--dash-text)] outline-none placeholder:text-[var(--dash-muted)]"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label={t("مسح", "Clear")} className="text-[var(--dash-muted)] hover:text-[var(--dash-text)]">
                <X className="size-4" />
              </button>
            )}
          </div>
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-16 z-30 space-y-1 rounded-2xl border border-[var(--dash-border)] bg-[#111735] p-2 shadow-2xl">
              {results.map((d) => {
                const meta = dashFileMeta(d.file_name);
                return (
                  <Link
                    key={d.id}
                    to="/documents/$category"
                    params={{ category: d.category }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/5"
                  >
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${meta.cls}`}>{meta.label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{d.title}</span>
                      <span className="block truncate text-xs text-[var(--dash-muted)]">
                        {deptTitle(d.category)} · {dashSize(d.file_size)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {query && results.length === 0 && (
            <p className="mt-2 text-center text-xs text-[var(--dash-muted)]">{t("لا توجد نتائج داخل ملفات مشروعك", "No matches in your project files")}</p>
          )}
        </div>

        {/* ---------- Stats ---------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DashStat icon={<Layers className="size-5" />} tone="text-sky-300 bg-sky-500/15"
            value={String(visibleDepts.length)} label={t("عدد الأقسام", "Departments")} />
          <DashStat icon={<Clock className="size-5" />} tone="text-amber-300 bg-amber-500/15"
            value={lastUpdate ? dashRelTime(lastUpdate) : "—"} label={t("آخر تحديث", "Last update")} />
          <DashStat icon={<FolderOpen className="size-5" />} tone="text-violet-300 bg-violet-500/15"
            value={loaded ? visibleDepts.reduce((n, d) => n + docs.filter((x) => x.category === d.key).length, 0).toLocaleString("en-US") : "…"}
            label={t("إجمالي الملفات", "Total files")} />
        </div>

        {/* ---------- Recent files ---------- */}
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-[var(--dash-text)]">{t("آخر الملفات", "Recent files")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recent.map((d) => {
              const meta = dashFileMeta(d.file_name);
              return (
                <Link
                  key={d.id}
                  to="/documents/$category"
                  params={{ category: d.category }}
                  className="flex min-w-[230px] items-center gap-3 rounded-[20px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 backdrop-blur-xl transition hover:border-violet-400/40 hover:bg-[var(--dash-card-strong)]"
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl border text-[11px] font-extrabold ${meta.cls}`}>{meta.label}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{d.title}</span>
                    <span className="block truncate text-xs text-[var(--dash-muted)]">
                      {deptTitle(d.category)} · {dashSize(d.file_size)}
                    </span>
                  </span>
                </Link>
              );
            })}
            {loaded && recent.length === 0 && (
              <p className="py-4 text-sm text-[var(--dash-muted)]">{t("لا ملفات بعد — ارفع أول ملف من قسم", "No files yet — upload from a department")}</p>
            )}
          </div>
        </section>

        {/* ---------- Filters ---------- */}
        <div className="flex flex-wrap gap-2">
          <DashFilter active={filter === null} onClick={() => setFilter(null)}>{t("الكل", "All")}</DashFilter>
          {visibleDepts.map((d) => (
            <DashFilter key={d.key} active={filter === d.key} onClick={() => setFilter(filter === d.key ? null : d.key)}>
              {lang === "ar" ? d.title_ar : d.title_en}
            </DashFilter>
          ))}
        </div>

        {/* ---------- Department cards (glass) ---------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((tile) => {
            const inner = (
              <motion.div
                whileHover={{ y: -8, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="group relative h-full rounded-[20px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-5 backdrop-blur-xl transition-shadow duration-300 hover:shadow-2xl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="relative inline-flex size-12">
                    <div
                      aria-hidden
                      className={`absolute -inset-1.5 rounded-2xl bg-gradient-to-br ${tile.gradient} opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-70`}
                    />
                    <div className={`relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${tile.gradient} text-2xl shadow-md transition-transform duration-300 group-hover:rotate-[10deg] group-hover:scale-105`}>
                      <span>{tile.emoji}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tile.badgeCls}`}>{tile.badge}</span>
                </div>
                <h3 className="mt-3 font-extrabold text-lg leading-tight">{lang === "ar" ? tile.title_ar : tile.title_en}</h3>
                <p className="mt-1 text-xs text-[var(--dash-muted)] line-clamp-2">{lang === "ar" ? tile.desc_ar : tile.desc_en}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-violet-300">{dashFilesLabel(tile.count, lang)}</span>
                  <span className="text-sm font-semibold text-[var(--dash-muted)]">{t("فتح", "Open")} ←</span>
                </div>
              </motion.div>
            );
            if (tile.key === QUALITY_HUB_KEY) {
              return <Link key={tile.key} to="/quality-hub" className="block h-full">{inner}</Link>;
            }
            return (
              <Link key={tile.key} to="/dept/$category" params={{ category: tile.key }} className="block h-full">
                {inner}
              </Link>
            );
          })}
        </div>

        {/* ---------- Two small action pills ---------- */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 backdrop-blur-xl">
            <Film className="size-4 text-teal-300" />
            <span className="text-sm font-semibold">{t("أداة تحويل الملفات", "File converter")}</span>
            <Link to="/convert" className="rounded-full bg-teal-500/90 px-3 py-1 text-xs font-bold text-white transition hover:bg-teal-400">
              {t("ابدأ التحويل", "Start")}
            </Link>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 backdrop-blur-xl">
            <Sparkles className="size-4 text-violet-300" />
            <span className="text-sm font-semibold">{t("اسأل مساعد المشروع", "Ask project assistant")} ✦</span>
            <Link to="/chat" className="rounded-full bg-violet-500/90 px-3 py-1 text-xs font-bold text-white transition hover:bg-violet-400">
              {t("ابدأ الآن", "Start")}
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- Floating + button ---------- */}
      {fabOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-52 rounded-2xl border border-[var(--dash-border)] bg-[#111735] p-2 shadow-2xl">
          <Link to="/" search={{ view: "editor" as const }} onClick={() => setFabOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5">
            <FileText className="size-4" /> {t("تقرير جديد", "New report")}
          </Link>
          <Link to="/chat" onClick={() => setFabOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5">
            <MessageCircle className="size-4" /> {t("محادثة جديدة", "New chat")}
          </Link>
          <Link to="/convert" onClick={() => setFabOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5">
            <Film className="size-4" /> {t("تحويل ملفات", "Convert files")}
          </Link>
          <Link to="/settings" onClick={() => setFabOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5">
            <SettingsIcon className="size-4" /> {t("الإعدادات", "Settings")}
          </Link>
        </div>
      )}
      <button
        onClick={() => setFabOpen(!fabOpen)}
        aria-label={t("إضافة", "Add")}
        className="fixed bottom-6 right-6 z-50 grid size-14 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_10px_40px_-10px_rgba(139,92,246,0.9)] transition hover:scale-105"
      >
        <Plus className={`size-7 transition-transform duration-300 ${fabOpen ? "rotate-45" : ""}`} />
      </button>
    </div>
  );
}

function DashStat({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 backdrop-blur-xl">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-extrabold">{value}</span>
        <span className="block text-xs text-[var(--dash-muted)]">{label}</span>
      </span>
    </div>
  );
}

function DashFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white shadow-lg"
          : "border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-muted)] hover:text-[var(--dash-text)]"
      }`}
    >
      {children}
    </button>
  );
}
