import type { JSONContent } from "@tiptap/react";
import type { MathBlock } from "@/types";

export type ReaderNoteDraft = {
  input: { id?: string; ownerId?: string; expectedUpdatedAt?: string | null; binderId: string; lessonId: string; folderId?: string | null; title: string; content: JSONContent; mathBlocks: MathBlock[] };
  scopeKey: string;
};
const key = (ownerId: string, binderId: string, lessonId: string) => `bindernotes:reader-note-draft:v1:${ownerId}:${binderId}:${lessonId}`;

// Used only after session storage rejects a write (privacy mode, quota), so a
// draft still survives leaving and reopening a lesson in this tab.
const memoryDrafts = new Map<string, string>();

/** Returns false when the draft is kept in this tab's memory only (no reload recovery). */
export function writeReaderNoteDraft(draft: ReaderNoteDraft) {
  if (!draft.input.ownerId) return true;
  const storageKey = key(draft.input.ownerId, draft.input.binderId, draft.input.lessonId);
  const value = JSON.stringify(draft);
  try {
    sessionStorage.setItem(storageKey, value);
    memoryDrafts.delete(storageKey);
    return true;
  } catch {
    memoryDrafts.set(storageKey, value);
    // Never leave an older journal behind to be restored over a newer save.
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is unavailable. */ }
    return false;
  }
}

export function readReaderNoteDraft(ownerId: string, binderId: string, lessonId: string): ReaderNoteDraft | null {
  try {
    const storageKey = key(ownerId, binderId, lessonId);
    const draft = JSON.parse(memoryDrafts.get(storageKey) ?? sessionStorage.getItem(storageKey) ?? "null");
    return draft?.input?.ownerId === ownerId && draft.input.binderId === binderId && draft.input.lessonId === lessonId && typeof draft.input.title === "string" && draft.input.content?.type === "doc" && Array.isArray(draft.input.mathBlocks) ? draft : null;
  } catch { return null; }
}

export function clearReaderNoteDraft(draft: ReaderNoteDraft) {
  if (!draft.input.ownerId) return;
  const storageKey = key(draft.input.ownerId, draft.input.binderId, draft.input.lessonId);
  const value = JSON.stringify(draft);
  // Only the exact journal revision that was acknowledged may be removed.
  if (memoryDrafts.get(storageKey) === value) memoryDrafts.delete(storageKey);
  try {
    if (sessionStorage.getItem(storageKey) === value) sessionStorage.removeItem(storageKey);
  } catch { /* Storage is unavailable; the memory copy was handled above. */ }
}
