import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, Plus, Search, Save, Trash2, Printer, Calculator, Package, X, Pencil,
} from "lucide-react";

type Ingredient = { name: string; amount: number; unit: string };
type Product = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  base_quantity: number;
  base_unit: string;
  ingredients: Ingredient[];
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const CATEGORIES: Record<string, { label: string; emoji: string; gradient: string }> = {
  "juice-production": { label: "إنتاج العصائر", emoji: "🥤", gradient: "from-orange-500 to-rose-500" },
  "juice-quality": { label: "جودة العصائر", emoji: "🧪", gradient: "from-rose-500 to-fuchsia-500" },
  "dairy-production": { label: "إنتاج الألبان", emoji: "🥛", gradient: "from-sky-500 to-cyan-500" },
  "dairy-quality": { label: "جودة الألبان", emoji: "🔬", gradient: "from-cyan-500 to-teal-500" },
  "bakery-production": { label: "إنتاج البيكري", emoji: "🥐", gradient: "from-amber-500 to-orange-500" },
  "bakery-quality": { label: "جودة البيكري", emoji: "🧫", gradient: "from-yellow-500 to-amber-500" },
};

export const Route = createFileRoute("/products/$category")({
  component: ProductsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-center text-sm text-destructive">{String(error?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-center">غير موجود</div>,
});

function ProductsPage() {
  const { category } = Route.useParams();
  const meta = CATEGORIES[category];
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setReady(true); });
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    const rows = (data ?? []).map((p) => ({
      ...(p as unknown as Product),
      ingredients: Array.isArray((p as unknown as { ingredients?: unknown }).ingredients)
        ? ((p as unknown as { ingredients: Ingredient[] }).ingredients)
        : [],
    })) as Product[];
    setProducts(rows);
  };
  useEffect(() => { load(); }, [session, category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  if (!ready) return <div className="min-h-screen grid place-items-center text-slate-500">...</div>;
  if (!meta) return <div className="p-6 text-center">قسم غير معروف</div>;
  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50" dir="rtl">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">سجّل الدخول للوصول للمنتجات</h2>
          <Link to="/" className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm">
            <ArrowRight className="size-4" /> الرجوع
          </Link>
        </div>
      </div>
    );
  }

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (p: Product) => { setEditing(p); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const afterSave = () => { closeForm(); load(); };

  const del = async (p: Product) => {
    if (!confirm(`حذف المنتج "${p.name}"؟`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    if (selected?.id === p.id) setSelected(null);
    load();
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="mx-auto max-w-6xl p-4 md:p-6 print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center justify-center rounded-md border w-10 h-10 bg-white hover:bg-slate-50" aria-label="رجوع">
              <ArrowRight className="size-4" />
            </Link>
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${meta.gradient} text-white px-3 py-1 text-xs font-semibold`}>
                <span>{meta.emoji}</span><span>{meta.label}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 mt-1">مكتبة المنتجات وحاسبة الخامات</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={openNew} className={`bg-gradient-to-r ${meta.gradient} text-white`}>
              <Plus className="size-4" /> إضافة منتج جديد
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* Products list */}
          <aside className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-3 shadow-lg print:hidden">
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="ابحث عن اسم المنتج..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="text-xs text-slate-500 mb-2 px-1">{filtered.length} منتج</div>
            <div className="space-y-1 max-h-[65vh] overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-6">لا توجد منتجات محفوظة بعد.</p>
              )}
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-right rounded-lg px-3 py-2 border transition ${
                    selected?.id === p.id
                      ? "bg-indigo-50 border-indigo-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-indigo-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        وصفة أساس: {p.base_quantity} {p.base_unit} · {p.ingredients.length} خامة
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Detail / Calculator */}
          <section>
            {selected ? (
              <ProductDetail
                product={selected}
                canDelete={selected.created_by === session.user.id}
                onEdit={() => openEdit(selected)}
                onDelete={() => del(selected)}
                gradient={meta.gradient}
              />
            ) : (
              <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-10 text-center text-slate-500 shadow-lg">
                اختر منتجًا من القائمة أو أضف منتجًا جديدًا لعرض حاسبة الخامات.
              </div>
            )}
          </section>
        </div>
      </div>

      {showForm && (
        <ProductForm
          category={category}
          userId={session.user.id}
          initial={editing}
          onClose={closeForm}
          onSaved={afterSave}
          gradient={meta.gradient}
        />
      )}
    </div>
  );
}

function ProductDetail({
  product, canDelete, onEdit, onDelete, gradient,
}: {
  product: Product; canDelete: boolean; onEdit: () => void; onDelete: () => void; gradient: string;
}) {
  const [qty, setQty] = useState<number>(product.base_quantity);
  useEffect(() => { setQty(product.base_quantity); }, [product.id, product.base_quantity]);

  const factor = product.base_quantity > 0 ? qty / product.base_quantity : 0;
  const scaled = product.ingredients.map((i) => ({
    ...i,
    total: +(i.amount * factor).toFixed(3),
  }));

  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-5 md:p-6 shadow-lg space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">{product.name}</h2>
          {product.description && <p className="text-sm text-slate-600 mt-1 max-w-2xl">{product.description}</p>}
          <div className="text-xs text-slate-500 mt-2">
            وصفة الأساس: <span className="font-semibold text-slate-700">{product.base_quantity} {product.base_unit}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" /> تعديل
          </Button>
          {canDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <Trash2 className="size-4" /> حذف
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="md:col-span-1">
          <Label className="text-xs text-slate-600">اسم المنتج</Label>
          <div className="mt-1 rounded-md border bg-white px-3 py-2 font-semibold text-slate-800">{product.name}</div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">الكمية المطلوب تصنيعها</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number" min={0} step="any"
              value={Number.isFinite(qty) ? qty : 0}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
              className="font-semibold"
            />
            <span className="text-sm text-slate-600 shrink-0">{product.base_unit}</span>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">مُعامل التحويل</Label>
          <div className="mt-1 rounded-md border bg-white px-3 py-2 font-semibold text-indigo-700">× {factor.toFixed(3)}</div>
        </div>
      </div>

      <div>
        <div className={`inline-flex items-center gap-2 rounded-t-lg bg-gradient-to-r ${gradient} text-white px-4 py-2 text-sm font-semibold`}>
          <Calculator className="size-4" /> الخامات المطلوبة لتصنيع {qty} {product.base_unit}
        </div>
        <div className="overflow-x-auto rounded-b-lg rounded-tl-lg border border-slate-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b border-slate-200 p-3 text-sm font-semibold text-slate-700 w-12">#</th>
                <th className="border-b border-slate-200 p-3 text-sm font-semibold text-slate-700">اسم الخامة</th>
                <th className="border-b border-slate-200 p-3 text-sm font-semibold text-slate-700 w-40">الكمية المطلوبة</th>
                <th className="border-b border-slate-200 p-3 text-sm font-semibold text-slate-700 w-32">الوحدة</th>
                <th className="border-b border-slate-200 p-3 text-sm font-semibold text-slate-500 w-40 hidden md:table-cell">
                  لكل {product.base_quantity} {product.base_unit}
                </th>
              </tr>
            </thead>
            <tbody>
              {scaled.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-slate-500">لم يتم إدخال خامات لهذا المنتج بعد.</td>
                </tr>
              ) : scaled.map((ing, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                  <td className="border-b border-slate-100 p-3 text-center text-sm font-semibold text-slate-600">{i + 1}</td>
                  <td className="border-b border-slate-100 p-3 text-sm text-slate-800 font-medium">{ing.name}</td>
                  <td className="border-b border-slate-100 p-3 text-sm font-bold text-indigo-700">{ing.total}</td>
                  <td className="border-b border-slate-100 p-3 text-sm text-slate-700">{ing.unit}</td>
                  <td className="border-b border-slate-100 p-3 text-sm text-slate-500 hidden md:table-cell">{ing.amount} {ing.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {product.notes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-xs font-semibold text-amber-800 mb-1">ملاحظات</div>
          <p className="text-sm text-slate-700 whitespace-pre-line">{product.notes}</p>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  category, userId, initial, onClose, onSaved, gradient,
}: {
  category: string; userId: string; initial: Product | null;
  onClose: () => void; onSaved: () => void; gradient: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [baseQuantity, setBaseQuantity] = useState<number>(initial?.base_quantity ?? 1);
  const [baseUnit, setBaseUnit] = useState<string>(initial?.base_unit ?? "كجم");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ name: "", amount: 0, unit: "كجم" }],
  );
  const [saving, setSaving] = useState(false);

  const setIng = (i: number, key: keyof Ingredient, v: string) => {
    setIngredients((prev) => prev.map((ing, idx) => idx === i
      ? { ...ing, [key]: key === "amount" ? (parseFloat(v) || 0) : v }
      : ing));
  };
  const addIng = () => setIngredients((p) => [...p, { name: "", amount: 0, unit: "كجم" }]);
  const removeIng = (i: number) => setIngredients((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("أدخل اسم المنتج");
    if (!(baseQuantity > 0)) return toast.error("أدخل كمية الأساس");
    const cleanedIngs = ingredients
      .map((i) => ({ name: i.name.trim(), amount: Number(i.amount) || 0, unit: (i.unit || "").trim() || "كجم" }))
      .filter((i) => i.name);
    setSaving(true);
    const payload = {
      category,
      name: name.trim(),
      description: description.trim() || null,
      base_quantity: baseQuantity,
      base_unit: baseUnit.trim() || "كجم",
      ingredients: cleanedIngs as unknown as never,
      notes: notes.trim() || null,
    };
    let error;
    if (initial) {
      ({ error } = await supabase.from("products").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("products").insert({ ...payload, created_by: userId }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "تم تحديث المنتج" : "تم حفظ المنتج");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className={`sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r ${gradient} text-white px-5 py-3`}>
          <h3 className="font-bold">{initial ? "تعديل المنتج" : "إضافة منتج جديد"}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/20" aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="mb-1 block">اسم المنتج *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1 block">وصف مختصر</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
            </div>
            <div>
              <Label className="mb-1 block">كمية الأساس *</Label>
              <Input type="number" min={0} step="any" value={baseQuantity}
                onChange={(e) => setBaseQuantity(parseFloat(e.target.value) || 0)} required />
              <p className="text-xs text-slate-500 mt-1">كل الخامات ستكون بنسبة هذه الكمية.</p>
            </div>
            <div>
              <Label className="mb-1 block">وحدة الأساس</Label>
              <Input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} placeholder="كجم / لتر / رغيف..." maxLength={20} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>الخامات</Label>
              <Button type="button" size="sm" variant="outline" onClick={addIng}>
                <Plus className="size-4" /> إضافة خامة
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-right">
                <thead className="bg-slate-100 text-sm">
                  <tr>
                    <th className="p-2 font-semibold text-slate-700 w-10">#</th>
                    <th className="p-2 font-semibold text-slate-700">اسم الخامة</th>
                    <th className="p-2 font-semibold text-slate-700 w-32">الكمية</th>
                    <th className="p-2 font-semibold text-slate-700 w-28">الوحدة</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2 text-center text-sm text-slate-500">{i + 1}</td>
                      <td className="p-1">
                        <Input value={ing.name} onChange={(e) => setIng(i, "name", e.target.value)} placeholder="مثال: سكر" />
                      </td>
                      <td className="p-1">
                        <Input type="number" min={0} step="any"
                          value={ing.amount}
                          onChange={(e) => setIng(i, "amount", e.target.value)} />
                      </td>
                      <td className="p-1">
                        <Input value={ing.unit} onChange={(e) => setIng(i, "unit", e.target.value)} placeholder="كجم" maxLength={20} />
                      </td>
                      <td className="p-1 text-center">
                        <button type="button" onClick={() => removeIng(i)}
                          className="text-rose-500 hover:text-rose-700" aria-label="حذف الخامة">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              مثال: لو كمية الأساس 100 كجم عصير، أدخل كل الخامات المطلوبة لتصنيع 100 كجم — والحاسبة ستضبطها تلقائيًا لأي كمية.
            </p>
          </div>

          <div>
            <Label className="mb-1 block">ملاحظات إضافية</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000}
              placeholder="أي معلومات عن طريقة التصنيع أو الحفظ..." />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={saving} className={`bg-gradient-to-r ${gradient} text-white`}>
              <Save className="size-4" /> {initial ? "حفظ التعديلات" : "حفظ المنتج"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}