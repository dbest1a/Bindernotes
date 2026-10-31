// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearReaderNoteDraft, readReaderNoteDraft, writeReaderNoteDraft, type ReaderNoteDraft } from "@/lib/reader-note-recovery";
import { PersonalNoteDraftStore } from "@/hooks/use-personal-note-draft";
import { emptyDoc } from "@/lib/utils";
import type { PersonalNotesEntry } from "@/types";

describe("reader recovery shared with Personal Notes", () => {
  beforeEach(() => sessionStorage.clear());
  const draft: ReaderNoteDraft = { scopeKey: "owner:binder:lesson", input: { id: "note", ownerId: "owner", binderId: "binder", lessonId: "lesson", expectedUpdatedAt: "2026-10-01T10:00:00.000Z", title: "My unsaved title", content: emptyDoc("My exact unsaved body"), mathBlocks: [] } };
  it("survives reader reload and exposes the same conflict copy in Personal Notes", () => {
    writeReaderNoteDraft(draft);
    expect(readReaderNoteDraft("owner", "binder", "lesson")).toEqual(draft);
    expect(readReaderNoteDraft("other-owner", "binder", "lesson")).toBeNull();
    const entry = { id: "note", kind: "binder-note", title: "Newer remote title", content: emptyDoc("Remote contribution"), tags: [], updated_at: "2026-10-01T11:00:00.000Z", note: { owner_id: "owner", binder_id: "binder", lesson_id: "lesson", math_blocks: [] } } as unknown as PersonalNotesEntry;
    const recovered = new PersonalNoteDraftStore("owner", vi.fn()).record(entry);
    expect(recovered.draft.title).toBe(draft.input.title);
    expect(recovered.draft.content).toEqual(draft.input.content);
    expect(recovered.expectedUpdatedAt).toBe(draft.input.expectedUpdatedAt);
    expect(recovered.revision).not.toBe(recovered.acknowledged);
    clearReaderNoteDraft(draft);
    expect(readReaderNoteDraft("owner", "binder", "lesson")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem("bindernotes:note-draft:v1:owner:binder-note:note") || "null").draft.title).toBe(draft.input.title);
  });
  it("keeps the draft in this tab when session storage rejects writes", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    try {
      expect(writeReaderNoteDraft(draft)).toBe(false);
      expect(readReaderNoteDraft("owner", "binder", "lesson")).toEqual(draft);
      expect(readReaderNoteDraft("other-owner", "binder", "lesson")).toBeNull();
      const newer = { ...draft, input: { ...draft.input, title: "Newer in memory" } };
      writeReaderNoteDraft(newer);
      clearReaderNoteDraft(draft);
      expect(readReaderNoteDraft("owner", "binder", "lesson")?.input.title).toBe("Newer in memory");
      clearReaderNoteDraft(newer);
      expect(readReaderNoteDraft("owner", "binder", "lesson")).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });
  it("drops an older stored journal when a newer write can only be kept in memory", () => {
    writeReaderNoteDraft(draft);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    const newer = { ...draft, input: { ...draft.input, title: "Newer in memory" } };
    try {
      writeReaderNoteDraft(newer);
    } finally {
      setItem.mockRestore();
    }
    expect(sessionStorage.getItem("bindernotes:reader-note-draft:v1:owner:binder:lesson")).toBeNull();
    clearReaderNoteDraft(newer);
    expect(readReaderNoteDraft("owner", "binder", "lesson")).toBeNull();
  });
  it("never deletes a newer reader or Personal Notes journal from an older acknowledgement", () => {
    writeReaderNoteDraft(draft);
    sessionStorage.setItem("bindernotes:note-draft:v1:owner:binder-note:note", "newer personal draft");
    const newer = { ...draft, input: { ...draft.input, title: "Newer reader title" } };
    writeReaderNoteDraft(newer);
    clearReaderNoteDraft(draft);
    expect(readReaderNoteDraft("owner", "binder", "lesson")?.input.title).toBe("Newer reader title");
    expect(sessionStorage.getItem("bindernotes:note-draft:v1:owner:binder-note:note")).toBe("newer personal draft");
  });
});
