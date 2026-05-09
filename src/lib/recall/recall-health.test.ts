import { describe, expect, it } from "vitest";
import { summarizeRecallHealth } from "@/lib/recall/recall-health";
import type { RecallCard } from "@/lib/recall/recall-types";

function card(overrides: Partial<RecallCard> = {}): RecallCard {
  return {
    id: "card-1",
    binderId: "binder-1",
    documentId: "lesson-1",
    lessonId: "lesson-1",
    sourceType: "manual",
    front: "Front",
    back: "Back",
    explanation: "",
    whyItMatters: "",
    tags: [],
    subject: "math",
    cardType: "basic_qa",
    status: "Learning",
    difficulty: "new",
    confidence: 0.3,
    lastReviewedAt: null,
    nextReviewAt: "2026-05-08T12:00:00.000Z",
    reviewCount: 0,
    lapseCount: 0,
    createdVia: "manual",
    draftStatus: "accepted",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Recall Health", () => {
  it("summarizes due, weak, mastered, source, and latest session counts conservatively", () => {
    const health = summarizeRecallHealth(
      [
        card({ id: "due", createdVia: "note" }),
        card({ id: "weak", status: "Weak", createdVia: "highlight" }),
        card({ id: "mastered", status: "Mastered", nextReviewAt: "2026-06-01T00:00:00.000Z" }),
        card({ id: "gap", status: "Source gap", draftStatus: "needs_review" }),
      ],
      {
        lessonId: "lesson-1",
        now: new Date("2026-05-09T12:00:00.000Z"),
        sessions: [
          {
            id: "session-1",
            cardIds: ["due"],
            correct: 1,
            createdAt: "2026-05-09T12:00:00.000Z",
            missed: 0,
            missedConcepts: [],
            mode: "Flip",
            scope: { binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1" },
            score: 100,
          },
        ],
      },
    );

    expect(health).toEqual({
      dueCards: 2,
      weakCards: 1,
      masteredCards: 1,
      sourceGaps: 1,
      cardsFromNotes: 1,
      cardsFromHighlights: 1,
      cardsFromCurrentLesson: 4,
      latestSessionScore: 100,
    });
  });
});
