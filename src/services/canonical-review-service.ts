import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";
import { ContentConflictError } from "@/lib/revisioned-save";
import {
  canonicalReviewSchema,
  canonicalFromStudy,
  recallSessionSchema,
  studyReviewEventSchema,
  scheduleCanonicalReview,
  type CanonicalReviewRecord,
  type SavedReviewRecord,
} from "@/lib/canonical-review";
import {
  buildStudyItem,
  type CreateStudyItemInput,
  type StudyReviewEvent,
} from "@/services/study-items-service";
import type { RecallSessionSummary } from "@/lib/recall/recall-types";
import type { StudyReviewRating } from "@/lib/study-scheduler";

const operationSchema = z
  .object({
    record: canonicalReviewSchema,
    expectedRevision: z.number().int().nonnegative(),
    operationId: z.string().uuid(),
    events: z.array(studyReviewEventSchema).max(1000),
    intent: z.string(),
  })
  .strict();
type PendingOperation = z.infer<typeof operationSchema>;
function pendingKey(ownerId: string, identity: string) {
  return `bindernotes:cloud-review-pending:v1:${ownerId}:${identity}`;
}
function readPending(key: string, ownerId: string) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const pending = operationSchema.parse(JSON.parse(raw));
  if (pending.record.item.owner_id !== ownerId)
    throw new Error("The pending review belongs to another account.");
  return pending;
}
async function commitPending(key: string, operation: PendingOperation) {
  // The journal is written before the request, so uncertain network outcomes reuse its UUID.
  window.localStorage.setItem(key, JSON.stringify(operation));
  const saved = await saveCanonicalReview(operation);
  if (window.localStorage.getItem(key) === JSON.stringify(operation)) window.localStorage.removeItem(key);
  return saved;
}

function clientFor(ownerId: string) {
  if (!supabase || !ownerId || saveQueue.getAccount() !== ownerId)
    throw new Error("Sign in to the account that owns this review work.");
  return supabase;
}
function assertActive(ownerId: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  clientFor(ownerId);
}
const rowSchema = z.object({
  id: z.string(),
  owner_id: z.string().uuid(),
  payload: canonicalReviewSchema,
  revision: z.number().int().positive(),
});
function parseRow(raw: unknown, ownerId: string): SavedReviewRecord {
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Saved review data is invalid. It has been kept in your account.");
  const row = parsed.data;
  if (row.owner_id !== ownerId || row.payload.item.owner_id !== ownerId || row.id !== row.payload.item.id)
    throw new Error("Review data is unavailable for this account.");
  return { record: row.payload, revision: row.revision };
}

export async function listCanonicalReviews(
  ownerId: string,
  signal?: AbortSignal,
): Promise<SavedReviewRecord[]> {
  const client = clientFor(ownerId);
  const records: SavedReviewRecord[] = [];
  for (let offset = 0; ; offset += 250) {
    assertActive(ownerId, signal);
    const query = client
      .from("review_items")
      .select("id,owner_id,payload,revision")
      .eq("owner_id", ownerId)
      .order("id")
      .range(offset, offset + 249);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query;
    assertActive(ownerId, signal);
    if (error || !Array.isArray(data))
      throw new Error("Saved review work could not be loaded. Retry when connected.");
    records.push(...data.map((row) => parseRow(row, ownerId)));
    if (data.length < 250) return records;
  }
}
export async function readCanonicalReview(
  ownerId: string,
  id: string,
  signal?: AbortSignal,
): Promise<SavedReviewRecord | null> {
  assertActive(ownerId, signal);
  const query = clientFor(ownerId)
    .from("review_items")
    .select("id,owner_id,payload,revision")
    .eq("owner_id", ownerId)
    .eq("id", id);
  if (signal) query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  assertActive(ownerId, signal);
  if (error) throw new Error("This review item could not be loaded.");
  if (!data) return null;
  const row = parseRow(data, ownerId);
  if (row.record.item.id !== id) throw new Error("The saved review identity did not match.");
  return row;
}

export async function saveCanonicalReview(input: {
  record: CanonicalReviewRecord;
  expectedRevision: number;
  operationId: string;
  events?: StudyReviewEvent[];
}): Promise<SavedReviewRecord> {
  const record = canonicalReviewSchema.parse(input.record);
  const ownerId = record.item.owner_id;
  const events = z
    .array(studyReviewEventSchema)
    .max(1000)
    .parse(input.events ?? []);
  if (events.some((event) => event.owner_id !== ownerId || event.item_id !== record.item.id))
    throw new Error("Review history belongs to a different account or item.");
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    !z.string().uuid().safeParse(input.operationId).success
  )
    throw new Error("Invalid review save operation.");
  const { data, error } = await clientFor(ownerId).rpc("save_review_item", {
    p_record: record,
    p_expected_revision: input.expectedRevision,
    p_operation_id: input.operationId,
    p_events: events,
  });
  assertActive(ownerId);
  if (error) {
    if (error.code === "40001") throw new ContentConflictError();
    throw new Error("Review work could not be saved. Keep your draft and retry.");
  }
  const saved = parseRow(data, ownerId);
  if (saved.record.item.id !== record.item.id || saved.revision !== input.expectedRevision + 1)
    throw new Error("The review save could not be confirmed.");
  return saved;
}

export async function createCloudStudyItem(input: CreateStudyItemInput) {
  clientFor(input.ownerId);
  const key = pendingKey(input.ownerId, "create");
  const intent = JSON.stringify({ ...input, now: undefined });
  const pending = readPending(key, input.ownerId);
  if (pending && pending.intent !== intent)
    throw new Error(
      "An earlier review-card save still needs confirmation. Open Review Queue and retry pending saves first.",
    );
  const operation = pending ?? {
    record: canonicalFromStudy(buildStudyItem(input)),
    expectedRevision: 0,
    operationId: crypto.randomUUID(),
    events: [],
    intent,
  };
  const saved = await commitPending(key, operation);
  return saved.record.item;
}

export async function recordCloudStudyReview(input: {
  ownerId: string;
  itemId: string;
  rating: StudyReviewRating;
  response?: string;
}) {
  clientFor(input.ownerId);
  const key = pendingKey(input.ownerId, `rating:${input.itemId}`);
  const intent = JSON.stringify({ rating: input.rating, responseLength: input.response?.length ?? 0 });
  let operation = readPending(key, input.ownerId);
  if (
    operation &&
    (operation.record.item.id !== input.itemId ||
      operation.events.length !== 1 ||
      operation.events[0].item_id !== input.itemId)
  )
    throw new Error("The pending rating is invalid. Its device data has been kept for recovery.");
  if (operation && operation.intent !== intent)
    throw new Error(
      "The previous rating still needs confirmation. Retry pending saves before choosing a different rating.",
    );
  if (!operation) {
    const saved = await readCanonicalReview(input.ownerId, input.itemId);
    if (!saved) throw new Error("This review item is unavailable.");
    const update = scheduleCanonicalReview(
      saved.record,
      input.rating,
      new Date(),
      crypto.randomUUID(),
      input.response?.length ?? 0,
    );
    operation = {
      record: update.record,
      expectedRevision: saved.revision,
      operationId: crypto.randomUUID(),
      events: [update.event],
      intent,
    };
  }
  const saved = await commitPending(key, operation);
  return { item: saved.record.item, event: operation.events[0], saved };
}

export async function retryPendingReviewSaves(ownerId: string) {
  clientFor(ownerId);
  const prefix = pendingKey(ownerId, "");
  const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
    window.localStorage.key(index),
  ).filter((key): key is string => Boolean(key?.startsWith(prefix)));
  let saved = 0;
  for (const key of keys) {
    const operation = readPending(key, ownerId);
    if (operation) {
      await commitPending(key, operation);
      saved += 1;
    }
  }
  return saved;
}

async function listHistory<T>(
  ownerId: string,
  table: "review_events" | "review_sessions",
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 250) {
    assertActive(ownerId, signal);
    const query = clientFor(ownerId)
      .from(table)
      .select("owner_id,payload")
      .eq("owner_id", ownerId)
      .order("id")
      .range(offset, offset + 249);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query;
    assertActive(ownerId, signal);
    if (error || !Array.isArray(data)) throw new Error("Review history could not be loaded.");
    for (const row of data) {
      if (row.owner_id !== ownerId) throw new Error("Review history is unavailable for this account.");
      const value = schema.safeParse(row.payload);
      if (!value.success)
        throw new Error("Review history contains invalid data. It has been kept in your account.");
      items.push(value.data);
    }
    if (data.length < 250) return items;
  }
}
export async function listCloudReviewEvents(ownerId: string, signal?: AbortSignal) {
  const events = await listHistory(ownerId, "review_events", studyReviewEventSchema, signal);
  if (events.some((event) => event.owner_id !== ownerId)) throw new Error("Review history owner mismatch.");
  return events;
}
export async function listCloudRecallSessions(ownerId: string, signal?: AbortSignal) {
  const sessions = await listHistory(ownerId, "review_sessions", recallSessionSchema, signal);
  if (sessions.some((session) => session.scope.userId !== ownerId))
    throw new Error("Recall history owner mismatch.");
  return sessions;
}
export async function saveCloudRecallSession(raw: RecallSessionSummary) {
  const session = recallSessionSchema.parse(raw);
  const ownerId = session.scope.userId!;
  const id = JSON.stringify([
    session.scope.binderId,
    session.scope.documentId,
    session.scope.lessonId,
    session.id,
  ]);
  const key = `bindernotes:cloud-recall-session-pending:v1:${ownerId}:${id}`;
  clientFor(ownerId);
  window.localStorage.setItem(key, JSON.stringify(session));
  const { data, error } = await clientFor(ownerId).rpc("save_review_session", {
    p_id: id,
    p_session: session,
  });
  assertActive(ownerId);
  if (error) throw new Error("Recall session could not be saved. Keep this page open and retry.");
  const saved = recallSessionSchema.parse(data);
  if (JSON.stringify(saved) !== JSON.stringify(session))
    throw new Error("The recall session save could not be confirmed.");
  if (window.localStorage.getItem(key) === JSON.stringify(session)) window.localStorage.removeItem(key);
  return saved;
}

export function readPendingRecallSessions(ownerId: string) {
  const prefix = `bindernotes:cloud-recall-session-pending:v1:${ownerId}:`;
  const sessions: RecallSessionSummary[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const session = recallSessionSchema.parse(JSON.parse(window.localStorage.getItem(key)!));
    if (session.scope.userId !== ownerId) throw new Error("Pending session belongs to another account.");
    sessions.push(session);
  }
  return sessions;
}
