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

  it("keeps an earlier failed write visible and retryable after a different write in the same collection succeeds", async () => {
    // Scopes are collections: `history-evidence:${binderId}:${ownerId}` covers
    // evidence created from a source and from a text selection.
    const queue = new SaveQueue();
    const scopeKey = "history-evidence:binder-1:user-1";
    let failEvidenceA!: (error: Error) => void;
    const evidenceA = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((_, reject) => { failEvidenceA = reject; }))
      .mockResolvedValueOnce("evidence-A");
    const evidenceB = vi.fn().mockResolvedValue("evidence-B");

    const first = queue.run({ entityType: "history_evidence", scopeKey, runner: evidenceA });
    const second = queue.run({ entityType: "history_evidence", scopeKey, runner: evidenceB });
    const firstRejected = expect(first).rejects.toThrow("evidence A failed");
    await Promise.resolve();
    failEvidenceA(new Error("evidence A failed"));
    await firstRejected;
    await second;

    expect(queue.getSnapshot(scopeKey)).toMatchObject({ state: "failed", error: "evidence A failed" });
    await queue.retryPending(["history_evidence"]);
    expect(evidenceA).toHaveBeenCalledTimes(2);
    expect(evidenceB).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot(scopeKey)).toMatchObject({ state: "saved", error: null });
  });

  it("never retries an older failed edit over a newer saved edit to the same field", async () => {
    // Codex review reproducer: failed old value -> successful new value -> retry.
    const queue = new SaveQueue();
    const scopeKey = "history-argument:binder-1:user-1";
    const server = { thesis: "original" };
    const write = (value: string) => vi.fn(async () => { server.thesis = value; return value; });
    const oldEdit = vi.fn().mockRejectedValueOnce(new Error("offline blip")).mockImplementation(async () => { server.thesis = "old"; });
    await expect(queue.run({ entityType: "history_argument", scopeKey, runner: oldEdit, targets: ["argument-chain:c1:thesis"] })).rejects.toThrow("offline blip");
    expect(queue.getSnapshot(scopeKey).state).toBe("failed");

    await queue.run({ entityType: "history_argument", scopeKey, runner: write("new"), targets: ["argument-chain:c1:thesis"] });
    expect(queue.getSnapshot(scopeKey).state).toBe("saved");
    await queue.retry(scopeKey);

    expect(oldEdit).toHaveBeenCalledTimes(1);
    expect(server.thesis).toBe("new");
  });

  it("skips a retry that was queued behind a newer write to the same field", async () => {
    const queue = new SaveQueue();
    const scopeKey = "history-argument:binder-1:user-1";
    const oldEdit = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue("old");
    await expect(queue.run({ entityType: "history_argument", scopeKey, runner: oldEdit, targets: ["argument-chain:c1:thesis"] })).rejects.toThrow("temporary");

    let finishNew!: () => void;
    const newEdit = queue.run({ entityType: "history_argument", scopeKey, runner: () => new Promise<void>((resolve) => { finishNew = resolve; }), targets: ["argument-chain:c1:thesis"] });
    const retried = queue.retry(scopeKey);
    await Promise.resolve();
    finishNew();
    await newEdit;
    await retried;

    expect(oldEdit).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot(scopeKey).state).toBe("saved");
  });

  it("retries only the fields of a failed patch that no newer edit has saved", async () => {
    const queue = new SaveQueue();
    const scopeKey = "history-argument:binder-1:user-1";
    const sent: Array<Record<string, string>> = [];
    let failFirst = true;
    const savePatch = (patch: Record<string, string>) => async () => {
      if (failFirst) { failFirst = false; throw new Error("temporary"); }
      sent.push(patch);
    };
    const target = (field: string) => `argument-chain:c1:${field}`;
    const patchRun = (patch: Record<string, string>) => queue.run({
      entityType: "history_argument",
      scopeKey,
      runner: savePatch(patch),
      targets: Object.keys(patch).map(target),
      rebase: (remaining) => {
        const rest = Object.fromEntries(Object.entries(patch).filter(([field]) => remaining.includes(target(field))));
        return Object.keys(rest).length ? savePatch(rest) : null;
      },
    });

    await expect(patchRun({ thesis: "old thesis", context: "old context" })).rejects.toThrow("temporary");
    await patchRun({ thesis: "new thesis" });
    await queue.retry(scopeKey);

    expect(sent).toEqual([{ thesis: "new thesis" }, { context: "old context" }]);
    expect(queue.getSnapshot(scopeKey).state).toBe("saved");
  });

  it("retries every failed partial patch instead of only the newest one", async () => {
    const queue = new SaveQueue();
    const thesis = vi.fn().mockRejectedValueOnce(new Error("thesis failed")).mockResolvedValueOnce("thesis");
    const conclusion = vi.fn().mockRejectedValueOnce(new Error("conclusion failed")).mockResolvedValueOnce("conclusion");
    await Promise.allSettled([
      queue.run({ entityType: "history_argument", scopeKey: "history-argument:binder-1:user-1", runner: thesis, targets: ["argument-chain:c1:thesis"] }),
      queue.run({ entityType: "history_argument", scopeKey: "history-argument:binder-1:user-1", runner: conclusion, targets: ["argument-chain:c1:conclusion"] }),
    ]);
    expect(queue.getSnapshot("history-argument:binder-1:user-1")).toMatchObject({ state: "failed", error: "conclusion failed" });

    await queue.retry("history-argument:binder-1:user-1");
    expect(thesis).toHaveBeenCalledTimes(2);
    expect(conclusion).toHaveBeenCalledTimes(2);
    expect(thesis.mock.invocationCallOrder[1]).toBeLessThan(conclusion.mock.invocationCallOrder[1]);
    expect(queue.getSnapshot("history-argument:binder-1:user-1").state).toBe("saved");
  });

  it("reports retrying while failed writes are re-sent", async () => {
    const queue = new SaveQueue();
    let finishRetry!: () => void;
    const runner = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishRetry = resolve; }));
    await expect(queue.run({ entityType: "highlight", scopeKey: "highlight:scope", runner })).rejects.toThrow("temporary");
    const retried = queue.retry("highlight:scope");
    expect(queue.getSnapshot("highlight:scope").state).toBe("retrying");
    await Promise.resolve();
    await Promise.resolve();
    finishRetry();
    await retried;
    expect(queue.getSnapshot("highlight:scope").state).toBe("saved");
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
