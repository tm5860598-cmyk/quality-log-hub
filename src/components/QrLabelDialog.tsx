import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { escapePrintHtml, loadReportSettings, resolveReportLogo } from "@/lib/report-settings";

export function QrLabelDialog({
  open, onClose, title, subtitle, payload,
}: { open: boolean; onClose: () => void; title: string; subtitle?: string; payload: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);
  const { username } = useAuth();
  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(payload, { width: 512, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [open, payload]);
  if (!open) return null;

  const doPrint = async () => {
    const html = printRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=520,height=640");
    if (!w) return;
    const settings = await loadReportSettings();
    const logoUrl = settings.show_logo ? await resolveReportLogo(settings.logo_path) : null;
    w.document.write(`<html dir="rtl"><head><title>${title}</title><style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;text-align:center;color:#0f172a}
      .brand-logo{width:58px;height:58px;object-fit:contain}.brand{font-size:16px;font-weight:700;margin:4px}
      img{width:340px;height:340px}
      h2{margin:12px 0 4px;font-size:20px}
      p{margin:2px 0;color:#475569;font-size:14px}
      .code{font-family:monospace;font-size:13px;word-break:break-all;margin-top:8px;color:#64748b}
    </style></head><body>${logoUrl ? `<img class="brand-logo" src="${escapePrintHtml(logoUrl)}" alt="">` : ""}<div class="brand">${escapePrintHtml(settings.company_name)}</div>${html}<small>طُبع بواسطة: ${escapePrintHtml(username || "مستخدم غير معروف")}</small></body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3">
          <h3 className="font-bold">ملصق QR للمنتج</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/20"><X className="size-5" /></button>
        </div>
        <div ref={printRef} className="p-6 text-center">
          {dataUrl ? (
            <img src={dataUrl} alt="QR" className="mx-auto w-64 h-64" />
          ) : (
            <div className="mx-auto w-64 h-64 grid place-items-center text-slate-400">جاري التوليد...</div>
          )}
          <h2 className="mt-3 text-lg font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
          <p className="code mt-2 text-xs font-mono text-slate-500 break-all">{payload}</p>
        </div>
        <div className="flex justify-end gap-2 border-t p-3">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={doPrint} className="bg-indigo-600 text-white hover:bg-indigo-700">
            <Printer className="size-4" /> طباعة الملصق
          </Button>
        </div>
      </div>
    </div>
  );
}