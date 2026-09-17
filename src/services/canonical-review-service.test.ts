// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalFromRecall, canonicalFromStudy } from "@/lib/canonical-review";
import { saveQueue } from "@/lib/save-queue";
import {
  createCloudStudyItem,
  listCanonicalReviews,
  listCloudReviewEvents,
  recordCloudStudyReview,
  retryPendingReviewSaves,
  saveCanonicalReview,
} from "@/services/canonical-review-service";
import {
  recallFixture,
  reviewCloudFixture,
  reviewOwnerA,
  reviewOwnerB,
  studyFixture,
} from "@/test/review-cloud-fixture";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: mocks }));
let database: ReturnType<typeof reviewCloudFixture>;
beforeEach(() => {
  window.localStorage.clear();
  database = reviewCloudFixture();
  saveQueue.setAccount(reviewOwnerA);
  mocks.from.mockReset().mockImplementation(database.from);
  mocks.rpc.mockReset().mockImplementation(database.rpc);
});
afterEach(() => saveQueue.setAccount(null));
const operationId = "10000000-0000-4000-8000-000000000001";

describe("canonical review repository", () => {
  it("round-trips Recall sources, reflection history, tags and existing schedule on a fresh read", async () => {
    const record = canonicalFromRecall(recallFixture(), "Calculus");
    await saveCanonicalReview({ record, expectedRevision: 0, operationId });
    const freshDevice = await listCanonicalReviews(reviewOwnerA);
    expect(freshDevice).toEqual([{ record, revision: 1 }]);
    expect(freshDevice[0].record.recall).toEqual(recallFixture());
  });
  it("records one canonical rating and immutable history while keeping Recall's schedule consistent", async () => {
    const record = canonicalFromRecall(recallFixture());
    await saveCanonicalReview({ record, expectedRevision: 0, operationId });
    const result = await recordCloudStudyReview({
      ownerId: reviewOwnerA,
      itemId: record.item.id,
      rating: "good",
      response: "private answer",
    });
    expect(result.item.review_count).toBe(3);
    expect(result.item.mastery).toBeCloseTo(0.64);
    expect(Date.parse(result.item.due_at) - Date.parse(result.event.reviewed_at)).toBe(9 * 86400000);
    const fresh = (await listCanonicalReviews(reviewOwnerA))[0];
    expect(fresh.record.recall).toMatchObject({
      reviewCount: 3,
      nextReviewAt: result.item.due_at,
      confidence: result.item.mastery,
    });
    const history = await listCloudReviewEvents(reviewOwnerA);
    expect(history).toHaveLength(1);
    expect(history[0].response_length).toBe(14);
    expect(JSON.stringify(history)).not.toContain("private answer");
  });
  it("retries an uncertain rating after reload without adding another event or moving the due date twice", async () => {
    const record = canonicalFromStudy(studyFixture());
    await saveCanonicalReview({ record, expectedRevision: 0, operationId });
    database.loseNextAcknowledgement = true;
    await expect(
      recordCloudStudyReview({ ownerId: reviewOwnerA, itemId: record.item.id, rating: "hard" }),
    ).rejects.toThrow(/could not be saved/);
    const first = structuredClone(database.tables.review_items[0]);
    expect(window.localStorage.length).toBe(1);
    expect(await retryPendingReviewSaves(reviewOwnerA)).toBe(1);
    expect(database.tables.review_items[0]).toEqual(first);
    expect(database.tables.review_events).toHaveLength(1);
    expect(window.localStorage.length).toBe(0);
  });
  it("does not create duplicate source cards when the first acknowledgement is lost", async () => {
    const input = {
      ownerId: reviewOwnerA,
      betaEnabled: true,
      prompt: "P",
      answer: "A",
      sourceKind: "manual" as const,
      type: "free_response" as const,
    };
    database.loseNextAcknowledgement = true;
    await expect(createCloudStudyItem(input)).rejects.toThrow();
    const item = await createCloudStudyItem(input);
    expect(database.tables.review_items).toHaveLength(1);
    expect(item.id).toBe(database.tables.review_items[0].id);
  });
  it("isolates account data and rejects cross-account responses even if the transport misbehaves", async () => {
    await saveCanonicalReview({
      record: canonicalFromStudy(studyFixture()),
      expectedRevision: 0,
      operationId,
    });
    saveQueue.setAccount(reviewOwnerB);
    database.owner = reviewOwnerB;
    expect(await listCanonicalReviews(reviewOwnerB)).toEqual([]);
    await expect(listCanonicalReviews(reviewOwnerA)).rejects.toThrow(/owns this review/);
    database.bypassOwner = true;
    await expect(listCanonicalReviews(reviewOwnerB)).rejects.toThrow(/unavailable for this account/);
  });
  it("rejects stale writes, nonfinite schedules and malformed persisted data without overwriting", async () => {
    const record = canonicalFromStudy(studyFixture());
    await saveCanonicalReview({ record, expectedRevision: 0, operationId });
    await expect(
      saveCanonicalReview({
        record: { ...record, item: { ...record.item, answer: "Stale" } },
        expectedRevision: 0,
        operationId: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/another tab or device/);
    await expect(
      saveCanonicalReview({
        record: { ...record, item: { ...record.item, mastery: NaN } },
        expectedRevision: 1,
        operationId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    expect(database.tables.review_items[0].revision).toBe(1);
    database.tables.review_items[0].payload = { ...record, item: { ...record.item, due_at: "not a date" } };
    await expect(listCanonicalReviews(reviewOwnerA)).rejects.toThrow(/invalid/);
  });
});
