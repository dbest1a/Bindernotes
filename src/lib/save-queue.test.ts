// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveQueue, saveQueue } from "@/lib/save-queue";

describe("save-queue", () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("serializes edits and keeps the newest pending edit's status and retry", async () => {
    const queue = new SaveQueue();
    let finishFirst!: (value: string) => void;
    const first = queue.run({ entityType: "history_event", scopeKey: "same", runner: () => new Promise<string>((resolve) => { finishFirst = resolve; }) });
    const secondRunner = vi.fn().mockRejectedValueOnce(new Error("Latest edit failed")).mockResolvedValueOnce("latest");
    const second = queue.run({ entityType: "history_event", scopeKey: "same", runner: secondRunner });
    const rejected = expect(second).rejects.toThrow("Latest edit failed");
    expect(secondRunner).not.toHaveBeenCalled();
    finishFirst("old");
    await first;
    await rejected;
    expect(queue.getSnapshot("same").state).toBe("failed");
    await queue.retry("same");
    expect(secondRunner).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot("same").state).toBe("saved");
    await queue.retry("same");
    expect(secondRunner).toHaveBeenCalledTimes(2);
  });

  it("does not mark a newer pending edit saved when the previous edit completes", async () => {
    const queue = new SaveQueue();
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const states: string[] = [];
    queue.subscribe((_, snapshot) => states.push(snapshot.state));
    const first = queue.run({ entityType: "history_event", scopeKey: "same", runner: () => new Promise<void>((resolve) => { finishFirst = resolve; }) });
    const second = queue.run({ entityType: "history_event", scopeKey: "same", runner: () => new Promise<void>((resolve) => { finishSecond = resolve; }) });
    finishFirst();
    await first;
    await Promise.resolve();
    expect(queue.getSnapshot("same").state).toBe("saving");
    expect(states).not.toContain("saved");
    finishSecond();
    await second;
    expect(queue.getSnapshot("same").state).toBe("saved");
  });

  it("recovers independent entities even when one retry fails", async () => {
    const queue = new SaveQueue();
    const bad = vi.fn().mockRejectedValue(new Error("unavailable"));
    const good = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce("saved");
    await Promise.allSettled([
      queue.run({ entityType: "history_event", scopeKey: "bad", runner: bad }),
      queue.run({ entityType: "history_event", scopeKey: "good", runner: good }),
    ]);
    await expect(queue.retryPending()).rejects.toThrow("Some changes could not sync");
    expect(queue.getSnapshot("bad").state).toBe("failed");
    expect(queue.getSnapshot("good").state).toBe("saved");
  });

  it("does not promise durable storage for offline in-memory work", async () => {
    const queue = new SaveQueue();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await expect(queue.run({ entityType: "history_event", scopeKey: "offline", runner: vi.fn() })).rejects.toThrow("Keep this tab open");
    expect(queue.getSnapshot("offline").detail).toBe("Offline - keep this tab open");
  });

  it("moves to saved after a successful write", async () => {
    const result = await saveQueue.run({
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
});
