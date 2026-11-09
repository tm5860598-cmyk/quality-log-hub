/**
 * Prints the standalone `.print-root` report from an isolated A4-sized iframe.
 *
 * Printing the app page itself breaks on phones: iOS/Android snapshot the narrow mobile layout,
 * so the fixed-width report is clipped, and any state reset right after `window.print()` returns
 * changes what the preview shows (e.g. a single Q&A turning back into the whole chat).
 * The iframe gets a frozen copy of the report and its own A4 viewport.
 */
export const isMobileBrowser = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

/** Must be called synchronously inside the click handler (popups are blocked after an await). */
export function openPrintWindow(): Window | null {
  if (!isMobileBrowser()) return null;
  try { return window.open("", "_blank"); } catch { return null; }
}

export async function printReport(popup: Window | null = openPrintWindow()): Promise<void> {
  const root = document.querySelector<HTMLElement>(".print-root");
  if (!root) { popup?.close(); window.print(); return; }

  const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => {
      const el = n.cloneNode(true) as HTMLElement;
      if (el instanceof HTMLLinkElement) el.href = el.href; // absolute URL inside srcdoc
      return el.outerHTML;
    })
    .join("\n");
  const html =
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=794"><title>${document.title.replace(/</g, "&lt;")}</title>${styles}</head>` +
    `<body style="margin:0;background:#fff">${root.outerHTML}</body></html>`;

  // Phones: iOS/Android print the top document and ignore iframes, so use a dedicated tab with an A4 viewport.
  if (popup && !popup.closed) {
    try {
      const d = popup.document;
      d.open();
      d.write(html.replace("</head>", `<style>@media screen{.print-root{display:block!important;width:auto!important;max-width:170mm;margin:0 auto!important;padding:12px}.pbar{position:sticky;top:0;background:#0f172a;padding:10px;text-align:center}.pbar button{font:700 16px Tahoma,Arial;padding:10px 22px;border-radius:10px;border:0;background:#fff}}</style></head>`).replace("<body", "<body").replace(/(<body[^>]*>)/, `$1<div class="pbar"><button onclick="print()">طباعة / حفظ PDF</button></div>`));
      d.close();
      await new Promise((r) => setTimeout(r, 700));
      try { await d.fonts?.ready; } catch { /* ignore */ }
      await Promise.all(Array.from(d.images).map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }))));
      popup.focus();
      popup.print();
      return;
    } catch { try { popup.close(); } catch { /* ignore */ } }
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;pointer-events:none";
  const loaded = new Promise<void>((res) => { frame.onload = () => res(); });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  let cleaned = false;
  const cleanup = () => { if (!cleaned) { cleaned = true; frame.remove(); } };
  try {
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 8000))]);
    const win = frame.contentWindow, doc = frame.contentDocument;
    if (!win || !doc) throw new Error("print frame unavailable");
    try { await doc.fonts?.ready; } catch { /* ignore */ }
    await Promise.all(Array.from(doc.images).map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }))));
    win.addEventListener("afterprint", () => setTimeout(cleanup, 500), { once: true });
    setTimeout(cleanup, 10 * 60 * 1000); // iOS may not fire afterprint
    win.focus();
    win.print();
  } catch {
    cleanup();
    window.print(); // last resort: print the page itself
  }
}
