import { metricBatchSchema } from "../src/lib/telemetry-contract";

export function telemetryHandler(options: { authenticate: (token: string) => Promise<boolean>; log: (value: unknown) => void }) {
  let tokens = 120;
  let last = Date.now();
  return async (request: Request) => {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    tokens = Math.min(120, tokens + (Date.now() - last) / 1000); last = Date.now();
    if (tokens < 1) return new Response(null, { status: 429 });
    tokens--;
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) return new Response(null, { status: 401 });
    try {
      if (!await options.authenticate(bearer.slice(7))) return new Response(null, { status: 401 });
      const reader = request.body?.getReader();
      if (!reader) return new Response(null, { status: 400 });
      let body = ""; let bytes = 0; const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 16384) { await reader.cancel(); return new Response(null, { status: 413 }); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      const parsed = metricBatchSchema.safeParse(JSON.parse(body));
      if (!parsed.success) return new Response(null, { status: 400 });
      options.log({ type: "bindernotes_operations", metrics: parsed.data.metrics });
      return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
    } catch { return new Response(null, { status: 400 }); }
  };
}
