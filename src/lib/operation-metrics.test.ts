import { afterEach, describe, expect, it } from "vitest";
import {
  clearOperationMetrics,
  flushOperationMetrics,
  inspectOperationMetrics,
  recordOperationMetric,
  setOperationMetricSink,
  timedSaveMetric,
} from "./operation-metrics";
const value = () => ({
  release: "development",
  correlation: crypto.randomUUID(),
  operation: "content_save",
  result: "saved",
  durationMs: 25,
  retryCount: 0,
  payloadBytes: 500,
});
afterEach(() => {
  clearOperationMetrics();
  setOperationMetricSink(null);
});
describe("content-free operation metrics", () => {
  it("rejects private/free-form fields and invalid metric values", () => {
    for (const field of ["note", "scene", "answer", "token", "ownerId", "url", "error", "title", "stack"]) {
      expect(recordOperationMetric({ ...value(), [field]: "PRIVATE_SENTINEL" })).toBe(false);
    }
    expect(recordOperationMetric({ ...value(), payloadBytes: Infinity })).toBe(false);
    expect(inspectOperationMetrics().metrics).toEqual([]);
  });
  it("measures bytes without retaining contents, entity IDs or exceptions", () => {
    timedSaveMetric("content_save", 2, { body: "PRIVATE_SENTINEL", owner: "SECRET_ACCOUNT" })("failed");
    const result = JSON.stringify(inspectOperationMetrics());
    expect(result).not.toContain("PRIVATE_SENTINEL");
    expect(result).not.toContain("SECRET_ACCOUNT");
    expect(inspectOperationMetrics().metrics[0]).toMatchObject({ retryCount: 2, result: "failed" });
  });
  it("bounds memory and isolates in-flight acknowledgement across account resets", async () => {
    for (let index = 0; index < 250; index++) recordOperationMetric(value());
    expect(inspectOperationMetrics().metrics).toHaveLength(200);
    expect(inspectOperationMetrics().dropped).toBe(50);
    let finish: (() => void) | undefined;
    setOperationMetricSink(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const report = flushOperationMetrics();
    clearOperationMetrics();
    const next = value();
    recordOperationMetric(next);
    finish?.();
    await report;
    expect(inspectOperationMetrics().metrics).toEqual([next]);
  });
  it("retains bounded measurements when reporting fails and never throws to the editor", async () => {
    setOperationMetricSink(async () => {
      throw new Error("provider secret");
    });
    recordOperationMetric(value());
    await expect(flushOperationMetrics()).resolves.toBeUndefined();
    expect(inspectOperationMetrics().metrics).toHaveLength(1);
    expect(JSON.stringify(inspectOperationMetrics())).not.toContain("provider secret");
  });
});
