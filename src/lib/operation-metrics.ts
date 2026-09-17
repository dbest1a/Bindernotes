import { operationMetricSchema, type OperationMetric } from "./telemetry-contract";

const metrics: OperationMetric[] = [];
let sink: ((batch: OperationMetric[]) => Promise<void>) | null = null;
let generation = 0;
let dropped = 0;
let reporting = false;

export function setOperationMetricSink(next: typeof sink) {
  sink = next;
}
export function clearOperationMetrics() {
  generation++;
  metrics.length = 0;
  dropped = 0;
}
export function inspectOperationMetrics() {
  return { metrics: structuredClone(metrics), dropped };
}

/** Logging must never affect persistence. Reject unknown fields instead of forwarding them. */
export function recordOperationMetric(raw: unknown) {
  const parsed = operationMetricSchema.safeParse(raw);
  if (!parsed.success) {
    dropped++;
    return false;
  }
  if (metrics.length >= 200) {
    metrics.shift();
    dropped++;
  }
  metrics.push(parsed.data);
  return true;
}
export function timedSaveMetric(
  operation: OperationMetric["operation"],
  retryCount: number,
  payload: unknown,
) {
  const started = performance.now();
  const epoch = generation;
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  } catch {
    /* Only the measurement is omitted; no document data is logged. */
  }
  const correlation = crypto.randomUUID();
  return (result: OperationMetric["result"]) => {
    if (generation !== epoch) return;
    recordOperationMetric({
      release: import.meta.env.VITE_RELEASE_SHA ?? "development",
      correlation,
      operation,
      result,
      durationMs: Math.min(3600000, Math.max(0, Math.round(performance.now() - started))),
      retryCount: Math.min(10000, Math.max(0, retryCount)),
      payloadBytes: Math.min(100000000, bytes),
    });
    void flushOperationMetrics();
  };
}
export async function flushOperationMetrics() {
  if (!sink || reporting || !metrics.length) return;
  reporting = true;
  const epoch = generation;
  const batch = metrics.slice(0, 20);
  try {
    await sink(structuredClone(batch));
    if (generation === epoch) {
      const delivered = new Set(batch.map((entry) => entry.correlation));
      for (let index = metrics.length - 1; index >= 0; index--)
        if (delivered.has(metrics[index].correlation)) metrics.splice(index, 1);
    }
  } catch {
    /* Best-effort metrics remain bounded in memory; saves are unaffected. */
  } finally {
    reporting = false;
  }
}
