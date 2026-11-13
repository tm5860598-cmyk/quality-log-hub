/**
 * Prints the standalone `.print-root` report.
 *
 * Desktop: from an isolated A4-sized iframe holding a frozen copy of the report, so the chosen scope
 * (e.g. one question and its answer) cannot change while the browser builds the preview.
 *
 * Phones: iframes and new tabs are unreliable (iOS prints the parent page, in-app browsers block popups
 * or ignore print() in them), so the page itself is printed; the report is fitted to the narrow layout by CSS.
 * Saving a real PDF file is a separate, always-working path: see pdf-export.ts.
 */
export const isMobileBrowser = () =>
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

/** Kept for callers that open a window inside the click handler; popups are no longer used. */
export function openPrintWindow(): Window | null {
  return null;
}

const A4_PX = 794; // 210mm at 96dpi

async function settle(root: ParentNode, ms: number) {
  await new Promise((r) => setTimeout(r, ms));
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }))));
}

export async function printReport(_popup: Window | null = null): Promise<void> {
  const root = document.querySelector<HTMLElement>(".print-root");
  if (!root) { window.print(); return; }

  // iPhone/iPad: Safari's print of the page itself is unreliable (clips, scales, splits blocks, shows page overlays),
  // so build the real PDF and hand it to the share sheet, whose "Print" action prints the file page by page.
  if (isIOS()) {
    try {
      const { toast } = await import("sonner");
      const { buildReportPdf, pdfFileName } = await import("./pdf-export");
      const id = toast.loading("جاري تجهيز الطباعة…");
      const blob = await buildReportPdf();
      const name = pdfFileName(document.title);
      const file = new File([blob], name, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); toast.dismiss(id); return; }
        catch (e) {
          if ((e as Error)?.name === "AbortError") { toast.dismiss(id); return; }
          // The tap's permission may have expired while the PDF was being built: ask for one more tap.
          toast("التقرير جاهز — اضغط ثم اختر «طباعة» (Print)", {
            id, duration: 60000,
            action: { label: "فتح القائمة", onClick: () => { void navigator.share({ files: [file], title: name }).catch(() => undefined); } },
          });
          return;
        }
      } else toast.dismiss(id);
    } catch { /* fall through to plain print */ }
  }

  // Phones: print the page itself (the print CSS fits the report to the narrow layout); no tabs, no viewport tricks.
  if (isMobileBrowser()) { await settle(document, 150); window.print(); return; }

  const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => {
      const el = n.cloneNode(true) as HTMLElement;
      if (el instanceof HTMLLinkElement) el.href = el.href; // absolute URL inside srcdoc
      return el.outerHTML;
    })
    .join("\n");
  const html =
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=${A4_PX}"><title>${document.title.replace(/</g, "&lt;")}</title>${styles}</head>` +
    `<body style="margin:0;background:#fff">${root.outerHTML}</body></html>`;

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
    await settle(doc, 50);
    win.addEventListener("afterprint", () => setTimeout(cleanup, 500), { once: true });
    setTimeout(cleanup, 10 * 60 * 1000);
    win.focus();
    win.print();
  } catch {
    cleanup();
    window.print(); // last resort: print the page itself
  }
}

/** "Save as PDF file" button helper (loaded on demand): builds the PDF locally and saves/shares it. */
export async function savePdf(title: string): Promise<void> {
  const { toast } = await import("sonner");
  const { exportReportPdf } = await import("./pdf-export");
  let id: string | number | undefined;
  await exportReportPdf(title, (msg, kind) => { id = kind === "info" ? toast.loading(msg, { id }) : kind === "success" ? toast.success(msg, { id }) : toast.error(msg, { id }); });
}
