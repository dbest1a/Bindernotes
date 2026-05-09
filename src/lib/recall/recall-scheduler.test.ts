import { describe, expect, it } from "vitest";
import {
  buildCheckpointSession,
  buildGuidedRecallQueue,
  compareRecallAnswer,
  isRecallCardDue,
  rateRecallCard,
} from "@/lib/recall/recall-scheduler";
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
    confidence: 0.2,
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    lapseCount: 0,
    createdVia: "manual",
    draftStatus: "accepted",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Recall Lab scheduler", () => {
  it("compares typed answers with simple deterministic normalization", () => {
    expect(compareRecallAnswer("  Ray!! ", "ray")).toBe(true);
    expect(compareRecallAnswer("perpendicular lines", "Lines meet at 90 degrees")).toBe(false);
  });

  it("updates next due date and review state from Again/Hard/Good/Easy ratings", () => {
    const now = new Date("2026-05-09T12:00:00.000Z");

    const again = rateRecallCard(card(), "Again", now);
    expect(again.status).toBe("Weak");
    expect(again.lapseCount).toBe(1);
    expect(isRecallCardDue(again, now)).toBe(true);

    const hard = rateRecallCard(card({ id: "hard" }), "Hard", now);
    expect(hard.nextReviewAt).toBe("2026-05-10T12:00:00.000Z");

    const good = rateRecallCard(card({ id: "good" }), "Good", now);
    expect(good.nextReviewAt).toBe("2026-05-12T12:00:00.000Z");

    const easy = rateRecallCard(card({ id: "easy", reviewCount: 3, confidence: 0.8 }), "Easy", now);
    expect(easy.status).toBe("Mastered");
    expect(easy.nextReviewAt).toBe("2026-05-27T12:00:00.000Z");
  });

  it("prioritizes due, weak, current lesson cards for Guided Recall", () => {
    const now = new Date("2026-05-09T12:00:00.000Z");
    const queue = buildGuidedRecallQueue(
      [
        card({ id: "mastered", status: "Mastered", confidence: 0.9, lessonId: "lesson-2" }),
        card({ id: "weak-current", status: "Weak", confidence: 0.1, lessonId: "lesson-1" }),
        card({ id: "learning-current", status: "Learning", confidence: 0.2, lessonId: "lesson-1" }),
      ],
      { lessonId: "lesson-1" },
      "Current lesson",
      now,
    );

    expect(queue.map((item) => item.id)).toEqual(["weak-current", "learning-current", "mastered"]);
  });

  it("builds a checkpoint from selected recall cards", () => {
    const session = buildCheckpointSession(
      [card({ id: "a" }), card({ id: "b" })],
      { binderId: "binder-1", documentId: "lesson-1", lessonId: "lesson-1", userId: "user-1" },
      {
        count: 1,
        modes: ["Flip", "Type answer"],
        goal: "Checkpoint prep",
        now: new Date("2026-05-09T12:00:00.000Z"),
      },
    );

    expect(session.mode).toBe("Checkpoint");
    expect(session.cardIds).toHaveLength(1);
    expect(session.score).toBe(0);
  });
});
