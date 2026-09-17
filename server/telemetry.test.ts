import { describe, expect, it, vi } from "vitest";
import { telemetryHandler } from "./telemetry";
const metric = {
  release: "development",
  correlation: crypto.randomUUID(),
  operation: "content_save",
  result: "failed",
  durationMs: 10,
  retryCount: 1,
  payloadBytes: 200,
};
const request = (body: unknown, token = "valid") =>
  new Request("https://app.test/api/telemetry", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
describe("metrics ingestion", () => {
  it("authenticates and logs only strictly validated fields", async () => {
    const log = vi.fn();
    const handler = telemetryHandler({ authenticate: async (token) => token === "valid", log });
    expect((await handler(request({ metrics: [metric] }, "forged"))).status).toBe(401);
    expect((await handler(request({ metrics: [{ ...metric, note: "PRIVATE" }] }))).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
    expect((await handler(request({ metrics: [metric] }))).status).toBe(202);
    expect(log).toHaveBeenCalledWith({ type: "bindernotes_operations", metrics: [metric] });
  });
  it("bounds actual request size regardless of a claimed content-length", async () => {
    const log = vi.fn();
    const handler = telemetryHandler({ authenticate: async () => true, log });
    expect((await handler(request({ body: "x".repeat(17000) }))).status).toBe(413);
    expect(log).not.toHaveBeenCalled();
  });
});
