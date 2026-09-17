// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canonicalFromRecall, type CanonicalReviewRecord } from "@/lib/canonical-review";
import { saveQueue } from "@/lib/save-queue";
import { saveCanonicalReview } from "@/services/canonical-review-service";
import { recallFixture, reviewCloudFixture, reviewOwnerA, reviewOwnerB } from "@/test/review-cloud-fixture";
import { useCloudRecall } from "./use-cloud-recall";
const transport = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: transport }));
let database: ReturnType<typeof reviewCloudFixture>;
const scope = { userId: reviewOwnerA, binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1" };
beforeEach(() => {
  window.localStorage.clear();
  database = reviewCloudFixture();
  saveQueue.setAccount(reviewOwnerA);
  transport.from.mockImplementation(database.from);
  transport.rpc.mockImplementation(database.rpc);
});
afterEach(() => {
  cleanup();
  saveQueue.setAccount(null);
});
it("reopens saved cards on a fresh device without local data", async () => {
  const record = canonicalFromRecall(recallFixture());
  await saveCanonicalReview({ record, expectedRevision: 0, operationId: crypto.randomUUID() });
  window.localStorage.clear();
  const hook = renderHook(() => useCloudRecall(scope, "Calculus", true));
  await waitFor(() => expect(hook.result.current.cards).toEqual([record.recall]));
});
it("durably restores an unsaved edit after account teardown and confirms it on retry", async () => {
  const card = recallFixture();
  await saveCanonicalReview({
    record: canonicalFromRecall(card),
    expectedRevision: 0,
    operationId: crypto.randomUUID(),
  });
  const first = renderHook(() => useCloudRecall(scope, "Calculus", true));
  await waitFor(() => expect(first.result.current.cards).toHaveLength(1));
  database.fail = true;
  act(() =>
    first.result.current.updateCards([
      { ...card, back: "My corrected explanation", updatedAt: "2026-09-17T12:00:00.000Z" },
    ]),
  );
  await act(() => first.result.current.save());
  expect(first.result.current.states[0].dirty).toBe(true);
  first.unmount();
  saveQueue.setAccount(null);
  saveQueue.setAccount(reviewOwnerA);
  const reopened = renderHook(() => useCloudRecall(scope, "Calculus", true));
  await waitFor(() => expect(reopened.result.current.cards[0]?.back).toBe("My corrected explanation"));
  database.fail = false;
  await act(() => reopened.result.current.save());
  await waitFor(() => expect(reopened.result.current.states[0].dirty).toBe(false));
  expect((database.tables.review_items[0].payload as CanonicalReviewRecord).item.answer).toBe(
    "My corrected explanation",
  );
});
it("keeps a stale edit in conflict and saves a recovery copy before accepting the newer account card", async () => {
  const card = recallFixture();
  const original = canonicalFromRecall(card);
  await saveCanonicalReview({ record: original, expectedRevision: 0, operationId: crypto.randomUUID() });
  const hook = renderHook(() => useCloudRecall(scope, "Calculus", true));
  await waitFor(() => expect(hook.result.current.cards).toHaveLength(1));
  await saveCanonicalReview({
    record: canonicalFromRecall({ ...card, back: "Other device answer" }),
    expectedRevision: 1,
    operationId: crypto.randomUUID(),
  });
  act(() => hook.result.current.updateCards([{ ...card, back: "This device answer" }]));
  await act(() => hook.result.current.save());
  expect(hook.result.current.states[0].state).toBe("conflict");
  expect(hook.result.current.cards[0].back).toBe("This device answer");
  await act(() => hook.result.current.preserveCopy(card.id));
  expect(hook.result.current.cards.map((value) => value.back).sort()).toEqual([
    "Other device answer",
    "This device answer",
  ]);
  expect(database.tables.review_items).toHaveLength(2);
});
it("does not expose account A cards or pending work after switching to B", async () => {
  const card = recallFixture();
  const hook = renderHook(({ userId }) => useCloudRecall({ ...scope, userId }, "Calculus", true), {
    initialProps: { userId: reviewOwnerA },
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  act(() => hook.result.current.updateCards([card]));
  act(() => {
    saveQueue.setAccount(reviewOwnerB);
    database.owner = reviewOwnerB;
  });
  hook.rerender({ userId: reviewOwnerB });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.cards).toEqual([]);
  expect(database.tables.review_items).toHaveLength(0);
  expect(Object.keys(window.localStorage).some((key) => key.includes(reviewOwnerA))).toBe(true);
});
