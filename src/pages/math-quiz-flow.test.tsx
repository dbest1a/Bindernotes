// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("@/lib/supabase", () => ({ supabase: null }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ profile: { id: "learner-quiz", role: "learner" } }) }));
vi.mock("@/components/math/desmos-graph", () => ({ DesmosGraph: () => null, Desmos3DGraph: () => null }));
vi.mock("@/components/study/math-study-loop-panel", () => ({ MathStudyLoopPanel: () => null }));
import { MathQuizAttemptPage, MathQuizResultsPage } from "@/pages/math-learning-page";
import { createQuizSet, getQuizAttempt, saveQuestion } from "@/services/math-learning-service";

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}</output>; }
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Location /><Routes><Route path="/math/quizzes/:quizId/attempt" element={<MathQuizAttemptPage />} /><Route path="/math/quizzes/:quizId/results/:attemptId" element={<MathQuizResultsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
async function setupQuiz() {
  const question = await saveQuestion({ userId: "learner-quiz", type: "numeric", title: "Expected zero", promptMarkdown: "What is 2 minus 2?", answerJson: { expected: 0, tolerance: 0 }, difficulty: "foundational", calculatorAllowed: false, status: "published" });
  return createQuizSet({ userId: "learner-quiz", title: "Saved result test", questionIds: [question.id, "question-tangent-a-changes"] });
}
beforeEach(() => window.localStorage.clear());
afterEach(cleanup);
describe("Quiz attempt and saved result flow", () => {
  it("saves blank numbers as incomplete, keeps explanations ungraded, and reloads the saved result by attempt ID", async () => {
    const quiz = await setupQuiz();
    const first = mount(`/math/quizzes/${quiz.id}/attempt`);
    await screen.findByRole("button", { name: "Submit answers" });
    fireEvent.change(screen.getByLabelText("Answer: Moving the tangent point"), { target: { value: "It follows the selected point and takes the local derivative as its slope." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(await screen.findByText("Attempt completed")).toBeTruthy();
    expect(screen.getByText("Automatic score: 0 / 1")).toBeTruthy();
    expect(screen.getByText("Incomplete")).toBeTruthy();
    expect(screen.getByText("Ungraded · Self-review")).toBeTruthy();
    expect(screen.queryByText("Incorrect")).toBeNull();
    const path = screen.getByTestId("location").textContent!;
    const attemptId = path.split("/").at(-1)!;
    const saved = await getQuizAttempt(attemptId, quiz.id, "learner-quiz");
    expect(saved?.answers).toHaveLength(2);
    expect(saved?.attempt.total_points).toBe(1);
    expect(saved?.answers.find((answer) => answer.submitted_answer_json.numeric === undefined && answer.question_id !== "question-tangent-a-changes")?.submitted_answer_json).toEqual({});
    expect(await getQuizAttempt(attemptId, quiz.id, "another-learner")).toBeNull();
    expect(await getQuizAttempt(attemptId, "another-quiz", "learner-quiz")).toBeNull();
    first.unmount();
    mount(path);
    expect(await screen.findByText("Attempt completed")).toBeTruthy();
    expect(screen.getByText(/It follows the selected point/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retry quiz" }).getAttribute("href")).toBe(`/math/quizzes/${quiz.id}/attempt`);
  });

  it("accepts an explicitly entered zero in the same authored quiz flow", async () => {
    const quiz = await setupQuiz();
    mount(`/math/quizzes/${quiz.id}/attempt`);
    await screen.findByRole("button", { name: "Submit answers" });
    fireEvent.change(screen.getByLabelText("Answer: Expected zero"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(await screen.findByText("Automatic score: 1 / 1")).toBeTruthy();
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Incomplete")).toBeTruthy();
  });
});
