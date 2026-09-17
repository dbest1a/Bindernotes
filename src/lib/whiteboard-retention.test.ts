import { describe, expect, it } from "vitest";
import { planWhiteboardVersionRetention } from "@/lib/whiteboard-retention";

describe("whiteboard retention planning", () => {
  it("marks only older excess auto versions as compactable", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `auto-${index + 1}`,
      version: index + 1,
      versionKind: "auto" as const,
      retentionStatus: "active" as const,
      createdAt: "2026-04-01T00:00:00.000Z",
      approximatePayloadBytes: 100,
    }));

    const plan = planWhiteboardVersionRetention(rows, {
      keepNewestAutoVersions: 3,
      keepAllAutoVersionsForDays: 7,
      now,
    });

    expect(plan.compactable.map((row) => row.id)).toEqual(["auto-3", "auto-2", "auto-1"]);
    expect(plan.compactablePayloadBytes).toBe(300);
    expect(plan.keep.map((row) => row.id)).toEqual(["auto-6", "auto-5", "auto-4"]);
  });

  it("keeps manual checkpoints and recent auto versions", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    const plan = planWhiteboardVersionRetention(
      [
        {
          id: "manual-1",
          version: 1,
          versionKind: "manual",
          retentionStatus: "active",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "recent-auto",
          version: 2,
          versionKind: "auto",
          retentionStatus: "active",
          createdAt: "2026-05-06T00:00:00.000Z",
        },
        {
          id: "old-auto",
          version: 3,
          versionKind: "auto",
          retentionStatus: "active",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      {
        keepNewestAutoVersions: 0,
        keepAllAutoVersionsForDays: 7,
        now,
      },
    );

    expect(plan.protectedVersionCount).toBe(1);
    expect(plan.keep.map((row) => row.id)).toContain("manual-1");
    expect(plan.keep.map((row) => row.id)).toContain("recent-auto");
    expect(plan.compactable.map((row) => row.id)).toEqual(["old-auto"]);
  });
});
