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

class SaveQueue {
  private records = new Map<string, SaveQueueRecord<unknown>>();
  private listeners = new Set<SaveQueueListener>();

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
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) {
      this.setRecord(input.scopeKey, {
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state: "offline",
        lastSavedAt: this.records.get(input.scopeKey)?.lastSavedAt ?? null,
        error: null,
        retry: input.runner,
      });
      throw new Error("You are offline. This change is safe on this device, but it has not synced yet.");
    }

    this.setRecord(input.scopeKey, {
      entityType: input.entityType,
      scopeKey: input.scopeKey,
      state: "saving",
      lastSavedAt: this.records.get(input.scopeKey)?.lastSavedAt ?? null,
      error: null,
      retry: input.runner,
    });

    try {
      const result = await input.runner();
      this.setRecord(input.scopeKey, {
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state: "saved",
        lastSavedAt: new Date().toISOString(),
        error: null,
        retry: input.runner,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      this.setRecord(input.scopeKey, {
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state: "failed",
        lastSavedAt: this.records.get(input.scopeKey)?.lastSavedAt ?? null,
        error: message,
        retry: input.runner,
      });
      throw error;
    }
  }

  async retry(scopeKey: string) {
    const record = this.records.get(scopeKey);
    if (!record?.retry) {
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

    for (const scopeKey of scopeKeys) {
      await this.retry(scopeKey);
    }
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
      return "Offline - edits safe on this device";
    case "retrying":
      return "Couldn't sync - retrying";
    case "failed":
      return "Save failed - copy backup or retry";
    case "conflict":
      return "Conflict found - choose version";
    case "idle":
    default:
      return "Saved";
  }
}

export const saveQueue = new SaveQueue();
