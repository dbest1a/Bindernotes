import {
  scheduleStudyItemReview,
  type StudyReviewRating,
} from "@/lib/study-scheduler";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type StudyItemType =
  | "highlight_recall"
  | "formula_card"
  | "theorem_card"
  | "worked_example"
  | "mistake_review"
  | "graph_explanation"
  | "free_response"
  | "numeric_problem"
  | "multiple_choice";

export type StudyItemSourceKind = "note" | "highlight" | "formula" | "theorem" | "problem" | "mistake" | "graph" | "manual";

export type StudyItemStatus = "due" | "upcoming" | "difficult" | "mastered";

export type StudyItem = {
  id: string;
  owner_id: string;
  type: StudyItemType;
  prompt: string;
  answer: string;
  source_kind: StudyItemSourceKind;
  source_id: string | null;
  source_title: string | null;
  source_excerpt: string | null;
  binder_id: string | null;
  binder_title: string | null;
  course_id: string | null;
  course_title: string | null;
  due_at: string;
  status: StudyItemStatus;
  mastery: number;
  review_count: number;
  lapse_count: number;
  created_at: string;
  updated_at: string;
};

export type StudyReviewEvent = {
  id: string;
  owner_id: string;
  item_id: string;
  rating: StudyReviewRating;
  reviewed_at: string;
  due_at_before: string;
  due_at_after: string;
  response_length: number;
};

export type CreateStudyItemInput = {
  answer: string;
  betaEnabled: boolean;
  binderId?: string | null;
  binderTitle?: string | null;
  courseId?: string | null;
  courseTitle?: string | null;
  dueAt?: string | null;
  now?: Date;
  ownerId: string;
  prompt: string;
  sourceExcerpt?: string | null;
  sourceId?: string | null;
  sourceKind: StudyItemSourceKind;
  sourceTitle?: string | null;
  type: StudyItemType;
};

export type RecordStudyReviewInput = {
  betaEnabled: boolean;
  itemId: string;
  now?: Date;
  ownerId: string;
  rating: StudyReviewRating;
  response?: string;
};

export function studyItemsStorageKey(ownerId: string) {
  return `bindernotes:study-items:v1:${safeStoragePart(ownerId)}`;
}

export function studyReviewEventsStorageKey(ownerId: string) {
  return `bindernotes:study-review-events:v1:${safeStoragePart(ownerId)}`;
}

export function listStudyItems(ownerId: string, storage = defaultStorage()): StudyItem[] {
  return readArray<StudyItem>(storage, studyItemsStorageKey(ownerId))
    .filter((item) => item.owner_id === ownerId)
    .sort((left, right) => Date.parse(left.due_at) - Date.parse(right.due_at));
}

export function listStudyReviewEvents(ownerId: string, storage = defaultStorage()): StudyReviewEvent[] {
  return readArray<StudyReviewEvent>(storage, studyReviewEventsStorageKey(ownerId))
    .filter((event) => event.owner_id === ownerId)
    .sort((left, right) => Date.parse(right.reviewed_at) - Date.parse(left.reviewed_at));
}

export function createStudyItem(input: CreateStudyItemInput, storage = defaultStorage()): StudyItem {
  assertReviewQueueBetaEnabled(input.betaEnabled);
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const item: StudyItem = {
    id: createId("study-item"),
    owner_id: input.ownerId,
    type: input.type,
    prompt: input.prompt.trim(),
    answer: input.answer.trim(),
    source_kind: input.sourceKind,
    source_id: input.sourceId ?? null,
    source_title: input.sourceTitle ?? null,
    source_excerpt: trimSourceExcerpt(input.sourceExcerpt),
    binder_id: input.binderId ?? null,
    binder_title: input.binderTitle ?? null,
    course_id: input.courseId ?? null,
    course_title: input.courseTitle ?? null,
    due_at: input.dueAt ?? createdAt,
    status: "due",
    mastery: 0,
    review_count: 0,
    lapse_count: 0,
    created_at: createdAt,
    updated_at: createdAt,
  };

  if (!item.prompt || !item.answer) {
    throw new Error("Study items need both a prompt and an answer.");
  }

  const next = [item, ...listStudyItems(input.ownerId, storage)];
  writeArray(storage, studyItemsStorageKey(input.ownerId), next);
  return item;
}

export function recordStudyReviewEvent(input: RecordStudyReviewInput, storage = defaultStorage()) {
  assertReviewQueueBetaEnabled(input.betaEnabled);
  const now = input.now ?? new Date();
  const items = listStudyItems(input.ownerId, storage);
  const item = items.find((candidate) => candidate.id === input.itemId && candidate.owner_id === input.ownerId);
  if (!item) {
    throw new Error("Study item was not found for this account.");
  }

  const updatedItem = scheduleStudyItemReview(item, input.rating, now);
  const event: StudyReviewEvent = {
    id: createId("study-review-event"),
    owner_id: input.ownerId,
    item_id: item.id,
    rating: input.rating,
    reviewed_at: now.toISOString(),
    due_at_before: item.due_at,
    due_at_after: updatedItem.due_at,
    response_length: input.response?.length ?? 0,
  };
  const nextItems = items.map((candidate) => (candidate.id === updatedItem.id ? updatedItem : candidate));
  writeArray(storage, studyItemsStorageKey(input.ownerId), nextItems);
  writeArray(storage, studyReviewEventsStorageKey(input.ownerId), [
    event,
    ...listStudyReviewEvents(input.ownerId, storage),
  ].slice(0, 500));

  return { event, item: updatedItem };
}

export function assertReviewQueueBetaEnabled(betaEnabled: boolean) {
  if (!betaEnabled) {
    throw new Error("Review Queue beta must be enabled before study items can be changed.");
  }
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

function trimSourceExcerpt(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";
  return trimmed ? trimmed.slice(0, 700) : null;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
