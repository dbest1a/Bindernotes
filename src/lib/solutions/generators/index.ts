import { derivativeGenerator } from "./derivative";
import { integralGenerator } from "./integral";
import { linearEquationGenerator } from "./linear-equation";
import { linearSystemGenerator } from "./linear-system";
import { quadraticGenerator } from "./quadratic";
import type { GeneratorResult, SolutionGenerator } from "./generator-types";

export type { GeneratorResult, SolutionGenerator } from "./generator-types";

/** Free, deterministic, local step generators. No AI, no network. */
export const solutionGenerators: readonly SolutionGenerator[] = [
  linearEquationGenerator,
  quadraticGenerator,
  derivativeGenerator,
  integralGenerator,
  linearSystemGenerator,
];

export type SolutionGeneratorId = (typeof solutionGenerators)[number]["id"];

export function getSolutionGenerator(id: string): SolutionGenerator | undefined {
  return solutionGenerators.find((generator) => generator.id === id);
}

/** Guesses the most likely generator for a piece of input (used to pre-select the type picker). */
export function detectSolutionGenerator(input: string): SolutionGenerator {
  const text = input.trim();
  if (/\bd\s*\/\s*d[a-z]\b|\\frac\s*\{\s*d\s*\}|derivative|differentiate/i.test(text)) {
    return derivativeGenerator;
  }
  if (/\\int|(?:^|[^a-zA-Z\\])int(?![a-zA-Z])|∫|integral/i.test(text)) {
    return integralGenerator;
  }
  if (/\bdet\b|\\det|determinant|inverse|\[\s*\[|\\begin\{[pbv]?matrix\}|;|\\\\|\n/.test(text)) {
    return linearSystemGenerator;
  }
  if (/\^\s*\{?\s*2|²|x\s*\*\s*x/.test(text)) {
    return quadraticGenerator;
  }
  return linearEquationGenerator;
}

export function generateSolution(generatorId: string, input: string): GeneratorResult {
  const generator = getSolutionGenerator(generatorId);
  if (!generator) {
    return { ok: false, message: "Unknown solution type." };
  }
  return generator.generate(input);
}
