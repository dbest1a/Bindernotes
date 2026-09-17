import { canonicalFromRecall, canonicalFromStudy, recallCardSchema, recallSessionSchema, studyItemSchema, studyReviewEventSchema, type CanonicalReviewRecord } from "@/lib/canonical-review";
import { recallSessionStorageKey, recallStorageKey } from "@/lib/recall/recall-storage";
import type { RecallSessionSummary } from "@/lib/recall/recall-types";
import { studyItemsStorageKey, studyReviewEventsStorageKey, type StudyReviewEvent } from "@/services/study-items-service";
import { listCloudReviewEvents, readCanonicalReview, saveCanonicalReview, saveCloudRecallSession } from "@/services/canonical-review-service";

type ReadStorage = Pick<Storage, "getItem" | "key" | "length">;
export type LocalReviewMigration = {
  ownerId: string; records: CanonicalReviewRecord[]; events: StudyReviewEvent[]; sessions: RecallSessionSummary[];
  issues: Array<{ key: string; reason: string }>; sourceKeys: string[];
};

/** Read-only, explicit inspection. Browser originals are never removed by migration. */
export function previewLocalReviewMigration(ownerId: string, storage: ReadStorage): LocalReviewMigration {
  const result: LocalReviewMigration = { ownerId, records: [], events: [], sessions: [], issues: [], sourceKeys: [] };
  const queueKey = studyItemsStorageKey(ownerId), eventsKey = studyReviewEventsStorageKey(ownerId);
  const recallPrefix = `bindernotes:recall-lab:${ownerId}:`;
  const issue = (key: string, reason: string) => result.issues.push({ key, reason });
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !(key === queueKey || key === eventsKey || key.startsWith(recallPrefix))) continue;
    if (key.startsWith(recallPrefix) && !key.endsWith(":cards") && !key.endsWith(":sessions")) continue;
    result.sourceKeys.push(key);
    let values: unknown;
    try {
      const raw = storage.getItem(key);
      if (!raw || raw.length > 10000000) throw new Error();
      values = JSON.parse(raw);
      if (!Array.isArray(values) || values.length > 10000) throw new Error();
    } catch { issue(key, "Invalid or oversized device data; original kept."); continue; }
    for (const raw of values as unknown[]) {
      if (key === queueKey) {
        const parsed = studyItemSchema.safeParse(raw);
        if (!parsed.success || parsed.data.owner_id !== ownerId) { issue(key, "Invalid or mismatched review owner; original kept."); continue; }
        result.records.push(canonicalFromStudy(parsed.data));
      } else if (key === eventsKey) {
        const parsed = studyReviewEventSchema.safeParse(raw);
        if (!parsed.success || parsed.data.owner_id !== ownerId) { issue(key, "Invalid or mismatched history owner; original kept."); continue; }
        result.events.push(parsed.data);
      } else if (key.endsWith(":cards")) {
        const parsed = recallCardSchema.safeParse(raw);
        if (!parsed.success || parsed.data.userId !== ownerId || recallStorageKey(parsed.data) !== key) { issue(key, "Invalid or mismatched recall scope; original kept."); continue; }
        result.records.push(canonicalFromRecall(parsed.data));
      } else {
        const parsed = recallSessionSchema.safeParse(raw);
        if (!parsed.success || parsed.data.scope.userId !== ownerId || recallSessionStorageKey(parsed.data.scope) !== key) { issue(key, "Invalid or mismatched session scope; original kept."); continue; }
        result.sessions.push(parsed.data);
      }
    }
  }
  const byId = new Map<string, CanonicalReviewRecord>();
  const conflicts = new Set<string>();
  for (const record of result.records) {
    const existing = byId.get(record.item.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) { conflicts.add(record.item.id); issue("device", "Conflicting local review IDs require manual recovery; originals kept."); }
    byId.set(record.item.id, record);
  }
  result.records = [...byId.values()].filter((record) => !conflicts.has(record.item.id));
  const ids = new Set(result.records.map((record) => record.item.id));
  result.events = result.events.filter((event) => {
    if (ids.has(event.item_id)) return true;
    issue(eventsKey, "History has no matching valid local review item; original kept."); return false;
  });
  return result;
}

export async function importLocalReviews(preview: LocalReviewMigration) {
  const report = { saved: 0, unchanged: 0, conflicts: 0, sessions: 0, failed: 0, issues: [...preview.issues] };
  const cloudEvents = await listCloudReviewEvents(preview.ownerId);
  const eventsById = new Map(cloudEvents.map((event) => [event.id, event]));
  for (const record of preview.records) {
    if (record.item.owner_id !== preview.ownerId) throw new Error("Local migration owner mismatch.");
    try {
      const existing = await readCanonicalReview(preview.ownerId, record.item.id);
      const events = preview.events.filter((event) => event.item_id === record.item.id);
      if (existing && JSON.stringify(existing.record) !== JSON.stringify(record)) { report.conflicts += 1; continue; }
      if (events.some((event) => eventsById.has(event.id) && JSON.stringify(eventsById.get(event.id)) !== JSON.stringify(event))) { report.conflicts += 1; continue; }
      const missingEvents = events.filter((event) => !eventsById.has(event.id));
      if (existing && missingEvents.length === 0) { report.unchanged += 1; continue; }
      if (missingEvents.length > 1000) { report.failed += 1; report.issues.push({ key: "history", reason: "More than 1,000 events for one item need a larger reviewed import; original kept." }); continue; }
      await saveCanonicalReview({ record, expectedRevision: existing?.revision ?? 0, operationId: crypto.randomUUID(), events: missingEvents });
      missingEvents.forEach((event) => eventsById.set(event.id, event));
      report.saved += 1;
    } catch { report.failed += 1; }
  }
  for (const session of preview.sessions) {
    if (session.scope.userId !== preview.ownerId) throw new Error("Local session owner mismatch.");
    try { await saveCloudRecallSession(session); report.sessions += 1; } catch { report.failed += 1; }
  }
  return report;
}
