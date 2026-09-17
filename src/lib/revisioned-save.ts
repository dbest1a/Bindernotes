import { timedSaveMetric } from "./operation-metrics";
import type { OperationMetric } from "./telemetry-contract";
/** A request keeps its identity through uncertain failures and reloads. */
export type SaveOperation<T> = {
  operationId: string;
  localRevision: number;
  expectedRevision: number;
  snapshot: T;
};

export type DurableDraft<T> = {
  version: 1;
  ownerId: string;
  entityKey: string;
  snapshot: T;
  localRevision: number;
  savedRevision: number;
  serverRevision: number;
  pending: SaveOperation<T> | null;
};

export type DraftStorage<T> = {
  read(): DurableDraft<T> | null;
  write(draft: DurableDraft<T>): void;
  remove(): void;
};

export type RevisionedSaveState<T> = {
  snapshot: T;
  dirty: boolean;
  state: "saved" | "pending" | "saving" | "offline" | "error" | "conflict";
  error: string | null;
  durable: boolean;
  revision: number;
};

export class ContentConflictError extends Error {
  constructor() { super("This item changed on another tab or device. Preserve your draft as a copy or load the saved version."); }
}

/** Owns an entity, not a mounted editor. Switching routes cannot cancel its draft. */
export class RevisionedSave<T> {
  private draft: DurableDraft<T>;
  private view: RevisionedSaveState<T>;
  private listeners = new Set<() => void>();
  private active = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private retryCount = 0;

  constructor(private readonly options: {
    ownerId: string;
    entityKey: string;
    snapshot: T;
    serverRevision: number;
    storage: DraftStorage<T>;
    write: (operation: SaveOperation<T>) => Promise<{ revision: number }>;
    online?: () => boolean;
    createOperationId?: () => string;
    delay?: number;
    metricOperation?: OperationMetric["operation"];
  }) {
    this.draft = {
      version: 1, ownerId: options.ownerId, entityKey: options.entityKey,
      snapshot: structuredClone(options.snapshot), serverRevision: options.serverRevision,
      localRevision: 0, savedRevision: 0, pending: null,
    };
    let readError: string | null = null;
    try {
      const restored = options.storage.read();
      if (restored) {
        if (restored.ownerId !== options.ownerId || restored.entityKey !== options.entityKey) {
          throw new Error("The recovered draft belongs to a different account or item.");
        }
        this.draft = structuredClone(restored);
      }
    } catch {
      readError = "The device backup could not be read. Copy your work before leaving this page.";
    }
    this.view = {
      snapshot: this.draft.snapshot,
      dirty: this.draft.localRevision !== this.draft.savedRevision,
      state: readError ? "error" : this.draft.localRevision !== this.draft.savedRevision ? "pending" : "saved",
      error: readError, durable: !readError, revision: this.draft.localRevision,
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.view;
  getServerRevision = () => this.draft.serverRevision;

  edit(update: (current: T) => T, autosave = true) {
    if (!this.active) throw new Error("Sign in again before editing this draft.");
    this.draft.snapshot = structuredClone(update(structuredClone(this.draft.snapshot)));
    this.draft.localRevision += 1;
    const conflicted = this.view.state === "conflict";
    const durable = this.persist();
    this.publish({ state: conflicted ? "conflict" : durable ? "pending" : "error", error: conflicted ? this.view.error : durable ? null : this.storageError(), durable });
    if (autosave) this.schedule();
  }

  schedule() {
    if (!this.active || !this.view.dirty || this.view.state === "conflict") return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.options.delay ?? 850);
  }

  flush = (): Promise<void> => {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.active || !this.view.dirty || this.view.state === "conflict") return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  };

  private async drain() {
    while (this.active && this.draft.localRevision !== this.draft.savedRevision) {
      if (!(this.options.online?.() ?? (typeof navigator === "undefined" || navigator.onLine))) {
        this.publish({ state: "offline", error: this.view.durable ? "Offline. Your draft is backed up on this device." : this.storageError() });
        timedSaveMetric(this.options.metricOperation ?? "content_save", this.retryCount, this.draft.snapshot)("offline");
        return;
      }
      const operation = this.draft.pending ?? {
        operationId: this.options.createOperationId?.() ?? crypto.randomUUID(),
        localRevision: this.draft.localRevision,
        expectedRevision: this.draft.serverRevision,
        snapshot: structuredClone(this.draft.snapshot),
      };
      this.draft.pending = operation;
      const durable = this.persist();
      this.publish({ state: "saving", durable, error: durable ? null : this.storageError() });
      const measure = timedSaveMetric(this.options.metricOperation ?? "content_save", this.retryCount, operation.snapshot);
      try {
        const result = await this.options.write(structuredClone(operation));
        if (!this.active) return;
        if (!Number.isSafeInteger(result.revision) || result.revision <= operation.expectedRevision) {
          throw new Error("The server did not confirm a valid saved revision.");
        }
        this.draft.serverRevision = result.revision;
        this.draft.savedRevision = operation.localRevision;
        this.draft.pending = null;
        this.retryCount = 0;
        const persisted = this.persist();
        this.publish({ state: this.draft.localRevision === operation.localRevision ? "saved" : "pending", durable: persisted, error: persisted ? null : this.storageError() });
        measure(persisted ? "saved" : "device_storage_failed");
      } catch (error) {
        if (!this.active) return;
        this.publish({ state: error instanceof ContentConflictError ? "conflict" : "error", error: error instanceof Error ? error.message : "The save failed. Your draft is still available; retry or copy it." });
        this.retryCount++;
        measure(error instanceof ContentConflictError ? "conflict" : "failed");
        return;
      }
    }
  }

  /** Explicit user decision only; never called automatically after a conflict. */
  useRemote(snapshot: T, revision: number) {
    if (!this.active || this.running) throw new Error("Wait for the current save before choosing a version.");
    this.options.storage.remove();
    this.draft = { ...this.draft, snapshot: structuredClone(snapshot), serverRevision: revision, localRevision: 0, savedRevision: 0, pending: null };
    this.publish({ state: "saved", error: null, durable: true });
  }

  retire() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private persist() {
    try {
      if (this.draft.localRevision === this.draft.savedRevision && !this.draft.pending) this.options.storage.remove();
      else this.options.storage.write(structuredClone(this.draft));
      return true;
    } catch { return false; }
  }

  private storageError() { return "Device backup failed or is full. Copy your work and keep this page open until the server confirms saving."; }

  private publish(change: Partial<RevisionedSaveState<T>>) {
    this.view = { ...this.view, ...change, snapshot: this.draft.snapshot, dirty: this.draft.localRevision !== this.draft.savedRevision, revision: this.draft.localRevision };
    this.listeners.forEach((listener) => listener());
  }
}
