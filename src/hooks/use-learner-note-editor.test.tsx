// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLearnerNoteEditor, type LearnerNoteWrite } from "./use-learner-note-editor";
import { saveQueue } from "@/lib/save-queue";
import { ContentConflictError } from "@/lib/revisioned-save";
import { readLearnerNoteByScope } from "@/services/binder-service";
import { emptyDoc } from "@/lib/utils";
import type { LearnerNote } from "@/types";
vi.mock("@/services/binder-service", () => ({ readLearnerNoteByScope: vi.fn() }));
vi.mock("@/services/personal-content-repository", () => ({ preservePersonalContentCopy: vi.fn() }));
function note(lesson = "a", title = "Saved", revision = 3): LearnerNote & { revision: number } {
  return { id: `note-${lesson}`, owner_id: "owner", binder_id: "binder", lesson_id: lesson, folder_id: null, title, content: emptyDoc(title), math_blocks: [], pinned: true, created_at: "2026-01-01", updated_at: "2026-01-01", revision };
}
function writer() { return vi.fn<(input: LearnerNoteWrite) => Promise<LearnerNote>>(async (input) => ({ ...note(input.lessonId, input.title, input.expectedRevision + 1), id: input.id, content: input.content, math_blocks: input.mathBlocks })); }
function options(lesson: string, write = writer(), existing: LearnerNote | null = note(lesson)) { return { ownerId: "owner", binderId: "binder", lessonId: lesson, lessonTitle: lesson, folderId: null, note: existing, ready: true, write }; }
beforeEach(() => { saveQueue.setAccount(null); localStorage.clear(); sessionStorage.clear(); saveQueue.setAccount("owner"); vi.mocked(readLearnerNoteByScope).mockReset(); });
afterEach(() => { cleanup(); saveQueue.setAccount(null); vi.useRealTimers(); });

describe("reader lesson note saving", () => {
  it("persists each lesson before navigation and finishes its captured save after unmount", async () => {
    vi.useFakeTimers(); const a = writer(); const b = writer();
    const hook = renderHook((props) => useLearnerNoteEditor(props), { initialProps: options("a", a) });
    const staleAChange = hook.result.current.setTitle;
    act(() => staleAChange("A draft"));
    expect(Object.keys(localStorage).some((key) => key.startsWith("binder-notes:draft:v2:"))).toBe(true);
    hook.rerender(options("b", b));
    act(() => staleAChange("stale callback"));
    act(() => hook.result.current.setTitle("B draft"));
    hook.unmount(); await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(a).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "a", title: "A draft", expectedRevision: 3, pinned: true }));
    expect(b).toHaveBeenCalledWith(expect.objectContaining({ lessonId: "b", title: "B draft", expectedRevision: 3 }));
  });

  it("keeps dirty content across same-user hydration and ignores another lesson's late acknowledgement", async () => {
    let resolve!: (note: LearnerNote) => void;
    const a = writer().mockImplementationOnce(() => new Promise<LearnerNote>((done) => { resolve = done; }));
    const hook = renderHook((props) => useLearnerNoteEditor(props), { initialProps: options("a", a) });
    act(() => hook.result.current.setTitle("A draft"));
    hook.rerender(options("a", a, note("a", "Other tab", 8)));
    expect(hook.result.current.title).toBe("A draft");
    let saving!: Promise<void>; act(() => { saving = hook.result.current.save(); });
    hook.rerender(options("b", writer())); act(() => hook.result.current.setTitle("B draft"));
    await act(async () => { resolve(note("a", "A draft", 4)); await saving; });
    expect(hook.result.current).toMatchObject({ title: "B draft", dirty: true });
  });

  it("preserves the pending operation and expected revision through uncertain retry and reload", async () => {
    const write = writer().mockRejectedValueOnce(new Error("Response lost"));
    const hook = renderHook(() => useLearnerNoteEditor(options("a", write)));
    act(() => hook.result.current.setTitle("Recover me")); await act(async () => hook.result.current.save());
    const operation = write.mock.calls[0][0]; hook.unmount();
    act(() => { saveQueue.setAccount(null); saveQueue.setAccount("owner"); });
    const reload = renderHook(() => useLearnerNoteEditor(options("a", write, note("a", "Remote acknowledged", 4))));
    expect(reload.result.current.title).toBe("Recover me");
    await act(async () => reload.result.current.save());
    expect(write).toHaveBeenLastCalledWith(operation);
  });

  it("keeps conflict explicit during edits until the user loads the remote version", async () => {
    const write = writer().mockRejectedValueOnce(new ContentConflictError());
    const hook = renderHook(() => useLearnerNoteEditor(options("a", write)));
    act(() => hook.result.current.setTitle("My changes")); await act(async () => hook.result.current.save());
    expect(hook.result.current.state).toBe("conflict");
    act(() => hook.result.current.setTitle("More local changes")); await act(async () => hook.result.current.save());
    expect(write).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state).toBe("conflict");
    vi.mocked(readLearnerNoteByScope).mockResolvedValueOnce(note("a", "Remote version", 9));
    await act(async () => hook.result.current.useRemote());
    expect(hook.result.current).toMatchObject({ title: "Remote version", dirty: false, state: "saved" });
  });

  it("can explicitly adopt a concurrently created note with another ID", async () => {
    const write = writer().mockRejectedValueOnce(new ContentConflictError());
    const hook = renderHook(() => useLearnerNoteEditor(options("a", write, null)));
    act(() => hook.result.current.setTitle("First note from this tab")); await act(async () => hook.result.current.save());
    vi.mocked(readLearnerNoteByScope).mockResolvedValueOnce(note("a", "Other tab created it", 1));
    await act(async () => hook.result.current.useRemote());
    expect(hook.result.current.title).toBe("Other tab created it");
    act(() => hook.result.current.setTitle("Continue editing")); await act(async () => hook.result.current.save());
    expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ id: "note-a", expectedRevision: 1 }));
  });
});
