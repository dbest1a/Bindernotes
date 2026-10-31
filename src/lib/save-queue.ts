import type { SaveEntityType, SaveStatusSnapshot, SaveStatusState } from "@/types";

const OFFLINE_MESSAGE = "You are offline. Keep this tab open and retry when connected; this change has not synced.";

type Rebase<T> = (remainingTargets: readonly string[]) => (() => Promise<T>) | null;

export type SaveQueueInput<T> = {
  entityType: SaveEntityType;
  scopeKey: string;
  runner: () => Promise<T>;
  /**
   * What this write sets, such as `argument-chain:<id>:thesis`. When a later
   * write to the same target succeeds, this write's failure is superseded and a
   * retry never restores the older value. Writes without targets (independent
   * creates) are never superseded.
   */
  targets?: readonly string[];
  /**
   * Rebuilds a multi-target write for only the targets no newer write has saved;
   * returns null when nothing is left. Without it, a partly superseded write is dropped.
   */
  rebase?: Rebase<T>;
};

type FailedOperation = {
  /** Order in which the student made the change; retries keep the original. */
  originId: number;
  runner: () => Promise<unknown>;
  targets: readonly string[];
  rebase?: Rebase<unknown>;
  state: "failed" | "offline";
  error: string;
};

type SaveQueueRecord = {
  entityType: SaveEntityType;
  scopeKey: string;
  lastSavedAt: string | null;
  /** Writes queued or running for this scope. */
  active: number;
  /** Retries among the active writes. */
  retrying: number;
  /**
   * Every write that has not reached the server, keyed by operation. A scope is
   * a collection (one status covers several records, and updates are partial
   * patches), so a later success only replaces a failure that wrote the same targets.
   */
  failures: Map<number, FailedOperation>;
  /** Newest change (by origin) that saved each target. */
  savedTargets: Map<string, number>;
};

type SaveQueueListener = (scopeKey: string, snapshot: SaveStatusSnapshot) => void;

export class SaveQueue {
  private records = new Map<string, SaveQueueRecord>();
  private listeners = new Set<SaveQueueListener>();
  private pending = new Map<string, Promise<unknown>>();
  private nextOperationId = 0;

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

  run<T>(input: SaveQueueInput<T>) {
    return this.enqueue(input, null);
  }

  /** Re-runs every failed or offline write for the scope, oldest first. */
  async retry(scopeKey: string) {
    const record = this.records.get(scopeKey);
    if (!record?.failures.size) {
      return;
    }

    const failed = [...record.failures.values()].sort((left, right) => left.originId - right.originId);
    record.failures.clear();
    const results = await Promise.allSettled(
      failed.map((operation) =>
        this.enqueue(
          { entityType: record.entityType, scopeKey, runner: operation.runner, targets: operation.targets, rebase: operation.rebase },
          operation.originId,
        ),
      ),
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length === 1) throw failures[0].reason;
    if (failures.length) throw new AggregateError(failures.map((result) => result.reason), "Some changes could not sync. Keep this tab open and retry.");
  }

  async retryPending(entityTypes?: SaveEntityType[]) {
    const allowed = entityTypes ? new Set(entityTypes) : null;
    const scopeKeys = [...this.records.values()]
      .filter((record) => record.failures.size > 0 && (!allowed || allowed.has(record.entityType)))
      .map((record) => record.scopeKey);

    const results = await Promise.allSettled(scopeKeys.map((scopeKey) => this.retry(scopeKey)));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((result) => result.reason), "Some changes could not sync. Keep this tab open and retry.");
  }

  /** `retryOriginId` is set when re-sending an earlier change. */
  private async enqueue<T>(input: SaveQueueInput<T>, retryOriginId: number | null): Promise<T> {
    const record = this.records.get(input.scopeKey) ?? {
      entityType: input.entityType,
      scopeKey: input.scopeKey,
      lastSavedAt: null,
      active: 0,
      retrying: 0,
      failures: new Map<number, FailedOperation>(),
      savedTargets: new Map<string, number>(),
    };
    this.records.set(input.scopeKey, record);
    const operationId = ++this.nextOperationId;
    const isRetry = retryOriginId !== null;
    const originId = retryOriginId ?? operationId;
    record.active += 1;
    if (isRetry) record.retrying += 1;
    this.emit(record);

    const previous = this.pending.get(input.scopeKey);
    const operation = (async () => {
      // Serialize writes to the same scope, without blocking other scopes.
      if (previous) await previous.catch(() => undefined);
      let runner = input.runner;
      let targets = input.targets ?? [];
      const rebase = input.rebase as Rebase<unknown> | undefined;
      try {
        if (isRetry && targets.length) {
          // A newer change may have saved while this retry waited its turn.
          const current = remainingTargets(record, targets, originId);
          if (!current.length) return undefined as T;
          if (current.length < targets.length) {
            const rebased = input.rebase?.(current);
            if (!rebased) return undefined as T;
            runner = rebased;
            targets = current;
          }
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          record.failures.set(operationId, { originId, runner, targets, rebase, state: "offline", error: OFFLINE_MESSAGE });
          throw new Error(OFFLINE_MESSAGE);
        }
        try {
          const result = await runner();
          record.lastSavedAt = new Date().toISOString();
          for (const target of targets) {
            record.savedTargets.set(target, Math.max(record.savedTargets.get(target) ?? 0, originId));
          }
          dropSupersededFailures(record);
          return result;
        } catch (error) {
          record.failures.set(operationId, {
            originId,
            runner,
            targets,
            rebase,
            state: "failed",
            error: error instanceof Error ? error.message : "Save failed.",
          });
          dropSupersededFailures(record);
          throw error;
        }
      } finally {
        record.active -= 1;
        if (isRetry) record.retrying -= 1;
        this.emit(record);
      }
    })();
    this.pending.set(input.scopeKey, operation);
    try {
      return await operation;
    } finally {
      if (this.pending.get(input.scopeKey) === operation) this.pending.delete(input.scopeKey);
    }
  }

  private emit(record: SaveQueueRecord) {
    const snapshot = formatSnapshot(record);
    this.listeners.forEach((listener) => listener(record.scopeKey, snapshot));
  }
}

function remainingTargets(record: SaveQueueRecord, targets: readonly string[], originId: number) {
  return targets.filter((target) => (record.savedTargets.get(target) ?? 0) < originId);
}

/** A failed write must never be retried over a newer change that already saved. */
function dropSupersededFailures(record: SaveQueueRecord) {
  for (const [operationId, failure] of record.failures) {
    if (!failure.targets.length) continue;
    const remaining = remainingTargets(record, failure.targets, failure.originId);
    if (remaining.length === failure.targets.length) continue;
    const rebased = remaining.length ? failure.rebase?.(remaining) : null;
    if (rebased) {
      record.failures.set(operationId, { ...failure, runner: rebased, targets: remaining });
    } else {
      record.failures.delete(operationId);
    }
  }
}

function getRecordState(record?: SaveQueueRecord): SaveStatusState {
  if (!record) return "idle";
  const failures = [...record.failures.values()];
  // An unsynced change outranks newer writes: the student must not see "Saved"
  // while an earlier change is still missing from their account.
  if (failures.some((failure) => failure.state === "failed")) return "failed";
  if (failures.length) return "offline";
  if (record.retrying) return "retrying";
  if (record.active) return "saving";
  return record.lastSavedAt ? "saved" : "idle";
}

function formatSnapshot(record?: SaveQueueRecord): SaveStatusSnapshot {
  const state = getRecordState(record);
  const latestFailure = record ? [...record.failures.values()].at(-1) : undefined;
  return {
    state,
    detail: buildSaveStatusDetail(state, record),
    lastSavedAt: record?.lastSavedAt ?? null,
    error: latestFailure?.error ?? null,
  };
}

function buildSaveStatusDetail(state: SaveStatusState, record?: SaveQueueRecord) {
  switch (state) {
    case "saving":
      return "Saving...";
    case "saved":
      return record?.lastSavedAt
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
