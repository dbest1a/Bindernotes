import { describe, expect, it } from "vitest";
import {
  createEmptySolution,
  createSolutionStep,
  sanitizeSolutionDocument,
  SOLUTION_LIMITS,
  stripSolutionChecks,
} from "./solution-types";

describe("sanitizeSolutionDocument", () => {
  it("returns undefined for garbage", () => {
    expect(sanitizeSolutionDocument(undefined)).toBeUndefined();
    expect(sanitizeSolutionDocument(null)).toBeUndefined();
    expect(sanitizeSolutionDocument("x = 1")).toBeUndefined();
    expect(sanitizeSolutionDocument([])).toBeUndefined();
    expect(sanitizeSolutionDocument({ version: 2, steps: [] })).toBeUndefined();
    expect(sanitizeSolutionDocument({ version: 1 })).toBeUndefined();
    expect(sanitizeSolutionDocument({ version: 1, steps: "nope" })).toBeUndefined();
  });

  it("keeps a valid document and drops unknown keys", () => {
    const doc = sanitizeSolutionDocument({
      version: 1,
      title: "Solve",
      problem: "Solve $x = 1$",
      answer: "x = 1",
      steps: [{ id: "a", math: "x = 1", note: "given", check: { status: "verified", method: "numeric", detail: "ok", extra: 1 }, junk: true }],
      source: { kind: "generator", generator: "linear-equation", input: "x = 1", extra: "no" },
      unknown: "field",
    });
    expect(doc).toEqual({
      version: 1,
      title: "Solve",
      problem: "Solve $x = 1$",
      answer: "x = 1",
      steps: [{ id: "a", math: "x = 1", note: "given", check: { status: "verified", method: "numeric", detail: "ok" } }],
      source: { kind: "generator", generator: "linear-equation", input: "x = 1" },
    });
  });

  it("drops malformed steps, invalid checks and bad sources", () => {
    const doc = sanitizeSolutionDocument({
      version: 1,
      steps: [{ id: "a", math: "x" }, { math: 42 }, "text", null, { id: "b", math: "y", check: { status: "maybe" } }, { id: "a", math: "dup" }],
      source: { kind: "magic" },
    });
    expect(doc?.steps.map((step) => step.id)).toEqual(["a", "b", "step-3"]);
    expect(doc?.steps[1].check).toBeUndefined();
    expect(doc?.source).toBeUndefined();
  });

  it("caps counts and lengths", () => {
    const steps = Array.from({ length: 100 }, (_, index) => ({ id: `s${index}`, math: "x".repeat(5000), note: "n".repeat(1000) }));
    const doc = sanitizeSolutionDocument({ version: 1, steps, problem: "p".repeat(10000), title: "t".repeat(1000), answer: "a".repeat(5000) });
    expect(doc?.steps).toHaveLength(SOLUTION_LIMITS.maxSteps);
    expect(doc?.steps[0].math).toHaveLength(SOLUTION_LIMITS.maxMathLength);
    expect(doc?.steps[0].note).toHaveLength(SOLUTION_LIMITS.maxNoteLength);
    expect(doc?.problem).toHaveLength(SOLUTION_LIMITS.maxProblemLength);
    expect(doc?.title).toHaveLength(SOLUTION_LIMITS.maxTitleLength);
    expect(doc?.answer).toHaveLength(SOLUTION_LIMITS.maxAnswerLength);
  });

  it("is fast enough to run on every save", () => {
    const steps = Array.from({ length: 60 }, (_, index) => ({ id: `s${index}`, math: "x^2 + 1 = 2", note: "because" }));
    const start = performance.now();
    for (let i = 0; i < 200; i += 1) {
      sanitizeSolutionDocument({ version: 1, steps });
    }
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("helpers", () => {
  it("creates an empty manual document", () => {
    expect(createEmptySolution()).toEqual({ version: 1, steps: [], source: { kind: "manual" } });
  });

  it("creates steps with unique ids", () => {
    const a = createSolutionStep("x");
    const b = createSolutionStep("y", "why");
    expect(a.id).not.toBe(b.id);
    expect(b.note).toBe("why");
    expect(a.note).toBeUndefined();
  });

  it("strips check results", () => {
    const doc = stripSolutionChecks({ version: 1, steps: [{ id: "a", math: "x", check: { status: "verified" } }] });
    expect(doc.steps[0].check).toBeUndefined();
  });
});
