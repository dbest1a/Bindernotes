export type WhiteboardVersionKind = "auto" | "draft" | "checkpoint" | "snapshot" | "manual";
export type WhiteboardRetentionStatus = "active" | "compactable" | "compacted" | "archived";

export type WhiteboardVersionRetentionRow = {
  id: string;
  version: number;
  createdAt: string;
  versionKind?: WhiteboardVersionKind | null;
  retentionStatus?: WhiteboardRetentionStatus | null;
  approximatePayloadBytes?: number | null;
};

export type WhiteboardRetentionOptions = {
  keepNewestAutoVersions: number;
  keepAllAutoVersionsForDays: number;
  now: Date;
};

export type WhiteboardRetentionPlan = {
  compactable: WhiteboardVersionRetentionRow[];
  compactablePayloadBytes: number;
  keep: WhiteboardVersionRetentionRow[];
  protectedVersionCount: number;
  totalPayloadBytes: number;
};

export const defaultWhiteboardRetentionOptions: WhiteboardRetentionOptions = {
  keepNewestAutoVersions: 50,
  keepAllAutoVersionsForDays: 7,
  now: new Date(),
};

function toMillis(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPayloadBytes(row: WhiteboardVersionRetentionRow) {
  return Math.max(0, row.approximatePayloadBytes ?? 0);
}

function isProtectedVersion(row: WhiteboardVersionRetentionRow) {
  return row.versionKind === "manual" || row.versionKind === "checkpoint" || row.versionKind === "snapshot";
}

export function planWhiteboardVersionRetention(
  rows: WhiteboardVersionRetentionRow[],
  options: Partial<WhiteboardRetentionOptions> = {},
): WhiteboardRetentionPlan {
  const resolved = {
    ...defaultWhiteboardRetentionOptions,
    ...options,
  };
  const newestAutoLimit = Math.max(0, resolved.keepNewestAutoVersions);
  const recentCutoffMs =
    resolved.now.getTime() - Math.max(0, resolved.keepAllAutoVersionsForDays) * 24 * 60 * 60 * 1000;

  const sorted = [...rows].sort((left, right) => {
    if (right.version !== left.version) {
      return right.version - left.version;
    }
    return toMillis(right.createdAt) - toMillis(left.createdAt);
  });

  const keep: WhiteboardVersionRetentionRow[] = [];
  const compactable: WhiteboardVersionRetentionRow[] = [];
  let protectedVersionCount = 0;
  let activeAutoRank = 0;

  for (const row of sorted) {
    const retentionStatus = row.retentionStatus ?? "active";
    const versionKind = row.versionKind ?? "auto";
    const createdAtMs = toMillis(row.createdAt);

    if (retentionStatus !== "active") {
      keep.push(row);
      continue;
    }

    if (isProtectedVersion(row)) {
      protectedVersionCount += 1;
      keep.push(row);
      continue;
    }

    if (versionKind !== "auto") {
      keep.push(row);
      continue;
    }

    activeAutoRank += 1;
    if (activeAutoRank <= newestAutoLimit || createdAtMs >= recentCutoffMs) {
      keep.push(row);
      continue;
    }

    compactable.push(row);
  }

  return {
    compactable,
    compactablePayloadBytes: compactable.reduce((total, row) => total + getPayloadBytes(row), 0),
    keep,
    protectedVersionCount,
    totalPayloadBytes: rows.reduce((total, row) => total + getPayloadBytes(row), 0),
  };
}
