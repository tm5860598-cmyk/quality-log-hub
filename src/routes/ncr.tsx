import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, Plus, Search, X, AlertTriangle, Save, Filter, Trash2, Printer,
} from "lucide-react";

type Ncr = {
  id: string; ncr_number: number; title: string; category: string | null;
  product_name: string | null; batch_number: string | null;
  severity: "low" | "medium" | "high" | "critical";
  source: string | null; description: string; root_cause: string | null; immediate_action: string | null;
  status: "open" | "investigating" | "action" | "closed";
  reported_by: string; assigned_to: string | null;
  reported_at: string; closed_at: string | null; created_at: string; updated_at: string;
};
type Capa = {
  id: string; ncr_id: string; action_type: "corrective" | "preventive"; description: string;
  responsible: string | null; due_date: string | null; completed_at: string | null;
  effectiveness: string | null; status: "open" | "in_progress" | "done" | "verified";
  created_by: string; created_at: string; updated_at: string;
};

const PRIVILEGED = ["owner", "admin", "qa_manager", "production_manager", "qa_engineer", "production_engineer"];
const SEVERITY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-rose-100 text-rose-700",
};
const STATUS_STYLE: Record<string, string> = {
  open: "bg-rose-100 text-rose-700",
  investigating: "bg-amber-100 text-amber-700",
  action: "bg-sky-100 text-sky-700",
  closed: "bg-emerald-100 text-emerald-700",
};
const SEV_LABEL: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
const STATUS_LABEL: Record<string, string> = { open: "مفتوح", investigating: "قيد التحقيق", action: "تنفيذ إجراء", closed: "مغلق" };

export const Route = createFileRoute("/ncr")({
  ssr: false,
  component: NcrPage,
  errorComponent: ({ error }) => <div className="p-6 text-center text-sm text-destructive">{String(error?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-6 text-center">غير موجود</div>,
});

function NcrPage() {
  const { session, role, status } = useAuth();
  const [list, setList] = useState<Ncr[]>([]);
  const [selected, setSelected] = useState<Ncr | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const canEdit = PRIVILEGED.includes(role);
  const canDelete = role === "owner" || role === "admin";

  const load = async () => {
    const { data, error } = await supabase.from("ncr_reports").select("*").order("reported_at", { ascending: false });
    if (error) return toast.error(error.message);
    setList((data ?? []) as Ncr[]);
  };
  useEffect(() => { if (session) load(); }, [session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || (r.product_name ?? "").toLowerCase().includes(q) || String(r.ncr_number).includes(q);
    });
  }, [list, query, statusFilter]);

  const del = async (r: Ncr) => {
    if (!confirm(`حذف التقرير NCR-${r.ncr_number}؟`)) return;
    const { error } = await supabase.from("ncr_reports").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    if (selected?.id === r.id) setSelected(null);
    load();
  };

  if (status === "loading") return <div className="min-h-screen grid place-items-center text-slate-500">...</div>;
  if (status === "unauthenticated" || !session) return (
    <div dir="rtl" className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold">سجّل الدخول للوصول لتقارير عدم المطابقة</h2>
        <Link to="/" className="inline-flex items-center gap-2 rounded-md bg-rose-600 text-white px-4 py-2 text-sm">
          <ArrowRight className="size-4" /> الرجوع
        </Link>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center justify-center rounded-md border w-10 h-10 bg-white hover:bg-slate-50" aria-label="رجوع">
              <ArrowRight className="size-4" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white px-3 py-1 text-xs font-semibold">
                <AlertTriangle className="size-4" /> عدم المطابقة NCR / CAPA
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 mt-1">تسجيل ومتابعة حالات عدم المطابقة والإجراءات التصحيحية</h1>
              <p className="text-xs text-slate-500 mt-0.5">دورك: <b>{role}</b> {canEdit ? "· يمكنك تحديث الحالات" : "· عرض + فتح بلاغ فقط"}</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-rose-500 to-orange-500 text-white">
            <Plus className="size-4" /> فتح تقرير جديد
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[380px_1fr]">
          <aside className="rounded-2xl border bg-white/80 backdrop-blur p-3 shadow-lg">
            <div className="relative mb-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input placeholder="ابحث برقم أو منتج أو عنوان..." value={query} onChange={(e) => setQuery(e.target.value)} className="pr-9" />
            </div>
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              <Filter className="size-3 text-slate-400" />
              {(["all","open","investigating","action","closed"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${statusFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"}`}>
                  {s === "all" ? "الكل" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 mb-2 px-1">{filtered.length} تقرير</div>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 && <p className="text-center text-sm text-slate-500 py-6">لا توجد تقارير مطابقة.</p>}
              {filtered.map((r) => (
                <button key={r.id} onClick={() => setSelected(r)}
                  className={`w-full text-right rounded-lg px-3 py-2 border transition ${
                    selected?.id === r.id ? "bg-rose-50 border-rose-300" : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-500">NCR-{r.ncr_number}</span>
                    <div className="flex gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SEVERITY_STYLE[r.severity]}`}>{SEV_LABEL[r.severity]}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-800 truncate">{r.title}</div>
                  <div className="text-xs text-slate-500 truncate">{r.product_name ?? "—"} · {new Date(r.reported_at).toLocaleDateString("ar-EG")}</div>
                </button>
              ))}
            </div>
          </aside>

          <section>
            {selected ? (
              <NcrDetail ncr={selected} canEdit={canEdit} canDelete={canDelete} onChange={load} onDelete={() => del(selected)} userId={session.user.id} />
            ) : (
              <div className="rounded-2xl border bg-white/80 backdrop-blur p-10 text-center text-slate-500 shadow-lg">
                اختر تقريرًا من القائمة أو افتح تقريرًا جديدًا لعرض التفاصيل والإجراءات التصحيحية.
              </div>
            )}
          </section>
        </div>
      </div>

      {showForm && <NcrForm userId={session.user.id} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NcrDetail({ ncr, canEdit, canDelete, onChange, onDelete, userId }: {
  ncr: Ncr; canEdit: boolean; canDelete: boolean; onChange: () => void; onDelete: () => void; userId: string;
}) {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [addingCapa, setAddingCapa] = useState(false);
  const [rootCause, setRootCause] = useState(ncr.root_cause ?? "");
  const [immediateAction, setImmediateAction] = useState(ncr.immediate_action ?? "");
  useEffect(() => { setRootCause(ncr.root_cause ?? ""); setImmediateAction(ncr.immediate_action ?? ""); }, [ncr.id]);

  const loadCapas = async () => {
    const { data, error } = await supabase.from("capa_actions").select("*").eq("ncr_id", ncr.id).order("created_at");
    if (!error) setCapas((data ?? []) as Capa[]);
  };
  useEffect(() => { loadCapas(); }, [ncr.id]);

  const setStatus = async (status: Ncr["status"]) => {
    const patch: Partial<Ncr> = { status };
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("ncr_reports").update(patch).eq("id", ncr.id);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث الحالة");
    onChange();
  };

  const saveAnalysis = async () => {
    const { error } = await supabase.from("ncr_reports")
      .update({ root_cause: rootCause.trim() || null, immediate_action: immediateAction.trim() || null })
      .eq("id", ncr.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    onChange();
  };

  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur p-5 md:p-6 shadow-lg space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">NCR-{ncr.ncr_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_STYLE[ncr.severity]}`}>{SEV_LABEL[ncr.severity]}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[ncr.status]}`}>{STATUS_LABEL[ncr.status]}</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800">{ncr.title}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {ncr.product_name && <>المنتج: <b>{ncr.product_name}</b> · </>}
            {ncr.batch_number && <>الدفعة: <b>{ncr.batch_number}</b> · </>}
            التاريخ: {new Date(ncr.reported_at).toLocaleString("ar-EG")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> طباعة</Button>
          {canDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <Trash2 className="size-4" /> حذف
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">وصف عدم المطابقة</div>
        <p className="rounded-lg border bg-slate-50 p-3 text-sm whitespace-pre-line">{ncr.description}</p>
      </div>

      {canEdit && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="text-sm font-semibold text-indigo-900">التحليل والإجراء الفوري</div>
          <div>
            <Label className="text-xs">السبب الجذري</Label>
            <Textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">الإجراء الفوري (Containment)</Label>
            <Textarea rows={2} value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAnalysis}><Save className="size-4" /> حفظ التحليل</Button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-600 self-center">تحديث الحالة:</span>
          {(["open","investigating","action","closed"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1 rounded-full border transition ${ncr.status === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-800">الإجراءات التصحيحية والوقائية (CAPA)</div>
          {canEdit && <Button size="sm" variant="outline" onClick={() => setAddingCapa(true)}><Plus className="size-4" /> إضافة إجراء</Button>}
        </div>
        {capas.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-4 border rounded-lg bg-slate-50">لا توجد إجراءات مسجلة.</p>
        ) : (
          <div className="space-y-2">
            {capas.map((c) => <CapaRow key={c.id} capa={c} canEdit={canEdit} onChange={loadCapas} />)}
          </div>
        )}
      </div>

      {addingCapa && (
        <CapaForm ncrId={ncr.id} userId={userId} onClose={() => setAddingCapa(false)} onSaved={() => { setAddingCapa(false); loadCapas(); }} />
      )}
    </div>
  );
}

function CapaRow({ capa, canEdit, onChange }: { capa: Capa; canEdit: boolean; onChange: () => void }) {
  const setStatus = async (status: Capa["status"]) => {
    const patch: Partial<Capa> = { status };
    if (status === "done" || status === "verified") patch.completed_at = capa.completed_at ?? new Date().toISOString();
    const { error } = await supabase.from("capa_actions").update(patch).eq("id", capa.id);
    if (error) return toast.error(error.message);
    onChange();
  };
  const del = async () => {
    if (!confirm("حذف الإجراء؟")) return;
    const { error } = await supabase.from("capa_actions").delete().eq("id", capa.id);
    if (error) return toast.error(error.message);
    onChange();
  };
  const CAP_STATUS: Record<string, string> = { open: "bg-slate-100 text-slate-700", in_progress: "bg-amber-100 text-amber-700", done: "bg-sky-100 text-sky-700", verified: "bg-emerald-100 text-emerald-700" };
  const CAP_LABEL: Record<string, string> = { open: "مفتوح", in_progress: "قيد التنفيذ", done: "منجز", verified: "تم التحقق" };
  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${capa.action_type === "corrective" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>
            {capa.action_type === "corrective" ? "تصحيحي" : "وقائي"}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${CAP_STATUS[capa.status]}`}>{CAP_LABEL[capa.status]}</span>
          {capa.due_date && <span className="text-xs text-slate-500">استحقاق: {capa.due_date}</span>}
        </div>
        {canEdit && <button onClick={del} className="text-rose-500 hover:text-rose-700"><Trash2 className="size-4" /></button>}
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-line">{capa.description}</p>
      {capa.effectiveness && <p className="text-xs text-slate-600">التقييم: {capa.effectiveness}</p>}
      {canEdit && (
        <div className="flex flex-wrap gap-1">
          {(["open","in_progress","done","verified"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${capa.status === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"}`}>
              {CAP_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CapaForm({ ncrId, userId, onClose, onSaved }: { ncrId: string; userId: string; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState<"corrective" | "preventive">("corrective");
  const [dueDate, setDueDate] = useState("");
  const [effectiveness, setEffectiveness] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return toast.error("أدخل وصف الإجراء");
    setSaving(true);
    const { error } = await supabase.from("capa_actions").insert({
      ncr_id: ncrId, created_by: userId, action_type: actionType,
      description: description.trim(), due_date: dueDate || null,
      effectiveness: effectiveness.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم إضافة الإجراء");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3">
          <h3 className="font-bold">إجراء تصحيحي/وقائي جديد</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-white/20"><X className="size-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-xs">النوع</Label>
            <div className="flex gap-2 mt-1">
              {(["corrective","preventive"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setActionType(t)}
                  className={`text-xs px-3 py-1 rounded-full border ${actionType === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"}`}>
                  {t === "corrective" ? "تصحيحي" : "وقائي"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">وصف الإجراء *</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">تاريخ الاستحقاق</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">تقييم الفعالية</Label>
              <Input value={effectiveness} onChange={(e) => setEffectiveness(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t p-3">
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 text-white"><Save className="size-4" /> حفظ</Button>
        </div>
      </form>
    </div>
  );
}

function NcrForm({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productName, setProductName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("أدخل عنوان التقرير");
    if (!description.trim()) return toast.error("أدخل وصف عدم المطابقة");
    setSaving(true);
    const { error } = await supabase.from("ncr_reports").insert({
      title: title.trim(), description: description.trim(),
      product_name: productName.trim() || null, batch_number: batchNumber.trim() || null,
      category: category.trim() || null, severity, source: source.trim() || null,
      reported_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم فتح التقرير");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between bg-gradient-to-r from-rose-500 to-orange-500 text-white px-5 py-3">
          <h3 className="font-bold">فتح تقرير عدم مطابقة جديد</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-white/20"><X className="size-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-xs">عنوان التقرير *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: انحراف في pH لعصير المانجو" required />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">المنتج</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">رقم الدفعة</Label>
              <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="BATCH-001" />
            </div>
            <div>
              <Label className="text-xs">القسم</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="عصائر / ألبان / بيكري" />
            </div>
            <div>
              <Label className="text-xs">المصدر</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="خط الإنتاج / معمل / شكوى عميل" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">درجة الخطورة</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {(["low","medium","high","critical"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSeverity(s)}
                    className={`text-xs px-3 py-1 rounded-full border ${severity === s ? "bg-slate-900 text-white border-slate-900" : `${SEVERITY_STYLE[s]} border-transparent`}`}>
                    {SEV_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">وصف عدم المطابقة *</Label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required
              placeholder="اشرح المشكلة، متى وأين حدثت، والملاحظات..." />
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t p-3 bg-white">
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={saving} className="bg-gradient-to-r from-rose-500 to-orange-500 text-white">
            <Save className="size-4" /> فتح التقرير
          </Button>
        </div>
      </form>
    </div>
  );
}