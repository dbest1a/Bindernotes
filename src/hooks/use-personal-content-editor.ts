import { createPersonalDraftJournal } from "@/lib/personal-content-drafts";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RevisionedSave, type RevisionedSaveState } from "@/lib/revisioned-save";
import { contentRevision, personalContentFromEntry, type PersonalContentSnapshot } from "@/lib/personal-content-contract";
import { savePersonalContent, readPersonalContent, preservePersonalContentCopy } from "@/services/personal-content-repository";
import { saveQueue } from "@/lib/save-queue";
import { queryKeys } from "@/lib/query-keys";
import { emptyDoc } from "@/lib/utils";
import type { PersonalNotesEntry } from "@/types";

const journals = new Map<string, ReturnType<typeof createPersonalDraftJournal>>();
const editors = new Map<string, RevisionedSave<PersonalContentSnapshot>>();
saveQueue.subscribeAccount(() => { editors.forEach((editor) => editor.retire()); editors.clear(); journals.clear(); });

const emptyState: RevisionedSaveState<PersonalContentSnapshot> = {
  snapshot: { kind: "note", id: "", ownerId: "", title: "", content: emptyDoc(""), mathBlocks: [], tags: [], tagsInput: "", pinned: false, folderId: null, binderId: null, documentId: null, lessonId: null },
  dirty: false, state: "saved", error: null, durable: true, revision: 0,
};
const noopSubscribe = () => () => {};
const getEmpty = () => emptyState;


export function usePersonalContentEditor(entry: PersonalNotesEntry | null, ownerId: string | null, autosave: boolean) {
  const queryClient = useQueryClient();
  const identity = entry ? `${entry.kind}:${entry.id}` : "";
  const editor = useMemo(() => {
    if (!entry || entry.contentLoaded === false || !ownerId) return null;
    const key = `${ownerId}:${identity}`;
    let existing = editors.get(key);
    if (!existing) {
      const snapshot = personalContentFromEntry(entry, ownerId);
      let storage;
      try { storage = createPersonalDraftJournal(ownerId, identity); }
      catch { storage = { clearSelection: () => {}, list: () => [], read: () => { throw new Error("Device storage unavailable"); }, write: () => { throw new Error("Device storage unavailable"); }, remove: () => { throw new Error("Device storage unavailable"); } }; }
      journals.set(key, storage);
      existing = new RevisionedSave({
        ownerId, entityKey: identity, snapshot, serverRevision: contentRevision(entry.note), storage,
        write: async (operation) => {
          const result = await savePersonalContent(operation);
          if (saveQueue.getAccount() === ownerId) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.personalNotes.forProfile(ownerId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.forProfile(ownerId) });
          }
          return result;
        },
      });
      editors.set(key, existing);
    }
    return existing;
  }, [identity, entry?.contentLoaded, ownerId, queryClient]);
  const state = useSyncExternalStore(editor?.subscribe ?? noopSubscribe, editor?.getSnapshot ?? getEmpty, getEmpty);

  useEffect(() => {
    if (!editor || !entry || entry.contentLoaded === false || !ownerId || editor.getSnapshot().dirty) return;
    const revision = contentRevision(entry.note);
    if (revision > editor.getServerRevision()) editor.useRemote(personalContentFromEntry(entry, ownerId), revision);
  }, [editor, entry, ownerId]);

  useEffect(() => {
    if (autosave) editor?.schedule();
    const recover = () => { if (autosave) editors.forEach((item) => { void item.flush(); }); };
    window.addEventListener("online", recover);
    return () => { window.removeEventListener("online", recover); };
  }, [editor, autosave]);

  const change = useCallback((patch: Partial<PersonalContentSnapshot>) => { editor?.edit((current) => ({ ...current, ...patch }), autosave); }, [editor, autosave]);
  const useRemote = useCallback(async () => {
    if (!editor) return;
    const remote = await readPersonalContent(editor.getSnapshot().snapshot);
    editor.useRemote(remote.snapshot, remote.revision);
    journals.get(`${ownerId}:${identity}`)?.clearSelection();
  }, [editor, identity, ownerId]);
  const preserveCopy = useCallback(async () => {
    if (!editor) return;
    const copy = await preservePersonalContentCopy(editor.getSnapshot().snapshot);
    await useRemote();
    await queryClient.invalidateQueries({ queryKey: queryKeys.personalNotes.forProfile(ownerId ?? undefined) });
    return copy;
  }, [editor, ownerId, queryClient, useRemote]);

  const backups = journals.get(`${ownerId}:${identity}`)?.list() ?? [];
  const preserveBackup = async (backupKey: string) => {
    const backup = journals.get(`${ownerId}:${identity}`)?.list().find((item) => item.key === backupKey);
    if (!backup || backup.draft.ownerId !== ownerId) throw new Error("This device backup is no longer available.");
    const copy = await preservePersonalContentCopy(backup.draft.snapshot);
    await queryClient.invalidateQueries({ queryKey: queryKeys.personalNotes.forProfile(ownerId ?? undefined) });
    return copy;
  };
  return { ...state, backups, preserveBackup, change, save: editor?.flush ?? (async () => {}), useRemote, preserveCopy };
}
