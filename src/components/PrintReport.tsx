import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a standalone, full-length print layout into document.body.
 * It is hidden on screen and is the ONLY thing printed (see print CSS in styles.css).
 * Because it lives outside every scroll container, the whole report is printed —
 * no screenshot, no viewport clipping, automatic multi-page pagination.
 */
export function PrintReport({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: Array<{ label: string; value: string }>;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="print-root" dir="rtl" aria-hidden="true">
      <header className="print-report-head">
        <h1>{title}</h1>
        {meta && meta.length > 0 && (
          <table className="print-meta">
            <tbody>
              {meta.map((m) => (
                <tr key={m.label}>
                  <th>{m.label}</th>
                  <td>{m.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </header>
      <main className="print-report-body rich-content">{children}</main>
      <footer className="print-report-foot">My Favourite Project — تقرير مطبوع آليًا</footer>
    </div>,
    document.body,
  );
}
