import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  savedQuestionSnapshotSchema,
  type QuizAttemptResults,
  type SavedQuestionAttempt,
} from "@/services/quiz-attempt-results-service";

export function SavedQuizResults({ results }: { results: QuizAttemptResults }) {
  const { attempt, answers } = results;
  const title =
    typeof attempt.metadata_json?.quizTitle === "string" ? attempt.metadata_json.quizTitle : "Quiz";
  return (
    <main className="app-page max-w-[1120px]">
      <Card>
        <CardHeader>
          <CardTitle>{title} results</CardTitle>
          <CardDescription>
            Saved attempt from {new Date(attempt.started_at).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <h2 className="text-xl font-semibold">
            {attempt.completed_at
              ? `Score: ${attempt.score ?? "Not graded"} / ${attempt.total_points ?? "Not recorded"}`
              : "Incomplete attempt"}
          </h2>
          <p className="text-sm text-muted-foreground">
            These are the saved answers and scores from this attempt.
          </p>
          {answers.some((answer) => answer.is_correct === null && answer.points_awarded !== null) ? (
            <p className="text-sm text-muted-foreground">
              This total includes completion credit for responses awaiting review. It is not a count of
              mathematically correct answers.
            </p>
          ) : null}
          {answers.length ? (
            answers.map((answer) => <SavedAnswer answer={answer} key={answer.id} />)
          ) : (
            <p>No saved answers were recorded for this attempt.</p>
          )}
          <Button asChild className="justify-self-start">
            <Link to={`/math/quizzes/${encodeURIComponent(attempt.quiz_set_id)}/attempt`}>
              Start another attempt
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function SavedAnswer({ answer }: { answer: SavedQuestionAttempt }) {
  const parsed = savedQuestionSnapshotSchema.safeParse(answer.feedback_json?.questionSnapshot);
  const snapshot = parsed.success && parsed.data.id === answer.question_id ? parsed.data : null;
  const total = answer.feedback_json?.totalPoints;
  const feedback = answer.feedback_json?.message;
  const choiceLabels = new Map(snapshot?.choices.map((choice) => [choice.id, choice.label]) ?? []);
  return (
    <article className="rounded-lg border border-border/70 bg-background/75 p-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant={answer.is_correct ? "secondary" : "outline"}>
          {answer.is_correct === null ? "Saved for review" : answer.is_correct ? "Correct" : "Review"}
        </Badge>
        <span>
          {answer.points_awarded ?? "Not graded"}
          {typeof total === "number" && Number.isFinite(total) ? ` / ${total}` : " points"}
        </span>
      </div>
      <h3 className="mt-2 font-semibold">
        {snapshot?.title || snapshot?.promptMarkdown || `Question ${answer.question_id}`}
      </h3>
      {snapshot?.title && snapshot.promptMarkdown ? (
        <p className="mt-2 whitespace-pre-wrap">{snapshot.promptMarkdown}</p>
      ) : null}
      {snapshot?.promptLatex ? <p className="mt-2 whitespace-pre-wrap">{snapshot.promptLatex}</p> : null}
      {!snapshot ? (
        <p className="mt-2 text-sm text-muted-foreground">
          The original question text was not saved with this older attempt.
        </p>
      ) : null}
      <p className="mt-3 text-sm font-semibold">Your saved answer</p>
      <p className="whitespace-pre-wrap">{formatSavedAnswer(answer.submitted_answer_json, choiceLabels)}</p>
      {typeof feedback === "string" ? <p className="mt-3 text-sm">{feedback}</p> : null}
      {snapshot?.explanationMarkdown ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {snapshot.explanationMarkdown}
        </p>
      ) : null}
    </article>
  );
}

export function formatSavedAnswer(
  answer: Record<string, unknown>,
  choiceLabels = new Map<string, string>(),
): string {
  if (typeof answer.numeric === "string" || typeof answer.numeric === "number")
    return String(answer.numeric).trim() || "No answer submitted";
  if (typeof answer.booleanAnswer === "boolean") return answer.booleanAnswer ? "True" : "False";
  if (typeof answer.selectedChoiceId === "string")
    return choiceLabels.get(answer.selectedChoiceId) ?? answer.selectedChoiceId;
  const selection = answer.selectedChoiceIds ?? answer.orderedStepIds;
  if (Array.isArray(selection) && selection.every((value: unknown) => typeof value === "string")) {
    return (
      selection.map((value: string) => choiceLabels.get(value) ?? value).join(", ") || "No answer submitted"
    );
  }
  for (const value of [answer.text, answer.freeResponse]) {
    if (typeof value === "string") return value.trim() ? value : "No answer submitted";
  }
  return Object.keys(answer).length ? JSON.stringify(answer) : "No answer submitted";
}
