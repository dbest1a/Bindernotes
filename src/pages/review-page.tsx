import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, Filter, NotebookTabs, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewSession } from "@/components/study/review-session";
import { useAuth } from "@/hooks/use-auth";
import { useBetaFeatures } from "@/hooks/use-beta-features";
import { bucketStudyItems, type StudyReviewRating } from "@/lib/study-scheduler";
import {
  createStudyItem,
  listStudyItems,
  recordStudyReviewEvent,
  type StudyItem,
} from "@/services/study-items-service";

type ReviewTab = "due" | "upcoming" | "difficult" | "mastered" | "binder" | "mistakes";

const baseReviewTabs: Array<{ id: ReviewTab; label: string }> = [
  { id: "due", label: "Due today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "difficult", label: "Difficult" },
  { id: "mastered", label: "Mastered" },
  { id: "binder", label: "By binder/course" },
];

export function ReviewPage() {
  const { profile } = useAuth();
  const betaFeatures = useBetaFeatures(profile?.id);
  const mathStudyLoopBeta = betaFeatures.isFeatureEnabled("betaRevampMathStudyLoop");
  const reviewQueueBeta = betaFeatures.isFeatureEnabled("betaRevampReviewQueue");
  const [activeTab, setActiveTab] = useState<ReviewTab>("due");
  const [binderFilter, setBinderFilter] = useState("all");
  const [items, setItems] = useState<StudyItem[]>(() => (profile?.id ? listStudyItems(profile.id) : []));
  const [message, setMessage] = useState<string | null>(null);

  const buckets = useMemo(() => bucketStudyItems(items), [items]);
  const reviewTabs = useMemo(
    () => (mathStudyLoopBeta ? [...baseReviewTabs, { id: "mistakes" as const, label: "Review mistakes" }] : baseReviewTabs),
    [mathStudyLoopBeta],
  );
  const binderOptions = useMemo(
    () => [
      { id: "all", label: "All binders and courses" },
      ...buckets.byBinder.map((group) => ({ id: group.id, label: group.label })),
    ],
    [buckets.byBinder],
  );
  const visibleItems = useMemo(() => {
    const base =
      activeTab === "upcoming"
        ? buckets.upcoming
        : activeTab === "difficult"
          ? buckets.difficult
          : activeTab === "mastered"
          ? buckets.mastered
            : activeTab === "binder"
              ? items
              : activeTab === "mistakes"
                ? items.filter((item) => item.type === "mistake_review" || item.source_kind === "mistake")
                : buckets.dueToday;

    if (binderFilter === "all") {
      return base;
    }

    return base.filter((item) => (item.binder_id ?? item.course_id ?? "unfiled") === binderFilter);
  }, [activeTab, binderFilter, buckets.difficult, buckets.dueToday, buckets.mastered, buckets.upcoming, items]);

  if (!reviewQueueBeta) {
    return (
      <main className="app-page max-w-6xl" data-beta-revamp-review-queue="false" data-testid="review-page">
        <EmptyState
          description="Turn on Beta Revamp - Review Queue to test study items, spaced review, and study sessions."
          title="Review Queue is in beta"
        />
      </main>
    );
  }

  const refreshItems = () => {
    if (profile?.id) {
      setItems(listStudyItems(profile.id));
    }
  };

  const createStarterItem = () => {
    if (!profile?.id) {
      return;
    }
    createStudyItem({
      answer: "Write the source-linked answer in your own words before checking.",
      betaEnabled: reviewQueueBeta,
      ownerId: profile.id,
      prompt: "Explain one idea from today's notes.",
      sourceKind: "manual",
      sourceTitle: "Manual review item",
      type: "free_response",
    });
    refreshItems();
    setMessage("Review item added.");
  };

  const recordRating = (item: StudyItem, rating: StudyReviewRating, response: string) => {
    if (!profile?.id) {
      throw new Error("A real account is required for Review Queue.");
    }
    const result = recordStudyReviewEvent({
      betaEnabled: reviewQueueBeta,
      itemId: item.id,
      ownerId: profile.id,
      rating,
      response,
    });
    setItems(listStudyItems(profile.id));
    return result.event;
  };

  return (
    <main
      className="app-page grid max-w-[1540px] gap-6"
      data-beta-revamp-review-queue="true"
      data-testid="review-page"
    >
      <section className="page-shell grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <Badge variant="secondary">Beta Revamp</Badge>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Review Queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Turn notes, highlights, formulas, problems, and mistakes into active recall without open-ended homework AI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild variant="outline">
            <Link to="/notes">
              <NotebookTabs data-icon="inline-start" />
              Personal Notes
            </Link>
          </Button>
          <Button onClick={createStarterItem} type="button">
            <Plus data-icon="inline-start" />
            Add free-response item
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Due today" value={buckets.dueToday.length} />
        <MetricCard label="Upcoming" value={buckets.upcoming.length} />
        <MetricCard label="Difficult" value={buckets.difficult.length} />
        <MetricCard label="Mastered" value={buckets.mastered.length} />
      </section>

      {message ? <p className="rounded-lg border border-border/70 bg-card/85 px-3 py-2 text-sm" role="status">{message}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        <aside className="page-shell grid gap-4 p-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review queue filters">
            {reviewTabs.map((tab) => (
              <Button
                aria-pressed={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                size="sm"
                type="button"
                variant={activeTab === tab.id ? "default" : "outline"}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Filter className="size-4" />
              Filter by binder or course
            </span>
            <select
              aria-label="Filter by binder or course"
              className="appearance-select h-10 rounded-lg border border-border bg-background px-3 text-sm"
              onChange={(event) => setBinderFilter(event.target.value)}
              value={binderFilter}
            >
              {binderOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2" data-testid="review-items-list">
            {visibleItems.length ? (
              visibleItems.map((item) => (
                <article className="rounded-lg border border-border/70 bg-background/78 p-3" key={item.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.status === "difficult" ? "outline" : "secondary"}>{item.status}</Badge>
                    <Badge variant="outline">{item.type.replace(/_/g, " ")}</Badge>
                  </div>
                  <h2 className="mt-2 font-semibold">{item.prompt}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.binder_title ?? item.course_title ?? item.source_title ?? "Unfiled"} - due {formatDate(item.due_at)}
                  </p>
                </article>
              ))
            ) : (
              <EmptyState
                description="Add a note, highlight, formula, problem, or mistake to this queue."
                title="No items in this view"
              />
            )}
          </div>
        </aside>

        <section className="page-shell p-4">
          <div className="mb-4 flex items-center gap-2">
            <BookOpenCheck className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Study Session</h2>
          </div>
          <ReviewSession items={visibleItems.filter((item) => item.status !== "mastered")} onRate={recordRating} />
        </section>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/84 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}
