// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canonicalFromStudy, scheduleCanonicalReview } from "@/lib/canonical-review";
import { recallStorageKey } from "@/lib/recall/recall-storage";
import { saveQueue } from "@/lib/save-queue";
import { studyItemsStorageKey, studyReviewEventsStorageKey } from "@/services/study-items-service";
import { saveCanonicalReview } from "@/services/canonical-review-service";
import { importLocalReviews, previewLocalReviewMigration } from "./review-migration-service";
import { recallFixture, reviewCloudFixture, reviewOwnerA, reviewOwnerB, studyFixture } from "@/test/review-cloud-fixture";

const transport = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: transport }));
let database: ReturnType<typeof reviewCloudFixture>;
beforeEach(() => { window.localStorage.clear(); database = reviewCloudFixture(); saveQueue.setAccount(reviewOwnerA); transport.from.mockImplementation(database.from); transport.rpc.mockImplementation(database.rpc); });
afterEach(() => saveQueue.setAccount(null));

it("previews only exact owner data, rejects malformed/cross-account/orphan records and never alters originals", () => {
  const item = studyFixture(); const card = recallFixture();
  window.localStorage.setItem(studyItemsStorageKey(reviewOwnerA), JSON.stringify([item, { ...item, owner_id: reviewOwnerB }, { ...item, due_at: "invalid" }]));
  window.localStorage.setItem(studyItemsStorageKey(reviewOwnerB), JSON.stringify([studyFixture({ owner_id: reviewOwnerB })]));
  window.localStorage.setItem(recallStorageKey(card), JSON.stringify([card]));
  window.localStorage.setItem(recallStorageKey({ ...card, userId: null }), JSON.stringify([{ ...card, userId: null }]));
  const orphan = scheduleCanonicalReview(canonicalFromStudy(item), "good", new Date("2026-09-17T12:00:00Z"), "orphan").event;
  window.localStorage.setItem(studyReviewEventsStorageKey(reviewOwnerA), JSON.stringify([{ ...orphan, item_id: "missing" }]));
  const before = { ...window.localStorage };
  const preview = previewLocalReviewMigration(reviewOwnerA, window.localStorage);
  expect(preview.records).toHaveLength(2); expect(preview.events).toEqual([]); expect(preview.issues).toHaveLength(3);
  expect(preview.records[1].recall).toEqual(card);
  expect(preview.records[1].item.due_at).toBe(card.nextReviewAt);
  expect({ ...window.localStorage }).toEqual(before);
});

it("imports source/schedule/history idempotently and leaves all device data available", async () => {
  const item = studyFixture(); const transition = scheduleCanonicalReview(canonicalFromStudy(item), "hard", new Date("2026-09-17T12:00:00Z"), "history-1");
  window.localStorage.setItem(studyItemsStorageKey(reviewOwnerA), JSON.stringify([transition.record.item]));
  window.localStorage.setItem(studyReviewEventsStorageKey(reviewOwnerA), JSON.stringify([transition.event]));
  const before = { ...window.localStorage };
  const preview = previewLocalReviewMigration(reviewOwnerA, window.localStorage);
  expect(await importLocalReviews(preview)).toMatchObject({ saved: 1, failed: 0 });
  expect(await importLocalReviews(preview)).toMatchObject({ saved: 0, unchanged: 1, failed: 0 });
  expect(database.tables.review_items[0].payload).toEqual(transition.record);
  expect(database.tables.review_events).toHaveLength(1);
  expect(database.tables.review_events[0].payload).toEqual(transition.event);
  expect({ ...window.localStorage }).toEqual(before);
});

it("refuses to overwrite a different cloud record or import conflicting duplicate local IDs", async () => {
  const item = studyFixture();
  await saveCanonicalReview({ record: canonicalFromStudy({ ...item, answer: "Newer account answer" }), expectedRevision: 0, operationId: crypto.randomUUID() });
  window.localStorage.setItem(studyItemsStorageKey(reviewOwnerA), JSON.stringify([item]));
  expect(await importLocalReviews(previewLocalReviewMigration(reviewOwnerA, window.localStorage))).toMatchObject({ saved: 0, conflicts: 1 });
  expect(database.tables.review_items[0].payload).toEqual(canonicalFromStudy({ ...item, answer: "Newer account answer" }));
  window.localStorage.setItem(studyItemsStorageKey(reviewOwnerA), JSON.stringify([item, { ...item, answer: "Conflicting local answer" }]));
  expect(previewLocalReviewMigration(reviewOwnerA, window.localStorage)).toMatchObject({ records: [], issues: [{ key: "device", reason: expect.stringContaining("Conflicting") }] });
});

it("retains malformed JSON and reports failed saves without clearing the local source", async () => {
  const key = studyItemsStorageKey(reviewOwnerA); window.localStorage.setItem(key, "{broken");
  expect(previewLocalReviewMigration(reviewOwnerA, window.localStorage).issues).toHaveLength(1);
  expect(window.localStorage.getItem(key)).toBe("{broken");
  window.localStorage.setItem(key, JSON.stringify([studyFixture()])); database.fail = true;
  await expect(importLocalReviews(previewLocalReviewMigration(reviewOwnerA, window.localStorage))).rejects.toThrow();
  expect(window.localStorage.getItem(key)).toBe(JSON.stringify([studyFixture()]));
});
