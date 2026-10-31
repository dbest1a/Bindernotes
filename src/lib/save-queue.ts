import type { SaveEntityType, SaveStatusSnapshot, SaveStatusState } from "@/types";

type SaveQueueRecord<T> = {
  entityType: SaveEntityType;
  scopeKey: string;
  state: SaveStatusState;
  lastSavedAt: string | null;
  error: string | null;
  retry: (() => Promise<T>) | null;
};

type SaveQueueListener = (scopeKey: string, snapshot: SaveStatusSnapshot) => void;

export class SaveQueue {
  private records = new Map<string, SaveQueueRecord<unknown>>();
  private listeners = new Set<SaveQueueListener>();
  private revisions = new Map<string, number>();
  private pending = new Map<string, Promise<unknown>>();

  subscribe(listener: SaveQueueListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(scopeKey: string): SaveStatusSnapshot {
    const record = this.records.get(scopeKey);
    return formatSnapshot(record);
  }

  async run<T>(input: {
    entityType: SaveEntityType;
    scopeKey: string;
    runner: () => Promise<T>;
  }) {
    const revision = (this.revisions.get(input.scopeKey) ?? 0) + 1;
    this.revisions.set(input.scopeKey, revision);
    const update = (state: SaveStatusState, error: string | null = null) => {
      // An earlier request may finish after another edit has been queued. Only
      // the newest edit owns the visible status and retry closure.
      if (this.revisions.get(input.scopeKey) !== revision) return;
      this.setRecord(input.scopeKey, {
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state,
        lastSavedAt: state === "saved" ? new Date().toISOString() : this.records.get(input.scopeKey)?.lastSavedAt ?? null,
        error,
        retry: state === "saved" ? null : input.runner,
      });
    };
    update("saving");
    const previous = this.pending.get(input.scopeKey);
    const operation = (async () => {
      // Serialize writes to the same entity, without blocking other entities.
      if (previous) await previous.catch(() => undefined);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        update("offline");
        throw new Error("You are offline. Keep this tab open and retry when connected; this change has not synced.");
      }
      try {
        const result = await input.runner();
        update("saved");
        return result;
      } catch (error) {
        update("failed", error instanceof Error ? error.message : "Save failed.");
        throw error;
      }
    })();
    this.pending.set(input.scopeKey, operation);
    try {
      return await operation;
    } finally {
      if (this.pending.get(input.scopeKey) === operation) this.pending.delete(input.scopeKey);
    }
  }

  async retry(scopeKey: string) {
    const record = this.records.get(scopeKey);
    if (!record?.retry || (record.state !== "failed" && record.state !== "offline")) {
      return;
    }

    this.setRecord(scopeKey, {
      ...record,
      state: "retrying",
      error: null,
    });

    return this.run({
      entityType: record.entityType,
      scopeKey,
      runner: record.retry,
    });
  }

  async retryPending(entityTypes?: SaveEntityType[]) {
    const allowed = entityTypes ? new Set(entityTypes) : null;
    const scopeKeys = [...this.records.entries()]
      .filter(([, record]) => {
        if (!record.retry) {
          return false;
        }

        if (allowed && !allowed.has(record.entityType)) {
          return false;
        }

        return record.state === "offline" || record.state === "failed";
      })
      .map(([scopeKey]) => scopeKey);

    const results = await Promise.allSettled(scopeKeys.map((scopeKey) => this.retry(scopeKey)));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((result) => result.reason), "Some changes could not sync. Keep this tab open and retry.");
  }

  private setRecord(scopeKey: string, record: SaveQueueRecord<unknown>) {
    this.records.set(scopeKey, record);
    const snapshot = formatSnapshot(record);
    this.listeners.forEach((listener) => listener(scopeKey, snapshot));
  }
}

function formatSnapshot(record?: SaveQueueRecord<unknown>): SaveStatusSnapshot {
  return {
    state: record?.state ?? "idle",
    detail: buildSaveStatusDetail(record),
    lastSavedAt: record?.lastSavedAt ?? null,
    error: record?.error ?? null,
  };
}

function buildSaveStatusDetail(record?: SaveQueueRecord<unknown>) {
  if (!record) {
    return "Saved";
  }

  switch (record.state) {
    case "saving":
      return "Saving...";
    case "saved":
      return record.lastSavedAt
        ? `Saved ${new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(record.lastSavedAt))}`
        : "Saved";
    case "offline":
      return "Offline - keep this tab open";
    case "retrying":
      return "Couldn't sync - retrying";
    case "failed":
      return "Save failed - keep this tab open";
    case "conflict":
      return "Conflict found - choose version";
    case "idle":
    default:
      return "Saved";
  }
}

export const saveQueue = new SaveQueue();
