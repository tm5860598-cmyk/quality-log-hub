import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";
import { resolveReportLogo, useReportSettings } from "@/lib/report-settings";

export type PrintMeta = { label: string; value: string };

export function PrintReport({ title, department, reportNumber, product, meta, children }: {
  title?: string;
  department?: string;
  reportNumber?: string;
  product?: string;
  meta?: PrintMeta[];
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { username } = useAuth();
  const { settings } = useReportSettings();
  const printedAt = new Date().toLocaleString("ar-EG");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let alive = true;
    void resolveReportLogo(settings.show_logo ? settings.logo_path : null).then((url) => { if (alive) setLogoUrl(url); });
    return () => { alive = false; };
  }, [settings.logo_path, settings.show_logo]);
  if (!mounted) return null;

  const rows: PrintMeta[] = [
    { label: "التاريخ", value: printedAt },
    { label: "رقم التقرير", value: reportNumber || "—" },
    { label: "القسم", value: department || "—" },
    { label: "المنتج", value: product || "—" },
    { label: "اسم المستخدم", value: username || "مستخدم غير معروف" },
    ...(meta ?? []),
  ];

  return createPortal(
    <div className={`print-root print-style-${settings.style_mode}`} dir="rtl" aria-hidden="true">
      <header className="print-report-head">
        {logoUrl && <img className="print-company-logo" src={logoUrl} alt="" />}
        <div className="print-report-identity">
          <div className="print-company-name">{settings.company_name}</div>
          <h1>{title || settings.default_report_title}</h1>
          {department && <div className="print-department-name">{department}</div>}
          {settings.show_company_data && settings.company_extra_data && (
            <div className="print-company-data">{settings.company_extra_data}</div>
          )}
        </div>
      </header>
      <table className="print-meta"><tbody>
        {Array.from({ length: Math.ceil(rows.length / 2) }, (_, index) => {
          const first = rows[index * 2];
          const second = rows[index * 2 + 1];
          return <tr key={`${first.label}-${index}`}><th>{first.label}</th><td>{first.value}</td>{second ? <><th>{second.label}</th><td>{second.value}</td></> : <><th /><td /></>}</tr>;
        })}
      </tbody></table>
      <main className="print-report-body rich-content">{children}</main>
      <PrintedBy username={username} printedAt={printedAt} />
      <footer className="print-report-foot"><span>{settings.company_name} · {username || "مستخدم غير معروف"}</span><span>صفحة <span className="print-page-number" /></span></footer>
    </div>,
    document.body,
  );
}

export function PrintedBy({ username, printedAt }: { username?: string; printedAt?: string }) {
  const { username: current } = useAuth();
  const name = username || current || "مستخدم غير معروف";
  return <div className="print-signature">تمت الطباعة بواسطة: <strong>{name}</strong><br />تاريخ ووقت الطباعة: {printedAt || new Date().toLocaleString("ar-EG")}</div>;
}