import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/lib/departments";
import { useAuth } from "@/lib/auth-context";
import { useDeptPermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, Plus, Search, Save, Trash2, Printer, Calculator, Package, X, Pencil,
  Info, FlaskConical, ListOrdered, ImageIcon, ChevronUp, ChevronDown, QrCode, FileText, Upload,
} from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { QrLabelDialog } from "@/components/QrLabelDialog";
import { SopDialog } from "@/components/SopDialog";
import { uploadProductImage } from "@/lib/product-media";
import { PrintReport } from "@/components/PrintReport";

// ---------- Types ----------
type Ingredient = {
  name: string;
  amount: number;
  unit: string;
  code?: string;
  supplier?: string;
  percentage?: number;
  min_percent?: number;
  max_percent?: number;
  standard_spec?: string;
  cost?: number;
  expiry_date?: string;
  storage_conditions?: string;
};

type RecipeStep = {
  order: number;
  description: string;
  ingredient_ref?: string;
  quantity?: string;
  stir_speed?: string;
  stir_time?: string;
  temperature?: string;
  pressure?: string;
  notes?: string;
};
type RecipeParams = {
  pasteurization_time?: string;
  cooling_time?: string;
  filling_point?: string;
  special_instructions?: string;
};
type Recipe = { steps: RecipeStep[]; parameters: RecipeParams };

type Spec = {
  ph?: string;
  brix?: string;
  viscosity?: string;
  net_weight?: string;
  shelf_life?: string;
  storage?: string;
  allergens?: string;
  standard_spec?: string;
};

type Product = {
  id: string;
  category: string;
  name: string;
  code: string | null;
  product_type: string | null;
  package_size: string | null;
  image_url: string | null;
  description: string | null;
  base_quantity: number;
  base_unit: string;
  ingredients: Ingredient[];
  spec: Spec;
  recipe: Recipe;
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

const PRIVILEGED_ROLES = ["owner", "admin", "qa_manager", "production_manager"];

const emptyRecipe = (): Recipe => ({ steps: [], parameters: {} });
const emptySpec = (): Spec => ({});

function normalizeProduct(p: Record<string, unknown>): Product {
  const ings = Array.isArray(p.ingredients) ? (p.ingredients as Ingredient[]) : [];
  const rec = (p.recipe && typeof p.recipe === "object") ? (p.recipe as Recipe) : emptyRecipe();
  const spec = (p.spec && typeof p.spec === "object") ? (p.spec as Spec) : emptySpec();
  return {
    ...(p as unknown as Product),
    ingredients: ings,
    recipe: { steps: Array.isArray(rec.steps) ? rec.steps : [], parameters: rec.parameters ?? {} },
    spec: spec,
  };
}

export const Route = createFileRoute("/products/$category")({
  ssr: false,
  component: ProductsPage,
  head: () => ({ meta: [
    { title: "المنتجات والوصفات | My Favourite Project" },
    { name: "description", content: "مكتبة المنتجات والوصفات وحساب الخامات وتقارير التصنيع." },
    { property: "og:title", content: "المنتجات والوصفات | My Favourite Project" },
    { property: "og:description", content: "مكتبة المنتجات والوصفات وحساب الخامات وتقارير التصنيع." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-center text-sm text-destructive">{String((error as Error)?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-center">غير موجود</div>,
});

function ProductsPage() {
  const { category } = Route.useParams();
  const { dept } = useDepartment(category);
  const meta = dept
    ? { label: dept.title_ar, emoji: dept.emoji, gradient: dept.gradient }
    : CATEGORIES[category];
  const { session, role: userRole, status } = useAuth();
  const { can, loading: permLoading } = useDeptPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canEdit = PRIVILEGED_ROLES.includes(userRole);
  const canDelete = userRole === "owner" || userRole === "admin";

  const load = async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setProducts((data ?? []).map((p) => normalizeProduct(p as Record<string, unknown>)));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session, category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.code ?? "").toLowerCase().includes(q) ||
      (p.product_type ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  if (status === "loading" || permLoading) return <div className="min-h-screen grid place-items-center text-slate-500">...</div>;
  if (!meta) return <div className="p-6 text-center">قسم غير معروف</div>;
  if (status === "authenticated" && !can(category).view) {
    return (
      <div dir="rtl" className="min-h-screen grid place-items-center p-6 text-center bg-background">
        <div className="max-w-md space-y-3">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">لا تملك صلاحية الدخول لهذا القسم</h1>
          <Link to="/" className="text-primary underline text-sm">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }
  if (status === "unauthenticated" || !session) {
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
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 mt-1">مكتبة المنتجات والوصفات</h1>
              <p className="text-xs text-slate-500 mt-0.5">دورك الحالي: <span className="font-semibold">{userRole}</span> {canEdit ? "· يمكنك الإضافة والتعديل" : "· عرض فقط"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Button onClick={openNew} className={`bg-gradient-to-r ${meta.gradient} text-white`}>
                <Plus className="size-4" /> إضافة منتج جديد
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[340px_1fr]">
          {/* Products list */}
          <aside className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-3 shadow-lg print:hidden">
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="ابحث بالاسم أو الكود أو النوع..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="text-xs text-slate-500 mb-2 px-1">{filtered.length} منتج</div>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
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
                    <ProductImage
                      src={p.image_url}
                      alt={p.name}
                      className="w-10 h-10 rounded-md object-cover shrink-0 border"
                      fallbackClassName="w-10 h-10 rounded-md bg-indigo-50 grid place-items-center shrink-0 border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {p.code && <span className="font-mono">{p.code} · </span>}
                        {p.ingredients.length} خامة · {p.recipe.steps.length} خطوة
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
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => openEdit(selected)}
                onDelete={() => del(selected)}
                gradient={meta.gradient}
                department={meta.label}
              />
            ) : (
              <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-10 text-center text-slate-500 shadow-lg">
                اختر منتجًا من القائمة أو أضف منتجًا جديدًا لعرض تفاصيله وحاسبة الخامات.
              </div>
            )}
          </section>
        </div>
      </div>

      {showForm && canEdit && (
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

// ---------- Detail view ----------
function ProductDetail({
  product, canEdit, canDelete, onEdit, onDelete, gradient, department,
}: {
  product: Product; canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void; gradient: string; department: string;
}) {
  const [qty, setQty] = useState<number>(product.base_quantity);
  const [view, setView] = useState<"calc" | "spec" | "recipe">("calc");
  const [showQr, setShowQr] = useState(false);
  const [showSop, setShowSop] = useState(false);
  const [sopKind, setSopKind] = useState<"sop" | "bmr">("sop");
  useEffect(() => { setQty(product.base_quantity); setView("calc"); }, [product.id, product.base_quantity]);

  const factor = product.base_quantity > 0 ? qty / product.base_quantity : 0;
  const scaled = product.ingredients.map((i) => ({ ...i, total: +(i.amount * factor).toFixed(3) }));

  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-5 md:p-6 shadow-lg space-y-5">
      <PrintReport title="تقرير المنتج وحساب الخامات" department={department} reportNumber={product.code || undefined} product={product.name} meta={[
        { label: "الكمية المستهدفة", value: `${qty} ${product.base_unit}` },
        { label: "حجم العبوة", value: product.package_size || "—" },
        { label: "نوع المنتج", value: product.product_type || "—" },
      ]}>
        {product.description && <p>{product.description}</p>}
        <h2>الخامات المطلوبة</h2>
        <table><thead><tr><th>#</th><th>الخامة</th><th>الكود</th><th>المورد</th><th>الكمية</th><th>الوحدة</th><th>%</th></tr></thead><tbody>{scaled.map((ingredient, index) => <tr key={`print-${index}`}><td>{index + 1}</td><td>{ingredient.name}</td><td>{ingredient.code || "—"}</td><td>{ingredient.supplier || "—"}</td><td>{ingredient.total}</td><td>{ingredient.unit}</td><td>{ingredient.percentage != null ? `${ingredient.percentage}%` : "—"}</td></tr>)}</tbody></table>
        <h2>المواصفات القياسية</h2>
        <table><tbody>{Object.entries(product.spec).filter(([, value]) => value).map(([key, value]) => <tr key={`spec-${key}`}><th>{key}</th><td>{value}</td></tr>)}</tbody></table>
        <h2>خطوات التصنيع</h2>
        <ol>{[...product.recipe.steps].sort((a, b) => a.order - b.order).map((step, index) => <li key={`step-${index}`}><strong>{step.description}</strong>{[step.ingredient_ref, step.quantity, step.stir_speed, step.stir_time, step.temperature, step.pressure].filter(Boolean).length > 0 && <div>{[step.ingredient_ref && `الخامة: ${step.ingredient_ref}`, step.quantity && `الكمية: ${step.quantity}`, step.stir_speed && `السرعة: ${step.stir_speed}`, step.stir_time && `المدة: ${step.stir_time}`, step.temperature && `الحرارة: ${step.temperature}`, step.pressure && `الضغط: ${step.pressure}`].filter(Boolean).join(" · ")}</div>}</li>)}</ol>
        {product.notes && <section className="print-block"><h3>ملاحظات</h3><p>{product.notes}</p></section>}
      </PrintReport>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="flex gap-3 min-w-0">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            className="w-20 h-20 rounded-xl object-cover border shrink-0"
            fallbackClassName="w-20 h-20 rounded-xl bg-indigo-50 grid place-items-center border shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold text-slate-800 truncate">{product.name}</h2>
            <div className="flex flex-wrap gap-2 mt-1 text-xs">
              {product.code && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono">{product.code}</span>}
              {product.product_type && <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5">{product.product_type}</span>}
              {product.package_size && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">{product.package_size}</span>}
            </div>
            {product.description && <p className="text-sm text-slate-600 mt-2 max-w-2xl">{product.description}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowQr(true)}>
            <QrCode className="size-4" /> QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSopKind("sop"); setShowSop(true); }}>
            <FileText className="size-4" /> SOP
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSopKind("bmr"); setShowSop(true); }}>
            <FileText className="size-4" /> BMR
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-4" /> تعديل
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600 border-rose-200 hover:bg-rose-50">
              <Trash2 className="size-4" /> حذف
            </Button>
          )}
        </div>
      </div>

      <QrLabelDialog
        open={showQr}
        onClose={() => setShowQr(false)}
        title={product.name}
        subtitle={[product.code, product.product_type, product.package_size].filter(Boolean).join(" · ")}
        productId={product.id}
      />
      <SopDialog
        open={showSop}
        onClose={() => setShowSop(false)}
        kind={sopKind}
        product={product}
        qty={qty}
      />

      <div className="flex flex-wrap gap-1 print:hidden">
        <ViewTab active={view === "calc"} onClick={() => setView("calc")} icon={<Calculator className="size-4" />}>الخامات والحاسبة</ViewTab>
        <ViewTab active={view === "spec"} onClick={() => setView("spec")} icon={<FlaskConical className="size-4" />}>المواصفات القياسية</ViewTab>
        <ViewTab active={view === "recipe"} onClick={() => setView("recipe")} icon={<ListOrdered className="size-4" />}>وصفة التصنيع</ViewTab>
      </div>

      {view === "calc" && (
        <>
          <div className="grid gap-3 md:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <Label className="text-xs text-slate-600">اسم المنتج</Label>
              <div className="mt-1 rounded-md border bg-white px-3 py-2 font-semibold text-slate-800">{product.name}</div>
            </div>
            <div>
              <Label className="text-xs text-slate-600">الكمية المطلوب تصنيعها</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input type="number" min={0} step="any"
                  value={Number.isFinite(qty) ? qty : 0}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                  className="font-semibold" />
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
              <table className="w-full text-right border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border-b p-2 w-10">#</th>
                    <th className="border-b p-2">الخامة</th>
                    <th className="border-b p-2 hidden md:table-cell">الكود</th>
                    <th className="border-b p-2 hidden md:table-cell">المورد</th>
                    <th className="border-b p-2 w-24">الكمية</th>
                    <th className="border-b p-2 w-20">الوحدة</th>
                    <th className="border-b p-2 w-20 hidden md:table-cell">%</th>
                  </tr>
                </thead>
                <tbody>
                  {scaled.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-500">لم يتم إدخال خامات لهذا المنتج بعد.</td></tr>
                  ) : scaled.map((ing, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="border-b border-slate-100 p-2 text-center font-semibold text-slate-600">{i + 1}</td>
                      <td className="border-b border-slate-100 p-2 font-medium text-slate-800">{ing.name}</td>
                      <td className="border-b border-slate-100 p-2 font-mono text-xs hidden md:table-cell">{ing.code ?? "—"}</td>
                      <td className="border-b border-slate-100 p-2 text-slate-600 hidden md:table-cell">{ing.supplier ?? "—"}</td>
                      <td className="border-b border-slate-100 p-2 font-bold text-indigo-700">{ing.total}</td>
                      <td className="border-b border-slate-100 p-2 text-slate-700">{ing.unit}</td>
                      <td className="border-b border-slate-100 p-2 text-slate-600 hidden md:table-cell">{ing.percentage != null ? `${ing.percentage}%` : "—"}</td>
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
        </>
      )}

      {view === "spec" && <SpecView spec={product.spec} />}
      {view === "recipe" && <RecipeView recipe={product.recipe} />}
    </div>
  );
}

function ViewTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-slate-900 text-white shadow" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
      }`}>
      {icon} {children}
    </button>
  );
}

function SpecView({ spec }: { spec: Spec }) {
  const items: [string, string | undefined][] = [
    ["pH", spec.ph], ["Brix", spec.brix], ["اللزوجة", spec.viscosity],
    ["الوزن الصافي", spec.net_weight], ["الصلاحية", spec.shelf_life],
    ["ظروف التخزين", spec.storage], ["الحساسية / Allergens", spec.allergens],
  ];
  const anything = items.some(([, v]) => v) || spec.standard_spec;
  if (!anything) return <div className="text-center text-slate-500 py-8">لا توجد مواصفات مسجلة.</div>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {items.map(([label, val]) => val ? (
          <div key={label} className="rounded-lg border bg-white p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="font-semibold text-slate-800 mt-1">{val}</div>
          </div>
        ) : null)}
      </div>
      {spec.standard_spec && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="text-xs font-semibold text-indigo-800 mb-1">المواصفة القياسية</div>
          <p className="text-sm text-slate-700 whitespace-pre-line">{spec.standard_spec}</p>
        </div>
      )}
    </div>
  );
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const steps = [...recipe.steps].sort((a, b) => a.order - b.order);
  const p = recipe.parameters;
  if (steps.length === 0 && !p.pasteurization_time && !p.cooling_time && !p.filling_point && !p.special_instructions) {
    return <div className="text-center text-slate-500 py-8">لم تُدخل وصفة تصنيع بعد.</div>;
  }
  return (
    <div className="space-y-4">
      {steps.length > 0 && (
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="rounded-lg border bg-white p-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-bold">{s.order}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{s.description || "—"}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                    {s.ingredient_ref && <Chip>الخامة: {s.ingredient_ref}</Chip>}
                    {s.quantity && <Chip>الكمية: {s.quantity}</Chip>}
                    {s.stir_speed && <Chip>سرعة التقليب: {s.stir_speed}</Chip>}
                    {s.stir_time && <Chip>مدة التقليب: {s.stir_time}</Chip>}
                    {s.temperature && <Chip>الحرارة: {s.temperature}</Chip>}
                    {s.pressure && <Chip>الضغط: {s.pressure}</Chip>}
                  </div>
                  {s.notes && <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{s.notes}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {p.pasteurization_time && <ParamCard label="زمن البسترة" value={p.pasteurization_time} />}
        {p.cooling_time && <ParamCard label="زمن التبريد" value={p.cooling_time} />}
        {p.filling_point && <ParamCard label="نقطة التعبئة" value={p.filling_point} />}
      </div>
      {p.special_instructions && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-xs font-semibold text-amber-800 mb-1">تعليمات خاصة</div>
          <p className="text-sm text-slate-700 whitespace-pre-line">{p.special_instructions}</p>
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5">{children}</span>;
}
function ParamCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800 mt-1">{value}</div>
    </div>
  );
}

// ---------- Form ----------
type FormTab = "basic" | "spec" | "ingredients" | "recipe";

function ProductForm({
  category, userId, initial, onClose, onSaved, gradient,
}: {
  category: string; userId: string; initial: Product | null;
  onClose: () => void; onSaved: () => void; gradient: string;
}) {
  const [tab, setTab] = useState<FormTab>("basic");

  // Basic
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [productType, setProductType] = useState(initial?.product_type ?? "");
  const [packageSize, setPackageSize] = useState(initial?.package_size ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [baseQuantity, setBaseQuantity] = useState<number>(initial?.base_quantity ?? 1);
  const [baseUnit, setBaseUnit] = useState<string>(initial?.base_unit ?? "كجم");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Spec
  const [spec, setSpec] = useState<Spec>(initial?.spec ?? {});
  const setSpecField = (k: keyof Spec, v: string) => setSpec((s) => ({ ...s, [k]: v }));

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ name: "", amount: 0, unit: "كجم" }],
  );
  const setIng = <K extends keyof Ingredient>(i: number, key: K, v: Ingredient[K]) =>
    setIngredients((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [key]: v } : ing));
  const addIng = () => setIngredients((p) => [...p, { name: "", amount: 0, unit: "كجم" }]);
  const removeIng = (i: number) => setIngredients((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);

  // Recipe
  const [steps, setSteps] = useState<RecipeStep[]>(initial?.recipe?.steps ?? []);
  const [params, setParams] = useState<RecipeParams>(initial?.recipe?.parameters ?? {});
  const setParamField = (k: keyof RecipeParams, v: string) => setParams((p) => ({ ...p, [k]: v }));
  const addStep = () => setSteps((p) => [...p, { order: p.length + 1, description: "" }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));
  const moveStep = (i: number, dir: -1 | 1) => setSteps((p) => {
    const arr = [...p];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return p;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return arr.map((s, idx) => ({ ...s, order: idx + 1 }));
  });
  const setStep = <K extends keyof RecipeStep>(i: number, key: K, v: RecipeStep[K]) =>
    setSteps((p) => p.map((s, idx) => idx === i ? { ...s, [key]: v } : s));

  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setTab("basic"); return toast.error("أدخل اسم المنتج"); }
    if (!(baseQuantity > 0)) { setTab("basic"); return toast.error("أدخل كمية الأساس"); }

    const cleanedIngs: Ingredient[] = ingredients
      .map((i) => ({
        name: i.name.trim(),
        amount: Number(i.amount) || 0,
        unit: (i.unit || "").trim() || "كجم",
        code: i.code?.trim() || undefined,
        supplier: i.supplier?.trim() || undefined,
        percentage: i.percentage != null && !Number.isNaN(i.percentage) ? Number(i.percentage) : undefined,
        min_percent: i.min_percent != null && !Number.isNaN(i.min_percent) ? Number(i.min_percent) : undefined,
        max_percent: i.max_percent != null && !Number.isNaN(i.max_percent) ? Number(i.max_percent) : undefined,
        standard_spec: i.standard_spec?.trim() || undefined,
        cost: i.cost != null && !Number.isNaN(i.cost) ? Number(i.cost) : undefined,
        expiry_date: i.expiry_date || undefined,
        storage_conditions: i.storage_conditions?.trim() || undefined,
      }))
      .filter((i) => i.name);

    const cleanedSpec: Spec = Object.fromEntries(
      Object.entries(spec).filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v]) => [k, String(v).trim()])
    );
    const cleanedParams: RecipeParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v]) => [k, String(v).trim()])
    );
    const cleanedSteps: RecipeStep[] = steps
      .map((s, idx) => ({
        order: idx + 1,
        description: s.description.trim(),
        ingredient_ref: s.ingredient_ref?.trim() || undefined,
        quantity: s.quantity?.trim() || undefined,
        stir_speed: s.stir_speed?.trim() || undefined,
        stir_time: s.stir_time?.trim() || undefined,
        temperature: s.temperature?.trim() || undefined,
        pressure: s.pressure?.trim() || undefined,
        notes: s.notes?.trim() || undefined,
      }))
      .filter((s) => s.description);

    setSaving(true);
    const payload = {
      category,
      name: name.trim(),
      code: code.trim() || null,
      product_type: productType.trim() || null,
      package_size: packageSize.trim() || null,
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      base_quantity: baseQuantity,
      base_unit: baseUnit.trim() || "كجم",
      ingredients: cleanedIngs as unknown as never,
      spec: cleanedSpec as unknown as never,
      recipe: { steps: cleanedSteps, parameters: cleanedParams } as unknown as never,
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
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className={`sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r ${gradient} text-white px-5 py-3`}>
          <h3 className="font-bold">{initial ? "تعديل المنتج" : "إضافة منتج جديد"}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/20" aria-label="إغلاق">
            <X className="size-5" />
          </button>
        </div>

        <div className="sticky top-[52px] z-10 bg-white border-b px-3 py-2 flex flex-wrap gap-1">
          <FormTabBtn active={tab === "basic"} onClick={() => setTab("basic")} icon={<Info className="size-4" />}>الأساسي</FormTabBtn>
          <FormTabBtn active={tab === "spec"} onClick={() => setTab("spec")} icon={<FlaskConical className="size-4" />}>المواصفات</FormTabBtn>
          <FormTabBtn active={tab === "ingredients"} onClick={() => setTab("ingredients")} icon={<Package className="size-4" />}>الخامات ({ingredients.length})</FormTabBtn>
          <FormTabBtn active={tab === "recipe"} onClick={() => setTab("recipe")} icon={<ListOrdered className="size-4" />}>الوصفة ({steps.length})</FormTabBtn>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {tab === "basic" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="اسم المنتج *" className="md:col-span-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
              </Field>
              <Field label="كود المنتج">
                <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={50} placeholder="مثال: JUC-001" />
              </Field>
              <Field label="النوع">
                <Input value={productType} onChange={(e) => setProductType(e.target.value)} maxLength={80} placeholder="مثال: عصير طبيعي" />
              </Field>
              <Field label="حجم العبوة">
                <Input value={packageSize} onChange={(e) => setPackageSize(e.target.value)} maxLength={50} placeholder="مثال: 250 مل" />
              </Field>
              <Field label="صورة المنتج">
                <ImageUploadField value={imageUrl} onChange={setImageUrl} userId={userId} />
              </Field>
              <Field label="كمية الأساس *">
                <div className="flex gap-2">
                  <Input type="number" min={0} step="any" value={baseQuantity}
                    onChange={(e) => setBaseQuantity(parseFloat(e.target.value) || 0)} required />
                  <Input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} placeholder="كجم" maxLength={20} className="w-24" />
                </div>
                <p className="text-xs text-slate-500 mt-1">كل الخامات ستكون بنسبة هذه الكمية.</p>
              </Field>
              <Field label="وصف مختصر" className="md:col-span-2">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
              </Field>
              <Field label="ملاحظات إضافية" className="md:col-span-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
              </Field>
            </div>
          )}

          {tab === "spec" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="pH"><Input value={spec.ph ?? ""} onChange={(e) => setSpecField("ph", e.target.value)} placeholder="3.5 - 4.0" /></Field>
              <Field label="Brix"><Input value={spec.brix ?? ""} onChange={(e) => setSpecField("brix", e.target.value)} placeholder="12°" /></Field>
              <Field label="اللزوجة"><Input value={spec.viscosity ?? ""} onChange={(e) => setSpecField("viscosity", e.target.value)} placeholder="cP" /></Field>
              <Field label="الوزن الصافي"><Input value={spec.net_weight ?? ""} onChange={(e) => setSpecField("net_weight", e.target.value)} placeholder="250 g" /></Field>
              <Field label="مدة الصلاحية"><Input value={spec.shelf_life ?? ""} onChange={(e) => setSpecField("shelf_life", e.target.value)} placeholder="12 شهر" /></Field>
              <Field label="ظروف التخزين"><Input value={spec.storage ?? ""} onChange={(e) => setSpecField("storage", e.target.value)} placeholder="مبرد 2-8°" /></Field>
              <Field label="الحساسية / Allergens" className="md:col-span-2"><Input value={spec.allergens ?? ""} onChange={(e) => setSpecField("allergens", e.target.value)} placeholder="ألبان، جلوتين..." /></Field>
              <Field label="المواصفة القياسية" className="md:col-span-2">
                <Textarea value={spec.standard_spec ?? ""} onChange={(e) => setSpecField("standard_spec", e.target.value)} rows={4} placeholder="ES / Codex / نص المواصفة..." />
              </Field>
            </div>
          )}

          {tab === "ingredients" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{ingredients.length} خامة</p>
                <Button type="button" size="sm" variant="outline" onClick={addIng}>
                  <Plus className="size-4" /> إضافة خامة
                </Button>
              </div>
              <div className="space-y-3">
                {ingredients.map((ing, i) => (
                  <div key={i} className="rounded-lg border bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-600">خامة #{i + 1}</span>
                      <button type="button" onClick={() => removeIng(i)} className="text-rose-500 hover:text-rose-700" aria-label="حذف">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Field label="الاسم *"><Input value={ing.name} onChange={(e) => setIng(i, "name", e.target.value)} placeholder="سكر" /></Field>
                      <Field label="الكود"><Input value={ing.code ?? ""} onChange={(e) => setIng(i, "code", e.target.value)} placeholder="RM-001" /></Field>
                      <Field label="المورد"><Input value={ing.supplier ?? ""} onChange={(e) => setIng(i, "supplier", e.target.value)} /></Field>
                      <Field label="الكمية">
                        <Input type="number" step="any" min={0} value={ing.amount}
                          onChange={(e) => setIng(i, "amount", parseFloat(e.target.value) || 0)} />
                      </Field>
                      <Field label="الوحدة"><Input value={ing.unit} onChange={(e) => setIng(i, "unit", e.target.value)} placeholder="كجم" maxLength={20} /></Field>
                      <Field label="النسبة %">
                        <Input type="number" step="any" value={ing.percentage ?? ""}
                          onChange={(e) => setIng(i, "percentage", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                      </Field>
                      <Field label="حد أدنى %">
                        <Input type="number" step="any" value={ing.min_percent ?? ""}
                          onChange={(e) => setIng(i, "min_percent", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                      </Field>
                      <Field label="حد أقصى %">
                        <Input type="number" step="any" value={ing.max_percent ?? ""}
                          onChange={(e) => setIng(i, "max_percent", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                      </Field>
                      <Field label="التكلفة">
                        <Input type="number" step="any" value={ing.cost ?? ""}
                          onChange={(e) => setIng(i, "cost", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                      </Field>
                      <Field label="تاريخ الانتهاء">
                        <Input type="date" value={ing.expiry_date ?? ""} onChange={(e) => setIng(i, "expiry_date", e.target.value)} />
                      </Field>
                      <Field label="ظروف التخزين">
                        <Input value={ing.storage_conditions ?? ""} onChange={(e) => setIng(i, "storage_conditions", e.target.value)} placeholder="مبرد / جاف" />
                      </Field>
                      <Field label="المواصفة القياسية" className="md:col-span-3">
                        <Input value={ing.standard_spec ?? ""} onChange={(e) => setIng(i, "standard_spec", e.target.value)} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                لو كمية الأساس 100 كجم، أدخل كل الخامات المطلوبة لتصنيع 100 كجم — والحاسبة ستضبطها تلقائيًا لأي كمية.
              </p>
            </div>
          )}

          {tab === "recipe" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">خطوات التصنيع بالترتيب</p>
                <Button type="button" size="sm" variant="outline" onClick={addStep}>
                  <Plus className="size-4" /> إضافة خطوة
                </Button>
              </div>
              <div className="space-y-3">
                {steps.length === 0 && <p className="text-center text-sm text-slate-500 py-6">لا توجد خطوات بعد.</p>}
                {steps.map((s, i) => (
                  <div key={i} className="rounded-lg border bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold">{i + 1}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveStep(i, -1)} className="p-1 rounded hover:bg-white" aria-label="لأعلى"><ChevronUp className="size-4" /></button>
                        <button type="button" onClick={() => moveStep(i, 1)} className="p-1 rounded hover:bg-white" aria-label="لأسفل"><ChevronDown className="size-4" /></button>
                        <button type="button" onClick={() => removeStep(i)} className="p-1 rounded text-rose-500 hover:bg-white" aria-label="حذف"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Field label="وصف الخطوة *" className="md:col-span-3">
                        <Textarea rows={2} value={s.description} onChange={(e) => setStep(i, "description", e.target.value)} placeholder="مثال: خلط السكر مع الماء" />
                      </Field>
                      <Field label="الخامة"><Input value={s.ingredient_ref ?? ""} onChange={(e) => setStep(i, "ingredient_ref", e.target.value)} /></Field>
                      <Field label="الكمية"><Input value={s.quantity ?? ""} onChange={(e) => setStep(i, "quantity", e.target.value)} placeholder="10 كجم" /></Field>
                      <Field label="سرعة التقليب"><Input value={s.stir_speed ?? ""} onChange={(e) => setStep(i, "stir_speed", e.target.value)} placeholder="150 rpm" /></Field>
                      <Field label="مدة التقليب"><Input value={s.stir_time ?? ""} onChange={(e) => setStep(i, "stir_time", e.target.value)} placeholder="15 دقيقة" /></Field>
                      <Field label="درجة الحرارة"><Input value={s.temperature ?? ""} onChange={(e) => setStep(i, "temperature", e.target.value)} placeholder="85°C" /></Field>
                      <Field label="الضغط"><Input value={s.pressure ?? ""} onChange={(e) => setStep(i, "pressure", e.target.value)} placeholder="2 bar" /></Field>
                      <Field label="ملاحظات" className="md:col-span-3">
                        <Textarea rows={2} value={s.notes ?? ""} onChange={(e) => setStep(i, "notes", e.target.value)} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-indigo-50/40 p-3">
                <div className="text-sm font-semibold text-indigo-900 mb-2">بارامترات عامة</div>
                <div className="grid gap-2 md:grid-cols-3">
                  <Field label="زمن البسترة"><Input value={params.pasteurization_time ?? ""} onChange={(e) => setParamField("pasteurization_time", e.target.value)} placeholder="15 ثانية / 90°C" /></Field>
                  <Field label="زمن التبريد"><Input value={params.cooling_time ?? ""} onChange={(e) => setParamField("cooling_time", e.target.value)} placeholder="30 دقيقة" /></Field>
                  <Field label="نقطة التعبئة"><Input value={params.filling_point ?? ""} onChange={(e) => setParamField("filling_point", e.target.value)} placeholder="4°C" /></Field>
                  <Field label="تعليمات خاصة" className="md:col-span-3">
                    <Textarea rows={2} value={params.special_instructions ?? ""} onChange={(e) => setParamField("special_instructions", e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
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

function FormTabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}>
      {icon} {children}
    </button>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function ImageUploadField({ value, onChange, userId }: { value: string; onChange: (v: string) => void; userId: string }) {
  const [uploading, setUploading] = useState(false);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    setUploading(true);
    try {
      const ref = await uploadProductImage(f, userId);
      onChange(ref);
      toast.success("تم رفع الصورة");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {value ? (
          <ProductImage src={value} alt="preview" className="w-14 h-14 rounded-md object-cover border"
            fallbackClassName="w-14 h-14 rounded-md bg-slate-100 grid place-items-center border" />
        ) : (
          <div className="w-14 h-14 rounded-md bg-slate-100 grid place-items-center border">
            <ImageIcon className="size-5 text-slate-400" />
          </div>
        )}
        <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
          <Upload className="size-4" /> {uploading ? "جارٍ الرفع..." : "رفع صورة"}
          <input type="file" accept="image/*" onChange={onFile} className="hidden" disabled={uploading} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-rose-600 hover:underline">إزالة</button>
        )}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="أو الصق رابط https://..." />
    </div>
  );
}