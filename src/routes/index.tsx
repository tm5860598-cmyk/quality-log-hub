import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Languages, Plus, Save, Printer, FileDown, Trash2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

type Row = {
  id: string;
  problem: string;
  action: string;
  qualitySign: string;
  productionSign: string;
};

let rowCounter = 0;
const emptyRow = (): Row => ({
  id: `row-${++rowCounter}`,
  problem: "",
  action: "",
  qualitySign: "",
  productionSign: "",
});

type Lang = "ar" | "en";

const T = {
  ar: {
    title: "تقرير المشاكل والإجراءات",
    date: "التاريخ",
    add: "إضافة صف",
    save: "حفظ",
    print: "طباعة",
    pdf: "تصدير PDF",
    lang: "English",
    num: "#",
    problem: "المشكلة",
    action: "الإجراء المتخذ",
    quality: "إمضاء مهندس الجودة",
    production: "إمضاء مهندس الإنتاج",
    del: "حذف",
    saved: "تم حفظ التقرير بنجاح",
    exported: "تم تصدير التقرير كـ PDF",
  },
  en: {
    title: "Problems & Actions Report",
    date: "Date",
    add: "Add Row",
    save: "Save",
    print: "Print",
    pdf: "Export PDF",
    lang: "عربي",
    num: "#",
    problem: "Problem",
    action: "Action Taken",
    quality: "Quality Engineer Signature",
    production: "Production Engineer Signature",
    del: "Delete",
    saved: "Report saved successfully",
    exported: "Report exported as PDF",
  },
} as const;

function Index() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [lang, setLang] = useState<Lang>("ar");
  const reportRef = useRef<HTMLDivElement>(null);
  const t = T[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  const updateRow = (id: string, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleSave = () => {
    const payload = { date, rows };
    localStorage.setItem(`report-${Date.now()}`, JSON.stringify(payload));
    toast.success(t.saved);
  };

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (!reportRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf()
      .set({
        margin: 10,
        filename: `${t.title}-${date}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      })
      .from(reportRef.current)
      .save();
    toast.success(t.exported);
  };

  return (
    <div
      dir={dir}
      className="min-h-screen p-6 print:p-0 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent">
            {t.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="border-indigo-200 bg-white/70 hover:bg-white"
            >
              <Languages className="size-4" /> {t.lang}
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44 bg-white/70"
            />
            <Button
              variant="outline"
              onClick={addRow}
              className="border-emerald-200 bg-white/70 hover:bg-emerald-50 text-emerald-700"
            >
              <Plus className="size-4" /> {t.add}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:opacity-90 text-white shadow-md"
            >
              <Save className="size-4" /> {t.save}
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:opacity-90 text-white shadow-md"
            >
              <Printer className="size-4" /> {t.print}
            </Button>
            <Button
              onClick={handlePdf}
              className="bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-90 text-white shadow-md"
            >
              <FileDown className="size-4" /> {t.pdf}
            </Button>
          </div>
        </div>

        <div
          ref={reportRef}
          dir={dir}
          className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur p-6 shadow-xl print:border-0 print:p-2 print:shadow-none print:bg-white"
        >
          <div className="mb-4 flex items-center justify-between border-b border-indigo-100 pb-3">
            <h2 className="text-xl font-bold text-indigo-900">{t.title}</h2>
            <span className="text-sm text-slate-600">
              {t.date}: <span className="font-semibold">{date}</span>
            </span>
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
                    <td className="border border-indigo-100 p-2 text-center text-sm font-semibold text-indigo-700">
                      {idx + 1}
                    </td>
                    <td className="border border-indigo-100 p-1">
                      <Textarea
                        value={row.problem}
                        onChange={(e) => updateRow(row.id, "problem", e.target.value)}
                        rows={2}
                        className="min-h-[60px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </td>
                    <td className="border border-indigo-100 p-1">
                      <Textarea
                        value={row.action}
                        onChange={(e) => updateRow(row.id, "action", e.target.value)}
                        rows={2}
                        className="min-h-[60px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </td>
                    <td className="border border-indigo-100 p-1">
                      <Input
                        value={row.qualitySign}
                        onChange={(e) => updateRow(row.id, "qualitySign", e.target.value)}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </td>
                    <td className="border border-indigo-100 p-1">
                      <Input
                        value={row.productionSign}
                        onChange={(e) => updateRow(row.id, "productionSign", e.target.value)}
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </td>
                    <td className="border border-indigo-100 p-2 text-center print:hidden">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-rose-500 hover:text-rose-700 transition"
                        aria-label={t.del}
                      >
                        <Trash2 className="size-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
