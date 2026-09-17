import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  canonicalFromRecall,
  canonicalReviewSchema,
  scheduleCanonicalReview,
  studyReviewEventSchema,
  type SavedReviewRecord,
} from "@/lib/canonical-review";
import { RevisionedSave, type DurableDraft } from "@/lib/revisioned-save";
import { saveQueue } from "@/lib/save-queue";
import type {
  RecallCard,
  RecallDeckScope,
  RecallReviewRating,
  RecallSessionSummary,
} from "@/lib/recall/recall-types";
import {
  listCanonicalReviews,
  listCloudRecallSessions,
  readCanonicalReview,
  saveCanonicalReview,
  saveCloudRecallSession,
  readPendingRecallSessions,
} from "@/services/canonical-review-service";

const editSchema = z
  .object({ record: canonicalReviewSchema, events: z.array(studyReviewEventSchema).max(1000) })
  .strict();
type Edit = z.infer<typeof editSchema>;
const operationSchema = z
  .object({
    operationId: z.string().uuid(),
    localRevision: z.number().int().nonnegative(),
    expectedRevision: z.number().int().nonnegative(),
    snapshot: editSchema,
  })
  .strict();
const draftSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().uuid(),
    entityKey: z.string(),
    snapshot: editSchema,
    localRevision: z.number().int().nonnegative(),
    savedRevision: z.number().int().nonnegative(),
    serverRevision: z.number().int().nonnegative(),
    pending: operationSchema.nullable(),
  })
  .strict();
const editors = new Map<string, RevisionedSave<Edit>>();
const listeners = new Set<() => void>();
let generation = 0;
function notify() {
  generation += 1;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function version() {
  return generation;
}
saveQueue.subscribeAccount(() => {
  editors.forEach((editor) => editor.retire());
  editors.clear();
  notify();
});
const prefix = (ownerId: string) => `bindernotes:canonical-recall-draft:v1:${ownerId}:`;
function matching(card: RecallCard, scope: RecallDeckScope) {
  return (
    card.userId === scope.userId &&
    card.binderId === scope.binderId &&
    card.documentId === scope.documentId &&
    card.lessonId === scope.lessonId
  );
}
function editorFor(saved: SavedReviewRecord) {
  const ownerId = saved.record.item.owner_id,
    id = saved.record.item.id;
  const key = prefix(ownerId) + id;
  let editor = editors.get(key);
  if (!editor) {
    editor = new RevisionedSave<Edit>({
      metricOperation: "review_save",
      ownerId,
      entityKey: id,
      snapshot: { record: saved.record, events: [] },
      serverRevision: saved.revision,
      storage: {
        read() {
          const raw = window.localStorage.getItem(key);
          if (!raw) return null;
          const draft = draftSchema.parse(JSON.parse(raw));
          if (
            draft.snapshot.record.item.owner_id !== ownerId ||
            draft.snapshot.record.item.id !== id ||
            (draft.pending &&
              (draft.pending.snapshot.record.item.owner_id !== ownerId ||
                draft.pending.snapshot.record.item.id !== id))
          )
            throw new Error("Invalid draft identity");
          return draft as DurableDraft<Edit>;
        },
        write(draft) {
          window.localStorage.setItem(key, JSON.stringify(draft));
        },
        remove() {
          window.localStorage.removeItem(key);
        },
      },
      write: async (operation) => {
        const result = await saveCanonicalReview({
          ...operation.snapshot,
          expectedRevision: operation.expectedRevision,
          operationId: operation.operationId,
        });
        return { revision: result.revision };
      },
    });
    editors.set(key, editor);
    editor.subscribe(notify);
    notify();
  } else if (!editor.getSnapshot().dirty && saved.revision > editor.getServerRevision()) {
    editor.useRemote({ record: saved.record, events: [] }, saved.revision);
  }
  return editor;
}
function scopeEditors(scope: RecallDeckScope) {
  return [...editors.values()].filter((editor) => {
    const card = editor.getSnapshot().snapshot.record.recall;
    return card && matching(card, scope);
  });
}

export function useCloudRecall(scope: RecallDeckScope, binderTitle: string, enabled: boolean) {
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<RecallSessionSummary[]>([]);
  const revision = useSyncExternalStore(subscribe, version, version);
  const scopeIdentity = JSON.stringify(scope);
  useEffect(() => {
    if (!enabled || !scope.userId) return;
    const ownerId = scope.userId;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(prefix(ownerId))) continue;
        try {
          const draft = draftSchema.parse(JSON.parse(window.localStorage.getItem(key)!));
          const card = draft.snapshot.record.recall;
          if (draft.ownerId === ownerId && card && matching(card, scope))
            editorFor({ record: draft.snapshot.record, revision: draft.serverRevision });
        } catch {
          setError("A device review draft could not be read. Its original data has been kept.");
        }
      }
    } catch {
      setError("Device review backups are unavailable. Keep this page open while saving.");
    }
    void Promise.all([
      listCanonicalReviews(ownerId, controller.signal),
      listCloudRecallSessions(ownerId, controller.signal),
    ])
      .then(([records, history]) => {
        if (controller.signal.aborted) return;
        for (const saved of records)
          if (saved.record.recall && matching(saved.record.recall, scope)) editorFor(saved);
        const combined = new Map(
          [...history, ...readPendingRecallSessions(ownerId)].map((session) => [
            JSON.stringify([session.scope, session.id]),
            session,
          ]),
        );
        setSessions(
          [...combined.values()].filter(
            (session) =>
              session.scope.userId === ownerId &&
              session.scope.binderId === scope.binderId &&
              session.scope.documentId === scope.documentId &&
              session.scope.lessonId === scope.lessonId,
          ),
        );
        scopeEditors(scope).forEach((editor) => editor.schedule());
        notify();
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Review work could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scopeIdentity, enabled, reload]);
  const current = useMemo(() => scopeEditors(scope), [scopeIdentity, revision]);
  const cards = current.map((editor) => editor.getSnapshot().snapshot.record.recall!).filter(Boolean);
  function updateCards(nextCards: RecallCard[]) {
    if (!scope.userId || saveQueue.getAccount() !== scope.userId)
      throw new Error("Sign in before editing review work.");
    for (const card of nextCards) {
      if (!matching(card, scope)) throw new Error("Recall scope mismatch.");
      const record = canonicalFromRecall(card, binderTitle);
      const editor = editorFor({ record, revision: 0 });
      if (
        JSON.stringify(editor.getSnapshot().snapshot.record) !== JSON.stringify(record) ||
        editor.getServerRevision() === 0
      )
        editor.edit((current) => ({ ...current, record }));
    }
  }
  function rateCard(card: RecallCard, rating: RecallReviewRating) {
    const editor = current.find(
      (candidate) => candidate.getSnapshot().snapshot.record.recall?.id === card.id,
    );
    if (!editor) throw new Error("Load this card before reviewing it.");
    if (editor.getSnapshot().dirty)
      throw new Error("Save or retry this card's pending changes before rating it again.");
    if (editor.getSnapshot().state === "conflict")
      throw new Error("Resolve the saved-card conflict before rating it.");
    editor.edit((current) => {
      const update = scheduleCanonicalReview(
        current.record,
        rating === "Again" ? "forgot" : (rating.toLowerCase() as "hard" | "good" | "easy"),
        new Date(),
        crypto.randomUUID(),
      );
      return { record: update.record, events: [...current.events, update.event] };
    });
    return editor.getSnapshot().snapshot.record.recall!;
  }
  async function saveSession(session: RecallSessionSummary) {
    setSessions((current) => [session, ...current.filter((candidate) => candidate.id !== session.id)]);
    try {
      await saveCloudRecallSession(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Session could not be saved.");
    }
  }
  async function useRemote(cardId: string) {
    const editor = current.find((candidate) => candidate.getSnapshot().snapshot.record.recall?.id === cardId);
    if (!editor || !scope.userId) return;
    const saved = await readCanonicalReview(scope.userId, editor.getSnapshot().snapshot.record.item.id);
    if (!saved) throw new Error("Saved card could not be found. Your draft is unchanged.");
    editor.useRemote({ record: saved.record, events: [] }, saved.revision);
  }
  async function preserveCopy(cardId: string) {
    const editor = current.find((candidate) => candidate.getSnapshot().snapshot.record.recall?.id === cardId);
    const original = editor?.getSnapshot().snapshot.record.recall;
    if (!original) return;
    const record = canonicalFromRecall({ ...original, id: `recovered-${crypto.randomUUID()}` }, binderTitle);
    const copy = editorFor({ record, revision: 0 });
    copy.edit((value) => value, false);
    await copy.flush();
    if (copy.getSnapshot().state !== "saved")
      throw new Error("The recovered copy is still pending. Its device draft has been retained.");
    await useRemote(cardId);
  }
  useEffect(() => {
    const online = () =>
      scopeEditors(scope).forEach((editor) => {
        void editor.flush();
      });
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [scopeIdentity]);
  return {
    cards,
    sessions,
    loading,
    error,
    updateCards,
    rateCard,
    saveSession,
    useRemote,
    preserveCopy,
    save: async () => {
      await Promise.all(current.map((editor) => editor.flush()));
      if (scope.userId) {
        try {
          for (const session of readPendingRecallSessions(scope.userId))
            await saveCloudRecallSession(session);
          setError("");
        } catch (error) {
          setError(error instanceof Error ? error.message : "Pending session could not be saved.");
        }
      }
    },
    refresh: () => setReload((value) => value + 1),
    states: current.map((editor) => ({
      cardId: editor.getSnapshot().snapshot.record.recall!.id,
      ...editor.getSnapshot(),
    })),
  };
}
