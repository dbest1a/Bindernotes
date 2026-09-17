import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { RevisionedSave, type RevisionedSaveState } from "@/lib/revisioned-save";
import { createPersonalDraftJournal } from "@/lib/personal-content-drafts";
import { contentRevision, type PersonalContentSnapshot } from "@/lib/personal-content-contract";
import { saveQueue } from "@/lib/save-queue";
import { emptyDoc } from "@/lib/utils";
import { NOTE_SAVE_BEFORE_SIGN_OUT_EVENT } from "@/lib/note-save";
import { preservePersonalContentCopy } from "@/services/personal-content-repository";
import { readLearnerNoteByScope } from "@/services/binder-service";
import type { LearnerNote, MathBlock } from "@/types";
import type { JSONContent } from "@tiptap/react";

export type LearnerNoteWrite = {
  id: string; binderId: string; lessonId: string; folderId: string | null; title: string;
  content: JSONContent; mathBlocks: MathBlock[]; pinned: boolean; expectedRevision: number; operationId: string;
};
type Editor = { save: RevisionedSave<PersonalContentSnapshot>; journal: ReturnType<typeof createPersonalDraftJournal>; savedAt: string | null };
const editors = new Map<string, Editor>();
saveQueue.subscribeAccount(() => { editors.forEach((editor) => editor.save.retire()); editors.clear(); });
const emptySnapshot: PersonalContentSnapshot = { kind: "learner-note", id: "", ownerId: "", title: "", content: emptyDoc(), mathBlocks: [], tags: [], tagsInput: "", pinned: false, folderId: null, binderId: null, documentId: null, lessonId: null };
const emptyState: RevisionedSaveState<PersonalContentSnapshot> = { snapshot: emptySnapshot, dirty: false, state: "saved", error: null, durable: true, revision: 0 };
const noopSubscribe = () => () => {};
const getEmpty = () => emptyState;

function initialId(scope: string, note: LearnerNote | null) {
  if (note) return note.id;
  const key = `binder-notes:reader-note-id:${scope}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID(); sessionStorage.setItem(key, id); return id;
  } catch { return crypto.randomUUID(); }
}
function snapshotFromNote(note: LearnerNote, ownerId: string): PersonalContentSnapshot {
  if (note.owner_id !== ownerId) throw new Error("The saved note belongs to a different account.");
  return { ...emptySnapshot, id: note.id, ownerId, binderId: note.binder_id, lessonId: note.lesson_id, folderId: note.folder_id ?? null, title: note.title, content: note.content, mathBlocks: note.math_blocks, pinned: note.pinned };
}

export function useLearnerNoteEditor(options: {
  ownerId: string | null; binderId?: string; lessonId?: string; lessonTitle: string; folderId: string | null;
  note: LearnerNote | null; ready: boolean; write: (input: LearnerNoteWrite) => Promise<LearnerNote>;
}) {
  const scope = options.ownerId && options.binderId && options.lessonId ? `${options.ownerId}:${options.binderId}:${options.lessonId}` : "";
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [adoptedNote, setAdoptedNote] = useState<{ scope: string; note: LearnerNote } | null>(null);
  const writerRef = useRef(options.write); writerRef.current = options.write;
  const editor = useMemo(() => {
    if (!scope || !options.ready || !options.ownerId || !options.binderId || !options.lessonId) return null;
    const existing = editors.get(scope);
    if (existing) return existing;
    const initialNote = adoptedNote?.scope === scope ? adoptedNote.note : options.note;
    const snapshot = initialNote ? snapshotFromNote(initialNote, options.ownerId) : { ...emptySnapshot, id: initialId(scope, null), ownerId: options.ownerId, binderId: options.binderId, lessonId: options.lessonId, folderId: options.folderId, title: `${options.lessonTitle} notes` };
    let journal: ReturnType<typeof createPersonalDraftJournal>;
    try { journal = createPersonalDraftJournal(options.ownerId, `binder-note:${snapshot.id}`); }
    catch { journal = { clearSelection: () => {}, list: () => [], read: () => { throw new Error("Device backup unavailable"); }, write: () => { throw new Error("Device backup unavailable"); }, remove: () => { throw new Error("Device backup unavailable"); } }; }
    // Capture this scope's writer. A future lesson's mutation closure must never receive it.
    const writer = writerRef.current;
    const value: Editor = { journal, savedAt: initialNote?.updated_at ?? null, save: null! };
    value.save = new RevisionedSave({
      ownerId: options.ownerId, entityKey: `binder-note:${snapshot.id}`, snapshot,
      serverRevision: initialNote ? contentRevision(initialNote) : 0, storage: journal, delay: 700,
      write: async (operation) => {
        if (saveQueue.getAccount() !== operation.snapshot.ownerId) throw new Error("Sign in to the draft's account before saving.");
        const saved = await writer({ id: operation.snapshot.id, binderId: operation.snapshot.binderId!, lessonId: operation.snapshot.lessonId!, folderId: operation.snapshot.folderId, title: operation.snapshot.title, content: operation.snapshot.content, mathBlocks: operation.snapshot.mathBlocks, pinned: operation.snapshot.pinned, expectedRevision: operation.expectedRevision, operationId: operation.operationId });
        if (saved.owner_id !== operation.snapshot.ownerId || saved.id !== operation.snapshot.id) throw new Error("The saved note did not match this draft.");
        value.savedAt = saved.updated_at;
        return { revision: contentRevision(saved) };
      },
    });
    editors.set(scope, value);
    return value;
  }, [scope, options.ready, adoptedNote]);
  const state = useSyncExternalStore(editor?.save.subscribe ?? noopSubscribe, editor?.save.getSnapshot ?? getEmpty, getEmpty);
  const lifetimeRef = useRef({ scope, active: true });
  if (lifetimeRef.current.scope !== scope) { lifetimeRef.current.active = false; lifetimeRef.current = { scope, active: true }; }
  const lifetime = lifetimeRef.current;
  useEffect(() => { lifetime.active = true; setChoiceError(null); return () => { lifetime.active = false; }; }, [lifetime]);

  useEffect(() => {
    if (!editor || !options.note || editor.save.getSnapshot().dirty) return;
    if (options.note.id !== editor.save.getSnapshot().snapshot.id && adoptedNote?.scope !== scope) {
      editor.save.retire(); editors.delete(scope); setAdoptedNote({ scope, note: options.note }); return;
    }
    if (contentRevision(options.note) <= editor.save.getServerRevision()) return;
    if (options.note.id === editor.save.getSnapshot().snapshot.id) {
      editor.savedAt = options.note.updated_at;
      editor.save.useRemote(snapshotFromNote(options.note, options.ownerId!), contentRevision(options.note));
    }
  }, [adoptedNote, editor, options.note, options.ownerId, scope]);
  useEffect(() => {
    editor?.save.schedule();
    const flush = () => { void editor?.save.flush(); };
    const online = () => editors.forEach((item) => { void item.save.flush(); });
    const signOut = (event: Event) => { if (editor) (event as CustomEvent<{ promises?: Promise<unknown>[] }>).detail?.promises?.push(editor.save.flush()); };
    window.addEventListener("pagehide", flush); window.addEventListener("online", online); window.addEventListener(NOTE_SAVE_BEFORE_SIGN_OUT_EVENT, signOut);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("online", online); window.removeEventListener(NOTE_SAVE_BEFORE_SIGN_OUT_EVENT, signOut); };
  }, [editor]);
  const change = useCallback((update: (snapshot: PersonalContentSnapshot) => PersonalContentSnapshot) => {
    if (!editor || editors.get(scope) !== editor || saveQueue.getAccount() !== options.ownerId || !lifetime.active || lifetime !== lifetimeRef.current) return;
    setChoiceError(null); editor.save.edit(update);
  }, [editor, lifetime, options.ownerId, scope]);
  const useRemote = async () => {
    if (!editor) return;
    try {
      const snapshot = editor.save.getSnapshot().snapshot;
      const remote = await readLearnerNoteByScope(snapshot.ownerId, snapshot.binderId!, snapshot.lessonId!);
      if (editors.get(scope) !== editor || !lifetime.active || lifetime !== lifetimeRef.current) return;
      if (remote.id !== snapshot.id) {
        editor.save.retire(); editors.delete(scope); setAdoptedNote({ scope, note: remote });
      } else {
        editor.savedAt = remote.updated_at;
        editor.save.useRemote(snapshotFromNote(remote, snapshot.ownerId), contentRevision(remote));
      }
      editor.journal.clearSelection();
      setChoiceError(null);
    }
    catch (error) { if (lifetime.active) setChoiceError(error instanceof Error ? error.message : "Could not load saved note."); }
  };
  const preserveCopy = async () => {
    if (!editor) return;
    try { await preservePersonalContentCopy(editor.save.getSnapshot().snapshot); await useRemote(); }
    catch (error) { if (lifetime.active) setChoiceError(error instanceof Error ? error.message : "Could not preserve draft copy."); }
  };
  const preserveBackup = async (key: string) => {
    const backup = editor?.journal.list().find((item) => item.key === key);
    if (!backup || backup.draft.ownerId !== options.ownerId) return;
    try { await preservePersonalContentCopy(backup.draft.snapshot); }
    catch (error) { if (lifetime.active) setChoiceError(error instanceof Error ? error.message : "Could not preserve backup."); }
  };
  return { ...state, error: choiceError ?? state.error, savedAt: editor?.savedAt ?? null,
    persisted: Boolean(editor && (editor.save.getServerRevision() > 0 || editor.savedAt)),
    title: state.snapshot.title, content: state.snapshot.content, mathBlocks: state.snapshot.mathBlocks,
    setTitle: useCallback((title: string) => change((value) => ({ ...value, title })), [change]),
    setContent: useCallback((content: JSONContent) => change((value) => ({ ...value, content })), [change]),
    setMathBlocks: useCallback((update: MathBlock[] | ((current: MathBlock[]) => MathBlock[])) => change((value) => ({ ...value, mathBlocks: typeof update === "function" ? update(value.mathBlocks) : update })), [change]),
    save: editor?.save.flush ?? (async () => {}), useRemote, preserveCopy, backups: editor?.journal.list() ?? [], preserveBackup,
  };
}
