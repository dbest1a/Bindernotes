import { describe, expect, it } from "vitest";
import {
  buildJacobMathModules,
  buildJacobPracticeQuestions,
  jacobMathCoverage,
} from "@/lib/jacob-math-coverage";

const expectedTitles = [
  "Geometry Language, Rigid Motions, and Dilation",
  "Triangle Congruence, Similarity, and Angle Bisectors",
  "Right-Triangle Trig, Inverse Trig, and Special Triangles",
  "Coordinate Geometry, Segment Division, and Conic Basics",
  "Circles, Radians, and Laws of Sines and Cosines",
  "Polynomial Operations, Cubes, and Finite Series",
  "Graphing Polynomials, Rational Exponents, and Logarithms",
  "Parent Functions, Unit Circle, Rational Functions, and Matrices",
  "Composite Functions, Trig Identities, and Complex Numbers",
  "Vectors, Matrices Continued, Probability, Growth, Series, and Precalculus Limits",
  "Calculus Limits and the Derivative Definition",
  "Derivative Rules and Core Techniques",
  "Applications of Differential Calculus",
  "Integrals, Antiderivatives, and the Fundamental Theorem of Calculus",
  "Differential Equations and Applications of Integral Calculus",
  "Parametric Equations, Polar Coordinates, Infinite Series, and Taylor Series",
  "Multivariable Foundations and Vector Algebra",
  "Partial Derivatives, Gradient, Divergence, Curl, and Jacobian",
  "Multivariable Applications, Optimization, Integration, Green, and Stokes",
  "Linear Systems, Matrix Operations, Inverses, and Determinants",
  "Vector Spaces, Bases, Change of Basis, and Eigenvalues",
  "Orthogonality, Least Squares, Spectral Theorem, and SVD",
  "Differential Equations, Systems, Fourier Series, and Heat Flow",
  "Real Analysis Foundations: Sets, Fields, Real Numbers, and Completeness",
  "Real Analysis: Sequences, Metric Spaces, and Continuity",
  "Real Analysis: Series, Power Series, and Uniform Convergence",
  "Real Analysis: Differentiation, Taylor Theory, Riemann Integration, and Improper Integrals",
];

describe("Jacob Math Notes coverage ledger", () => {
  it("accounts for all 27 required Jacob sections", () => {
    expect(jacobMathCoverage).toHaveLength(27);
    expect(jacobMathCoverage.map((section) => section.sectionNumber)).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 1),
    );
    expect(jacobMathCoverage.map((section) => section.title)).toEqual(expectedTitles);
  });

  it("gives every section formulas, practice, related concepts, and source subsections", () => {
    for (const section of jacobMathCoverage) {
      expect(section.sourceSubsections.length).toBeGreaterThan(0);
      expect(section.contentBlocks.length).toBeGreaterThan(0);
      expect(section.formulas.length).toBeGreaterThan(0);
      expect(section.practice.length).toBeGreaterThanOrEqual(2);
      expect(section.relatedConcepts.length).toBeGreaterThan(0);
      expect(section.graphs.every((graph) => graph.mode === "2d" || graph.mode === "3d")).toBe(true);
    }
  });

  it("generates one published math module per Jacob section", () => {
    const modules = buildJacobMathModules("2026-01-01T00:00:00.000Z");

    expect(modules).toHaveLength(27);
    expect(new Set(modules.map((module) => module.slug)).size).toBe(27);
    expect(modules.every((module) => module.visibility === "published")).toBe(true);
    expect(modules[0].module_json.formulaCards?.length).toBeGreaterThan(0);
    expect(modules[0].module_json.relatedConcepts?.length).toBeGreaterThan(0);
  });

  it("generates at least two linked practice questions per Jacob section", () => {
    const questions = buildJacobPracticeQuestions("2026-01-01T00:00:00.000Z");

    expect(questions).toHaveLength(54);
    expect(new Set(questions.map((question) => question.id)).size).toBe(54);
    for (const moduleId of buildJacobMathModules("2026-01-01T00:00:00.000Z").map((module) => module.id)) {
      expect(questions.filter((question) => question.module_id === moduleId).length).toBeGreaterThanOrEqual(2);
    }
  });
});
