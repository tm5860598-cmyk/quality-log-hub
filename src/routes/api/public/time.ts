import { createFileRoute } from "@tanstack/react-router";

// Public, read-only: returns the server clock so the browser can correct a wrong device clock.
export const Route = createFileRoute("/api/public/time")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ now: Date.now() }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        }),
    },
  },
});
