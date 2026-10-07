import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { escapePrintHtml, loadReportSettings, resolveReportLogo } from "@/lib/report-settings";
import { supabase } from "@/integrations/supabase/client";

export function QrLabelDialog({
  open, onClose, title, subtitle, productId,
}: { open: boolean; onClose: () => void; title: string; subtitle?: string; productId: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [payload, setPayload] = useState("");
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const { username } = useAuth();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataUrl(""); setPayload(""); setError("");
    (async () => {
      const { data: token, error: shareError } = await supabase.rpc("ensure_recipe_qr_share", { _product_id: productId });
      if (shareError || !token) throw new Error("تعذر إنشاء الرابط. تأكد من اتصالك وصلاحية عرض القسم.");
      const origin = window.location.hostname === "localhost" || window.location.hostname.startsWith("id-preview--") ? "https://tarekmohamed.lovable.app" : window.location.origin;
      const url = `${origin}/recipe/${token}`;
      const image = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      if (!cancelled) { setPayload(url); setDataUrl(image); }
    })().catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "تعذر إنشاء الرمز"); });
    return () => { cancelled = true; };
  }, [open, productId]);
  if (!open) return null;

  const doPrint = async () => {
    if (!dataUrl) return;
    const html = printRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=520,height=640");
    if (!w) return;
    const settings = await loadReportSettings();
    const logoUrl = settings.show_logo ? await resolveReportLogo(settings.logo_path) : null;
    w.document.write(`<html dir="rtl"><head><title>${escapePrintHtml(title)}</title><style>
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
      <div className="absolute inset-0 bg-foreground/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="ملصق QR للمنتج" className="relative w-full max-w-md rounded-lg bg-card text-card-foreground shadow-xl overflow-hidden max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between bg-primary text-primary-foreground px-5 py-3">
          <h3 className="font-bold">ملصق QR للمنتج</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق"><X className="size-5" /></Button>
        </div>
        <div ref={printRef} className="p-6 text-center">
          {dataUrl ? (
            <img src={dataUrl} alt="QR الوصفة" className="mx-auto size-64 max-w-full" />
          ) : (
            <div className="mx-auto w-64 h-64 max-w-full grid place-items-center text-muted-foreground">{error || "جاري التوليد..."}</div>
          )}
          <h2 className="mt-3 text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          {payload && <a href={payload} target="_blank" rel="noopener noreferrer" className="code block mt-2 text-xs font-mono text-muted-foreground break-all underline">{payload}</a>}
        </div>
        <div className="flex justify-end gap-2 border-t p-3">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={doPrint} disabled={!dataUrl}>
            <Printer className="size-4" /> طباعة الملصق
          </Button>
        </div>
      </div>
    </div>
  );
}