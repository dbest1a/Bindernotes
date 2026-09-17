import { useQuery } from "@tanstack/react-query";
import { getQuizAttemptResults } from "@/services/quiz-attempt-results-service";

export function useQuizAttemptResults(quizId?: string, attemptId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ["math", "quiz-attempt", ownerId, quizId, attemptId],
    enabled: Boolean(quizId && attemptId && ownerId),
    queryFn: ({ signal }) => {
      if (!quizId || !attemptId || !ownerId)
        throw new Error("A saved attempt and signed-in account are required.");
      return getQuizAttemptResults({ quizId, attemptId, ownerId, signal });
    },
  });
}
