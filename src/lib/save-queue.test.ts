// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";

describe("save-queue", () => {
  beforeEach(() => { saveQueue.setAccount(null); saveQueue.setAccount("test-owner"); });
  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("moves to saved after a successful write", async () => {
    const result = await saveQueue.run({
        ownerId: "test-owner",
      entityType: "history_event",
      scopeKey: "test:history-event:success",
      runner: async () => "ok",
    });

    expect(result).toBe("ok");
    expect(saveQueue.getSnapshot("test:history-event:success").state).toBe("saved");
  });

  it("moves to failed after a rejected write", async () => {
    await expect(
      saveQueue.run({
        ownerId: "test-owner",
        entityType: "history_argument",
        scopeKey: "test:history-argument:failure",
        runner: async () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toThrow("boom");

    const snapshot = saveQueue.getSnapshot("test:history-argument:failure");
    expect(snapshot.state).toBe("failed");
    expect(snapshot.error).toBe("boom");
  });

  it("reports offline honestly and does not pretend to save", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await expect(
      saveQueue.run({
        ownerId: "test-owner",
        entityType: "history_evidence",
        scopeKey: "test:history-evidence:offline",
        runner: vi.fn(async () => "should-not-run"),
      }),
    ).rejects.toThrow("offline");

    expect(saveQueue.getSnapshot("test:history-evidence:offline").state).toBe("offline");
  });

  it("retries pending offline scopes when sync recovery runs", async () => {
    let calls = 0;

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await expect(
      saveQueue.run({
        ownerId: "test-owner",
        entityType: "history_evidence",
        scopeKey: "test:history-evidence:recover",
        runner: async () => {
          calls += 1;
          return "saved";
        },
      }),
    ).rejects.toThrow("offline");

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await saveQueue.retryPending(["history_evidence"]);

    expect(calls).toBe(1);
    expect(saveQueue.getSnapshot("test:history-evidence:recover").state).toBe("saved");
  });

  it("never retries account A's failed work after B signs in", async () => {
    const runner = vi.fn(async () => { throw new Error("offline failure"); });
    await expect(saveQueue.run({ownerId: "test-owner", entityType: "highlight", scopeKey: "same-item", runner})).rejects.toThrow();
    saveQueue.setAccount("account-B");
    await saveQueue.retryPending();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(saveQueue.getSnapshot("same-item").state).toBe("idle");
    await expect(saveQueue.run({ownerId: "test-owner", entityType: "highlight", scopeKey: "same-item", runner})).rejects.toThrow("different signed-in account");
  });

  it("does not resurrect retired retry closures when an old request settles", async () => {
    let finish!: (value: string) => void;
    const running = saveQueue.run({ownerId: "test-owner", entityType: "highlight", scopeKey: "same-item", runner: () => new Promise<string>((resolve) => { finish = resolve; })});
    const rejected = expect(running).rejects.toThrow("account changed");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    saveQueue.setAccount("account-B");
    finish("old account result");
    await rejected;
    expect(saveQueue.getSnapshot("same-item").state).toBe("idle");
  });

  it("serializes same-entity writes and does not show saved while newer work remains", async () => {
    let finish!: (value: string) => void;
    let finishNext!: (value: string) => void;
    const first = saveQueue.run({ownerId: "test-owner", entityType: "highlight", scopeKey: "same-item", runner: () => new Promise<string>((resolve) => { finish = resolve; })});
    const nextRunner = vi.fn(() => new Promise<string>((resolve) => { finishNext = resolve; }));
    const second = saveQueue.run({ownerId: "test-owner", entityType: "highlight", scopeKey: "same-item", runner: nextRunner});
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(nextRunner).not.toHaveBeenCalled();
    finish("one"); await first;
    await vi.waitFor(() => expect(finishNext).toBeTypeOf("function"));
    expect(saveQueue.getSnapshot("same-item").state).toBe("saving");
    finishNext("two"); await second;
    expect(saveQueue.getSnapshot("same-item").state).toBe("saved");
  });
});
