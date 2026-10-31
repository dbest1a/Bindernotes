/**
 * Public verification API for Worked Solution cards.
 *
 * - `checkSolution(doc)` returns the same document with `check` set on every step.
 * - `checkStep(doc, stepId)` returns the check for one step (in the context of the whole document).
 *
 * The Compute Engine is loaded lazily, preferably inside a Web Worker so the whiteboard
 * never stalls. When workers are unavailable (jsdom tests, restrictive browsers) or fail,
 * a main-thread fallback dynamically imports the engine and yields to the event loop
 * between steps.
 */

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { SolutionDocument, StepCheck } from "./solution-types";
import { SolutionChecker, type CheckOptions } from "./verify-core";
import type { VerifyWorkerRequest, VerifyWorkerResponse } from "./verify.worker";

export type { CheckOptions } from "./verify-core";

const DEFAULT_STEP_BUDGET_MS = 500;
const WORKER_GRACE_MS = 4000;

type Pending = { resolve: (results: StepCheck[]) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

let worker: Worker | undefined;
let workerBroken = false;
let requestId = 0;
const pending = new Map<number, Pending>();
let enginePromise: Promise<ComputeEngine> | undefined;

/** Allows tests and hosts to force the main-thread path. */
let workerAllowed = true;
export function setVerifierWorkerEnabled(enabled: boolean): void {
  workerAllowed = enabled;
  if (!enabled) {
    disposeWorker();
  }
}

function disposeWorker(): void {
  if (worker) {
    worker.terminate();
    worker = undefined;
  }
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new Error("Verifier worker stopped"));
    pending.delete(id);
  }
}

function createWorker(): Worker | undefined {
  if (!workerAllowed || workerBroken || typeof Worker === "undefined") {
    return undefined;
  }
  if (worker) {
    return worker;
  }
  try {
    const instance = new Worker(new URL("./verify.worker.ts", import.meta.url), { type: "module" });
    instance.onmessage = (event: MessageEvent<VerifyWorkerResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) {
        return;
      }
      pending.delete(event.data.id);
      clearTimeout(entry.timer);
      if ("error" in event.data) {
        entry.reject(new Error(event.data.error));
      } else {
        entry.resolve(event.data.results);
      }
    };
    instance.onerror = () => {
      workerBroken = true;
      disposeWorker();
    };
    worker = instance;
    return instance;
  } catch {
    workerBroken = true;
    return undefined;
  }
}

function runInWorker(instance: Worker, maths: string[], options: CheckOptions | undefined): Promise<StepCheck[]> {
  return new Promise<StepCheck[]>((resolve, reject) => {
    requestId += 1;
    const id = requestId;
    const budget = (options?.stepBudgetMs ?? DEFAULT_STEP_BUDGET_MS) * Math.max(1, maths.length) + WORKER_GRACE_MS;
    const timer = setTimeout(() => {
      pending.delete(id);
      // A single engine call that never returns can only be stopped by killing the worker.
      workerBroken = false;
      disposeWorker();
      reject(new Error("Verifier worker timed out"));
    }, budget);
    pending.set(id, { resolve, reject, timer });
    const message: VerifyWorkerRequest = { id, maths, options: options ? { ...options, now: undefined } : undefined };
    instance.postMessage(message);
  });
}

async function loadEngine(): Promise<ComputeEngine> {
  enginePromise ??= import("@cortex-js/compute-engine").then((module) => new module.ComputeEngine());
  return enginePromise;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function runOnMainThread(maths: string[], options: CheckOptions | undefined): Promise<StepCheck[]> {
  const ce = await loadEngine();
  const checker = new SolutionChecker(ce, maths, options);
  const results: StepCheck[] = [];
  for (;;) {
    const next = checker.next();
    if (next.done) {
      break;
    }
    results.push(next.value);
    if (results.length < maths.length) {
      await yieldToEventLoop();
    }
  }
  return results;
}

/** Checks a list of step LaTeX strings in order. Low-level; prefer `checkSolution`. */
export async function checkStepMaths(maths: string[], options?: CheckOptions): Promise<StepCheck[]> {
  if (maths.length === 0) {
    return [];
  }
  const instance = createWorker();
  if (instance) {
    try {
      return await runInWorker(instance, maths, options);
    } catch {
      // Fall through to the main-thread path.
    }
  }
  return runOnMainThread(maths, options);
}

/** Returns the same document with a `check` on every step. */
export async function checkSolution(doc: SolutionDocument, options?: CheckOptions): Promise<SolutionDocument> {
  const results = await checkStepMaths(
    doc.steps.map((step) => step.math),
    options,
  );
  return {
    ...doc,
    steps: doc.steps.map((step, index) => ({ ...step, check: results[index] ?? { status: "unchecked", detail: "Not checked." } })),
  };
}

/** Checks one step, using the whole document as context (earlier lines matter for equation chains). */
export async function checkStep(doc: SolutionDocument, stepId: string, options?: CheckOptions): Promise<StepCheck> {
  const index = doc.steps.findIndex((step) => step.id === stepId);
  if (index === -1) {
    return { status: "unchecked", detail: "Step not found." };
  }
  const results = await checkStepMaths(
    doc.steps.slice(0, index + 1).map((step) => step.math),
    options,
  );
  return results[index] ?? { status: "unchecked", detail: "Not checked." };
}

/** Warms up the verifier (worker + engine) so the first check feels instant. */
export async function preloadVerifier(): Promise<void> {
  const instance = createWorker();
  if (instance) {
    try {
      await runInWorker(instance, ["1 = 1"], { stepBudgetMs: 1000 });
      return;
    } catch {
      // fall back below
    }
  }
  await loadEngine();
}
