import { describe, expect, it, vi } from "vitest";
import { startQuizAttempt } from "@/services/math-learning-service";
import { getQuizAttemptResults } from "@/services/quiz-attempt-results-service";
vi.mock("@/lib/supabase", () => ({ supabase: null }));

describe("quiz storage configuration", () => {
  it("does not report a local synthetic attempt as cloud-saved", async () => {
    await expect(startQuizAttempt({ quizSetId: "quiz", userId: "learner" })).rejects.toThrow(/was not saved/);
    await expect(getQuizAttemptResults({ quizId: "quiz", attemptId: "attempt", ownerId: "learner" })).rejects.toThrow(/cannot be loaded/);
  });
});
