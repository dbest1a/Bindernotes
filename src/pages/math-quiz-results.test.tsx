// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathQuestionEditorPage, MathQuizAttemptPage, MathQuizResultsPage } from "@/pages/math-learning-page";
import type { QuizAttemptResults } from "@/services/quiz-attempt-results-service";
import type { QuestionBankItem } from "@/types/math-learning";

const mocks = vi.hoisted(() => ({
  owner: "learner-a", result: null as QuizAttemptResults | null, isError: false,
  resultQuery: vi.fn(), start: vi.fn(), submit: vi.fn(), complete: vi.fn(), saveQuestion: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ profile: { id: mocks.owner }, isLoading: false }) }));
vi.mock("@/hooks/use-quiz-attempt-results", () => ({ useQuizAttemptResults: (...args: unknown[]) => {
  mocks.resultQuery(...args);
  return { data: mocks.result, isLoading: false, isError: mocks.isError, refetch: vi.fn() };
} }));
vi.mock("@/hooks/use-math-learning", () => ({
  useQuizSet: () => ({ data: { id: "quiz-a", title: "Current changed quiz", questions: [practiceQuestion] }, isLoading: false, isError: false }),
  useStartQuizAttempt: () => ({ mutateAsync: mocks.start }),
  useSubmitQuestionAttempt: () => ({ mutateAsync: mocks.submit }),
  useCompleteQuizAttempt: () => ({ mutateAsync: mocks.complete }),
  useMathCourses: () => ({ data: [] }), useMathModules: () => ({ data: [] }), useQuestionBank: () => ({ data: [] }),
  useSaveQuestion: () => ({ mutateAsync: mocks.saveQuestion, isPending: false }),
}));

beforeEach(() => {
  mocks.owner = "learner-a";
  mocks.result = savedResults();
  mocks.isError = false;
  mocks.resultQuery.mockClear();
  mocks.start.mockReset().mockResolvedValue({ id: "attempt-a" });
  mocks.submit.mockReset().mockResolvedValue({ score: { pointsAwarded: 1, totalPoints: 1 } });
  mocks.complete.mockReset().mockResolvedValue({ id: "attempt-a" });
  mocks.saveQuestion.mockReset().mockResolvedValue({ id: "new-question" });
});
afterEach(cleanup);

describe("historical quiz results", () => {
  it("uses the exact URL attempt and displays saved answer/score/context even when current quiz content differs", () => {
    renderResults();
    expect(mocks.resultQuery).toHaveBeenCalledWith("quiz-a", "attempt-a", "learner-a");
    expect(screen.getByText("Score: 0 / 1")).toBeTruthy();
    expect(screen.getByText("Original question title")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Original explanation")).toBeTruthy();
    expect(screen.queryByText("Current changed quiz")).toBeNull();
  });

  it("does not render another account's data during an account transition", () => {
    const view = renderResults();
    mocks.owner = "learner-b";
    view.rerender(resultRouter());
    expect(screen.queryByText("Original question title")).toBeNull();
    expect(screen.queryByText("42")).toBeNull();
    expect(screen.getByText("Saved attempt unavailable")).toBeTruthy();
  });

  it("does not substitute mismatched attempt results or hide a request failure as an empty quiz", () => {
    mocks.result = { ...savedResults(), attempt: { ...savedResults().attempt, id: "wrong-attempt" } };
    const view = renderResults();
    expect(screen.getByText("Saved attempt unavailable")).toBeTruthy();
    mocks.isError = true;
    view.rerender(resultRouter());
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("labels an older attempt without snapshots honestly and still displays its saved answer", () => {
    const result = savedResults();
    result.answers[0].feedback_json = { message: "Saved feedback" };
    mocks.result = result;
    renderResults();
    expect(screen.getByText(/original question text was not saved/)).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });
});

describe("quiz submission", () => {
  it("does not start duplicate attempts while the first start is pending", async () => {
    let resolveStart: (value: { id: string }) => void = () => { throw new Error("Start has not run"); };
    mocks.start.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve; }));
    renderAttempt();
    const submit = screen.getByRole("button", { name: "Submit answers" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving attempt…" }).hasAttribute("disabled")).toBe(true);
    await act(async () => resolveStart({ id: "attempt-a" }));
    await waitFor(() => expect(screen.getByText("Score: 0 / 1")).toBeTruthy());
  });

  it("does not continue an old account's submission after the active account changes", async () => {
    let resolveStart: (value: { id: string }) => void = () => { throw new Error("Start has not run"); };
    mocks.start.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve; }));
    const view = renderAttempt();
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    mocks.owner = "learner-b";
    view.rerender(attemptRouter());
    await act(async () => resolveStart({ id: "old-account-attempt" }));
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start attempt" })).toBeTruthy();
  });

  it("navigates to the saved result ID only after completing the persisted attempt", async () => {
    renderAttempt();
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    await waitFor(() => expect(screen.getByText("Score: 0 / 1")).toBeTruthy());
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ attemptId: "attempt-a", userId: "learner-a", answer: {} }));
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ attemptId: "attempt-a" }));
  });

  it("shows a failed save and retries the same attempt rather than manufacturing a successful result", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("failed save"));
    renderAttempt();
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not fully saved"));
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.queryByText("Score: 0 / 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    await waitFor(() => expect(screen.getByText("Score: 0 / 1")).toBeTruthy());
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });
});

describe("numeric question authoring", () => {
  it("cannot turn a blank expected value into a zero answer key", () => {
    render(<MemoryRouter><MathQuestionEditorPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Question type"), { target: { value: "numeric" } });
    const save = screen.getByRole("button", { name: "Save question" });
    expect(save.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/finite expected answer/);
    fireEvent.change(screen.getByLabelText("Expected number"), { target: { value: "0" } });
    expect(save.hasAttribute("disabled")).toBe(false);
    fireEvent.change(screen.getByLabelText("Tolerance"), { target: { value: "-1" } });
    expect(save.hasAttribute("disabled")).toBe(true);
    expect(mocks.saveQuestion).not.toHaveBeenCalled();
  });
});

function resultRouter() {
  return <MemoryRouter initialEntries={["/math/quizzes/quiz-a/results/attempt-a"]}><Routes><Route path="/math/quizzes/:quizId/results/:attemptId" element={<MathQuizResultsPage />} /></Routes></MemoryRouter>;
}
function renderResults() { return render(resultRouter()); }
function renderAttempt() {
  return render(attemptRouter());
}
function attemptRouter() {
  return <MemoryRouter initialEntries={["/math/quizzes/quiz-a/attempt"]}><Routes>
    <Route path="/math/quizzes/:quizId/attempt" element={<MathQuizAttemptPage />} />
    <Route path="/math/quizzes/:quizId/results/:attemptId" element={<MathQuizResultsPage />} />
  </Routes></MemoryRouter>;
}
function savedResults(): QuizAttemptResults {
  return {
    attempt: { id: "attempt-a", quiz_set_id: "quiz-a", user_id: "learner-a", started_at: "2026-09-17T00:00:00Z", completed_at: "2026-09-17T00:01:00Z", score: 0, total_points: 1, metadata_json: { quizTitle: "Original quiz" } },
    answers: [{ id: "answer-a", quiz_attempt_id: "attempt-a", question_id: "question-a", user_id: "learner-a", submitted_answer_json: { numeric: "42" }, is_correct: false, points_awarded: 0, created_at: "2026-09-17T00:00:30Z", feedback_json: { totalPoints: 1, message: "Saved feedback", questionSnapshot: { id: "question-a", title: "Original question title", promptMarkdown: "Original question", promptLatex: null, explanationMarkdown: "Original explanation", type: "numeric", choices: [] } } }],
  };
}
const practiceQuestion: QuestionBankItem = { id: "question-a", course_id: null, topic_id: null, module_id: null, note_id: null, graph_state_id: null, type: "numeric", title: "Current question title", prompt_markdown: "Current prompt", prompt_latex: null, answer_json: { expected: 1 }, explanation_markdown: "Current explanation", explanation_latex: null, difficulty: "foundational", calculator_allowed: false, estimated_time_seconds: null, source_type: "manual", status: "draft", created_by: "learner-a", created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z" };
