import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

const emptyRow = (): Row => ({
  id: crypto.randomUUID(),
  problem: "",
  action: "",
  qualitySign: "",
  productionSign: "",
});

function Index() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);

  const updateRow = (id: string, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const handleSave = () => {
    const payload = { date, rows };
    localStorage.setItem(`report-${Date.now()}`, JSON.stringify(payload));
    toast.success("تم حفظ التقرير بنجاح");
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background p-6 print:p-0">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <h1 className="text-2xl font-bold text-foreground">تقرير المشاكل والإجراءات</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={addRow}>
              + إضافة صف
            </Button>
            <Button onClick={handleSave}>حفظ</Button>
            <Button variant="secondary" onClick={handlePrint}>
              طباعة
            </Button>
          </div>
        </div>

        <div dir="rtl" className="rounded-lg border border-border bg-card p-6 print:border-0 print:p-2">
          <div className="mb-4 hidden items-center justify-between print:flex">
            <h2 className="text-xl font-bold">تقرير المشاكل والإجراءات</h2>
            <span className="text-sm">التاريخ: {date}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 text-sm font-semibold w-12">#</th>
                  <th className="border border-border p-2 text-sm font-semibold">المشكلة</th>
                  <th className="border border-border p-2 text-sm font-semibold">الإجراء المتخذ</th>
                  <th className="border border-border p-2 text-sm font-semibold">إمضاء مهندس الجودة</th>
                  <th className="border border-border p-2 text-sm font-semibold">إمضاء مهندس الإنتاج</th>
                  <th className="border border-border p-2 text-sm font-semibold w-16 print:hidden">حذف</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="border border-border p-2 text-center text-sm">{idx + 1}</td>
                    <td className="border border-border p-1">
                      <Textarea
                        value={row.problem}
                        onChange={(e) => updateRow(row.id, "problem", e.target.value)}
                        rows={2}
                        className="min-h-[60px] resize-none border-0 shadow-none focus-visible:ring-0 print:bg-transparent"
                      />
                    </td>
                    <td className="border border-border p-1">
                      <Textarea
                        value={row.action}
                        onChange={(e) => updateRow(row.id, "action", e.target.value)}
                        rows={2}
                        className="min-h-[60px] resize-none border-0 shadow-none focus-visible:ring-0 print:bg-transparent"
                      />
                    </td>
                    <td className="border border-border p-1">
                      <Input
                        value={row.qualitySign}
                        onChange={(e) => updateRow(row.id, "qualitySign", e.target.value)}
                        className="border-0 shadow-none focus-visible:ring-0 print:bg-transparent"
                      />
                    </td>
                    <td className="border border-border p-1">
                      <Input
                        value={row.productionSign}
                        onChange={(e) => updateRow(row.id, "productionSign", e.target.value)}
                        className="border-0 shadow-none focus-visible:ring-0 print:bg-transparent"
                      />
                    </td>
                    <td className="border border-border p-2 text-center print:hidden">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-destructive hover:underline text-sm"
                      >
                        ×
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
