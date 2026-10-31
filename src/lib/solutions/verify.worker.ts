/**
 * Web Worker entry: loads the Compute Engine off the main thread and checks steps.
 * Protocol: { id, maths, options } → { id, results } | { id, error }.
 */

import { ComputeEngine } from "@cortex-js/compute-engine";
import { checkStepsSync, type CheckOptions } from "./verify-core";
import type { StepCheck } from "./solution-types";

export type VerifyWorkerRequest = { id: number; maths: string[]; options?: CheckOptions };
export type VerifyWorkerResponse = { id: number; results: StepCheck[] } | { id: number; error: string };

let engine: ComputeEngine | undefined;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<VerifyWorkerRequest>) => void) | null;
  postMessage: (message: VerifyWorkerResponse) => void;
};

scope.onmessage = (event: MessageEvent<VerifyWorkerRequest>) => {
  const { id, maths, options } = event.data;
  try {
    engine ??= new ComputeEngine();
    const results = checkStepsSync(engine, maths, options);
    scope.postMessage({ id, results });
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
