import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Languages, Plus, Save, Printer, FileDown, Trash2,
  LogOut, Users, FileText, LogIn, UserPlus, FolderOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({ component: Index });

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
    appName: "نظام التقارير",
    date: "التاريخ", reportTitle: "عنوان التقرير", reportDetails: "تفاصيل التقرير",
    add: "إضافة صف", save: "حفظ", print: "طباعة", pdf: "تصدير PDF", lang: "English",
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
    title: "Problems & Actions Report", appName: "Reports System",
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
} as const;

const sanitizeUsername = (u: string) => u.trim().toLowerCase();
const userToEmail = (u: string) => `${sanitizeUsername(u)}@app.local`;

function Index() {
  const [lang, setLang] = useState<Lang>("ar");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState<"owner" | "user" | null>(null);
  const [username, setUsername] = useState<string>("");
  const t = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRole(null); setUsername(""); return; }
    (async () => {
      const [{ data: profile }, { data: roleRow }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle(),
      ]);
      setUsername(profile?.username ?? "");
      setRole((roleRow?.role as "owner" | "user") ?? "user");
    })();
  }, [session]);

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">...</div>;
  }

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      {!session ? (
        <AuthScreen lang={lang} setLang={setLang} t={t} />
      ) : (
        <AppScreen
          lang={lang} setLang={setLang} t={t} dir={dir}
          username={username} role={role ?? "user"}
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
  const [tab, setTab] = useState<"editor" | "list" | "users">("editor");
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
  const handlePdf = async () => {
    if (!reportRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf().set({
      margin: 10, filename: `${title || t.title}-${date}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    }).from(reportRef.current).save();
    toast.success(t.exported);
  };

  const logout = async () => { await supabase.auth.signOut(); };

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
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" /> {t.logout}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <TabBtn active={tab === "editor"} onClick={() => setTab("editor")} icon={<FileText className="size-4" />}>
            {editingId ? `${t.reportNo} ${reportNumber}` : t.newReport}
          </TabBtn>
          <TabBtn active={tab === "list"} onClick={() => setTab("list")} icon={<FolderOpen className="size-4" />}>
            {t.savedReports} ({reports.length})
          </TabBtn>
          {role === "owner" && (
            <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="size-4" />}>
              {t.manageUsers}
            </TabBtn>
          )}
          {tab === "editor" && editingId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              <Plus className="size-4" /> {t.newReport}
            </Button>
          )}
        </div>

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
        {tab === "users" && role === "owner" && (
          <UserManager t={t} lang={lang} />
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

function UserManager({ t, lang }: { t: typeof T["ar"]; lang: Lang }) {
  const [users, setUsers] = useState<{ id: string; username: string; role: string }[]>([]);
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, username"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    setUsers((profiles ?? []).map((p) => ({
      id: p.id, username: p.username, role: roleMap.get(p.id) ?? "user",
    })));
  };
  useEffect(() => { load(); }, []);

  const addUser = async (e: FormEvent) => {
    e.preventDefault();
    const uname = sanitizeUsername(u);
    if (!uname) return toast.error(t.invalidUsername);
    if (!p) return toast.error(t.invalidPassword);
    setLoading(true);

    // Save current owner session, create new user, then restore
    const { data: ownerSession } = await supabase.auth.getSession();
    const ownerRefresh = ownerSession.session?.refresh_token;

    const { error } = await supabase.auth.signUp({
      email: userToEmail(uname), password: p,
      options: { data: { username: uname } },
    });

    if (ownerRefresh) {
      await supabase.auth.refreshSession({ refresh_token: ownerRefresh });
    }

    if (error) toast.error(error.message);
    else { toast.success(t.userAdded); setU(""); setP(""); load(); }
    setLoading(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-6 shadow-xl">
        <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <UserPlus className="size-5" /> {t.addUser}
        </h2>
        <form onSubmit={addUser} className="space-y-3">
          <div>
            <Label className="mb-1 block">{t.username}</Label>
            <Input value={u} onChange={(e) => setU(e.target.value)} required />
            <p className="text-xs text-slate-500 mt-1">{t.usernameHelp}</p>
          </div>
          <div>
            <Label className="mb-1 block">{t.password}</Label>
            <Input type="password" value={p} onChange={(e) => setP(e.target.value)} required />
            <p className="text-xs text-slate-500 mt-1">{t.passwordHelp}</p>
          </div>
          <Button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 text-white">
            <UserPlus className="size-4" /> {t.addUser}
          </Button>
        </form>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-6 shadow-xl">
        <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <Users className="size-5" /> {lang === "ar" ? "المستخدمون" : "Users"} ({users.length})
        </h2>
        <div className="space-y-2">
          {users.map((usr) => (
            <div key={usr.id} className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/60 border border-indigo-100">
              <span className="font-semibold text-slate-800">{usr.username}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                usr.role === "owner" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"
              }`}>
                {usr.role === "owner" ? t.role_owner : t.role_user}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
