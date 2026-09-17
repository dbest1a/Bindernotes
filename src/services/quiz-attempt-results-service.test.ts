import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeQuizAttempt, startQuizAttempt, submitQuestionAttempt } from "@/services/math-learning-service";
import { getQuizAttemptResults } from "@/services/quiz-attempt-results-service";
import type { QuestionBankItem, QuizSet } from "@/types/math-learning";

type Row = Record<string, unknown>;
const database = vi.hoisted(() => ({
  tables: { quiz_attempts: [] as Row[], question_attempts: [] as Row[] },
  owner: "learner-a", failTable: "", bypassFilters: false, afterRead: null as null | (() => void), from: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from: database.from } }));

beforeEach(() => {
  database.tables = { quiz_attempts: [], question_attempts: [] };
  database.owner = "learner-a";
  database.failTable = "";
  database.bypassFilters = false;
  database.afterRead = null;
  database.from.mockReset().mockImplementation((table: string) => {
    if (table !== "quiz_attempts" && table !== "question_attempts") throw new Error(`Unexpected table ${table}`);
    const filters: Array<[string, unknown]> = [];
    let write: { kind: "insert" | "upsert" | "update"; row: Row } | null = null;
    let start = 0;
    let end = Infinity;
    const execute = (single: boolean) => {
      if (database.failTable === table) return { data: null, error: { message: "private backend details" } };
      let rows = database.tables[table];
      const matches = (row: Row) => database.bypassFilters || (row.user_id === database.owner && filters.every(([key, value]) => row[key] === value));
      if (write) {
        if (write.row.user_id !== undefined && write.row.user_id !== database.owner) return { data: null, error: { message: "denied" } };
        if (write.kind === "update") {
          rows = rows.map((row) => matches(row) ? { ...row, ...write?.row } : row);
        } else {
          const existing = rows.find((row) => row.id === write?.row.id);
          if (existing && (write.kind === "insert" || existing.user_id !== database.owner)) return { data: null, error: { message: "duplicate or denied" } };
          const saved = structuredClone(write.row);
          rows = [...rows.filter((row) => row.id !== saved.id), saved];
          filters.push(["id", saved.id]);
        }
        database.tables[table] = rows;
      }
      const selected = rows.filter(matches).slice(start, end + 1);
      database.afterRead?.();
      return { data: single ? selected[0] ?? null : selected, error: null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query,
      range: (from: number, to: number) => { start = from; end = to; return query; },
      abortSignal: () => query,
      insert: (row: Row) => { write = { kind: "insert", row }; return query; },
      upsert: (row: Row) => { write = { kind: "upsert", row }; return query; },
      update: (row: Row) => { write = { kind: "update", row }; return query; },
      single: async () => execute(true),
      maybeSingle: async () => execute(true),
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute(false)).then(resolve),
    };
    return query;
  });
});

describe("saved quiz attempt repository", () => {
  it.each([NaN, Infinity, -1, 2])("rejects invalid awarded points %s before storing a completion", async (pointsAwarded) => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    await expect(completeQuizAttempt({ attemptId: attempt.id, quizSet: quiz, userId: database.owner, scores: [{ pointsAwarded, totalPoints: 1 }] })).rejects.toThrow(/invalid scoring data/);
    expect(database.tables.quiz_attempts[0].completed_at).toBeNull();
  });

  it("saves, completes, and reopens the exact attempt with unchanged answers, scores and original question context", async () => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner, quizTitle: quiz.title });
    const zeroQuestion = question("zero", 0);
    const zero = await submitQuestionAttempt({ attemptId: attempt.id, userId: database.owner, question: zeroQuestion, answer: { numeric: "" } });
    const correct = await submitQuestionAttempt({ attemptId: attempt.id, userId: database.owner, question: question("twelve", 12), answer: { numeric: "12" } });
    await completeQuizAttempt({ attemptId: attempt.id, quizSet: quiz, userId: database.owner, scores: [zero.score, correct.score] });
    const other = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    zeroQuestion.prompt_markdown = "Changed after submission";
    zeroQuestion.answer_json.expected = 123;
    const reopened = await getQuizAttemptResults({ attemptId: attempt.id, quizId: quiz.id, ownerId: database.owner });
    expect(reopened?.attempt).toMatchObject({ id: attempt.id, score: 1, total_points: 2, metadata_json: { quizTitle: "Saved algebra" } });
    expect(reopened?.attempt.id).not.toBe(other.id);
    expect(reopened?.answers.map((answer) => [answer.submitted_answer_json, answer.is_correct, answer.points_awarded])).toEqual([
      [{ numeric: "" }, false, 0], [{ numeric: "12" }, true, 1],
    ]);
    expect(reopened?.answers[0].feedback_json?.questionSnapshot).toMatchObject({ promptMarkdown: "Original zero question" });
  });

  it("retries a question write without creating a second answer record", async () => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    const input = { attemptId: attempt.id, userId: database.owner, question: question("one", 1) };
    await submitQuestionAttempt({ ...input, answer: { numeric: "0" } });
    await submitQuestionAttempt({ ...input, answer: { numeric: "1" } });
    expect(database.tables.question_attempts).toHaveLength(1);
    expect(database.tables.question_attempts[0]).toMatchObject({ is_correct: true, submitted_answer_json: { numeric: "1" } });
  });

  it("does not substitute another attempt, quiz, or account", async () => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    expect(await getQuizAttemptResults({ attemptId: "missing", quizId: quiz.id, ownerId: database.owner })).toBeNull();
    expect(await getQuizAttemptResults({ attemptId: attempt.id, quizId: "other-quiz", ownerId: database.owner })).toBeNull();
    database.owner = "learner-b";
    expect(await getQuizAttemptResults({ attemptId: attempt.id, quizId: quiz.id, ownerId: "learner-b" })).toBeNull();
    expect(await getQuizAttemptResults({ attemptId: attempt.id, quizId: quiz.id, ownerId: "learner-a" })).toBeNull();
  });

  it("rejects a response containing another owner's attempt even if an upstream boundary malfunctions", async () => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    database.bypassFilters = true;
    await expect(getQuizAttemptResults({ attemptId: attempt.id, quizId: quiz.id, ownerId: "learner-b" })).rejects.toThrow(/unavailable for this account/);
  });

  it("paginates answers instead of reporting a partial response as the complete saved work", async () => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    const saved = await submitQuestionAttempt({ attemptId: attempt.id, userId: database.owner, question: question("one", 1), answer: { numeric: 1 } });
    database.tables.question_attempts = Array.from({ length: 251 }, (_, index) => ({ ...saved.attempt, id: `row-${index}`, question_id: `question-${index}` }));
    const reopened = await getQuizAttemptResults({ attemptId: attempt.id, quizId: quiz.id, ownerId: database.owner });
    expect(reopened?.answers).toHaveLength(251);
    expect(reopened?.answers.at(-1)?.question_id).toBe("question-250");
  });

  it("reports storage/invalid-data failures and respects aborted or superseded reads", async () => {
    const attempt = await startQuizAttempt({ quizSetId: quiz.id, userId: database.owner });
    const input = { attemptId: attempt.id, quizId: quiz.id, ownerId: database.owner };
    database.failTable = "question_attempts";
    await expect(getQuizAttemptResults(input)).rejects.toThrow("Could not load saved answers");
    database.failTable = "";
    database.tables.quiz_attempts[0].score = NaN;
    await expect(getQuizAttemptResults(input)).rejects.toThrow(/invalid data/);
    database.tables.quiz_attempts[0].score = null;
    const controller = new AbortController();
    database.afterRead = () => controller.abort();
    await expect(getQuizAttemptResults({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});

const quiz: QuizSet = { id: "quiz-a", user_id: "learner-a", course_id: null, topic_id: null, module_id: null, title: "Saved algebra", description: null, settings_json: {}, created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z" };
function question(id: string, expected: number): QuestionBankItem {
  return { id, course_id: null, topic_id: null, module_id: null, note_id: null, graph_state_id: null, type: "numeric", title: null, prompt_markdown: `Original ${id} question`, prompt_latex: null, answer_json: { expected, tolerance: 0 }, explanation_markdown: "Original explanation", explanation_latex: null, difficulty: "foundational", calculator_allowed: false, estimated_time_seconds: null, source_type: "manual", status: "draft", created_by: "learner-a", created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z" };
}
