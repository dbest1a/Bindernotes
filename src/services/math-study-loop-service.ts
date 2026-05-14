import { createStudyItem, type StudyItem } from "@/services/study-items-service";
import type { CalculatorMode, MathGraphState, ModuleExpression } from "@/types/math-learning";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type MathMistakeType =
  | "algebra_error"
  | "setup_error"
  | "concept_misunderstanding"
  | "graph_interpretation"
  | "formula_misuse"
  | "arithmetic"
  | "proof_gap"
  | "notation"
  | "other";

export const mathMistakeTypeOptions: Array<{ value: MathMistakeType; label: string }> = [
  { value: "algebra_error", label: "Algebra error" },
  { value: "setup_error", label: "Setup error" },
  { value: "concept_misunderstanding", label: "Concept misunderstanding" },
  { value: "graph_interpretation", label: "Graph interpretation" },
  { value: "formula_misuse", label: "Formula misuse" },
  { value: "arithmetic", label: "Arithmetic" },
  { value: "proof_gap", label: "Proof gap" },
  { value: "notation", label: "Notation" },
  { value: "other", label: "Other" },
];

export type MathProblemLogEntry = {
  id: string;
  owner_id: string;
  problem_title: string;
  source: string;
  binder_id: string | null;
  binder_title: string | null;
  course_id: string | null;
  course_title: string | null;
  concept_tags: string[];
  attempt: string;
  final_answer: string;
  mistake_type: MathMistakeType;
  graph_link_id: string | null;
  formula_card_ids: string[];
  review_due_at: string | null;
  confidence: number;
  linked_review_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MathFormulaTheoremCard = {
  id: string;
  owner_id: string;
  kind: "formula" | "theorem";
  title: string;
  statement: string;
  plain_english_meaning: string;
  example_problem: string;
  common_mistake: string;
  proof_idea: string | null;
  graph_link_id: string | null;
  linked_review_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MathStudyGraphLink = {
  id: string;
  owner_id: string;
  graph_state_id: string;
  title: string;
  mode: Exclude<CalculatorMode, "none">;
  desmos_state: DesmosState;
  expressions: ModuleExpression[];
  reflection: string;
  problem_log_id: string | null;
  formula_card_id: string | null;
  note_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProblemLogEntryInput = {
  attempt: string;
  betaEnabled: boolean;
  binderId?: string | null;
  binderTitle?: string | null;
  conceptTags?: string[] | string;
  confidence: number;
  courseId?: string | null;
  courseTitle?: string | null;
  finalAnswer: string;
  formulaCardIds?: string[];
  graphLinkId?: string | null;
  mistakeType: MathMistakeType;
  now?: Date;
  ownerId: string;
  problemTitle: string;
  reviewDueAt?: string | null;
  source: string;
};

export type CreateFormulaTheoremCardInput = {
  betaEnabled: boolean;
  commonMistake: string;
  exampleProblem: string;
  graphLinkId?: string | null;
  kind: "formula" | "theorem";
  now?: Date;
  ownerId: string;
  plainEnglishMeaning: string;
  proofIdea?: string | null;
  reviewItemId?: string | null;
  statement: string;
  title: string;
};

export type SaveStudyGraphLinkInput = {
  betaEnabled: boolean;
  desmosState: DesmosState;
  expressions?: ModuleExpression[] | null;
  formulaCardId?: string | null;
  graphStateId?: string | null;
  mode: Exclude<CalculatorMode, "none">;
  noteId?: string | null;
  now?: Date;
  ownerId: string;
  problemLogId?: string | null;
  reflection: string;
  title: string;
};

export function mathStudyProblemLogsStorageKey(ownerId: string) {
  return `bindernotes:math-study-loop:problem-logs:v1:${safeStoragePart(ownerId)}`;
}

export function mathStudyFormulaCardsStorageKey(ownerId: string) {
  return `bindernotes:math-study-loop:formula-cards:v1:${safeStoragePart(ownerId)}`;
}

export function mathStudyGraphLinksStorageKey(ownerId: string) {
  return `bindernotes:math-study-loop:graph-links:v1:${safeStoragePart(ownerId)}`;
}

export function listProblemLogEntries(ownerId: string, storage = defaultStorage()): MathProblemLogEntry[] {
  return readArray<MathProblemLogEntry>(storage, mathStudyProblemLogsStorageKey(ownerId))
    .filter((entry) => entry.owner_id === ownerId)
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
}

export function listFormulaTheoremCards(ownerId: string, storage = defaultStorage()): MathFormulaTheoremCard[] {
  return readArray<MathFormulaTheoremCard>(storage, mathStudyFormulaCardsStorageKey(ownerId))
    .filter((card) => card.owner_id === ownerId)
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
}

export function listStudyGraphLinks(ownerId: string, storage = defaultStorage()): MathStudyGraphLink[] {
  return readArray<MathStudyGraphLink>(storage, mathStudyGraphLinksStorageKey(ownerId))
    .filter((link) => link.owner_id === ownerId)
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
}

export function createProblemLogEntry(
  input: CreateProblemLogEntryInput,
  storage = defaultStorage(),
): MathProblemLogEntry {
  assertMathStudyLoopBetaEnabled(input.betaEnabled);
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const entry: MathProblemLogEntry = {
    id: createId("math-problem-log"),
    owner_id: input.ownerId,
    problem_title: input.problemTitle.trim(),
    source: input.source.trim(),
    binder_id: input.binderId ?? null,
    binder_title: input.binderTitle ?? null,
    course_id: input.courseId ?? null,
    course_title: input.courseTitle ?? null,
    concept_tags: normalizeTags(input.conceptTags),
    attempt: input.attempt.trim(),
    final_answer: input.finalAnswer.trim(),
    mistake_type: input.mistakeType,
    graph_link_id: input.graphLinkId ?? null,
    formula_card_ids: input.formulaCardIds ?? [],
    review_due_at: input.reviewDueAt ?? null,
    confidence: clampConfidence(input.confidence),
    linked_review_item_id: null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  if (!entry.problem_title || !entry.source || !entry.attempt) {
    throw new Error("Problem logs need a title, source, and attempt.");
  }

  writeArray(storage, mathStudyProblemLogsStorageKey(input.ownerId), [
    entry,
    ...listProblemLogEntries(input.ownerId, storage),
  ]);
  return entry;
}

export function createFormulaTheoremCard(
  input: CreateFormulaTheoremCardInput,
  storage = defaultStorage(),
): MathFormulaTheoremCard {
  assertMathStudyLoopBetaEnabled(input.betaEnabled);
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const card: MathFormulaTheoremCard = {
    id: createId(`math-${input.kind}-card`),
    owner_id: input.ownerId,
    kind: input.kind,
    title: input.title.trim(),
    statement: input.statement.trim(),
    plain_english_meaning: input.plainEnglishMeaning.trim(),
    example_problem: input.exampleProblem.trim(),
    common_mistake: input.commonMistake.trim(),
    proof_idea: input.proofIdea?.trim() || null,
    graph_link_id: input.graphLinkId ?? null,
    linked_review_item_id: input.reviewItemId ?? null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  if (!card.title || !card.statement || !card.plain_english_meaning) {
    throw new Error("Formula and theorem cards need a title, statement, and meaning.");
  }

  writeArray(storage, mathStudyFormulaCardsStorageKey(input.ownerId), [
    card,
    ...listFormulaTheoremCards(input.ownerId, storage).filter((candidate) => candidate.title !== card.title),
  ]);
  return card;
}

export function saveStudyGraphLink(
  input: SaveStudyGraphLinkInput,
  storage = defaultStorage(),
): MathStudyGraphLink {
  assertMathStudyLoopBetaEnabled(input.betaEnabled);
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const link: MathStudyGraphLink = {
    id: createId("math-graph-link"),
    owner_id: input.ownerId,
    graph_state_id: input.graphStateId ?? createId("graph-state"),
    title: input.title.trim(),
    mode: input.mode,
    desmos_state: input.desmosState,
    expressions: input.expressions ?? [],
    reflection: input.reflection.trim(),
    problem_log_id: input.problemLogId ?? null,
    formula_card_id: input.formulaCardId ?? null,
    note_id: input.noteId ?? null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  if (!link.title || !link.reflection) {
    throw new Error("Graph links need a title and reflection.");
  }

  writeArray(storage, mathStudyGraphLinksStorageKey(input.ownerId), [
    link,
    ...listStudyGraphLinks(input.ownerId, storage),
  ]);
  return link;
}

export function restoreGraphStateFromStudyLink(
  ownerId: string,
  linkId: string,
  storage = defaultStorage(),
): DesmosState | null {
  return listStudyGraphLinks(ownerId, storage).find((link) => link.id === linkId)?.desmos_state ?? null;
}

export function addProblemMistakeToReview({
  betaEnabled,
  ownerId,
  problemLog,
  reviewQueueBetaEnabled,
  storage = defaultStorage(),
}: {
  betaEnabled: boolean;
  ownerId: string;
  problemLog: MathProblemLogEntry;
  reviewQueueBetaEnabled: boolean;
  storage?: StorageLike;
}): StudyItem {
  assertMathStudyLoopBetaEnabled(betaEnabled);
  const mistakeLabel = formatMistakeType(problemLog.mistake_type);
  const item = createStudyItem({
    answer: [
      `Mistake type: ${mistakeLabel}`,
      `Attempt: ${problemLog.attempt}`,
      `Correct/final answer: ${problemLog.final_answer}`,
    ].join("\n"),
    betaEnabled: reviewQueueBetaEnabled,
    binderId: problemLog.binder_id,
    binderTitle: problemLog.binder_title,
    courseId: problemLog.course_id,
    courseTitle: problemLog.course_title,
    ownerId,
    prompt: `Review mistake: ${problemLog.problem_title}`,
    sourceExcerpt: problemLog.attempt,
    sourceId: problemLog.id,
    sourceKind: "mistake",
    sourceTitle: problemLog.problem_title,
    type: "mistake_review",
  });

  const nextLogs = listProblemLogEntries(ownerId, storage).map((entry) =>
    entry.id === problemLog.id
      ? {
          ...entry,
          linked_review_item_id: item.id,
          review_due_at: item.due_at,
          updated_at: new Date().toISOString(),
        }
      : entry,
  );
  writeArray(storage, mathStudyProblemLogsStorageKey(ownerId), nextLogs);
  return item;
}

export function formatMistakeType(value: MathMistakeType) {
  return mathMistakeTypeOptions.find((option) => option.value === value)?.label ?? "Other";
}

export function assertMathStudyLoopBetaEnabled(betaEnabled: boolean) {
  if (!betaEnabled) {
    throw new Error("Math Study Loop beta must be enabled before math study-loop data can be changed.");
  }
}

function normalizeTags(value: string[] | string | undefined) {
  const raw = Array.isArray(value) ? value : value?.split(",") ?? [];
  return [...new Set(raw.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

function clampConfidence(value: number) {
  return Math.max(1, Math.min(5, Math.round(Number.isFinite(value) ? value : 1)));
}

function defaultStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function readArray<T>(storage: StorageLike | undefined, key: string): T[] {
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray<T>(storage: StorageLike | undefined, key: string, values: T[]) {
  storage?.setItem(key, JSON.stringify(values));
}

function safeStoragePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
