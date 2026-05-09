import type {
  RecallCard,
  RecallDeckScope,
  RecallSessionSummary,
} from "@/lib/recall/recall-types";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safePart(value: string | null | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
}

export function recallStorageKey(scope: RecallDeckScope) {
  return [
    "bindernotes",
    "recall-lab",
    safePart(scope.userId, "local-user"),
    safePart(scope.binderId, "binder"),
    safePart(scope.documentId, "document"),
    safePart(scope.lessonId, "lesson"),
    "cards",
  ].join(":");
}

export function recallSessionStorageKey(scope: RecallDeckScope) {
  return recallStorageKey(scope).replace(/:cards$/, ":sessions");
}

function readJsonArray<T>(storage: StorageLike | undefined, key: string): T[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(storage: StorageLike | undefined, key: string, values: T[]) {
  if (!storage) return;

  storage.setItem(key, JSON.stringify(values));
}

export function loadRecallCards(scope: RecallDeckScope, storage: StorageLike | undefined): RecallCard[] {
  return readJsonArray<RecallCard>(storage, recallStorageKey(scope)).filter((card) => {
    return (
      card &&
      card.binderId === scope.binderId &&
      card.documentId === scope.documentId &&
      card.lessonId === scope.lessonId
    );
  });
}

export function saveRecallCards(scope: RecallDeckScope, cards: RecallCard[], storage: StorageLike | undefined) {
  writeJsonArray(storage, recallStorageKey(scope), cards);
}

export function upsertRecallCard(scope: RecallDeckScope, card: RecallCard, storage: StorageLike | undefined) {
  const cards = loadRecallCards(scope, storage);
  const index = cards.findIndex((candidate) => candidate.id === card.id);
  const nextCards =
    index >= 0
      ? cards.map((candidate) => (candidate.id === card.id ? card : candidate))
      : [card, ...cards];
  saveRecallCards(scope, nextCards, storage);
  return nextCards;
}

export function removeRecallCard(scope: RecallDeckScope, cardId: string, storage: StorageLike | undefined) {
  const cards = loadRecallCards(scope, storage).filter((card) => card.id !== cardId);
  saveRecallCards(scope, cards, storage);
  return cards;
}

export function loadRecallSessions(
  scope: RecallDeckScope,
  storage: StorageLike | undefined,
): RecallSessionSummary[] {
  return readJsonArray<RecallSessionSummary>(storage, recallSessionStorageKey(scope));
}

export function saveRecallSessions(
  scope: RecallDeckScope,
  sessions: RecallSessionSummary[],
  storage: StorageLike | undefined,
) {
  writeJsonArray(storage, recallSessionStorageKey(scope), sessions.slice(0, 24));
}

export function appendRecallSession(
  scope: RecallDeckScope,
  session: RecallSessionSummary,
  storage: StorageLike | undefined,
) {
  const sessions = [session, ...loadRecallSessions(scope, storage)].slice(0, 24);
  saveRecallSessions(scope, sessions, storage);
  return sessions;
}
