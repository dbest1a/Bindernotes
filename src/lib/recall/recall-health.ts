import { isRecallCardDue } from "@/lib/recall/recall-scheduler";
import type {
  RecallCard,
  RecallHealthSummary,
  RecallSessionSummary,
} from "@/lib/recall/recall-types";

export function summarizeRecallHealth(
  cards: RecallCard[],
  options: {
    lessonId?: string | null;
    sessions?: RecallSessionSummary[];
    now?: Date;
  } = {},
): RecallHealthSummary {
  const accepted = cards.filter((card) => card.draftStatus === "accepted");
  const now = options.now ?? new Date();

  return {
    dueCards: accepted.filter((card) => isRecallCardDue(card, now)).length,
    weakCards: accepted.filter((card) => ["Weak", "Confused"].includes(card.status)).length,
    masteredCards: accepted.filter((card) => card.status === "Mastered").length,
    sourceGaps: cards.filter((card) => card.status === "Source gap" || card.qualityStatus === "source_gap").length,
    cardsFromNotes: cards.filter((card) => card.createdVia === "note").length,
    cardsFromHighlights: cards.filter((card) => card.createdVia === "highlight").length,
    cardsFromCurrentLesson: cards.filter((card) => card.lessonId === options.lessonId).length,
    latestSessionScore: options.sessions?.[0]?.score,
  };
}
