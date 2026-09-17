import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentConflictError,
  RevisionedSave,
  type DurableDraft,
  type SaveOperation,
} from "./revisioned-save";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  let backup: DurableDraft<{ text: string }> | null = null;
  let sequence = 0;
  let online = true;
  const storage = {
    read: () => structuredClone(backup),
    write: (value: DurableDraft<{ text: string }>) => {
      backup = structuredClone(value);
    },
    remove: () => {
      backup = null;
    },
  };
  const write = vi
    .fn<(operation: SaveOperation<{ text: string }>) => Promise<{ revision: number }>>()
    .mockImplementation(async (op) => ({ revision: op.expectedRevision + 1 }));
  const create = (entityKey = "note:1", ownerId = "A") =>
    new RevisionedSave({
      ownerId,
      entityKey,
      snapshot: { text: "original" },
      serverRevision: 0,
      storage,
      write,
      online: () => online,
      createOperationId: () => `operation-${++sequence}`,
    });
  return {
    create,
    storage,
    write,
    backup: () => backup,
    offline: () => {
      online = false;
    },
    online: () => {
      online = true;
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("revisioned entity saving", () => {
  it("serializes rapid edits and never clears a newer draft on an old acknowledgement", async () => {
    const f = setup();
    const first = deferred<{ revision: number }>();
    const second = deferred<{ revision: number }>();
    f.write.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const editor = f.create();
    editor.edit(() => ({ text: "first" }), false);
    const saving = editor.flush();
    editor.edit(() => ({ text: "second" }), false);
    editor.edit(() => ({ text: "third" }), false);
    expect(f.write).toHaveBeenCalledTimes(1);
    first.resolve({ revision: 1 });
    await Promise.resolve();
    expect(editor.getSnapshot()).toMatchObject({ dirty: true, snapshot: { text: "third" } });
    expect(f.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRevision: 1, snapshot: { text: "third" } }),
    );
    second.resolve({ revision: 2 });
    await saving;
    expect(editor.getSnapshot()).toMatchObject({ dirty: false, state: "saved", snapshot: { text: "third" } });
  });

  it("preserves independent entities when the editor unsubscribes during navigation", async () => {
    vi.useFakeTimers();
    const a = setup();
    const b = setup();
    const first = a.create();
    const second = b.create("note:2");
    const unsubscribe = first.subscribe(vi.fn());
    first.edit(() => ({ text: "note A pending" }));
    unsubscribe();
    second.edit(() => ({ text: "note B pending" }));
    await vi.advanceTimersByTimeAsync(850);
    expect(a.write).toHaveBeenCalledWith(expect.objectContaining({ snapshot: { text: "note A pending" } }));
    expect(b.write).toHaveBeenCalledWith(expect.objectContaining({ snapshot: { text: "note B pending" } }));
  });

  it("recovers an offline draft after reload, without a memory closure", async () => {
    const f = setup();
    f.offline();
    const old = f.create();
    old.edit(() => ({ text: "offline work" }), false);
    await old.flush();
    old.retire();
    const reloaded = f.create();
    expect(reloaded.getSnapshot().snapshot.text).toBe("offline work");
    f.online();
    await reloaded.flush();
    expect(reloaded.getSnapshot().dirty).toBe(false);
    expect(f.backup()).toBeNull();
  });

  it("retries an uncertain request using the original operation ID before saving subsequent edits", async () => {
    const f = setup();
    f.write.mockRejectedValueOnce(new Error("response lost"));
    const first = f.create();
    first.edit(() => ({ text: "sent" }), false);
    await first.flush();
    first.edit(() => ({ text: "newer unsent" }), false);
    first.retire();
    const next = f.create();
    await next.flush();
    expect(f.write.mock.calls.map(([op]) => [op.operationId, op.snapshot.text, op.expectedRevision])).toEqual(
      [
        ["operation-1", "sent", 0],
        ["operation-1", "sent", 0],
        ["operation-2", "newer unsent", 1],
      ],
    );
  });

  it("reports storage failure honestly while permitting a confirmed online save", async () => {
    const f = setup();
    f.storage.write = () => {
      throw new Error("quota");
    };
    const editor = f.create();
    editor.edit(() => ({ text: "only memory" }), false);
    expect(editor.getSnapshot()).toMatchObject({ durable: false, dirty: true, state: "error" });
    expect(editor.getSnapshot().error).toContain("Copy your work");
    await editor.flush();
    expect(editor.getSnapshot().state).toBe("saved");
  });

  it("retirement prevents late acknowledgements and queued writes entering the next account", async () => {
    const f = setup();
    const pending = deferred<{ revision: number }>();
    f.write.mockReturnValueOnce(pending.promise);
    const a = f.create();
    a.edit(() => ({ text: "A private" }), false);
    const running = a.flush();
    a.edit(() => ({ text: "A newer" }), false);
    a.retire();
    pending.resolve({ revision: 1 });
    await running;
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.backup()?.snapshot.text).toBe("A newer");
    const b = f.create("note:1", "B");
    expect(b.getSnapshot().snapshot.text).toBe("original");
    expect(b.getSnapshot().state).toBe("error");
  });

  it("preserves both sides of a server conflict and never silently retries over it", async () => {
    const f = setup();
    f.write.mockRejectedValueOnce(new ContentConflictError());
    const editor = f.create();
    editor.edit(() => ({ text: "my version" }), false);
    await editor.flush();
    await editor.flush();
    expect(editor.getSnapshot()).toMatchObject({
      dirty: true,
      state: "conflict",
      snapshot: { text: "my version" },
    });
    expect(f.backup()?.snapshot.text).toBe("my version");
    expect(f.write).toHaveBeenCalledTimes(1);
    editor.useRemote({ text: "remote version" }, 9);
    expect(editor.getSnapshot()).toMatchObject({ dirty: false, snapshot: { text: "remote version" } });
  });
});
