import type {
  RecallCard,
  RecallDeckScope,
  RecallPracticeMode,
  RecallReviewRating,
  RecallSessionGoal,
  RecallSessionSummary,
} from "@/lib/recall/recall-types";

const dayMs = 24 * 60 * 60 * 1000;

export function normalizeRecallAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function compareRecallAnswer(answer: string, expected: string) {
  const normalizedAnswer = normalizeRecallAnswer(answer);
  const normalizedExpected = normalizeRecallAnswer(expected);

  if (!normalizedAnswer || !normalizedExpected) {
    return false;
  }

  return (
    normalizedAnswer === normalizedExpected ||
    normalizedExpected.includes(normalizedAnswer) ||
    normalizedAnswer.includes(normalizedExpected)
  );
}

function addDays(now: Date, days: number) {
  return new Date(now.getTime() + Math.max(0, days) * dayMs).toISOString();
}

function intervalDays(card: RecallCard, rating: RecallReviewRating) {
  const reviewScale = Math.max(1, Math.min(4, Math.floor(card.reviewCount / 2) + 1));
  switch (rating) {
    case "Again":
      return 0;
    case "Hard":
      return Math.max(1, Math.round(1 * reviewScale * 0.75));
    case "Good":
      return Math.max(3, Math.round(3 * reviewScale));
    case "Easy":
      return Math.max(7, Math.round(7 * reviewScale * 1.25));
  }
}

export function rateRecallCard(card: RecallCard, rating: RecallReviewRating, now = new Date()): RecallCard {
  const nextReviewCount = card.reviewCount + 1;
  const confidenceDelta: Record<RecallReviewRating, number> = {
    Again: -0.28,
    Hard: -0.08,
    Good: 0.18,
    Easy: 0.28,
  };
  const nextConfidence = Math.max(0, Math.min(1, card.confidence + confidenceDelta[rating]));
  const nextStatus =
    rating === "Again"
      ? "Weak"
      : rating === "Hard"
        ? nextReviewCount > 2
          ? "Learning"
          : "Weak"
        : rating === "Easy" && nextReviewCount >= 3
          ? "Mastered"
          : rating === "Easy"
            ? "Strong"
            : nextReviewCount >= 4 && nextConfidence > 0.7
              ? "Strong"
              : "Learning";

  return {
    ...card,
    confidence: nextConfidence,
    difficulty: rating.toLowerCase() as RecallCard["difficulty"],
    draftStatus: card.draftStatus === "draft" ? "accepted" : card.draftStatus,
    lastReviewedAt: now.toISOString(),
    lapseCount: rating === "Again" ? card.lapseCount + 1 : card.lapseCount,
    nextReviewAt: addDays(now, intervalDays(card, rating)),
    reviewCount: nextReviewCount,
    status: nextStatus,
    updatedAt: now.toISOString(),
  };
}

export function isRecallCardDue(card: RecallCard, now = new Date()) {
  if (card.draftStatus !== "accepted" || card.status === "Duplicate" || card.status === "Wrong") {
    return false;
  }

  if (!card.nextReviewAt) {
    return true;
  }

  return new Date(card.nextReviewAt).getTime() <= now.getTime();
}

function statusPriority(card: RecallCard) {
  if (card.status === "Source gap") return 0;
  if (card.status === "Weak" || card.status === "Confused") return 1;
  if (card.status === "Learning") return 2;
  if (card.status === "Strong") return 3;
  if (card.status === "Mastered") return 4;
  return 5;
}

export function buildGuidedRecallQueue(
  cards: RecallCard[],
  scope: Partial<RecallDeckScope> = {},
  goal: RecallSessionGoal = "Current lesson",
  now = new Date(),
) {
  const dueCards = cards.filter((card) => card.draftStatus === "accepted");

  return [...dueCards].sort((left, right) => {
    const leftDue = isRecallCardDue(left, now) ? 0 : 1;
    const rightDue = isRecallCardDue(right, now) ? 0 : 1;
    if (leftDue !== rightDue) return leftDue - rightDue;

    const leftScopeBoost =
      goal === "Current lesson" && scope.lessonId && left.lessonId === scope.lessonId ? -1 : 0;
    const rightScopeBoost =
      goal === "Current lesson" && scope.lessonId && right.lessonId === scope.lessonId ? -1 : 0;
    if (leftScopeBoost !== rightScopeBoost) return leftScopeBoost - rightScopeBoost;

    const statusDelta = statusPriority(left) - statusPriority(right);
    if (statusDelta !== 0) return statusDelta;

    const confidenceDelta = left.confidence - right.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function buildCheckpointSession(
  cards: RecallCard[],
  scope: RecallDeckScope,
  options: {
    count: number;
    modes: RecallPracticeMode[];
    goal?: RecallSessionGoal;
    now?: Date;
  },
): RecallSessionSummary {
  const now = options.now ?? new Date();
  const queue = buildGuidedRecallQueue(cards, scope, options.goal ?? "Checkpoint prep", now).slice(0, options.count);

  return {
    id: `recall-session-${now.getTime()}`,
    cardIds: queue.map((card) => card.id),
    correct: 0,
    createdAt: now.toISOString(),
    missed: 0,
    missedConcepts: [],
    mode: "Checkpoint",
    goal: options.goal,
    scope,
    score: 0,
  };
}
