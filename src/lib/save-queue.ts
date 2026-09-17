import type { SaveEntityType, SaveStatusSnapshot, SaveStatusState } from "@/types";

type SaveQueueRecord<T> = {
  ownerId: string;
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
  private accountListeners = new Set<(ownerId: string | null) => void>();
  private ownerId: string | null = null;
  private generation = 0;
  private sequences = new Map<string, number>();
  private tails = new Map<string, Promise<unknown>>();

  getAccount() { return this.ownerId; }

  setAccount(ownerId: string | null) {
    if (ownerId === this.ownerId) return;
    this.ownerId = ownerId;
    this.generation += 1;
    const scopes = [...this.records.keys()];
    this.records.clear();
    this.sequences.clear();
    this.tails.clear();
    for (const scope of scopes) this.listeners.forEach((listener) => listener(scope, formatSnapshot()));
    this.accountListeners.forEach((listener) => listener(ownerId));
  }

  subscribeAccount(listener: (ownerId: string | null) => void) {
    this.accountListeners.add(listener);
    return () => { this.accountListeners.delete(listener); };
  }

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
    ownerId: string;
    entityType: SaveEntityType;
    scopeKey: string;
    runner: () => Promise<T>;
  }) {
    if (!input.ownerId || input.ownerId !== this.ownerId) {
      throw new Error("This save belongs to a different signed-in account.");
    }
    const generation = this.generation;
    const sequence = (this.sequences.get(input.scopeKey) ?? 0) + 1;
    this.sequences.set(input.scopeKey, sequence);
    const current = () => generation === this.generation && input.ownerId === this.ownerId;
    const latest = () => current() && this.sequences.get(input.scopeKey) === sequence;
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) {
      this.setRecord(input.scopeKey, {
        ownerId: input.ownerId,
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state: "offline",
        lastSavedAt: this.records.get(input.scopeKey)?.lastSavedAt ?? null,
        error: null,
        retry: input.runner,
      });
      throw new Error("You are offline. Keep this page open or copy a backup until this change is saved.");
    }

    this.setRecord(input.scopeKey, {
      ownerId: input.ownerId,
      entityType: input.entityType,
      scopeKey: input.scopeKey,
      state: "saving",
      lastSavedAt: this.records.get(input.scopeKey)?.lastSavedAt ?? null,
      error: null,
      retry: input.runner,
    });

    const previous = this.tails.get(input.scopeKey) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      if (!current()) throw new Error("The account changed before this save could finish.");
      return input.runner();
    });
    this.tails.set(input.scopeKey, operation);
    try {
      const result = await operation;
      if (!current()) throw new Error("The account changed before this save could finish.");
      if (latest()) this.setRecord(input.scopeKey, {
        ownerId: input.ownerId,
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state: "saved",
        lastSavedAt: new Date().toISOString(),
        error: null,
        retry: null,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      if (latest()) this.setRecord(input.scopeKey, {
        ownerId: input.ownerId,
        entityType: input.entityType,
        scopeKey: input.scopeKey,
        state: "failed",
        lastSavedAt: this.records.get(input.scopeKey)?.lastSavedAt ?? null,
        error: message,
        retry: input.runner,
      });
      throw error;
    } finally {
      if (this.tails.get(input.scopeKey) === operation) this.tails.delete(input.scopeKey);
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
      ownerId: record.ownerId,
      entityType: record.entityType,
      scopeKey,
      runner: record.retry,
    });
  }

  async retryPending(entityTypes?: SaveEntityType[]) {
    const allowed = entityTypes ? new Set(entityTypes) : null;
    const scopeKeys = [...this.records.entries()]
      .filter(([, record]) => {
        if (!record.retry || record.ownerId !== this.ownerId) {
          return false;
        }

        if (allowed && !allowed.has(record.entityType)) {
          return false;
        }

        return record.state === "offline" || record.state === "failed";
      })
      .map(([scopeKey]) => scopeKey);

    return Promise.allSettled(scopeKeys.map((scopeKey) => this.retry(scopeKey)));
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
      return "Offline - keep this page open or copy a backup";
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
