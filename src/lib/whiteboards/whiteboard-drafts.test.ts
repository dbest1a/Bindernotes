// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
import { clearWhiteboardRecoverySelection, createWhiteboardDraftCopy, getWhiteboardDraft, listWhiteboardBackups, mergeWhiteboardDrafts, restoreWhiteboardBackup } from "./whiteboard-drafts";
import { saveWhiteboard } from "./whiteboard-storage";
import type { BinderWhiteboard, WhiteboardSaveResult } from "./whiteboard-types";

vi.mock("./whiteboard-storage", () => ({ isScratchWhiteboard: (board: BinderWhiteboard) => board.id.startsWith("scratch-"), saveWhiteboard: vi.fn() }));
function board(id = "board-a", revision = 4): BinderWhiteboard {
  return { id, ownerId: "owner", binderId: "binder", lessonId: "lesson", title: id, subject: "Math", moduleContext: "lesson", scene: { elements: [] }, modules: [], revision, storageMode: "supabase", objectCount: 0, sceneSizeBytes: 0, assetSizeBytes: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01", archivedAt: null };
}
function saved(snapshot: BinderWhiteboard, revision: number): WhiteboardSaveResult { return { board: { ...snapshot, revision }, status: "saved", backend: "supabase", message: "Saved", savedAt: "2026-01-01" }; }
function deferred<T>() { let resolve!: (result: T) => void; const promise = new Promise<T>((res) => { resolve = res; }); return { promise, resolve }; }
function backups() { return Object.keys(localStorage).filter((key) => key.startsWith("bindernotes:whiteboard-draft:v1:")); }
beforeEach(() => {
  saveQueue.setAccount(null); localStorage.clear(); sessionStorage.clear(); saveQueue.setAccount("owner");
  vi.mocked(saveWhiteboard).mockReset().mockImplementation(async (snapshot, options) => saved(snapshot, (options?.expectedRevision ?? 0) + 1));
});
afterEach(() => { saveQueue.setAccount(null); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("durable whiteboard drafts", () => {
  it("never creates a save controller from unloaded metadata and preserves a dirty scene across metadata refresh", () => {
    const metadata = { ...board(), metadataOnly: true };
    expect(() => getWhiteboardDraft(metadata)).toThrow("selected whiteboard scene");
    expect(mergeWhiteboardDrafts([metadata], { ownerId: "owner", binderId: "binder", lessonId: "lesson" })).toEqual([metadata]);
    const draft = getWhiteboardDraft(board());
    draft.edit((value) => ({ ...value, scene: { elements: [{ id: "unsaved-stroke" }] } }), false);
    expect(mergeWhiteboardDrafts([{ ...metadata, revision: 10 }], { ownerId: "owner", binderId: "binder", lessonId: "lesson" })[0].scene.elements).toEqual([{ id: "unsaved-stroke" }]);
  });
  it("captures immutable per-board scenes before the debounce and survives navigation", async () => {
    vi.useFakeTimers();
    const a = getWhiteboardDraft(board()); const b = getWhiteboardDraft(board("board-b"));
    const scene = { elements: [{ id: "stroke-a", version: 1 }] };
    a.edit((current) => ({ ...current, scene }));
    scene.elements[0].id = "mutated-after-callback";
    b.edit((current) => ({ ...current, title: "B changed" }));
    expect(backups()).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(backups()[0])!).snapshot.scene.elements[0].id).toBe("stroke-a");
    await vi.advanceTimersByTimeAsync(1600);
    expect(saveWhiteboard).toHaveBeenCalledWith(expect.objectContaining({ id: "board-a", scene: { elements: [{ id: "stroke-a", version: 1 }] } }), expect.objectContaining({ expectedRevision: 4 }));
    expect(saveWhiteboard).toHaveBeenCalledWith(expect.objectContaining({ id: "board-b", title: "B changed" }), expect.anything());
  });

  it("serializes revisions while edits arrive during an in-flight save", async () => {
    const first = deferred<WhiteboardSaveResult>();
    vi.mocked(saveWhiteboard).mockReturnValueOnce(first.promise);
    const draft = getWhiteboardDraft(board());
    draft.edit((current) => ({ ...current, title: "first" }), false);
    const saving = draft.flush();
    draft.edit((current) => ({ ...current, title: "second" }), false);
    expect(saveWhiteboard).toHaveBeenCalledTimes(1);
    first.resolve(saved(board(), 5)); await saving;
    expect(saveWhiteboard).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: "second" }), expect.objectContaining({ expectedRevision: 5 }));
    expect(draft.getServerRevision()).toBe(6);
    expect(draft.getSnapshot()).toMatchObject({ dirty: false, snapshot: { title: "second" } });
    expect(backups()).toHaveLength(0);
  });

  it("reuses the exact pending operation after uncertain failure and account rehydration", async () => {
    vi.mocked(saveWhiteboard).mockRejectedValueOnce(new Error("Response lost"));
    const draft = getWhiteboardDraft(board());
    draft.edit((current) => ({ ...current, title: "recover me" }), false); await draft.flush();
    const [snapshot, options] = vi.mocked(saveWhiteboard).mock.calls[0];
    saveQueue.setAccount(null); saveQueue.setAccount("owner");
    const recovered = getWhiteboardDraft(board());
    expect(recovered.getSnapshot().snapshot.title).toBe("recover me");
    await recovered.flush();
    expect(saveWhiteboard).toHaveBeenLastCalledWith(snapshot, options);
  });

  it("preserves conflicts across remote refresh and offers an independent copy or explicit remote", async () => {
    vi.mocked(saveWhiteboard).mockResolvedValueOnce({ ...saved(board(), 5), status: "conflict", message: "Conflict" });
    const draft = getWhiteboardDraft(board());
    draft.edit((current) => ({ ...current, title: "my changes" }), false); await draft.flush();
    expect(draft.getSnapshot().state).toBe("conflict");
    expect(mergeWhiteboardDrafts([{ ...board("board-a", 8), title: "someone else" }], { ownerId: "owner", binderId: "binder", lessonId: "lesson" })[0].title).toBe("my changes");
    const copy = createWhiteboardDraftCopy(draft.getSnapshot().snapshot); await copy.flush();
    expect(saveWhiteboard).toHaveBeenLastCalledWith(expect.objectContaining({ title: "my changes (draft copy)" }), expect.objectContaining({ expectedRevision: 0 }));
    expect(copy.getSnapshot().snapshot.id).not.toBe("board-a");
    expect(draft.getSnapshot().dirty).toBe(true);
    draft.useRemote({ ...board("board-a", 8), title: "someone else" }, 8);
    expect(draft.getSnapshot()).toMatchObject({ dirty: false, state: "saved", snapshot: { title: "someone else" } });
  });

  it("retains a late retired-account acknowledgement as a recoverable pending operation", async () => {
    const request = deferred<WhiteboardSaveResult>(); vi.mocked(saveWhiteboard).mockReturnValueOnce(request.promise);
    const draft = getWhiteboardDraft(board()); draft.edit((current) => ({ ...current, title: "pending" }), false);
    const saving = draft.flush(); saveQueue.setAccount("other-owner");
    request.resolve(saved(board(), 5)); await saving;
    expect(backups()).toHaveLength(1);
    expect(mergeWhiteboardDrafts([], { ownerId: "other-owner", binderId: "binder", lessonId: "lesson" })).toEqual([]);
    expect(() => draft.edit((value) => value)).toThrow(/Sign in/);
  });

  it("reports storage exhaustion without pretending an offline draft is durable", () => {
    const draft = getWhiteboardDraft(board());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    draft.edit((current) => ({ ...current, title: "keep page open" }), false);
    expect(draft.getSnapshot()).toMatchObject({ dirty: true, durable: false, state: "error" });
    expect(draft.getSnapshot().error).toMatch(/backup failed or is full/);
  });

  it("recovers scratch drafts without scheduling an unintended server creation", async () => {
    vi.useFakeTimers();
    const draft = getWhiteboardDraft(board("scratch-a", 0));
    draft.edit((current) => ({ ...current, title: "scratch work" }), false);
    saveQueue.setAccount(null); saveQueue.setAccount("owner");
    const recovered = mergeWhiteboardDrafts([], { ownerId: "owner", binderId: "binder", lessonId: "lesson" });
    expect(recovered[0].title).toBe("scratch work");
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveWhiteboard).not.toHaveBeenCalled();
  });

  it("uses a new writer slot after reload or tab duplication and retains selectable inherited backups", async () => {
    const first = getWhiteboardDraft(board()); first.edit((current) => ({ ...current, title: "first tab work" }), false);
    const inheritedKey = backups()[0]; const inherited = localStorage.getItem(inheritedKey);
    // A cloned tab inherits the same session pointer, but initializes a distinct writer.
    saveQueue.setAccount(null); saveQueue.setAccount("owner");
    const second = getWhiteboardDraft(board()); second.edit((current) => ({ ...current, title: "second tab work" }), false);
    expect(backups()).toHaveLength(2);
    expect(localStorage.getItem(inheritedKey)).toBe(inherited);
    await second.flush();
    expect(localStorage.getItem(inheritedKey)).toBe(inherited);
    expect(listWhiteboardBackups(board()).map((item) => item.draft.snapshot.title)).toContain("first tab work");
    const recovered = restoreWhiteboardBackup(board(), inheritedKey);
    expect(recovered.getSnapshot().snapshot.title).toBe("first tab work");
  });
  it("does not automatically resurrect an inherited draft after an explicit remote choice", () => {
    const first = getWhiteboardDraft(board()); first.edit((current) => ({ ...current, title: "old draft" }), false);
    saveQueue.setAccount(null); saveQueue.setAccount("owner");
    const recovered = getWhiteboardDraft(board());
    recovered.useRemote({ ...board(), title: "remote chosen" }, 4);
    clearWhiteboardRecoverySelection(board());
    saveQueue.setAccount(null); saveQueue.setAccount("owner");
    expect(getWhiteboardDraft({ ...board(), title: "remote chosen" }).getSnapshot()).toMatchObject({ dirty: false, snapshot: { title: "remote chosen" } });
    expect(listWhiteboardBackups(board()).map((item) => item.draft.snapshot.title)).toContain("old draft");
  });
});
