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
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/hooks/use-auth";

export function useMathCourses() {
  const { profile } = useAuth();
  return useQuery({
    enabled: Boolean(profile),
    queryKey: queryKeys.math.coursesForProfile(profile?.id),
    queryFn: listMathCourses,
  });
}

export function useMathCourseBundle(courseSlug?: string) {
  const { profile } = useAuth();
  return useQuery({
    enabled: Boolean(courseSlug && profile),
    queryKey: queryKeys.math.course(courseSlug, profile?.id),
    queryFn: () => getMathCourseBundle(courseSlug!),
  });
}

export function useMathModules() {
  const { profile } = useAuth();
  return useQuery({
    enabled: Boolean(profile),
    queryKey: queryKeys.math.modulesForProfile(profile?.id),
    queryFn: () => listMathModules(),
  });
}

export function useMathModuleBundle(moduleSlug?: string, userId?: string) {
  const { profile } = useAuth();
  const ownerId = userId ?? profile?.id;
  return useQuery({
    enabled: Boolean(moduleSlug && ownerId && ownerId === profile?.id),
    queryKey: queryKeys.math.module(moduleSlug, ownerId ?? "guest"),
    queryFn: () => getMathModuleBundle(moduleSlug!, ownerId),
  });
}

export function useQuestionBank(filters: Parameters<typeof listQuestions>[0] = {}) {
  const { profile } = useAuth();
  return useQuery({
    enabled: Boolean(profile),
    queryKey: queryKeys.math.questions(filters, profile?.id),
    queryFn: () => listQuestions(filters),
  });
}

export function useQuizSet(quizId?: string) {
  const { profile } = useAuth();
  return useQuery({
    enabled: Boolean(quizId && profile),
    queryKey: queryKeys.math.quiz(quizId, profile?.id),
    queryFn: () => getQuizSet(quizId!),
  });
}

export function useSaveMathGraphState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveGraphStateInput) => saveGraphState(input),
    onSuccess: (graphState) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.math.moduleBundles,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.math.graphStates(graphState.module_id, graphState.user_id ?? undefined),
      });
    },
  });
}

export function useSaveQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: QuestionInput) => saveQuestion(input),
    onSuccess: (question) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.math.questionBanks });
      if (question.module_id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.math.moduleBundles });
      }
    },
  });
}

export function useCreateQuizSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuizSet,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.math.quizzes });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.math.quiz(input.quizSet.id, input.userId) });
    },
  });
}
