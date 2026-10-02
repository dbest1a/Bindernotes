import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import type { LearnerNote, MathBlock, PersonalNotesEntry } from "@/types";
import { emptyDoc } from "@/lib/utils";
import { clearReaderNoteDraft, readReaderNoteDraft, type ReaderNoteDraft } from "@/lib/reader-note-recovery";

export type NoteDraft = {
  title: string;
  content: JSONContent;
  tagsInput: string;
  folderId?: string | null;
  pinned?: boolean;
  mathBlocks?: MathBlock[];
};
type DraftRecord = {
  journalId: string;
  entry: PersonalNotesEntry;
  draft: NoteDraft;
  revision: number;
  acknowledged: number;
  expectedUpdatedAt: string;
  state: "saved" | "saving" | "error";
  error: string | null;
  pending?: Promise<void>;
  readerRecovery?: ReaderNoteDraft;
};
export type SaveNoteDraft = (entry: PersonalNotesEntry, draft: NoteDraft, expectedUpdatedAt: string) => Promise<{ updated_at: string } | undefined>;
const blankDraft: NoteDraft = { title: "", content: emptyDoc(""), tagsInput: "" };
const storageKey = (ownerId: string, entry: PersonalNotesEntry) => `bindernotes:note-draft:v1:${ownerId}:${entry.kind}:${entry.id}`;

/** Each tab owns its recovery journal. A stale tab must never overwrite another tab's journal. */
export class PersonalNoteDraftStore {
  private records = new Map<string, DraftRecord>();
  constructor(private ownerId: string, private notify: () => void) {}

  record(entry: PersonalNotesEntry) {
    const key = storageKey(this.ownerId, entry);
    let record = this.records.get(key);
    if (!record) {
      record = { journalId: crypto.randomUUID(), entry, draft: { title: entry.title, content: entry.content, tagsInput: entry.tags.join(", ") }, revision: 0, acknowledged: 0, expectedUpdatedAt: entry.updated_at, state: "saved", error: null };
      try {
        let recovered = JSON.parse(sessionStorage.getItem(key) || "null") as DraftRecord | null;
        if (!recovered && entry.kind === "binder-note") {
          const note = entry.note as LearnerNote;
          const readerRecovery = readReaderNoteDraft(this.ownerId, note.binder_id, note.lesson_id);
          if (readerRecovery) recovered = { ...record, readerRecovery, draft: { title: readerRecovery.input.title, content: readerRecovery.input.content, tagsInput: readerRecovery.input.mathBlocks.length ? "math" : "", mathBlocks: readerRecovery.input.mathBlocks }, expectedUpdatedAt: readerRecovery.input.expectedUpdatedAt ?? "1970-01-01T00:00:00.000Z" };
        }
        if (recovered?.entry?.id === entry.id && recovered.entry.kind === entry.kind && recovered.draft?.content?.type === "doc" && typeof recovered.draft.title === "string" && typeof recovered.draft.tagsInput === "string" && typeof recovered.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(recovered.expectedUpdatedAt))) {
          const sameAsServer = recovered.draft.title === entry.title
            && JSON.stringify(recovered.draft.content) === JSON.stringify(entry.content)
            && recovered.draft.tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean).join(",") === entry.tags.join(",")
            && (recovered.draft.folderId === undefined || recovered.draft.folderId === entry.folderId)
            && (recovered.draft.pinned === undefined || recovered.draft.pinned === entry.pinned)
            && (recovered.draft.mathBlocks === undefined || JSON.stringify(recovered.draft.mathBlocks) === JSON.stringify(entry.note.math_blocks));
          if (!sameAsServer) record = { ...record, readerRecovery: recovered.readerRecovery, draft: recovered.draft, expectedUpdatedAt: recovered.expectedUpdatedAt, revision: 1 };
          else {
            sessionStorage.removeItem(key);
            if (recovered.readerRecovery) clearReaderNoteDraft(recovered.readerRecovery);
          }
        }
      } catch { /* Storage may be unavailable; editing remains possible with an explicit warning below. */ }
      this.records.set(key, record);
      if (record.revision !== record.acknowledged) this.journal(record, true);
    } else if (record.revision === record.acknowledged && !record.pending && entry.updated_at > record.expectedUpdatedAt) {
      record.entry = entry;
      record.expectedUpdatedAt = entry.updated_at;
      record.draft = { title: entry.title, content: entry.content, tagsInput: entry.tags.join(", ") };
    }
    return record;
  }

  change(entry: PersonalNotesEntry, update: Partial<NoteDraft>) {
    const record = this.record(entry);
    record.draft = { ...record.draft, ...update };
    record.revision += 1;
    if (record.state !== "saving") record.state = "saved";
    record.error = null;
    this.journal(record, true);
    this.notify();
  }

  private journal(record: DraftRecord, claim = false) {
    try {
      const existing = JSON.parse(sessionStorage.getItem(storageKey(this.ownerId, record.entry)) || "null");
      if (!claim && existing?.journalId && existing.journalId !== record.journalId) return;
      sessionStorage.setItem(storageKey(this.ownerId, record.entry), JSON.stringify({ ...record, pending: undefined }));
    } catch {
      record.error = "Browser recovery storage is unavailable. Keep this tab open until the note saves.";
    }
  }

  private clearJournal(record: DraftRecord) {
    const key = storageKey(this.ownerId, record.entry);
    const current = JSON.parse(sessionStorage.getItem(key) || "null");
    if (current?.journalId === record.journalId && current.revision === record.revision) sessionStorage.removeItem(key);
  }

  save(entry: PersonalNotesEntry, save: SaveNoteDraft): Promise<void> {
    const record = this.record(entry);
    if (record.pending) return record.pending;
    if (record.revision === record.acknowledged) return Promise.resolve();
    record.state = "saving";
    record.error = null;
    const run = async () => {
      // Serial writes use the acknowledged server revision. Edits made during a
      // request are sent next, never marked saved by the older response.
      while (record.revision !== record.acknowledged) {
        const revision = record.revision;
        const snapshot = structuredClone(record.draft);
        this.journal(record);
        try {
          const saved = await save(record.entry, snapshot, record.expectedUpdatedAt);
          record.expectedUpdatedAt = saved?.updated_at ?? record.expectedUpdatedAt;
          record.acknowledged = revision;
          if (record.revision === revision) {
            try { this.clearJournal(record); } catch { /* Saved remotely. */ }
            if (record.readerRecovery) { try { clearReaderNoteDraft(record.readerRecovery); } catch { /* Saved remotely. */ } }
          } else this.journal(record);
          this.notify();
        } catch (error) {
          record.state = "error";
          record.error = error instanceof Error ? error.message : "Could not save. Your draft is kept in this tab for reload recovery.";
          this.journal(record);
          this.notify();
          return;
        }
      }
      record.state = "saved";
      this.notify();
    };
    record.pending = run().finally(() => { record.pending = undefined; this.notify(); });
    this.notify();
    return record.pending;
  }

  hasUnsaved() { return [...this.records.values()].some((record) => record.revision !== record.acknowledged); }
  flush(save: SaveNoteDraft) { for (const record of this.records.values()) if (record.state !== "error") void this.save(record.entry, save); }
  discard(entry: PersonalNotesEntry) {
    const record = this.records.get(storageKey(this.ownerId, entry));
    const recovery = record?.readerRecovery;
    this.records.delete(storageKey(this.ownerId, entry));
    try { if (record) this.clearJournal(record); } catch { /* Best effort after explicit recovery. */ }
    if (recovery) { try { clearReaderNoteDraft(recovery); } catch { /* Keep recovery if unavailable. */ } }
    this.notify();
  }
}

export function usePersonalNoteDraft(ownerId: string | undefined, entry: PersonalNotesEntry | null, autosave: boolean, save: SaveNoteDraft) {
  const [, render] = useState(0);
  const mounted = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  const storeRef = useRef<{ ownerId: string | undefined; store: PersonalNoteDraftStore } | null>(null);
  if (!storeRef.current || storeRef.current.ownerId !== ownerId) {
    storeRef.current = { ownerId, store: new PersonalNoteDraftStore(ownerId ?? "", () => { if (mounted.current) render((n) => n + 1); }) };
  }
  const store = storeRef.current.store;
  const record = entry ? store.record(entry) : null;
  const revision = record?.revision;
  const activeId = entry?.id;
  const entryRef = useRef(entry);
  entryRef.current = entry;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (autosave) store.flush((...args) => saveRef.current(...args)); };
  }, [store, autosave]);
  useEffect(() => {
    const outgoing = entry;
    return () => { if (outgoing && autosave) void store.save(outgoing, (...args) => saveRef.current(...args)); };
  }, [activeId, autosave, store]);
  useEffect(() => {
    if (!entry || !autosave || !record || record.state === "error" || record.revision === record.acknowledged) return;
    const timer = window.setTimeout(() => void store.save(entry, (...args) => saveRef.current(...args)), 850);
    return () => window.clearTimeout(timer);
  }, [activeId, revision, autosave, record?.state, store]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (store.hasUnsaved()) { event.preventDefault(); event.returnValue = ""; } };
    const pageHide = () => { if (autosave) store.flush((...args) => saveRef.current(...args)); };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("pagehide", pageHide); };
  }, [autosave, store]);
  const change = useCallback((update: Partial<NoteDraft>) => { if (entryRef.current) store.change(entryRef.current, update); }, [store]);
  const persist = useCallback(() => entryRef.current ? store.save(entryRef.current, (...args) => saveRef.current(...args)) : Promise.resolve(), [store]);
  return { draft: record?.draft ?? blankDraft, dirty: Boolean(record && record.revision !== record.acknowledged), saveState: record?.state ?? "saved", saveError: record?.error ?? null, change, persist, discard: () => { if (entry) store.discard(entry); } };
}
