/**
 * Worked Solution board object: data contract.
 *
 * A SolutionDocument is what the whiteboard persists for a "Worked Solution" card.
 * `sanitizeSolutionDocument` runs on every board save and load, so it must stay
 * fast, pure and strict: unknown keys are dropped, sizes are capped, garbage
 * yields `undefined`.
 */

export type StepCheckStatus = "verified" | "mismatch" | "unchecked" | "error";

export type StepCheck = {
  status: StepCheckStatus;
  /** Short machine-friendly label for how the step was checked, e.g. "identity", "numeric", "equivalent". */
  method?: string;
  /** Plain-language evidence, e.g. "Both sides agree at 6 random points" or "Left ≈ 1.5708, right ≈ 1.5". */
  detail?: string;
};

export type SolutionStep = {
  id: string;
  /** LaTeX for the step. */
  math: string;
  /** Plain-text reason for the step. */
  note?: string;
  check?: StepCheck;
};

export type SolutionSource =
  | { kind: "manual" }
  | { kind: "generator"; generator: string; input: string };

export type SolutionDocument = {
  version: 1;
  title?: string;
  /** Problem statement: text with optional $...$ LaTeX. */
  problem?: string;
  steps: SolutionStep[];
  /** Final answer in LaTeX. */
  answer?: string;
  source?: SolutionSource;
};

export const SOLUTION_LIMITS = {
  maxSteps: 60,
  maxMathLength: 2000,
  maxNoteLength: 600,
  maxProblemLength: 4000,
  maxTitleLength: 200,
  maxAnswerLength: 2000,
  maxIdLength: 64,
  maxMethodLength: 60,
  maxDetailLength: 600,
  maxGeneratorNameLength: 60,
  maxGeneratorInputLength: 2000,
} as const;

const CHECK_STATUSES: ReadonlySet<string> = new Set(["verified", "mismatch", "unchecked", "error"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.length > max ? value.slice(0, max) : value;
}

let idCounter = 0;

/** Creates a step id that is unique within a session and safe to persist. */
export function createStepId(): string {
  const cryptoRef = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return `step-${cryptoRef.randomUUID().slice(0, 8)}`;
  }
  idCounter += 1;
  return `step-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function createSolutionStep(math = "", note?: string): SolutionStep {
  const step: SolutionStep = { id: createStepId(), math };
  if (note) {
    step.note = note;
  }
  return step;
}

export function createEmptySolution(): SolutionDocument {
  return { version: 1, steps: [], source: { kind: "manual" } };
}

function sanitizeCheck(raw: unknown): StepCheck | undefined {
  if (!isRecord(raw) || typeof raw.status !== "string" || !CHECK_STATUSES.has(raw.status)) {
    return undefined;
  }
  const check: StepCheck = { status: raw.status as StepCheckStatus };
  const method = clampString(raw.method, SOLUTION_LIMITS.maxMethodLength);
  if (method) {
    check.method = method;
  }
  const detail = clampString(raw.detail, SOLUTION_LIMITS.maxDetailLength);
  if (detail) {
    check.detail = detail;
  }
  return check;
}

function sanitizeStep(raw: unknown, index: number, seenIds: Set<string>): SolutionStep | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const math = clampString(raw.math, SOLUTION_LIMITS.maxMathLength);
  if (math === undefined) {
    return undefined;
  }
  let id = clampString(raw.id, SOLUTION_LIMITS.maxIdLength);
  if (!id || seenIds.has(id)) {
    id = `step-${index + 1}`;
    while (seenIds.has(id)) {
      id = `${id}x`;
    }
  }
  seenIds.add(id);
  const step: SolutionStep = { id, math };
  const note = clampString(raw.note, SOLUTION_LIMITS.maxNoteLength);
  if (note) {
    step.note = note;
  }
  const check = sanitizeCheck(raw.check);
  if (check) {
    step.check = check;
  }
  return step;
}

function sanitizeSource(raw: unknown): SolutionSource | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  if (raw.kind === "manual") {
    return { kind: "manual" };
  }
  if (raw.kind === "generator") {
    const generator = clampString(raw.generator, SOLUTION_LIMITS.maxGeneratorNameLength);
    const input = clampString(raw.input, SOLUTION_LIMITS.maxGeneratorInputLength);
    if (generator && input !== undefined) {
      return { kind: "generator", generator, input };
    }
  }
  return undefined;
}

/**
 * Strict sanitizer for persisted solution documents.
 * Returns `undefined` for anything that is not a plausible document.
 */
export function sanitizeSolutionDocument(raw: unknown): SolutionDocument | undefined {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.steps)) {
    return undefined;
  }

  const seenIds = new Set<string>();
  const steps: SolutionStep[] = [];
  for (const item of raw.steps) {
    if (steps.length >= SOLUTION_LIMITS.maxSteps) {
      break;
    }
    const step = sanitizeStep(item, steps.length, seenIds);
    if (step) {
      steps.push(step);
    }
  }

  const doc: SolutionDocument = { version: 1, steps };
  const title = clampString(raw.title, SOLUTION_LIMITS.maxTitleLength);
  if (title) {
    doc.title = title;
  }
  const problem = clampString(raw.problem, SOLUTION_LIMITS.maxProblemLength);
  if (problem) {
    doc.problem = problem;
  }
  const answer = clampString(raw.answer, SOLUTION_LIMITS.maxAnswerLength);
  if (answer) {
    doc.answer = answer;
  }
  const source = sanitizeSource(raw.source);
  if (source) {
    doc.source = source;
  }
  return doc;
}

/** Removes check results so a document can be re-checked from scratch. */
export function stripSolutionChecks(doc: SolutionDocument): SolutionDocument {
  return {
    ...doc,
    steps: doc.steps.map((step) => {
      if (!step.check) {
        return step;
      }
      const { check: _check, ...rest } = step;
      return rest;
    }),
  };
}
