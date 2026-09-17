import { z } from "zod";
import type { RecallCard, RecallSessionSummary } from "@/lib/recall/recall-types";
import type { StudyItem, StudyReviewEvent } from "@/services/study-items-service";
import { scheduleStudyItemReview, type StudyReviewRating } from "@/lib/study-scheduler";

const id = z.string().min(1).max(2000);
const owner = z.string().uuid();
const text = z.string().max(100000);
const nullableText = text.nullable();
const timestamp = z.string().datetime({ offset: true });
const count = z.number().int().min(0).max(10000000);
const unit = z.number().finite().min(0).max(1);
const sourceKind = z.enum(["manual", "selected_text", "highlight", "note", "sticky", "chemistry_observation", "math_tool", "history_evidence"]);
export const studyItemSchema = z.object({
  id, owner_id: owner, type: z.enum(["highlight_recall", "formula_card", "theorem_card", "worked_example", "mistake_review", "graph_explanation", "free_response", "numeric_problem", "multiple_choice"]),
  prompt: text, answer: text, source_kind: z.enum(["note", "highlight", "formula", "theorem", "problem", "mistake", "graph", "manual"]),
  source_id: id.nullable(), source_title: nullableText, source_excerpt: nullableText,
  binder_id: id.nullable(), binder_title: nullableText, course_id: id.nullable(), course_title: nullableText,
  due_at: timestamp, status: z.enum(["due", "upcoming", "difficult", "mastered"]), mastery: unit,
  review_count: count, lapse_count: count, created_at: timestamp, updated_at: timestamp,
}).strict();
export const recallCardSchema: z.ZodType<RecallCard> = z.object({
  id, userId: owner, binderId: id, documentId: id, lessonId: id, sourceType: sourceKind,
  sourceId: id.nullable().optional(), sourceExcerpt: nullableText.optional(), sourceAnchor: nullableText.optional(),
  front: text, back: text, explanation: text.optional(), whyItMatters: text.optional(),
  tags: z.array(z.string().max(500)).max(200), subject: nullableText.optional(),
  cardType: z.enum(["basic_qa", "term_definition", "cloze", "concept_example", "example_concept", "compare_contrast", "process_steps", "source_evidence", "misconception", "formula_meaning", "worked_step", "graph_interpretation", "common_error", "proof_step", "definition_theorem", "element_fact", "ion_charge", "reaction_balancing", "safety_reagent", "lab_observation", "titration_concept", "lab_cause_effect", "stoichiometry_step", "event_context", "cause_effect", "evidence_claim", "source_quote_interpretation", "timeline_ordering", "argument_building", "myth_check", "claim_evidence_reasoning", "vocabulary", "revision_checklist", "prompt_outline"]),
  status: z.enum(["Draft", "Needs review", "Learning", "Weak", "Confused", "Source gap", "Strong", "Mastered", "Duplicate", "Too vague", "Wrong"]),
  difficulty: z.enum(["new", "again", "hard", "good", "easy"]), confidence: unit,
  lastReviewedAt: timestamp.nullable().optional(), nextReviewAt: timestamp.nullable().optional(), reviewCount: count, lapseCount: count,
  createdVia: sourceKind, draftStatus: z.enum(["draft", "accepted", "rejected", "needs_review"]),
  qualityStatus: z.enum(["good", "too_vague", "duplicate", "wrong", "source_gap"]).optional(),
  missReasons: z.array(z.object({ reason: z.enum(["Forgot term", "Confused similar concept", "Did not understand source", "Careless error", "Need example", "Card is wrong/vague", "Other"]), note: text.optional(), createdAt: timestamp }).strict()).max(10000).optional(),
  teachBackReflections: z.array(z.object({ text, createdAt: timestamp }).strict()).max(10000).optional(),
  createdAt: timestamp, updatedAt: timestamp,
}).strict();
export const studyReviewEventSchema: z.ZodType<StudyReviewEvent> = z.object({
  id, owner_id: owner, item_id: id, rating: z.enum(["forgot", "hard", "good", "easy"]), reviewed_at: timestamp,
  due_at_before: timestamp, due_at_after: timestamp, response_length: count,
}).strict();
export const recallSessionSchema: z.ZodType<RecallSessionSummary> = z.object({
  id, scope: z.object({ userId: owner, binderId: id, documentId: id, lessonId: id }).strict(),
  mode: z.enum(["Flip", "Type answer", "Cloze", "Multiple choice", "Pair Builder", "Teach-back", "Mistake review", "Checkpoint", "Guided Recall"]),
  goal: z.enum(["Quick warmup", "Checkpoint prep", "Weak spots", "Current lesson", "Binder review", "Subject review"]).optional(),
  cardIds: z.array(id).max(10000), correct: count, missed: count, score: z.number().finite().min(0).max(100),
  missedConcepts: z.array(text).max(10000), createdAt: timestamp,
}).strict();
export const canonicalReviewSchema = z.object({ schemaVersion: z.literal(1), item: studyItemSchema, recall: recallCardSchema.nullable() }).strict().superRefine((record, context) => {
  if (record.recall && (record.recall.userId !== record.item.owner_id || record.item.id !== recallCanonicalId(record.recall))) context.addIssue({ code: "custom", message: "Review ownership or identity mismatch" });
  if (record.recall && (record.recall.front !== record.item.prompt || record.recall.back !== record.item.answer || record.recall.confidence !== record.item.mastery || record.recall.reviewCount !== record.item.review_count || record.recall.lapseCount !== record.item.lapse_count || (record.recall.nextReviewAt ?? record.recall.createdAt) !== record.item.due_at)) context.addIssue({ code: "custom", message: "Review scheduling or content mismatch" });
});
export type CanonicalReviewRecord = z.infer<typeof canonicalReviewSchema>;
export type SavedReviewRecord = { record: CanonicalReviewRecord; revision: number };

export function recallCanonicalId(card: Pick<RecallCard, "id" | "binderId" | "documentId" | "lessonId">) {
  return `recall:${JSON.stringify([card.binderId, card.documentId, card.lessonId, card.id])}`;
}

export function canonicalFromRecall(raw: RecallCard, binderTitle: string | null = null): CanonicalReviewRecord {
  const card = recallCardSchema.parse(raw);
  return canonicalReviewSchema.parse({ schemaVersion: 1, recall: card, item: {
    id: recallCanonicalId(card), owner_id: card.userId, type: "free_response", prompt: card.front, answer: card.back,
    source_kind: card.sourceType === "highlight" ? "highlight" : card.sourceType === "note" ? "note" : "manual",
    source_id: card.sourceId ?? null, source_title: card.subject ?? null, source_excerpt: card.sourceExcerpt ?? null,
    binder_id: card.binderId, binder_title: binderTitle, course_id: null, course_title: null,
    due_at: card.nextReviewAt ?? card.createdAt,
    status: card.status === "Mastered" ? "mastered" : ["Weak", "Confused", "Source gap"].includes(card.status) ? "difficult" : "due",
    mastery: card.confidence, review_count: card.reviewCount, lapse_count: card.lapseCount, created_at: card.createdAt, updated_at: card.updatedAt,
  } });
}

export function reviewIsActive(record: CanonicalReviewRecord) {
  return !record.recall || (record.recall.draftStatus === "accepted" && !["Duplicate", "Wrong"].includes(record.recall.status));
}

/** One scheduling transition for all cloud reviews; migration does not reschedule old cards. */
export function scheduleCanonicalReview(record: CanonicalReviewRecord, rating: StudyReviewRating, now: Date, eventId: string, responseLength = 0) {
  const item = scheduleStudyItemReview(record.item, rating, now);
  const recall: RecallCard | null = record.recall ? {
    ...record.recall, front: item.prompt, back: item.answer, confidence: item.mastery,
    reviewCount: item.review_count, lapseCount: item.lapse_count, nextReviewAt: item.due_at,
    lastReviewedAt: now.toISOString(), updatedAt: item.updated_at, difficulty: rating === "forgot" ? "again" : rating,
    status: item.status === "mastered" ? "Mastered" : item.status === "difficult" ? "Weak" : "Learning",
  } : null;
  const event = studyReviewEventSchema.parse({ id: eventId, owner_id: item.owner_id, item_id: item.id, rating, reviewed_at: now.toISOString(), due_at_before: record.item.due_at, due_at_after: item.due_at, response_length: responseLength });
  return { record: canonicalReviewSchema.parse({ ...record, item, recall }), event };
}

export function canonicalFromStudy(raw: StudyItem): CanonicalReviewRecord {
  return canonicalReviewSchema.parse({ schemaVersion: 1, item: raw, recall: null });
}
