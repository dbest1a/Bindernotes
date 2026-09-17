import { z } from "zod";

// No free-form message, URL, entity/account ID, payload, title, token or stack field.
export const operationMetricSchema = z.object({
  release: z.string().regex(/^(?:[0-9a-f]{40}|development)$/),
  correlation: z.uuid(),
  operation: z.enum(["content_save", "whiteboard_save", "review_save", "asset_upload", "archive_import"]),
  result: z.enum(["saved", "conflict", "offline", "failed", "device_storage_failed"]),
  durationMs: z.number().int().min(0).max(3600000),
  retryCount: z.number().int().min(0).max(10000),
  payloadBytes: z.number().int().min(0).max(100000000),
}).strict();
export type OperationMetric = z.infer<typeof operationMetricSchema>;
export const metricBatchSchema = z.object({ metrics: z.array(operationMetricSchema).min(1).max(20) }).strict();
