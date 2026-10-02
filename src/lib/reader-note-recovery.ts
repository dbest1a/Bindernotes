import type { JSONContent } from "@tiptap/react";
import type { MathBlock } from "@/types";

export type ReaderNoteDraft = {
  input: { id?: string; ownerId?: string; expectedUpdatedAt?: string | null; binderId: string; lessonId: string; folderId?: string | null; title: string; content: JSONContent; mathBlocks: MathBlock[] };
  scopeKey: string;
};
const key = (ownerId: string, binderId: string, lessonId: string) => `bindernotes:reader-note-draft:v1:${ownerId}:${binderId}:${lessonId}`;

export function writeReaderNoteDraft(draft: ReaderNoteDraft) {
  if (!draft.input.ownerId) return;
  sessionStorage.setItem(key(draft.input.ownerId, draft.input.binderId, draft.input.lessonId), JSON.stringify(draft));
}

export function readReaderNoteDraft(ownerId: string, binderId: string, lessonId: string): ReaderNoteDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key(ownerId, binderId, lessonId)) || "null");
    return draft?.input?.ownerId === ownerId && draft.input.binderId === binderId && draft.input.lessonId === lessonId && typeof draft.input.title === "string" && draft.input.content?.type === "doc" && Array.isArray(draft.input.mathBlocks) ? draft : null;
  } catch { return null; }
}

export function clearReaderNoteDraft(draft: ReaderNoteDraft) {
  if (!draft.input.ownerId) return;
  const storageKey = key(draft.input.ownerId, draft.input.binderId, draft.input.lessonId);
  // Only the exact journal revision that was acknowledged may be removed.
  if (sessionStorage.getItem(storageKey) === JSON.stringify(draft)) sessionStorage.removeItem(storageKey);
}
