import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { StudyReviewRating } from "@/lib/study-scheduler";
import type { StudyItem } from "@/services/study-items-service";

const ratingLabels: Array<{ label: string; value: StudyReviewRating }> = [
  { label: "Forgot", value: "forgot" },
  { label: "Hard", value: "hard" },
  { label: "Good", value: "good" },
  { label: "Easy", value: "easy" },
];

export function ReviewCard({
  item,
  onRate,
  onReveal,
  onResponseChange,
  response,
  revealed,
}: {
  item: StudyItem;
  onRate: (rating: StudyReviewRating) => void;
  onReveal: () => void;
  onResponseChange: (value: string) => void;
  response: string;
  revealed: boolean;
}) {
  return (
    <article className="review-session-card grid gap-4" data-testid="review-session-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{formatStudyItemType(item.type)}</Badge>
        {item.binder_title ? <Badge variant="outline">{item.binder_title}</Badge> : null}
        {item.source_kind ? <Badge variant="outline">{formatSourceKind(item.source_kind)}</Badge> : null}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prompt</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{item.prompt}</h2>
      </div>
      {item.source_excerpt ? (
        <blockquote className="rounded-lg border-l-2 border-primary/45 bg-secondary/35 px-3 py-2 text-sm leading-6 text-muted-foreground">
          {item.source_excerpt}
        </blockquote>
      ) : null}
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Student response</span>
        <Textarea
          aria-label="Student response"
          onChange={(event) => onResponseChange(event.target.value)}
          placeholder="Explain it in your own words before checking."
          value={response}
        />
      </label>
      <div className="grid gap-3 rounded-lg border border-border/70 bg-background/72 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Answer</p>
          <Button onClick={onReveal} size="sm" type="button" variant={revealed ? "secondary" : "outline"}>
            Reveal / check
          </Button>
        </div>
        {revealed ? (
          <p className="text-sm leading-6 text-muted-foreground">{item.answer}</p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">Try recall first. The answer stays hidden until you reveal it.</p>
        )}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-semibold">Rate this review</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ratingLabels.map((rating) => (
            <Button
              disabled={!revealed}
              key={rating.value}
              onClick={() => onRate(rating.value)}
              type="button"
              variant={rating.value === "forgot" || rating.value === "hard" ? "outline" : "default"}
            >
              {rating.label}
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}

function formatStudyItemType(type: StudyItem["type"]) {
  return type
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceKind(kind: StudyItem["source_kind"]) {
  return kind[0]?.toUpperCase() + kind.slice(1);
}
