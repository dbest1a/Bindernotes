// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveQueue } from "@/lib/save-queue";
import { useSyncRecovery } from "@/lib/sync-recovery";
import type { SaveEntityType } from "@/types";

function Recovery({ types }: { types: SaveEntityType[] }) {
  useSyncRecovery(types);
  return null;
}

describe("useSyncRecovery", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("contains a failed reconnect retry instead of leaving an unhandled rejection", async () => {
    const failure = new AggregateError([new Error("still offline")], "Some changes could not sync.");
    const retryPending = vi.spyOn(saveQueue, "retryPending").mockRejectedValue(failure);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      render(<Recovery types={["highlight"]} />);
      await act(async () => {
        window.dispatchEvent(new Event("online"));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(retryPending).toHaveBeenCalledWith(["highlight"]);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("does not retry again when a parent re-renders with an equivalent inline list", () => {
    const retryPending = vi.spyOn(saveQueue, "retryPending").mockResolvedValue(undefined);
    const view = render(<Recovery types={["highlight", "history_event"]} />);
    view.rerender(<Recovery types={["highlight", "history_event"]} />);
    expect(retryPending).toHaveBeenCalledTimes(1);
    expect(retryPending).toHaveBeenCalledWith(["highlight", "history_event"]);
  });
});
