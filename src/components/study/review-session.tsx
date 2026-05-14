import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buildStudySessionSummary, type StudyReviewRating } from "@/lib/study-scheduler";
import type { StudyItem, StudyReviewEvent } from "@/services/study-items-service";
import { ReviewCard } from "@/components/study/review-card";

export function ReviewSession({
  items,
  onRate,
}: {
  items: StudyItem[];
  onRate: (item: StudyItem, rating: StudyReviewRating, response: string) => StudyReviewEvent;
}) {
  const [reviewedItemIds, setReviewedItemIds] = useState<Set<string>>(() => new Set());
  const [response, setResponse] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [events, setEvents] = useState<StudyReviewEvent[]>([]);
  const activeItem = items.find((item) => !reviewedItemIds.has(item.id)) ?? null;
  const summary = useMemo(
    () => buildStudySessionSummary({ events, items }),
    [events, items],
  );

  const rateActive = (rating: StudyReviewRating) => {
    if (!activeItem) {
      return;
    }
    const event = onRate(activeItem, rating, response);
    setEvents((current) => [...current, event]);
    setReviewedItemIds((current) => {
      const next = new Set(current);
      next.add(activeItem.id);
      return next;
    });
    setResponse("");
    setRevealed(false);
  };

  return (
    <section
      aria-label="Study Session"
      className="review-session grid gap-4"
      data-mobile-review-mode="one-card"
      data-testid="review-session"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Study Session</p>
          <h2 className="text-2xl font-semibold tracking-tight">One card at a time</h2>
        </div>
        <Badge variant="secondary">{events.length} reviewed</Badge>
      </div>

      {activeItem ? (
        <ReviewCard
          item={activeItem}
          onRate={rateActive}
          onResponseChange={setResponse}
          onReveal={() => setRevealed(true)}
          response={response}
          revealed={revealed}
        />
      ) : items.length ? (
        <SessionSummaryView summary={summary} />
      ) : (
        <EmptyState
          description="Add a note, highlight, formula, problem, or mistake to review before starting a session."
          title="No due study items"
        />
      )}

      {events.length > 0 && activeItem ? <SessionSummaryView compact summary={summary} /> : null}
    </section>
  );
}

function SessionSummaryView({
  compact = false,
  summary,
}: {
  compact?: boolean;
  summary: ReturnType<typeof buildStudySessionSummary>;
}) {
  return (
    <aside className="rounded-lg border border-border/70 bg-card/82 p-4" data-testid="review-session-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Session summary</h3>
        <Badge variant="outline">{summary.itemsReviewed} items</Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Items reviewed</dt>
          <dd className="font-semibold">{summary.itemsReviewed}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hard items</dt>
          <dd className="font-semibold">{summary.hardItems.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Next due</dt>
          <dd className="font-semibold">{summary.nextDue ? formatDue(summary.nextDue) : "Nothing scheduled"}</dd>
        </div>
      </dl>
      {!compact || summary.hardItems.length ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary.suggestedNextStep}</p>
      ) : null}
    </aside>
  );
}

function formatDue(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
