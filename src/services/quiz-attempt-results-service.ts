import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { QuestionBankItem } from "@/types/math-learning";

const jsonObject = z.record(z.string(), z.unknown());
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
export const savedQuizAttemptSchema = z.object({
  id: z.string().min(1),
  quiz_set_id: z.string().min(1),
  user_id: z.string().min(1),
  started_at: timestamp,
  completed_at: timestamp.nullable(),
  score: z.number().finite().nonnegative().nullable(),
  total_points: z.number().finite().nonnegative().nullable(),
  metadata_json: jsonObject.nullable(),
});
export const savedQuestionAttemptSchema = z.object({
  id: z.string().min(1),
  quiz_attempt_id: z.string().min(1),
  question_id: z.string().min(1),
  user_id: z.string().min(1),
  submitted_answer_json: jsonObject,
  is_correct: z.boolean().nullable(),
  points_awarded: z.number().finite().nonnegative().nullable(),
  feedback_json: jsonObject.nullable(),
  created_at: timestamp,
});
export const savedQuestionSnapshotSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  promptMarkdown: z.string(),
  promptLatex: z.string().nullable(),
  explanationMarkdown: z.string().nullable(),
  type: z.string(),
  choices: z.array(z.object({ id: z.string(), label: z.string() })),
});
export type SavedQuizAttempt = z.infer<typeof savedQuizAttemptSchema>;
export type SavedQuestionAttempt = z.infer<typeof savedQuestionAttemptSchema>;
export type QuizAttemptResults = { attempt: SavedQuizAttempt; answers: SavedQuestionAttempt[] };

export function snapshotQuestion(question: QuestionBankItem): z.infer<typeof savedQuestionSnapshotSchema> {
  return {
    id: question.id,
    title: question.title,
    promptMarkdown: question.prompt_markdown,
    promptLatex: question.prompt_latex,
    explanationMarkdown: question.explanation_markdown,
    type: question.type,
    choices: (question.choices ?? []).map((choice) => ({ id: choice.id, label: choice.choice_text })),
  };
}

export async function getQuizAttemptResults(input: {
  attemptId: string;
  quizId: string;
  ownerId: string;
  signal?: AbortSignal;
}): Promise<QuizAttemptResults | null> {
  if (!input.attemptId.trim() || !input.quizId.trim() || !input.ownerId.trim())
    throw new Error("A signed-in account and saved attempt are required.");
  if (!supabase) throw new Error("Account storage is unavailable. Saved quiz results cannot be loaded.");
  input.signal?.throwIfAborted();
  const attemptQuery = supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", input.attemptId)
    .eq("quiz_set_id", input.quizId)
    .eq("user_id", input.ownerId);
  if (input.signal) attemptQuery.abortSignal(input.signal);
  const { data, error } = await attemptQuery.maybeSingle();
  input.signal?.throwIfAborted();
  if (error) throw new Error("Could not load the saved quiz attempt. Please try again.");
  if (!data) return null;
  const parsedAttempt = savedQuizAttemptSchema.safeParse(data);
  if (!parsedAttempt.success)
    throw new Error("The saved quiz attempt has invalid data and could not be displayed.");
  const attempt = parsedAttempt.data;
  if (
    attempt.id !== input.attemptId ||
    attempt.quiz_set_id !== input.quizId ||
    attempt.user_id !== input.ownerId
  ) {
    throw new Error("The saved quiz attempt is unavailable for this account.");
  }

  // PostgREST limits responses by default. Page in a stable order to avoid silently omitting answers.
  const answers: SavedQuestionAttempt[] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const answersQuery = supabase
      .from("question_attempts")
      .select("*")
      .eq("quiz_attempt_id", input.attemptId)
      .eq("user_id", input.ownerId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (input.signal) answersQuery.abortSignal(input.signal);
    const response = await answersQuery;
    input.signal?.throwIfAborted();
    if (response.error) throw new Error("Could not load saved answers. Please try again.");
    const parsedAnswers = z.array(savedQuestionAttemptSchema).safeParse(response.data);
    if (!parsedAnswers.success)
      throw new Error("The saved answers have invalid data and could not be displayed.");
    if (
      parsedAnswers.data.some(
        (answer) => answer.quiz_attempt_id !== input.attemptId || answer.user_id !== input.ownerId,
      )
    ) {
      throw new Error("The saved answers are unavailable for this account.");
    }
    answers.push(...parsedAnswers.data);
    if (parsedAnswers.data.length < pageSize) break;
  }
  return { attempt, answers };
}
