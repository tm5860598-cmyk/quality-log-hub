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
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${escapePrintHtml(options.title)}</title><style>
    @page{size:A4;margin:28mm 14mm 20mm}*{box-sizing:border-box}body{margin:0;color:#111;font-family:Tahoma,Arial,sans-serif;font-size:11pt;line-height:1.55}
    .head{display:flex;align-items:center;gap:14px;border-bottom:${settings.style_mode === "formal" ? "3px double #222" : "1px solid #777"};padding-bottom:10px;margin-bottom:12px}.logo{width:68px;height:68px;object-fit:contain}.identity{flex:1;text-align:center}.identity h1{margin:0;font-size:18pt}.identity h2{margin:3px 0;font-size:14pt}.company-data{white-space:pre-line;font-size:9pt;color:#444}
    .meta{width:100%;border-collapse:collapse;margin:0 0 14px;font-size:9.5pt}.meta th,.meta td{border:1px solid #777;padding:4px 6px;text-align:right}.meta th{background:#eee;width:16%}
    table{width:100%;border-collapse:collapse;font-size:10pt}thead{display:table-header-group}tfoot{display:table-footer-group}tr,img,.sign,.box{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #777;padding:5px;text-align:right;vertical-align:top}th{background:#e7e7e7}h1,h2,h3{break-after:avoid}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.box{border:1px solid #aaa;padding:6px}.sign{margin-top:18px;padding-top:8px;border-top:1px dashed #777;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.sign>div{border-top:1px solid #777;padding-top:5px;text-align:center}ol{padding-right:22px}.foot{position:fixed;bottom:-14mm;right:0;left:0;border-top:1px solid #aaa;padding-top:4px;font-size:8.5pt;display:flex;justify-content:space-between}.page:after{content:counter(page)}
  </style></head><body><header class="head">${logoUrl ? `<img class="logo" src="${escapePrintHtml(logoUrl)}" alt="">` : ""}<div class="identity"><h1>${escapePrintHtml(settings.company_name)}</h1><h2>${escapePrintHtml(options.title || settings.default_report_title)}</h2>${options.department ? `<div>${escapePrintHtml(options.department)}</div>` : ""}${settings.show_company_data && settings.company_extra_data ? `<div class="company-data">${escapePrintHtml(settings.company_extra_data)}</div>` : ""}</div></header><table class="meta"><tbody>${meta.map(([label, value], i) => i % 2 === 0 ? `<tr><th>${label}</th><td>${escapePrintHtml(value)}</td>${meta[i + 1] ? `<th>${meta[i + 1][0]}</th><td>${escapePrintHtml(meta[i + 1][1])}</td>` : "<th></th><td></td>"}</tr>` : "").join("")}</tbody></table><main>${options.bodyHtml}</main><div class="sign">تمت الطباعة بواسطة: <b>${escapePrintHtml(options.username || "مستخدم غير معروف")}</b><br>تاريخ ووقت الطباعة: ${escapePrintHtml(printedAt)}</div><footer class="foot"><span>${escapePrintHtml(settings.company_name)} · ${escapePrintHtml(options.username || "مستخدم غير معروف")}</span><span>صفحة <span class="page"></span></span></footer></body></html>`;
}