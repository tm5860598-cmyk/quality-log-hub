/**
 * Prints the standalone `.print-root` report.
 *
 * Desktop: from an isolated A4-sized iframe holding a frozen copy of the report, so the chosen scope
 * (e.g. one question and its answer) cannot change while the browser builds the preview.
 *
 * Phones: iframes and new tabs are unreliable (iOS prints the parent page, in-app browsers block popups
 * or ignore print() in them), so the page itself is printed. The only problem there is that phones lay the
 * page out at ~390px and clip the fixed-width A4 report, so the viewport is widened to A4 width for the
 * duration of the print and restored afterwards.
 */
export const isMobileBrowser = () =>
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

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

async function printMainPage(): Promise<void> {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const created = !meta;
  const previous = meta?.getAttribute("content") ?? null;
  if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
  meta.setAttribute("content", `width=${A4_PX}, initial-scale=1`);

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    window.removeEventListener("afterprint", restore);
    window.removeEventListener("touchstart", restore);
    if (created) meta!.remove();
    else if (previous !== null) meta!.setAttribute("content", previous);
  };
  window.addEventListener("afterprint", restore);
  window.addEventListener("touchstart", restore, { passive: true });
  setTimeout(restore, 120_000);

  await settle(document, 450); // let the browser re-layout at the A4 width before the snapshot is taken
  window.print();
}

export async function printReport(_popup: Window | null = null): Promise<void> {
  const root = document.querySelector<HTMLElement>(".print-root");
  if (!root) { window.print(); return; }

  if (isMobileBrowser()) { await printMainPage(); return; }

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
