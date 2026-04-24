import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeQuizAttempt,
  createQuizSet,
  getMathCourseBundle,
  getMathModuleBundle,
  getQuizSet,
  listMathCourses,
  listMathModules,
  listQuestions,
  saveGraphState,
  saveQuestion,
  startQuizAttempt,
  submitQuestionAttempt,
  type QuestionInput,
  type SaveGraphStateInput,
} from "@/services/math-learning-service";
import type { QuestionBankItem, QuizSet } from "@/types/math-learning";
import type { SubmittedQuestionAnswer } from "@/lib/question-scoring";

export function useMathCourses() {
  return useQuery({
    queryKey: ["math", "courses"],
    queryFn: listMathCourses,
  });
}

export function useMathCourseBundle(courseSlug?: string) {
  return useQuery({
    enabled: Boolean(courseSlug),
    queryKey: ["math", "course", courseSlug],
    queryFn: () => getMathCourseBundle(courseSlug!),
  });
}

export function useMathModules() {
  return useQuery({
    queryKey: ["math", "modules"],
    queryFn: () => listMathModules(),
  });
}

export function useMathModuleBundle(moduleSlug?: string, userId?: string) {
  return useQuery({
    enabled: Boolean(moduleSlug),
    queryKey: ["math", "module", moduleSlug, userId ?? "guest"],
    queryFn: () => getMathModuleBundle(moduleSlug!, userId),
  });
}

export function useQuestionBank(filters: Parameters<typeof listQuestions>[0] = {}) {
  return useQuery({
    queryKey: ["math", "questions", filters],
    queryFn: () => listQuestions(filters),
  });
}

export function useQuizSet(quizId?: string) {
  return useQuery({
    enabled: Boolean(quizId),
    queryKey: ["math", "quiz", quizId],
    queryFn: () => getQuizSet(quizId!),
  });
}

export function useSaveMathGraphState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveGraphStateInput) => saveGraphState(input),
    onSuccess: (graphState) => {
      void queryClient.invalidateQueries({
        queryKey: ["math", "module"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["math", "graph-states", graphState.module_id],
      });
    },
  });
}

export function useSaveQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: QuestionInput) => saveQuestion(input),
    onSuccess: (question) => {
      void queryClient.invalidateQueries({ queryKey: ["math", "questions"] });
      if (question.module_id) {
        void queryClient.invalidateQueries({ queryKey: ["math", "module"] });
      }
    },
  });
}

export function useCreateQuizSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuizSet,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["math", "quiz"] });
    },
  });
}

export function useStartQuizAttempt() {
  return useMutation({
    mutationFn: startQuizAttempt,
  });
}

export function useSubmitQuestionAttempt() {
  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      userId: string;
      question: QuestionBankItem;
      answer: SubmittedQuestionAnswer;
    }) => submitQuestionAttempt(input),
  });
}

export function useCompleteQuizAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      attemptId: string;
      quizSet: QuizSet;
      userId: string;
      scores: Array<{ pointsAwarded: number | null; totalPoints: number }>;
    }) => completeQuizAttempt(input),
    onSuccess: (_attempt, input) => {
      void queryClient.invalidateQueries({ queryKey: ["math", "quiz", input.quizSet.id] });
    },
  });
}
