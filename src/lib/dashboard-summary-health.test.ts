import { describe, expect, it } from "vitest";
import {
  isDashboardSummaryStale,
  resolveDashboardSummaryHealth,
} from "@/lib/dashboard-summary-health";

describe("dashboard summary health", () => {
  const now = new Date("2026-05-07T12:00:00.000Z");

  it("treats failed refresh metadata as failed", () => {
    expect(
      resolveDashboardSummaryHealth(
        {
          summary_status: "fresh",
          refresh_error_code: "refresh_failed",
        },
        now,
      ),
    ).toBe("failed");
  });

  it("treats expired stale_after as stale", () => {
    const row = {
      summary_status: "fresh",
      stale_after: "2026-05-07T11:00:00.000Z",
    };

    expect(resolveDashboardSummaryHealth(row, now)).toBe("stale");
    expect(isDashboardSummaryStale(row, now)).toBe(true);
  });

  it("keeps refreshing status visible instead of flattening it to fresh", () => {
    expect(resolveDashboardSummaryHealth({ summary_status: "refreshing" }, now)).toBe("refreshing");
  });
});
