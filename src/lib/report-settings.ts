import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ReportStyle = "formal" | "simple";
export type ReportSettings = {
  id: string | null;
  company_name: string;
  logo_path: string | null;
  default_report_title: string;
  company_extra_data: string | null;
  show_logo: boolean;
  show_company_data: boolean;
  style_mode: ReportStyle;
};

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  id: null,
  company_name: "My Favourite Project",
  logo_path: null,
  default_report_title: "تقرير رسمي",
  company_extra_data: null,
  show_logo: true,
  show_company_data: true,
  style_mode: "formal",
};

let cached: ReportSettings | null = null;
const listeners = new Set<(settings: ReportSettings) => void>();

export async function loadReportSettings(): Promise<ReportSettings> {
  const { data, error } = await supabase.from("report_settings").select("*").maybeSingle();
  if (error) throw error;
  cached = data ? { ...DEFAULT_REPORT_SETTINGS, ...data } as ReportSettings : DEFAULT_REPORT_SETTINGS;
  listeners.forEach((listener) => listener(cached as ReportSettings));
  return cached;
}

export function clearReportSettingsCache() {
  cached = null;
}

export function useReportSettings() {
  const [settings, setSettings] = useState<ReportSettings>(cached ?? DEFAULT_REPORT_SETTINGS);
  const [loading, setLoading] = useState(cached === null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setSettings(await loadReportSettings()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    listeners.add(setSettings);
    if (!cached) void reload();
    return () => { listeners.delete(setSettings); };
  }, [reload]);

  return { settings, loading, reload };
}

export async function resolveReportLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("report-branding").createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function uploadReportLogo(file: File, userId: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/company-logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("report-branding").upload(path, file, {
    cacheControl: "3600", contentType: file.type || undefined, upsert: false,
  });
  if (error) throw error;
  return path;
}

export function escapePrintHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

const CAIRO_FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">`;

export async function buildStandalonePrintDocument(options: {
  title: string;
  department?: string;
  reportNumber?: string;
  product?: string;
  username?: string;
  bodyHtml: string;
}) {
  const settings = cached ?? await loadReportSettings();
  const logoUrl = settings.show_logo ? await resolveReportLogo(settings.logo_path) : null;
  const printedAt = new Date().toLocaleString("ar-EG");
  const meta = [
    ["التاريخ", printedAt], ["رقم التقرير", options.reportNumber || "—"],
    ["القسم", options.department || "—"], ["المنتج", options.product || "—"],
    ["اسم المستخدم", options.username || "مستخدم غير معروف"],
  ];
  const formal = settings.style_mode === "formal";
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapePrintHtml(options.title)}</title>${CAIRO_FONT_LINKS}<style>
    @page{size:A4;margin:2cm}
    *{box-sizing:border-box}
    body{margin:0;color:#334155;font-family:Cairo,Tahoma,Arial,sans-serif;font-size:11pt;font-weight:400;line-height:1.8}
    .watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64pt;font-weight:800;letter-spacing:4pt;color:rgba(100,116,139,.10);white-space:nowrap;z-index:-1;pointer-events:none}
    .head{display:flex;align-items:center;gap:14px;border-bottom:${formal ? "3px double #222" : "1px solid #777"};padding-bottom:10px;margin-bottom:12px}
    .logo{width:68px;height:68px;object-fit:contain}
    .identity{flex:1;text-align:center}
    .identity h1{margin:0;font-size:16pt;font-weight:800;color:#000;font-family:Cairo,Tahoma,Arial,sans-serif}
    .identity h2{margin:3px 0;font-size:14pt;font-weight:700;color:#1E293B;font-family:Cairo,Tahoma,Arial,sans-serif}
    .datetime{font-size:9pt;color:#475569;margin-top:2px}
    .company-data{white-space:pre-line;font-size:9pt;color:#475569}
    .meta{width:100%;border-collapse:collapse;margin:0 0 14px;font-size:9.5pt}
    .meta th,.meta td{border:1px solid #000;padding:4px 6px;text-align:right;color:#334155}
    .meta th{background:#F1F5F9;color:#0F172A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    main h1{font-size:22pt;font-weight:800;color:#000;font-family:Cairo,Tahoma,Arial,sans-serif;border-bottom:2px solid #000;padding-bottom:4pt;margin:14pt 0 8pt;break-before:page;page-break-before:always}
    main h1:first-child{break-before:auto;page-break-before:auto}
    main h2{font-size:14pt;font-weight:700;color:#1E293B;margin:12pt 0 6pt}
    main h3{font-size:12pt;font-weight:700;color:#1E293B}
    main p,main li{font-size:11pt;font-weight:400;color:#334155;line-height:1.8}
    table{width:100%;border-collapse:collapse;font-size:10.5pt}
    thead{display:table-header-group}tfoot{display:table-footer-group}
    tr,img,.sign,.box{break-inside:avoid;page-break-inside:avoid}
    th,td{border:1px solid #000;padding:5px;text-align:right;vertical-align:top;color:#000}
    th{background:#F1F5F9;color:#0F172A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1,h2,h3{break-after:avoid;page-break-after:avoid}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .box{border:1px solid #000;padding:6px}
    .sign{margin-top:18px;padding-top:8px;border-top:1px dashed #777;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;color:#334155}
    .sign>div{border-top:1px solid #000;padding-top:5px;text-align:center}
    ol{padding-right:22px}
    .foot{position:fixed;bottom:-14mm;right:0;left:0;border-top:1px solid #999;padding-top:4px;font-size:8.5pt;display:flex;justify-content:space-between;color:#334155}
    .page:after{content:counter(page)}
    .total:after{content:counter(pages)}
  </style></head><body><div class="watermark">NFSA Compliant</div><header class="head">${logoUrl ? `<img class="logo" src="${escapePrintHtml(logoUrl)}" alt="">` : ""}<div class="identity"><h1>${escapePrintHtml(settings.company_name)}</h1><h2>${escapePrintHtml(options.title || settings.default_report_title)}</h2><div class="datetime">التاريخ والوقت: ${escapePrintHtml(printedAt)}</div>${options.department ? `<div>${escapePrintHtml(options.department)}</div>` : ""}${settings.show_company_data && settings.company_extra_data ? `<div class="company-data">${escapePrintHtml(settings.company_extra_data)}</div>` : ""}</div></header><table class="meta"><tbody>${meta.map(([label, value], i) => i % 2 === 0 ? `<tr><th>${label}</th><td>${escapePrintHtml(value)}</td>${meta[i + 1] ? `<th>${meta[i + 1][0]}</th><td>${escapePrintHtml(meta[i + 1][1])}</td>` : "<th></th><td></td>"}</tr>` : "").join("")}</tbody></table><main>${options.bodyHtml}</main><div class="sign">تمت الطباعة بواسطة: <b>${escapePrintHtml(options.username || "مستخدم غير معروف")}</b><br>تاريخ ووقت الطباعة: ${escapePrintHtml(printedAt)}</div><footer class="foot"><span>تم إنشاء هذا التقرير من منصة ${escapePrintHtml(settings.company_name)} — مهندس طارق</span><span>صفحة <span class="page"></span> من <span class="total"></span></span></footer></body></html>`;
}