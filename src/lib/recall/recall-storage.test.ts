import { describe, expect, it } from "vitest";
import {
  loadRecallCards,
  recallStorageKey,
  saveRecallCards,
  upsertRecallCard,
} from "@/lib/recall/recall-storage";
import type { RecallCard, RecallDeckScope } from "@/lib/recall/recall-types";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    snapshot: () => Object.fromEntries(values),
  };
}

function card(id: string, scope: RecallDeckScope): RecallCard {
  return {
    id,
    binderId: scope.binderId,
    documentId: scope.documentId,
    lessonId: scope.lessonId,
    userId: scope.userId,
    sourceType: "manual",
    front: "Front",
    back: "Back",
    explanation: "",
    whyItMatters: "",
    tags: [],
    subject: "math",
    cardType: "basic_qa",
    status: "Draft",
    difficulty: "new",
    confidence: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    lapseCount: 0,
    createdVia: "manual",
    draftStatus: "needs_review",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Recall Lab local storage", () => {
  it("namespaces cards by user, binder, document, and lesson", () => {
    const userOne = { userId: "user-1", binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1" };
    const userTwo = { ...userOne, userId: "user-2" };

    expect(recallStorageKey(userOne)).not.toBe(recallStorageKey(userTwo));
    expect(recallStorageKey(userOne)).toContain("user-1");
    expect(recallStorageKey(userOne)).toContain("binder-1");
  });

  it("loads only cards that match the current scoped deck", () => {
    const scope = { userId: "user-1", binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1" };
    const storage = createStorage();
    saveRecallCards(scope, [card("a", scope), card("b", { ...scope, lessonId: "lesson-2" })], storage);

    expect(loadRecallCards(scope, storage).map((item) => item.id)).toEqual(["a"]);
  });

  it("upserts without duplicating the same card id", () => {
    const scope = { userId: "user-1", binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1" };
    const storage = createStorage();
    const first = card("a", scope);
    upsertRecallCard(scope, first, storage);
    upsertRecallCard(scope, { ...first, front: "Updated" }, storage);

    const cards = loadRecallCards(scope, storage);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("Updated");
  });
});
