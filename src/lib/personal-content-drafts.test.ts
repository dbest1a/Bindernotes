// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPersonalDraftJournal } from "./personal-content-drafts";
import type { DurableDraft } from "./revisioned-save";
import type { PersonalContentSnapshot } from "./personal-content-contract";

function draft(text: string): DurableDraft<PersonalContentSnapshot> {
  return { version: 1, ownerId: "A", entityKey: "personal-note:note-1", localRevision: 1, savedRevision: 0, serverRevision: 0, pending: null,
    snapshot: {kind: "note", id: "note-1", ownerId: "A", title: text, content: {type: "doc", content: []}, tagsInput: "", tags: [], mathBlocks: [], pinned: false, binderId: null, folderId: null, documentId: null, lessonId: null},
  };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("durable private note journal", () => {
  it("recovers the originating tab's draft after reload", () => {
    const journal = createPersonalDraftJournal("A", "personal-note:note-1");
    journal.write(draft("pending work"));
    const reloaded = createPersonalDraftJournal("A", "personal-note:note-1");
    expect(reloaded.read()?.snapshot.title).toBe("pending work");
  });
  it("keeps independent writer slots even when duplicate tabs inherit the same session pointer", () => {
    const first = createPersonalDraftJournal("A", "personal-note:note-1");
    first.write(draft("first tab"));
    const duplicate = createPersonalDraftJournal("A", "personal-note:note-1");
    expect(duplicate.read()?.snapshot.title).toBe("first tab");
    duplicate.write(draft("duplicate tab"));
    first.write(draft("first tab newer"));
    const inspector = createPersonalDraftJournal("A", "personal-note:note-1");
    expect(inspector.list().map((entry) => entry.draft.snapshot.title).sort()).toEqual(["duplicate tab", "first tab newer"]);
    first.remove();
    expect(inspector.list().map((entry) => entry.draft.snapshot.title)).toEqual(["duplicate tab"]);
  });
  it("does not expose account A backups to B using the same item id", () => {
    createPersonalDraftJournal("A", "personal-note:note-1").write(draft("A only"));
    const b = createPersonalDraftJournal("B", "personal-note:note-1");
    expect(b.read()).toBeNull(); expect(b.list()).toEqual([]);
  });
  it("rejects a pending operation for another entity before writing a backup", () => {
    const value = draft("my work");
    value.pending = {operationId: "request", localRevision: 1, expectedRevision: 0, snapshot: {...value.snapshot, id: "other-note"}};
    expect(() => createPersonalDraftJournal("A", "personal-note:note-1").write(value)).toThrow("Draft identity or revision mismatch");
    expect(localStorage.length).toBe(0);
  });
  it("explicitly clears inherited recovery selection without deleting another writer's backup", () => {
    const first = createPersonalDraftJournal("A", "personal-note:note-1");
    first.write(draft("retained backup"));
    const reloaded = createPersonalDraftJournal("A", "personal-note:note-1");
    expect(reloaded.read()?.snapshot.title).toBe("retained backup");
    reloaded.remove(); reloaded.clearSelection();
    const afterRemoteChoice = createPersonalDraftJournal("A", "personal-note:note-1");
    expect(afterRemoteChoice.read()).toBeNull();
    expect(afterRemoteChoice.list().map((item) => item.draft.snapshot.title)).toEqual(["retained backup"]);
  });
});
