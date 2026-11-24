/**
 * Network hardening for the voice engine's downloads (wasm + voice models).
 * Safari reports any interrupted/blocked download as a bare "Load failed". While the engine loads, window.fetch is
 * wrapped: a failed GET is retried (with backoff) and then tried on a mirror host, and the final error says which
 * host failed instead of "Load failed".
 */
const MIRRORS: Array<[RegExp, (m: RegExpMatchArray, u: URL) => string]> = [
  [/^cdn\.jsdelivr\.net$/, (_m, u) => `https://fastly.jsdelivr.net${u.pathname}${u.search}`],
  [/^cdn\.jsdelivr\.net$/, (_m, u) => `https://unpkg.com${u.pathname.replace(/^\/npm\//, "/")}${u.search}`],
  [/^huggingface\.co$/, (_m, u) => `https://hf-mirror.com${u.pathname}${u.search}`],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function installResilientFetch(): () => void {
  const original = window.fetch;
  const wrapped: typeof fetch = async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url: URL | null = null;
    try { url = new URL(urlStr, location.href); } catch { /* relative or invalid */ }
    // Only retry cross-origin GET downloads (engine files); app API calls keep their normal behaviour.
    if (method !== "GET" || !url || url.origin === location.origin || init?.signal?.aborted) return original(input, init);

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await original(input, init);
        if (res.ok || res.status < 500) return res;
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        lastErr = e;
      }
      await sleep(600 * (attempt + 1) ** 2);
    }
    for (const [host, build] of MIRRORS) {
      const m = url.hostname.match(host);
      if (!m) continue;
      try {
        const res = await original(build(m, url), init);
        if (res.ok) return res;
      } catch (e) { if ((e as Error)?.name === "AbortError") throw e; lastErr = e; }
    }
    const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(`تعذّر تحميل ملفات محرك الصوت من ${url.hostname} (${reason}). تأكد من اتصال الإنترنت ثم أعد المحاولة — يُحمَّل المحرك مرة واحدة فقط ثم يُحفظ في المتصفح.`);
  };
  window.fetch = wrapped;
  return () => { if (window.fetch === wrapped) window.fetch = original; };
}

/** Turns browser-level network errors into a message a person can act on. */
export function friendlyNetworkError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/^(load failed|failed to fetch|networkerror|network request failed|the network connection was lost)/i.test(msg.trim())) {
    return "انقطع تحميل ملفات المحرك أو تم حجبه (Load failed). تأكد من اتصال الإنترنت ثم اضغط توليد من جديد — يُحمَّل المحرك مرة واحدة فقط.";
  }
  return msg;
}
