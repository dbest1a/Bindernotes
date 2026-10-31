import { createSolutionStep, type SolutionDocument, type SolutionStep } from "../solution-types";

export type GeneratorResult = { ok: true; doc: SolutionDocument } | { ok: false; message: string };

export type SolutionGenerator = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  examples: string[];
  generate: (input: string) => GeneratorResult;
};

export function fail(message: string): GeneratorResult {
  return { ok: false, message };
}

export function step(math: string, note?: string): SolutionStep {
  return createSolutionStep(math, note);
}

export function buildDocument(
  generator: string,
  input: string,
  fields: { title: string; problem: string; steps: SolutionStep[]; answer?: string },
): GeneratorResult {
  const doc: SolutionDocument = {
    version: 1,
    title: fields.title,
    problem: fields.problem,
    steps: fields.steps,
    source: { kind: "generator", generator, input: input.trim() },
  };
  if (fields.answer) {
    doc.answer = fields.answer;
  }
  return { ok: true, doc };
}

/** Wraps a generator body so unexpected parser errors become a clear message instead of a crash. */
export function safely(run: () => GeneratorResult): GeneratorResult {
  try {
    return run();
  } catch (error) {
    return fail(error instanceof Error && error.message ? error.message : "Couldn't read that input.");
  }
}

export const OR = " \\quad\\text{or}\\quad ";
