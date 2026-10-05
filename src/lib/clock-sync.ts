/**
 * Computers with a wrong clock/time-zone make the auth client think every fresh
 * token is already expired, so it refreshes in a loop, hits the rate limit and
 * logs the user out. We measure the offset against the server and correct
 * Date.now() (used by the auth client for expiry checks).
 */
let synced: Promise<void> | null = null;

export function syncClock(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (synced) return synced;
  synced = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const t0 = Date.now();
      const res = await fetch("/api/public/time", { cache: "no-store", signal: ctrl.signal });
      const t1 = Date.now();
      clearTimeout(timer);
      if (!res.ok) return;
      const { now } = (await res.json()) as { now: number };
      const offset = now - (t0 + t1) / 2;
      if (Math.abs(offset) < 30_000) return;
      console.warn(`[clock-sync] device clock off by ${Math.round(offset / 1000)}s — correcting`);
      const orig = Date.now.bind(Date);
      Date.now = () => orig() + offset;
    } catch {
      // network issue: keep device clock
    }
  })();
  return synced;
}
