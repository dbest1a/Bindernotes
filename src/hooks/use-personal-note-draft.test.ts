// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalNoteDraftStore } from "@/hooks/use-personal-note-draft";
import { emptyDoc } from "@/lib/utils";
import type { PersonalNotesEntry } from "@/types";

function entry(id = "note-a", kind: PersonalNotesEntry["kind"] = "personal-note"): PersonalNotesEntry {
  return { id, kind, title: "Baseline", content: emptyDoc("Baseline"), tags: [], updated_at: "2026-10-01T10:00:00.000Z", note: { id, owner_id: "owner-a", math_blocks: [] } } as unknown as PersonalNotesEntry;
}
const stamp = "2026-10-01T10:00:01.000Z";
describe("Personal Notes revision and recovery journal", () => {
  beforeEach(() => sessionStorage.clear());

  it.each(["personal-note", "personal-document", "binder-note"] as const)("synchronously recovers an outgoing %s title, body and tags after reload", (kind) => {
    const note = entry("note-a", kind);
    const store = new PersonalNoteDraftStore("owner-a", vi.fn());
    store.change(note, { title: "Unsent title", content: emptyDoc("Last keystroke"), tagsInput: "alpha, beta" });
    store.record(entry("note-b"));
    const recovered = new PersonalNoteDraftStore("owner-a", vi.fn()).record(note);
    expect(recovered.draft).toEqual({ title: "Unsent title", content: emptyDoc("Last keystroke"), tagsInput: "alpha, beta" });
    expect(recovered.revision).not.toBe(recovered.acknowledged);
    expect(new PersonalNoteDraftStore("other-owner", vi.fn()).record(note).draft.title).toBe("Baseline");
  });

  it("serializes writes and only acknowledges the submitted revision", async () => {
    const store = new PersonalNoteDraftStore("owner-a", vi.fn());
    const note = entry();
    let resolveFirst!: (value: { updated_at: string }) => void;
    let resolveSecond!: (value: { updated_at: string }) => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; })).mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    store.change(note, { title: "A" });
    const pending = store.save(note, save);
    store.change(note, { title: "B", content: emptyDoc("New body"), tagsInput: "new" });
    expect(store.save(note, save)).toBe(pending);
    resolveFirst({ updated_at: stamp });
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][1].title).toBe("A");
    expect(save.mock.calls[1]).toEqual([note, { title: "B", content: emptyDoc("New body"), tagsInput: "new" }, stamp]);
    expect(store.record(note).revision).not.toBe(store.record(note).acknowledged);
    expect(JSON.parse(sessionStorage.getItem("bindernotes:note-draft:v1:owner-a:personal-note:note-a") || "null").draft.title).toBe("B");
    resolveSecond({ updated_at: "2026-10-01T10:00:02.000Z" });
    await pending;
    expect(store.hasUnsaved()).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it("retains a conflict or failed write for recovery, without acknowledging another record", async () => {
    const store = new PersonalNoteDraftStore("owner-a", vi.fn());
    const a = entry();
    const b = entry("note-b");
    store.change(a, { title: "Conflict copy" });
    store.change(b, { title: "Another pending note" });
    await store.save(a, vi.fn().mockRejectedValue(new Error("A newer version exists")));
    expect(store.record(a).state).toBe("error");
    expect(store.record(b).revision).not.toBe(store.record(b).acknowledged);
    expect(new PersonalNoteDraftStore("owner-a", vi.fn()).record(a).draft.title).toBe("Conflict copy");
  });

  it("does not clear or replace a new page instance's draft when an outgoing save acknowledges", async () => {
    const note = entry();
    const outgoing = new PersonalNoteDraftStore("owner-a", vi.fn());
    outgoing.change(note, { title: "Outgoing request" });
    let resolve!: (value: { updated_at: string }) => void;
    const pending = outgoing.save(note, () => new Promise((done) => { resolve = done; }));
    const remounted = new PersonalNoteDraftStore("owner-a", vi.fn());
    remounted.change(note, { title: "New page edit" });
    resolve({ updated_at: stamp });
    await pending;
    expect(new PersonalNoteDraftStore("owner-a", vi.fn()).record(note).draft.title).toBe("New page edit");
  });

  it("recognizes an acknowledged payload after reload even if the page closed before the response", () => {
    const note = entry();
    const store = new PersonalNoteDraftStore("owner-a", vi.fn());
    store.change(note, { title: "Saved while closing" });
    const recovered = new PersonalNoteDraftStore("owner-a", vi.fn()).record({ ...note, title: "Saved while closing", updated_at: stamp });
    expect(recovered.revision).toBe(recovered.acknowledged);
    expect(recovered.expectedUpdatedAt).toBe(stamp);
  });
});
