import { z } from "zod";
import { ContentConflictError, RevisionedSave, type DraftStorage, type DurableDraft } from "@/lib/revisioned-save";
import { saveQueue } from "@/lib/save-queue";
import { AUTOSAVE_DEBOUNCE_MS } from "./whiteboard-limits";
import { isScratchWhiteboard, saveWhiteboard } from "./whiteboard-storage";
import type { BinderWhiteboard, WhiteboardScope } from "./whiteboard-types";

const boardSchema = z.object({
  id: z.string().min(1), ownerId: z.string().min(1), binderId: z.string().min(1), lessonId: z.string().nullable(),
  title: z.string(), subject: z.string(), moduleContext: z.enum(["binder", "lesson", "math-lab"]),
  scene: z.object({ elements: z.array(z.unknown()), appState: z.record(z.string(), z.unknown()).optional(), files: z.record(z.string(), z.unknown()).optional() }),
  modules: z.array(z.object({ id: z.string(), type: z.literal("bindernotes-module"), moduleId: z.string() }).passthrough()),
  revision: z.number().int().nonnegative().optional(), storageMode: z.enum(["local-draft", "supabase"]),
  objectCount: z.number(), sceneSizeBytes: z.number(), assetSizeBytes: z.number(),
  createdAt: z.string(), updatedAt: z.string(), archivedAt: z.string().nullable(),
}).passthrough();
const operationSchema = z.object({ operationId: z.string().min(1), localRevision: z.number().int().positive(), expectedRevision: z.number().int().nonnegative(), snapshot: boardSchema });
const draftSchema = z.object({ version: z.literal(1), ownerId: z.string(), entityKey: z.string(), snapshot: boardSchema, localRevision: z.number().int().nonnegative(), savedRevision: z.number().int().nonnegative(), serverRevision: z.number().int().nonnegative(), pending: operationSchema.nullable() });
const prefix = "bindernotes:whiteboard-draft:v1:";
const drafts = new Map<string, RevisionedSave<BinderWhiteboard>>();

function identity(board: Pick<BinderWhiteboard, "id" | "ownerId">) { return `${encodeURIComponent(board.ownerId)}:${encodeURIComponent(board.id)}`; }
function contextId() {
  const key = "binder-notes:draft-context:v1";
  let context = sessionStorage.getItem(key);
  if (!context) { context = crypto.randomUUID(); sessionStorage.setItem(key, context); }
  return context;
}
function parseDraft(raw: string): DurableDraft<BinderWhiteboard> {
  const draft = draftSchema.parse(JSON.parse(raw)) as unknown as DurableDraft<BinderWhiteboard>;
  if (draft.entityKey !== draft.snapshot.id || draft.ownerId !== draft.snapshot.ownerId ||
      draft.savedRevision > draft.localRevision ||
      (draft.pending && (draft.pending.snapshot.id !== draft.entityKey || draft.pending.snapshot.ownerId !== draft.ownerId || draft.pending.localRevision > draft.localRevision))) {
    throw new Error("Whiteboard draft identity mismatch");
  }
  return draft;
}
function storageFor(board: BinderWhiteboard, selectedBackup?: string): DraftStorage<BinderWhiteboard> {
  const context = contextId();
  const pointer = `${prefix}selected:${identity(board)}:${context}`;
  // A duplicated tab inherits sessionStorage, so its first write must use a new slot.
  const key = `${prefix}${identity(board)}:${context}:${crypto.randomUUID()}`;
  const inherited = selectedBackup ?? sessionStorage.getItem(pointer);
  return {
    read: () => {
      if (!inherited?.startsWith(`${prefix}${identity(board)}:`)) return null;
      const raw = localStorage.getItem(inherited); return raw ? parseDraft(raw) : null;
    },
    write: (draft) => {
      const json = JSON.stringify(draft); parseDraft(json); localStorage.setItem(key, json);
      sessionStorage.setItem(pointer, key);
    },
    remove: () => {
      localStorage.removeItem(key);
      if (sessionStorage.getItem(pointer) === key) sessionStorage.removeItem(pointer);
    },
  };
}

/** Controllers survive editor navigation. Only an account transition retires their closures. */
saveQueue.subscribeAccount(() => { drafts.forEach((draft) => draft.retire()); drafts.clear(); });
if (typeof window !== "undefined") {
  window.addEventListener("online", () => drafts.forEach((draft) => {
    if (!isScratchWhiteboard(draft.getSnapshot().snapshot)) void draft.flush();
  }));
}

export function getWhiteboardDraft(board: BinderWhiteboard, selectedBackup?: string) {
  const key = identity(board);
  let draft = drafts.get(key);
  if (!draft) {
    let storage: DraftStorage<BinderWhiteboard>;
    try { storage = storageFor(board, selectedBackup); }
    catch { storage = { read: () => { throw new Error("Device backup unavailable"); }, write: () => { throw new Error("Device backup unavailable"); }, remove: () => { throw new Error("Device backup unavailable"); } }; }
    draft = new RevisionedSave({
      ownerId: board.ownerId, entityKey: board.id, snapshot: board, serverRevision: board.revision ?? 0,
      storage, delay: AUTOSAVE_DEBOUNCE_MS,
      write: async (operation) => {
        if (saveQueue.getAccount() !== board.ownerId) throw new Error("Sign in to the draft's account before saving.");
        const result = await saveWhiteboard(operation.snapshot, {
          backend: "supabase", createVersion: true, operationId: operation.operationId, expectedRevision: operation.expectedRevision,
        });
        if (result.status === "conflict") throw new ContentConflictError();
        if (result.status !== "saved") throw new Error(result.message);
        return { revision: result.board.revision ?? 0 };
      },
    });
    drafts.set(key, draft);
    if (!isScratchWhiteboard(board)) draft.schedule();
  } else if (!draft.getSnapshot().dirty && (board.revision ?? 0) > draft.getServerRevision()) {
    draft.useRemote(board, board.revision ?? 0);
  }
  return draft;
}

export function whiteboardDraftSnapshot(board: BinderWhiteboard): BinderWhiteboard {
  const draft = getWhiteboardDraft(board);
  return { ...draft.getSnapshot().snapshot, revision: draft.getServerRevision() };
}

/** Merge server lists with device drafts; a background fetch cannot replace an unsaved scene. */
export function mergeWhiteboardDrafts(boards: BinderWhiteboard[], scope: WhiteboardScope) {
  const recovered = new Map<string, BinderWhiteboard>();
  const belongs = (board: BinderWhiteboard) => board.ownerId === scope.ownerId && board.binderId === scope.binderId && board.lessonId === (scope.lessonId ?? null);
  try {
    const context = contextId();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${prefix}${encodeURIComponent(scope.ownerId)}:`) || !key.includes(`:${context}:`)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const draft = parseDraft(raw);
        const pointer = `${prefix}selected:${identity(draft.snapshot)}:${context}`;
        if (belongs(draft.snapshot) && sessionStorage.getItem(pointer) === key) recovered.set(draft.snapshot.id, draft.snapshot);
      } catch { /* Leave malformed backups untouched. */ }
    }
  } catch { /* Visible controller errors report unavailable device storage. */ }
  drafts.forEach((draft) => { const state = draft.getSnapshot(); if (state.dirty && belongs(state.snapshot)) recovered.set(state.snapshot.id, state.snapshot); });
  boards.filter((board) => board.ownerId === scope.ownerId).forEach((board) => recovered.set(board.id, board));
  return [...recovered.values()].map(whiteboardDraftSnapshot);
}

export function listWhiteboardBackups(board: BinderWhiteboard) {
  const result: Array<{ key: string; draft: DurableDraft<BinderWhiteboard> }> = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${prefix}${identity(board)}:`)) continue;
      try { const draft = parseDraft(localStorage.getItem(key)!); result.push({ key, draft }); } catch { /* Preserve unreadable backups. */ }
    }
  } catch { /* The active controller reports storage failures. */ }
  return result;
}

export function restoreWhiteboardBackup(board: BinderWhiteboard, backupKey: string) {
  if (!listWhiteboardBackups(board).some((backup) => backup.key === backupKey)) throw new Error("This backup is unavailable.");
  drafts.get(identity(board))?.retire();
  drafts.delete(identity(board));
  return getWhiteboardDraft(board, backupKey);
}

export function clearWhiteboardRecoverySelection(board: BinderWhiteboard) {
  sessionStorage.removeItem(`${prefix}selected:${identity(board)}:${contextId()}`);
}

export function createWhiteboardDraftCopy(board: BinderWhiteboard) {
  const now = new Date().toISOString();
  const copy = { ...structuredClone(board), id: crypto.randomUUID(), revision: 0, title: `${board.title} (draft copy)`, createdAt: now, updatedAt: now, archivedAt: null, storageMode: "local-draft" as const };
  const draft = getWhiteboardDraft(copy);
  draft.edit(() => copy, false);
  return draft;
}
