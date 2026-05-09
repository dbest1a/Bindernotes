import type { WorkspaceModuleId } from "@/types";

export type RecallSourceType =
  | "manual"
  | "selected_text"
  | "highlight"
  | "note"
  | "sticky"
  | "chemistry_observation"
  | "math_tool"
  | "history_evidence";

export type RecallCreatedVia = RecallSourceType;

export type RecallDraftStatus = "draft" | "accepted" | "rejected" | "needs_review";

export type RecallQualityStatus =
  | "good"
  | "too_vague"
  | "duplicate"
  | "wrong"
  | "source_gap";

export type RecallCardStatus =
  | "Draft"
  | "Needs review"
  | "Learning"
  | "Weak"
  | "Confused"
  | "Source gap"
  | "Strong"
  | "Mastered"
  | "Duplicate"
  | "Too vague"
  | "Wrong";

export type RecallDifficulty = "new" | "again" | "hard" | "good" | "easy";

export type RecallCardType =
  | "basic_qa"
  | "term_definition"
  | "cloze"
  | "concept_example"
  | "example_concept"
  | "compare_contrast"
  | "process_steps"
  | "source_evidence"
  | "misconception"
  | "formula_meaning"
  | "worked_step"
  | "graph_interpretation"
  | "common_error"
  | "proof_step"
  | "definition_theorem"
  | "element_fact"
  | "ion_charge"
  | "reaction_balancing"
  | "safety_reagent"
  | "lab_observation"
  | "titration_concept"
  | "lab_cause_effect"
  | "stoichiometry_step"
  | "event_context"
  | "cause_effect"
  | "evidence_claim"
  | "source_quote_interpretation"
  | "timeline_ordering"
  | "argument_building"
  | "myth_check"
  | "claim_evidence_reasoning"
  | "vocabulary"
  | "revision_checklist"
  | "prompt_outline";

export type RecallReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type RecallMissReason =
  | "Forgot term"
  | "Confused similar concept"
  | "Did not understand source"
  | "Careless error"
  | "Need example"
  | "Card is wrong/vague"
  | "Other";

export type RecallCard = {
  id: string;
  userId?: string | null;
  binderId: string;
  documentId: string;
  lessonId: string;
  sourceType: RecallSourceType;
  sourceId?: string | null;
  sourceExcerpt?: string | null;
  sourceAnchor?: string | null;
  front: string;
  back: string;
  explanation?: string;
  whyItMatters?: string;
  tags: string[];
  subject?: string | null;
  cardType: RecallCardType;
  status: RecallCardStatus;
  difficulty: RecallDifficulty;
  confidence: number;
  lastReviewedAt?: string | null;
  nextReviewAt?: string | null;
  reviewCount: number;
  lapseCount: number;
  createdVia: RecallCreatedVia;
  draftStatus: RecallDraftStatus;
  qualityStatus?: RecallQualityStatus;
  missReasons?: Array<{ reason: RecallMissReason; note?: string; createdAt: string }>;
  teachBackReflections?: Array<{ text: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
};

export type RecallCardDraft = RecallCard & {
  draftStatus: "draft" | "needs_review";
};

export type RecallDeckScope = {
  userId?: string | null;
  binderId: string;
  documentId: string;
  lessonId: string;
};

export type RecallDraftContext = RecallDeckScope & {
  subject?: string | null;
  tags?: string[];
};

export type RecallSourceSeed = {
  id?: string | null;
  text: string;
  anchor?: string | null;
  tags?: string[];
  sourceType?: RecallSourceType;
  createdVia?: RecallCreatedVia;
};

export type RecallDraftInput = {
  text?: string;
  front?: string;
  back?: string;
  explanation?: string;
  whyItMatters?: string;
  tags?: string[];
  cardType?: RecallCardType;
  source?: RecallSourceSeed;
  sources?: RecallSourceSeed[];
};

export type RecallDraftCapability =
  | "supportsDrafts"
  | "supportsSourceLinks"
  | "supportsCloze"
  | "supportsBatchCreate"
  | "requiresUserReview";

export type RecallDraftProvider = {
  id:
    | "manualCardProvider"
    | "selectedTextDraftProvider"
    | "highlightDraftProvider"
    | "noteDraftProvider"
    | "stickyDraftProvider"
    | "subjectToolDraftProvider";
  label: string;
  capabilities: RecallDraftCapability[];
  createDrafts: (input: RecallDraftInput, context: RecallDraftContext) => RecallCardDraft[];
};

export type RecallPracticeMode =
  | "Flip"
  | "Type answer"
  | "Cloze"
  | "Multiple choice"
  | "Pair Builder"
  | "Teach-back"
  | "Mistake review"
  | "Checkpoint"
  | "Guided Recall";

export type RecallSessionGoal =
  | "Quick warmup"
  | "Checkpoint prep"
  | "Weak spots"
  | "Current lesson"
  | "Binder review"
  | "Subject review";

export type RecallSessionSummary = {
  id: string;
  scope: RecallDeckScope;
  mode: RecallPracticeMode;
  goal?: RecallSessionGoal;
  cardIds: string[];
  correct: number;
  missed: number;
  score: number;
  missedConcepts: string[];
  createdAt: string;
};

export type RecallHealthSummary = {
  dueCards: number;
  weakCards: number;
  masteredCards: number;
  sourceGaps: number;
  cardsFromNotes: number;
  cardsFromHighlights: number;
  cardsFromCurrentLesson: number;
  latestSessionScore?: number;
};

export type RecallToolLaunch = {
  moduleId: WorkspaceModuleId;
  source?: RecallSourceType;
};
