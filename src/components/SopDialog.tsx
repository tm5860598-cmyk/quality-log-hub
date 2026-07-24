import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";

type Ing = { name: string; amount: number; unit: string; code?: string; supplier?: string; percentage?: number };
type Step = { order: number; description: string; ingredient_ref?: string; quantity?: string; stir_speed?: string; stir_time?: string; temperature?: string; pressure?: string; notes?: string };
type Params = { pasteurization_time?: string; cooling_time?: string; filling_point?: string; special_instructions?: string };
type Spec = { ph?: string; brix?: string; viscosity?: string; net_weight?: string; shelf_life?: string; storage?: string; allergens?: string; standard_spec?: string };

export function SopDialog({
  open, onClose, kind, product, qty,
}: {
  open: boolean; onClose: () => void; kind: "sop" | "bmr";
  product: {
    name: string; code: string | null; product_type: string | null; package_size: string | null;
    base_quantity: number; base_unit: string; ingredients: Ing[]; recipe: { steps: Step[]; parameters: Params }; spec: Spec;
  };
  qty: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const factor = product.base_quantity > 0 ? qty / product.base_quantity : 0;
  const scaled = product.ingredients.map((i) => ({ ...i, total: +(i.amount * factor).toFixed(3) }));
  const isSop = kind === "sop";
  const title = isSop ? "Standard Operating Procedure (SOP)" : "Batch Manufacturing Record (BMR)";
  const arTitle = isSop ? "إجراء تشغيل قياسي" : "سجل تصنيع الدفعة";
  const batchNo = `BMR-${Date.now().toString().slice(-8)}`;
  const today = new Date().toLocaleDateString("ar-EG");

  const doPrint = () => {
    const html = ref.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<html dir="rtl"><head><title>${title}</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:16px 0 6px;color:#4338ca;border-bottom:1px solid #e2e8f0;padding-bottom:2px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #cbd5e1;padding:6px;text-align:right} th{background:#f1f5f9}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}
      .box{border:1px solid #cbd5e1;padding:6px 8px;border-radius:4px;background:#f8fafc}
      .sign{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;font-size:12px}
      .sign>div{border-top:1px solid #94a3b8;padding-top:6px;text-align:center}
      ol{padding-right:20px} li{margin-bottom:6px}
    </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3">
          <h3 className="font-bold">{arTitle} — {product.name}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/20"><X className="size-5" /></button>
        </div>
        <div ref={ref} className="p-6 space-y-4 text-sm">
          <div className="text-center">
            <h1 className="text-xl font-extrabold">{title}</h1>
            <p className="text-slate-600 text-xs mt-1">{arTitle}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="box border rounded p-2 bg-slate-50"><b>المنتج:</b> {product.name}</div>
            <div className="box border rounded p-2 bg-slate-50"><b>الكود:</b> {product.code ?? "—"}</div>
            <div className="box border rounded p-2 bg-slate-50"><b>النوع:</b> {product.product_type ?? "—"}</div>
            <div className="box border rounded p-2 bg-slate-50"><b>حجم العبوة:</b> {product.package_size ?? "—"}</div>
            {!isSop && <div className="box border rounded p-2 bg-slate-50"><b>رقم الدفعة:</b> {batchNo}</div>}
            <div className="box border rounded p-2 bg-slate-50"><b>التاريخ:</b> {today}</div>
            <div className="box border rounded p-2 bg-slate-50"><b>الكمية المستهدفة:</b> {qty} {product.base_unit}</div>
            <div className="box border rounded p-2 bg-slate-50"><b>معامل التحويل:</b> × {factor.toFixed(3)}</div>
          </div>

          <h2>1. المواصفات القياسية</h2>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {product.spec.ph && <div className="box border rounded p-2 bg-slate-50"><b>pH:</b> {product.spec.ph}</div>}
            {product.spec.brix && <div className="box border rounded p-2 bg-slate-50"><b>Brix:</b> {product.spec.brix}</div>}
            {product.spec.viscosity && <div className="box border rounded p-2 bg-slate-50"><b>اللزوجة:</b> {product.spec.viscosity}</div>}
            {product.spec.net_weight && <div className="box border rounded p-2 bg-slate-50"><b>الوزن الصافي:</b> {product.spec.net_weight}</div>}
            {product.spec.shelf_life && <div className="box border rounded p-2 bg-slate-50"><b>الصلاحية:</b> {product.spec.shelf_life}</div>}
            {product.spec.storage && <div className="box border rounded p-2 bg-slate-50"><b>التخزين:</b> {product.spec.storage}</div>}
            {product.spec.allergens && <div className="box border rounded p-2 bg-slate-50 col-span-2"><b>Allergens:</b> {product.spec.allergens}</div>}
          </div>

          <h2>2. الخامات المطلوبة</h2>
          <table>
            <thead><tr><th>#</th><th>الخامة</th><th>الكود</th><th>المورد</th><th>الكمية</th><th>الوحدة</th><th>{isSop ? "%" : "الفعلي"}</th></tr></thead>
            <tbody>
              {scaled.map((i, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td><td>{i.name}</td><td>{i.code ?? "—"}</td><td>{i.supplier ?? "—"}</td>
                  <td><b>{i.total}</b></td><td>{i.unit}</td>
                  <td>{isSop ? (i.percentage != null ? `${i.percentage}%` : "—") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>3. خطوات التصنيع</h2>
          {product.recipe.steps.length === 0 ? (
            <p className="text-slate-500">لم تُدخل خطوات تصنيع.</p>
          ) : (
            <ol>
              {[...product.recipe.steps].sort((a, b) => a.order - b.order).map((s, i) => (
                <li key={i}>
                  <b>{s.description}</b>
                  <div className="text-xs text-slate-600 mt-1">
                    {[
                      s.ingredient_ref && `الخامة: ${s.ingredient_ref}`,
                      s.quantity && `الكمية: ${s.quantity}`,
                      s.stir_speed && `سرعة: ${s.stir_speed}`,
                      s.stir_time && `مدة: ${s.stir_time}`,
                      s.temperature && `حرارة: ${s.temperature}`,
                      s.pressure && `ضغط: ${s.pressure}`,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  {!isSop && <div className="text-xs mt-1">✅ نُفذت — الساعة: __________ · بواسطة: __________</div>}
                  {s.notes && <div className="text-xs text-slate-500 mt-1">ملاحظات: {s.notes}</div>}
                </li>
              ))}
            </ol>
          )}

          <h2>4. بارامترات العملية</h2>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {product.recipe.parameters.pasteurization_time && <div className="box border rounded p-2 bg-slate-50"><b>البسترة:</b> {product.recipe.parameters.pasteurization_time}</div>}
            {product.recipe.parameters.cooling_time && <div className="box border rounded p-2 bg-slate-50"><b>التبريد:</b> {product.recipe.parameters.cooling_time}</div>}
            {product.recipe.parameters.filling_point && <div className="box border rounded p-2 bg-slate-50"><b>نقطة التعبئة:</b> {product.recipe.parameters.filling_point}</div>}
          </div>
          {product.recipe.parameters.special_instructions && (
            <div className="box border rounded p-2 bg-amber-50 border-amber-200"><b>تعليمات خاصة:</b> {product.recipe.parameters.special_instructions}</div>
          )}

          {!isSop && (
            <>
              <h2>5. سجل الفحوصات أثناء التصنيع</h2>
              <table>
                <thead><tr><th>الاختبار</th><th>الحد الأدنى</th><th>الحد الأقصى</th><th>القيمة الفعلية</th><th>الوقت</th><th>الفني</th></tr></thead>
                <tbody>
                  {["pH","Brix","Temperature","Viscosity"].map((k) => (
                    <tr key={k}><td>{k}</td><td></td><td></td><td></td><td></td><td></td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="sign grid grid-cols-3 gap-4 mt-8 text-xs">
            <div className="border-t pt-2 text-center">مهندس الإنتاج</div>
            <div className="border-t pt-2 text-center">مهندس الجودة</div>
            <div className="border-t pt-2 text-center">مدير المصنع</div>
          </div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 bg-white border-t p-3">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={doPrint} className="bg-indigo-600 text-white hover:bg-indigo-700">
            <Printer className="size-4" /> طباعة / حفظ PDF
          </Button>
        </div>
      </div>
    </div>
  );
}