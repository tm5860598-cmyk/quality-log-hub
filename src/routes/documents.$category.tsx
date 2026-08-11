import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ingestDocumentChunks } from "@/lib/documents.functions";
import { chunkPages, parseDocument } from "@/lib/doc-parse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, FileText, Trash2, Upload, Download, Sparkles, Search } from "lucide-react";

const PRIVILEGED = ["owner", "admin", "qa_manager", "production_manager", "qa_engineer", "production_engineer"];

const CATEGORY_LABELS: Record<string, string> = {
  "juice-production": "إنتاج العصائر",
  "juice-quality": "جودة العصائر",
  "dairy-production": "إنتاج الألبان",
  "dairy-quality": "جودة الألبان",
  "bakery-production": "إنتاج البيكري",
  "bakery-quality": "جودة البيكري",
  "quality-reports": "تقارير الجودة",
};

type Doc = {
  id: string; title: string; file_name: string; file_type: string; storage_path: string;
  file_size: number | null; page_count: number | null; status: string; error_message: string | null;
  product_id: string | null; product_name: string | null; created_at: string;
};
type Product = { id: string; name: string };

export const Route = createFileRoute("/documents/$category")({
  ssr: false,
  component: DocumentsPage,
});

function DocumentsPage() {
  const { category } = Route.useParams();
  const { status: authStatus, role, userId } = useAuth();
  const canEdit = PRIVILEGED.includes(role);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("documents").select("*").eq("category", category).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").eq("category", category).order("name"),
    ]);
    setDocs((d ?? []) as Doc[]);
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

  async function upload() {
    if (!file || !userId) return;
    setBusy(true);
    let docId: string | null = null;
    try {
      setProgress("جاري قراءة الملف...");
      const pages = await parseDocument(file);
      if (!pages.length) throw new Error("لم يتم استخراج أي نص من الملف (قد يكون ملف صور ممسوح ضوئيًا)");
      const chunks = chunkPages(pages);

      setProgress("جاري رفع الملف...");
      const path = `${category}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("department-docs").upload(path, file, { upsert: false });
      if (up.error) throw new Error(up.error.message);

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
          page_count: pages.length,
          status: "processing",
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      docId = ins.data.id as string;

      const BATCH = 40;
      for (let i = 0; i < chunks.length; i += BATCH) {
        setProgress(`تحليل المحتوى بالذكاء الاصطناعي... ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
        await ingestDocumentChunks({
          data: { documentId: docId, category, startIndex: i, chunks: chunks.slice(i, i + BATCH) },
        });
      }

      await supabase.from("documents").update({ status: "ready" }).eq("id", docId);
      toast.success("تم رفع المستند وتحليله وإضافته لقاعدة معرفة القسم");
      setFile(null);
      setTitle("");
      setProductId("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل رفع المستند";
      if (docId) await supabase.from("documents").update({ status: "failed", error_message: msg }).eq("id", docId);
      toast.error(msg);
      await load();
    } finally {
      setBusy(false);
      setProgress("");
    }
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
    return <div className="min-h-screen grid place-items-center text-slate-500">جاري التحميل...</div>;
  }
  if (authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen grid place-items-center">
        <Link to="/" className="text-indigo-600 underline">سجّل الدخول للمتابعة</Link>
      </div>
    );
  }

  const filtered = docs.filter((d) =>
    !q.trim() ? true : (d.title + d.file_name + (d.product_name ?? "")).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-sky-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <FileText className="h-6 w-6 text-indigo-600" />
              مستندات قسم {CATEGORY_LABELS[category] ?? category}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              ارفع ملفات PDF / Word الخاصة بالقسم والمنتجات — يقرأها النظام ويحوّلها لقاعدة معرفة يستند إليها المساعد الذكي مع ذكر اسم الملف ورقم الصفحة.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            الرئيسية <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {canEdit && (
          <div className="rounded-2xl bg-white shadow p-5 space-y-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Upload className="h-4 w-4" /> رفع مستند جديد</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>عنوان المستند</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مواصفة كرواسون" />
              </div>
              <div className="space-y-1">
                <Label>المنتج المرتبط (اختياري)</Label>
                <select
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                <Label>الملف (PDF / DOCX / TXT)</Label>
                <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={onPick} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={upload} disabled={!file || busy} className="bg-indigo-600 hover:bg-indigo-700">
                <Sparkles className="h-4 w-4 me-1" /> {busy ? "جاري المعالجة..." : "رفع وتحليل"}
              </Button>
              {progress && <span className="text-sm text-slate-600">{progress}</span>}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white shadow p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في مستندات القسم..." className="max-w-sm" />
            <span className="text-xs text-slate-500 ms-auto">{filtered.length} مستند</span>
          </div>
          {loading ? (
            <p className="text-slate-500 text-sm">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-slate-500 text-sm">لا توجد مستندات بعد في هذا القسم.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b">
                    <th className="text-start py-2">المستند</th>
                    <th className="text-start py-2">المنتج</th>
                    <th className="text-start py-2">الصفحات</th>
                    <th className="text-start py-2">الحالة</th>
                    <th className="text-start py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-semibold text-slate-800">{d.title}</div>
                        <div className="text-xs text-slate-500">{d.file_name}</div>
                      </td>
                      <td className="py-2 text-slate-700">{d.product_name ?? "—"}</td>
                      <td className="py-2 text-slate-700">{d.page_count ?? "—"}</td>
                      <td className="py-2">
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-xs " +
                            (d.status === "ready"
                              ? "bg-emerald-100 text-emerald-700"
                              : d.status === "failed"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700")
                          }
                          title={d.error_message ?? ""}
                        >
                          {d.status === "ready" ? "جاهز للبحث" : d.status === "failed" ? "فشل التحليل" : "قيد المعالجة"}
                        </span>
                      </td>
                      <td className="py-2 text-end whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openDoc(d)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => removeDoc(d)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-indigo-600 text-white p-5">
          <p className="font-bold mb-1">💡 كيف يستخدمها المساعد الذكي؟</p>
          <p className="text-sm opacity-90">
            اكتب في محادثة القسم مثلًا: «عايز أعمل كرواسون» — سيبحث المساعد داخل مستندات هذا القسم ويستخرج الخامات والوصفة وخطوات التصنيع و Parameters و Quality Checks و CCP/HACCP، مع ذكر اسم الملف ورقم الصفحة لكل معلومة، ولن يخترع معلومات غير موجودة.
          </p>
          <Link to="/chat" search={{ category }} className="inline-block mt-3 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30">
            ✨ افتح محادثة القسم
          </Link>
        </div>
      </div>
    </div>
  );
}
