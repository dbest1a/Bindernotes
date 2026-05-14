export type DashboardSummaryHealthStatus = "fresh" | "stale" | "refreshing" | "failed";

export type DashboardSummaryHealthRow = {
  refresh_error_code?: string | null;
  refresh_error_message?: string | null;
  stale_after?: string | null;
  summary_status?: string | null;
};

const validStatuses = new Set<DashboardSummaryHealthStatus>([
  "fresh",
  "stale",
  "refreshing",
  "failed",
]);

function isPastTimestamp(value: string | null | undefined, now: Date) {
  if (!value) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now.getTime();
}

export function resolveDashboardSummaryHealth(
  row: DashboardSummaryHealthRow,
  now = new Date(),
): DashboardSummaryHealthStatus {
  if (row.refresh_error_code || row.refresh_error_message) {
    return "failed";
  }

  const status = validStatuses.has(row.summary_status as DashboardSummaryHealthStatus)
    ? (row.summary_status as DashboardSummaryHealthStatus)
    : "fresh";

  if (status === "failed" || status === "refreshing") {
    return status;
  }

  if (isPastTimestamp(row.stale_after, now)) {
    return "stale";
  }

  return status;
}

export function isDashboardSummaryStale(row: DashboardSummaryHealthRow, now = new Date()) {
  return resolveDashboardSummaryHealth(row, now) === "stale";
}
