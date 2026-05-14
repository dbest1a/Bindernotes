export type StudyReviewRating = "forgot" | "hard" | "good" | "easy";

export type StudySchedulableItem = {
  id: string;
  prompt: string;
  due_at: string;
  status: "due" | "upcoming" | "difficult" | "mastered";
  mastery: number;
  review_count: number;
  lapse_count: number;
  binder_id: string | null;
  binder_title: string | null;
  course_id: string | null;
  course_title: string | null;
  updated_at: string;
};

export type StudySessionEventLike = {
  item_id: string;
  rating: StudyReviewRating;
  due_at_after: string;
};

const minuteMs = 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

export function scheduleStudyItemReview<T extends StudySchedulableItem>(
  item: T,
  rating: StudyReviewRating,
  now = new Date(),
): T {
  const nextReviewCount = item.review_count + 1;
  const nextMastery = clampMastery(item.mastery + masteryDelta(rating));
  const nextDue = new Date(now.getTime() + intervalMs(rating, nextReviewCount));
  const nextStatus =
    rating === "forgot" || rating === "hard"
      ? "difficult"
      : nextMastery >= 0.86 && nextReviewCount >= 3
        ? "mastered"
        : nextDue.getTime() <= now.getTime()
          ? "due"
          : "upcoming";

  return {
    ...item,
    due_at: nextDue.toISOString(),
    lapse_count: rating === "forgot" ? item.lapse_count + 1 : item.lapse_count,
    mastery: nextMastery,
    review_count: nextReviewCount,
    status: nextStatus,
    updated_at: now.toISOString(),
  };
}

export function bucketStudyItems<T extends StudySchedulableItem>(items: T[], now = new Date()) {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const dueToday = items
    .filter((item) => item.status !== "mastered" && Date.parse(item.due_at) <= endOfToday.getTime())
    .sort(sortByDue);
  const upcoming = items
    .filter((item) => item.status !== "mastered" && Date.parse(item.due_at) > endOfToday.getTime())
    .sort(sortByDue);
  const difficult = items
    .filter((item) => item.status === "difficult")
    .sort(sortByDue);
  const mastered = items
    .filter((item) => item.status === "mastered")
    .sort(sortByDue);
  const byBinder = Array.from(
    items.reduce((groups, item) => {
      const key = item.binder_id ?? item.course_id ?? "unfiled";
      const label = item.binder_title ?? item.course_title ?? "Unfiled";
      const group = groups.get(key) ?? { id: key, label, items: [] as T[] };
      group.items.push(item);
      groups.set(key, group);
      return groups;
    }, new Map<string, { id: string; label: string; items: T[] }>()),
  )
    .map(([, group]) => ({ ...group, items: group.items.sort(sortByDue) }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    byBinder,
    difficult,
    dueToday,
    mastered,
    upcoming,
  };
}

export function buildStudySessionSummary<T extends Pick<StudySchedulableItem, "id" | "prompt">>({
  events,
  items,
}: {
  events: StudySessionEventLike[];
  items: T[];
  now?: Date;
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const hardItems = events
    .filter((event) => event.rating === "forgot" || event.rating === "hard")
    .map((event) => itemById.get(event.item_id)?.prompt)
    .filter((prompt): prompt is string => Boolean(prompt));
  const nextDue = events
    .map((event) => event.due_at_after)
    .filter(Boolean)
    .sort()[0] ?? null;

  return {
    hardItems,
    itemsReviewed: events.length,
    nextDue,
    suggestedNextStep: hardItems.length
      ? "Review the hard items again before adding more new material."
      : "Keep the habit small: add one source-linked item after your next study block.",
  };
}

function intervalMs(rating: StudyReviewRating, reviewCount: number) {
  switch (rating) {
    case "forgot":
      return 10 * minuteMs;
    case "hard":
      return dayMs;
    case "good":
      return Math.max(3, reviewCount * 3) * dayMs;
    case "easy":
      return Math.max(7, reviewCount * 7) * dayMs;
  }
}

function masteryDelta(rating: StudyReviewRating) {
  switch (rating) {
    case "forgot":
      return -0.26;
    case "hard":
      return -0.06;
    case "good":
      return 0.24;
    case "easy":
      return 0.36;
  }
}

function clampMastery(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sortByDue(left: StudySchedulableItem, right: StudySchedulableItem) {
  const dueDelta = Date.parse(left.due_at) - Date.parse(right.due_at);
  if (dueDelta !== 0) {
    return dueDelta;
  }

  return left.prompt.localeCompare(right.prompt);
}
