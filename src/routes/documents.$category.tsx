import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { processDocument } from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "@/lib/departments";
import { ArrowRight, FileText, Trash2, Upload, Download, Sparkles, Search, RefreshCw, History, Eye, X } from "lucide-react";
import { useDeptPermissions } from "@/lib/permissions";

const MAX_SIZE = 40 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif";
/** Types whose text can be extracted into the AI knowledge base. */
const ANALYZABLE = ["pdf", "docx", "txt", "md", "csv"];

const FILE_ICONS: Record<string, string> = {
  pdf: "📕", doc: "📘", docx: "📘", txt: "📄", md: "📄", csv: "📊",
  xls: "📗", xlsx: "📗", ppt: "📙", pptx: "📙",
  png: "🖼️", jpg: "🖼️", jpeg: "🖼️", webp: "🖼️", gif: "🖼️",
};
const IMAGE_TYPES = ["png", "jpg", "jpeg", "webp", "gif"];
const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

type Doc = {
  id: string; title: string; file_name: string; file_type: string; storage_path: string;
  file_size: number | null; page_count: number | null; status: string; error_message: string | null;
  product_id: string | null; product_name: string | null; created_at: string;
  version: number; doc_group_id: string | null; is_current: boolean;
};
type Product = { id: string; name: string };

export const Route = createFileRoute("/documents/$category")({
  ssr: false,
  component: DocumentsPage,
});

function statusMeta(s: string) {
  switch (s) {
    case "completed":
    case "ready":
      return { label: "جاهز للبحث", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "stored":
      return { label: "محفوظ", cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" };
    case "failed":
      return { label: "فشل التحليل", cls: "bg-destructive/15 text-destructive" };
    case "processing":
      return { label: "جاري التحليل", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    default:
      return { label: "تم الرفع", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
  }
}

function DocumentsPage() {
  const { category } = Route.useParams();
  const { status: authStatus, userId } = useAuth();
  const { can, loading: permLoading } = useDeptPermissions();
  const perm = can(category);
  const canView = perm.view;
  const canUpload = perm.upload;
  const canEdit = perm.edit;
  const canDelete = perm.delete;
  const [preview, setPreview] = useState<{ url: string; doc: Doc } | null>(null);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [q, setQ] = useState("");
  const versionTarget = useRef<Doc | null>(null);
  const versionInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("documents").select("*").eq("category", category).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").eq("category", category).order("name"),
    ]);
    setDocs((d ?? []) as unknown as Doc[]);
    setProducts((p ?? []) as Product[]);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    if (authStatus === "authenticated") void load();
  }, [authStatus, load]);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  /** Analysis pass — resumable, never deletes the stored file on failure. */
  async function analyze(docId: string, label = "تحليل المحتوى") {
    setBusyId(docId);
    try {
      let offset = 0;
      for (let guard = 0; guard < 200; guard++) {
        const r = await processDocument({ data: { documentId: docId, offset } });
        setProgress(`${label}... ${Math.min(r.nextOffset, r.total)}/${r.total}`);
        offset = r.nextOffset;
        if (r.done) break;
      }
      toast.success("تم تحليل المستند وإضافته لقاعدة معرفة القسم");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحليل المستند — الملف محفوظ ويمكنك إعادة المحاولة");
      return false;
    } finally {
      setBusyId(null);
      setProgress("");
      await load();
    }
  }

  async function storeFile(f: File) {
    const safe = f.name.replace(/[^\w.\-]/g, "_");
    const path = `${category}/${crypto.randomUUID()}-${safe}`;
    const up = await supabase.storage.from("department-docs").upload(path, f, {
      upsert: false,
      contentType: f.type || "application/octet-stream",
    });
    if (up.error) throw new Error("فشل رفع الملف: " + up.error.message);
    return path;
  }

  async function upload() {
    if (!file || !userId) return;
    if (file.size > MAX_SIZE) return toast.error("حجم الملف كبير جدًا (الحد 40 ميجابايت)");
    setBusy(true);
    try {
      setProgress("جاري رفع الملف وحفظه...");
      const path = await storeFile(file);
      const product = products.find((p) => p.id === productId);
      const ins = await supabase
        .from("documents")
        .insert({
          category,
          product_id: productId || null,
          product_name: product?.name ?? null,
          title: title.trim() || file.name,
          file_name: file.name,
          file_type: file.name.split(".").pop()?.toLowerCase() ?? "",
          storage_path: path,
          file_size: file.size,
          status: "uploaded",
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      const docId = ins.data.id as string;
      await supabase.from("documents").update({ doc_group_id: docId }).eq("id", docId);
      setFile(null);
      setTitle("");
      setProductId("");
      if (ANALYZABLE.includes(ext(file.name))) {
        toast.success("تم حفظ الملف — يبدأ التحليل الآن");
        await load();
        await analyze(docId);
      } else {
        await supabase.from("documents").update({ status: "stored" }).eq("id", docId);
        toast.success("تم حفظ الملف في مكتبة القسم (هذه الصيغة تُعرض وتُحمّل بدون تحليل نصي)");
        await load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل رفع المستند");
      await load();
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function askNewVersion(d: Doc) {
    versionTarget.current = d;
    versionInput.current?.click();
  }

  async function onNewVersion(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    const target = versionTarget.current;
    e.target.value = "";
    if (!f || !target || !userId) return;
    if (f.size > MAX_SIZE) return toast.error("حجم الملف كبير جدًا (الحد 40 ميجابايت)");
    setBusy(true);
    try {
      setProgress("جاري رفع النسخة الجديدة...");
      const group = target.doc_group_id ?? target.id;
      const path = await storeFile(f);
      const version = Math.max(...docs.filter((x) => (x.doc_group_id ?? x.id) === group).map((x) => x.version)) + 1;
      const ins = await supabase
        .from("documents")
        .insert({
          category,
          product_id: target.product_id,
          product_name: target.product_name,
          title: target.title,
          file_name: f.name,
          file_type: f.name.split(".").pop()?.toLowerCase() ?? "",
          storage_path: path,
          file_size: f.size,
          status: "uploaded",
          uploaded_by: userId,
          doc_group_id: group,
          version,
        })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      // Previous versions stay stored, but leave the searchable knowledge base.
      const oldIds = docs.filter((x) => (x.doc_group_id ?? x.id) === group).map((x) => x.id);
      await supabase.from("documents").update({ is_current: false }).in("id", oldIds);
      await supabase.from("document_chunks").delete().in("document_id", oldIds);
      await load();
      if (ANALYZABLE.includes(ext(f.name))) {
        await analyze(ins.data.id as string, "تحليل النسخة الجديدة");
      } else {
        await supabase.from("documents").update({ status: "stored" }).eq("id", ins.data.id as string);
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل رفع النسخة");
      await load();
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function signed(d: Doc, secs = 300) {
    const { data, error } = await supabase.storage.from("department-docs").createSignedUrl(d.storage_path, secs);
    if (error || !data) { toast.error("تعذر فتح الملف"); return null; }
    return data.signedUrl;
  }

  async function previewDoc(d: Doc) {
    const url = await signed(d, 600);
    if (url) setPreview({ url, doc: d });
  }

  async function openDoc(d: Doc) {
    const { data, error } = await supabase.storage.from("department-docs").createSignedUrl(d.storage_path, 300);
    if (error || !data) return toast.error("تعذر فتح الملف");
    window.open(data.signedUrl, "_blank");
  }

  async function removeDoc(d: Doc) {
    if (!confirm(`حذف المستند "${d.title}" ومقاطعه من قاعدة المعرفة؟`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("department-docs").remove([d.storage_path]);
    toast.success("تم الحذف");
    await load();
  }

  if (authStatus === "loading") {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جاري التحميل...</div>;
  }
  if (authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Link to="/" className="text-primary underline">سجّل الدخول للمتابعة</Link>
      </div>
    );
  }

  if (permLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جاري التحقق من الصلاحيات...</div>;
  }
  if (!canView) {
    return (
      <div dir="rtl" className="min-h-screen grid place-items-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">لا تملك صلاحية عرض ملفات هذا القسم</h1>
          <p className="text-sm text-muted-foreground">اطلب من المالك منحك صلاحية «عرض» لهذا القسم من صفحة الإعدادات.</p>
          <Link to="/" className="text-primary underline text-sm">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  const current = docs.filter((d) => d.is_current !== false);
  const filtered = current.filter((d) =>
    !q.trim() ? true : (d.title + d.file_name + (d.product_name ?? "")).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 grid place-items-center print:hidden" onClick={() => setPreview(null)}>
          <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <div className="font-semibold truncate">
                {FILE_ICONS[ext(preview.doc.file_name)] ?? "📄"} {preview.doc.title}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => openDoc(preview.doc)}>
                  <Download className="h-4 w-4" /> تحميل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted/40 grid place-items-center p-3">
              {IMAGE_TYPES.includes(ext(preview.doc.file_name)) ? (
                <img src={preview.url} alt={preview.doc.title} className="max-h-[70vh] w-auto rounded-lg" />
              ) : ext(preview.doc.file_name) === "pdf" ? (
                <iframe src={preview.url} title={preview.doc.title} className="w-full h-[70vh] rounded-lg bg-white" />
              ) : (
                <div className="text-center space-y-3 py-10">
                  <div className="text-5xl">{FILE_ICONS[ext(preview.doc.file_name)] ?? "📄"}</div>
                  <p className="text-sm text-muted-foreground">
                    هذه الصيغة ({ext(preview.doc.file_name).toUpperCase()}) لا تُعرض داخل المتصفح — حمّلها لفتحها في البرنامج المناسب.
                  </p>
                  <Button onClick={() => openDoc(preview.doc)}><Download className="h-4 w-4" /> تحميل الملف</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <input ref={versionInput} type="file" accept={ACCEPT} className="hidden" onChange={onNewVersion} />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              مستندات قسم {CATEGORY_LABELS[category] ?? category}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ارفع PDF و Word و Excel و PowerPoint و TXT و CSV والصور. يُحفظ الملف أولًا، وما يمكن قراءته نصيًا (PDF, Word, TXT, CSV) يُحلَّل ويدخل قاعدة معرفة القسم.
            </p>
          </div>
          <Link to="/dept/$category" params={{ category }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            القسم <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {canUpload && (
          <div className="rounded-2xl bg-card border shadow-sm p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2"><Upload className="h-4 w-4" /> رفع مستند جديد</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>عنوان المستند</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مواصفة كرواسون" />
              </div>
              <div className="space-y-1">
                <Label>المنتج المرتبط (اختياري)</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">— بدون منتج (مستند عام للقسم) —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>الملف (PDF, Word, Excel, PowerPoint, TXT, CSV, صور)</Label>
                <Input type="file" accept={ACCEPT} onChange={onPick} />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={upload} disabled={!file || busy || !!busyId}>
                <Sparkles className="h-4 w-4 me-1" /> {busy || busyId ? "جاري المعالجة..." : "رفع وتحليل"}
              </Button>
              {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-card border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في مستندات القسم..." className="max-w-sm" />
            <span className="text-xs text-muted-foreground ms-auto">{filtered.length} مستند</span>
          </div>
          {loading ? (
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد مستندات بعد في هذا القسم.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b">
                    <th className="text-start py-2">المستند</th>
                    <th className="text-start py-2">المنتج</th>
                    <th className="text-start py-2">النسخة</th>
                    <th className="text-start py-2">الصفحات</th>
                    <th className="text-start py-2">الحالة</th>
                    <th className="text-start py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const meta = statusMeta(d.status);
                    const versions = docs.filter((x) => (x.doc_group_id ?? x.id) === (d.doc_group_id ?? d.id)).length;
                    return (
                      <tr key={d.id} className="border-b last:border-0 align-top">
                        <td className="py-2">
                          <div className="font-semibold">
                            <span className="me-1">{FILE_ICONS[ext(d.file_name)] ?? "📄"}</span>{d.title}
                          </div>
                          <div className="text-xs text-muted-foreground">{d.file_name}</div>
                          {d.status === "failed" && d.error_message && (
                            <div className="text-xs text-destructive mt-1 max-w-xs">{d.error_message}</div>
                          )}
                        </td>
                        <td className="py-2">{d.product_name ?? "—"}</td>
                        <td className="py-2 whitespace-nowrap">
                          v{d.version}
                          {versions > 1 && (
                            <span className="ms-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <History className="h-3 w-3" />{versions}
                            </span>
                          )}
                        </td>
                        <td className="py-2">{d.page_count ?? "—"}</td>
                        <td className="py-2">
                          <span className={"rounded-full px-2 py-0.5 text-xs " + meta.cls}>
                            {busyId === d.id ? "جاري التحليل" : meta.label}
                          </span>
                        </td>
                        <td className="py-2 text-end whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => previewDoc(d)} title="معاينة">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDoc(d)} title="تنزيل / فتح">
                            <Download className="h-4 w-4" />
                          </Button>
                          {canEdit && ANALYZABLE.includes(ext(d.file_name)) && (d.status === "failed" || d.status === "uploaded") && (
                            <Button size="sm" variant="ghost" disabled={!!busyId} onClick={() => analyze(d.id, "إعادة التحليل")} title="إعادة التحليل">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button size="sm" variant="ghost" disabled={busy || !!busyId} onClick={() => askNewVersion(d)} title="رفع نسخة جديدة">
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeDoc(d)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-primary text-primary-foreground p-5">
          <p className="font-bold mb-1">💡 كيف يستخدمها المساعد الذكي؟</p>
          <p className="text-sm opacity-90">
            اكتب في محادثة القسم مثلًا: «عايز أعمل كرواسون» — سيبحث المساعد داخل مستندات هذا القسم ويستخرج الخامات والوصفة وخطوات التصنيع و Parameters و Quality Checks، مع ذكر اسم الملف ورقم الصفحة لكل معلومة.
          </p>
          <Link to="/chat" search={{ category }} className="inline-block mt-3 rounded-lg bg-background/20 px-3 py-1.5 text-sm font-semibold hover:bg-background/30">
            ✨ افتح محادثة القسم
          </Link>
        </div>
      </div>
    </div>
  );
}
