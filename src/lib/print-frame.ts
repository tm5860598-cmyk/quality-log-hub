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

/** Same-origin CSS as text, with `@media print` blocks turned into always-on rules (for the on-screen print tab). */
function cssForScreen(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin (fonts): linked separately
    for (const r of Array.from(rules)) {
      if (r instanceof CSSMediaRule && /print/.test(r.conditionText || r.media.mediaText)) {
        const inner = Array.from(r.cssRules).filter((x) => !(x instanceof CSSPageRule)).map((x) => x.cssText).join("\n");
        out.push(`@media all {${inner}}`);
        for (const x of Array.from(r.cssRules)) if (x instanceof CSSPageRule) out.push(x.cssText); // paper size, margins, page numbers
      } else out.push(r.cssText);
    }
  }
  return out.join("\n");
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
  // The tab is a real blob: document (not about:blank + document.write): Safari/in-app browsers only honour
  // window.print() reliably on a normally loaded page, and the page's own script owns the button.
  if (popup && !popup.closed) {
    try {
      const fonts = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).filter((l) => { try { return !(l as HTMLLinkElement).sheet?.cssRules; } catch { return true; } }).map((l) => `<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`).join("");
      const tab =
        `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=794">` +
        `<base href="${location.origin}/">` +
        `<title>${document.title.replace(/</g, "&lt;")}</title>${fonts}<style>${cssForScreen()}</style>` +
        `<style>html,body{background:#E2E8F0!important;min-width:0!important}` +
        `html body .pbar.pbar{display:block!important;position:sticky;top:0;z-index:9;background:#0F172A;padding:10px;text-align:center}` +
        `.pbar button{font:700 16px Tahoma,Arial;padding:10px 22px;border-radius:10px;border:0;background:#fff;cursor:pointer}` +
        `@media screen{.print-root{background:#fff!important;padding:14mm!important;margin:12px auto!important;box-shadow:0 2px 14px rgba(15,23,42,.18);box-sizing:content-box!important}}` +
        `@media print{html body .pbar.pbar{display:none!important}.print-root{padding:0!important;margin:0 auto!important;box-shadow:none!important}}</style></head>` +
        `<body><div class="pbar"><button type="button" id="pbtn">طباعة / حفظ PDF</button></div>${root.outerHTML}` +
        `<script>document.getElementById("pbtn").addEventListener("click",function(){window.print()});` +
        `window.addEventListener("load",function(){setTimeout(function(){try{window.print()}catch(e){}},900)});</script></body></html>`;
      const url = URL.createObjectURL(new Blob([tab], { type: "text/html;charset=utf-8" }));
      popup.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 30 * 60 * 1000);
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
