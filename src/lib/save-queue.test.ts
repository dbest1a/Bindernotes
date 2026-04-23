// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";

describe("save-queue", () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
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
