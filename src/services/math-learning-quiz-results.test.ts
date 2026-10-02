// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }));
import { getQuizAttempt } from "@/services/math-learning-service";
function query(result: unknown) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(result), order: vi.fn().mockResolvedValue(result) };
}
beforeEach(() => mocks.from.mockReset());
describe("saved quiz account access", () => {
  it("scopes both queries to the account and verifies the quiz before reading answers", async () => {
    const attempt = query({ data: { id: "attempt-a", quiz_set_id: "quiz-a", user_id: "owner-a" }, error: null });
    const answers = query({ data: [{ id: "answer-a" }], error: null });
    mocks.from.mockReturnValueOnce(attempt).mockReturnValueOnce(answers);
    expect((await getQuizAttempt("attempt-a", "quiz-a", "owner-a"))?.answers).toHaveLength(1);
    expect(attempt.eq.mock.calls).toEqual([["id", "attempt-a"], ["quiz_set_id", "quiz-a"], ["user_id", "owner-a"]]);
    expect(answers.eq.mock.calls).toEqual([["quiz_attempt_id", "attempt-a"], ["user_id", "owner-a"]]);
  });
  it("does not query answers for an inaccessible or mismatched attempt", async () => {
    mocks.from.mockReturnValue(query({ data: null, error: null }));
    expect(await getQuizAttempt("attempt-a", "quiz-a", "owner-b")).toBeNull();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it("reports a failed retrieval instead of returning a fabricated result", async () => {
    mocks.from.mockReturnValue(query({ data: null, error: { message: "Connection interrupted" } }));
    await expect(getQuizAttempt("attempt-a", "quiz-a", "owner-a")).rejects.toThrow("Could not load quiz results");
  });
});
