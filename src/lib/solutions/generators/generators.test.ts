import { beforeAll, describe, expect, it } from "vitest";
import { detectSolutionGenerator, generateSolution, getSolutionGenerator, solutionGenerators } from "./index";
import { parseDerivativeInput } from "./derivative";
import { integrateNumerically, parseIntegralInput } from "./integral";
import { checkSolution, setVerifierWorkerEnabled } from "../verify";
import { distribute, parseExpression, simplify, toLatex, toPlainText } from "../expression";
import type { SolutionDocument } from "../solution-types";

beforeAll(() => {
  setVerifierWorkerEnabled(false);
});

function generate(id: string, input: string): SolutionDocument {
  const result = generateSolution(id, input);
  if (!result.ok) {
    throw new Error(`${id} failed for ${input}: ${result.message}`);
  }
  return result.doc;
}

/** Every generated step must be verified by the checker, except lines the checker can only treat as given or matrix notation. */
async function expectAllChecked(doc: SolutionDocument, allowedUnchecked: string[] = ["given"]) {
  const checked = await checkSolution(doc);
  const problems = checked.steps
    .map((step, index) => ({ index, step }))
    .filter(({ step }) => step.check?.status !== "verified" && !allowedUnchecked.includes(step.check?.method ?? ""))
    .map(({ index, step }) => `${index + 1}. [${step.check?.status}/${step.check?.method}] ${step.math} :: ${step.check?.detail}`);
  expect(problems).toEqual([]);
  expect(checked.steps.some((step) => step.check?.status === "verified")).toBe(true);
  return checked;
}

describe("expression engine", () => {
  it("parses plain text and simple LaTeX", () => {
    expect(toLatex(parseExpression("3(x-2)+4"))).toBe(String.raw`3\left(x - 2\right) + 4`);
    expect(toLatex(parseExpression(String.raw`\frac{\sin(x)}{x^2+1}`))).toBe(String.raw`\frac{\sin(x)}{x^{2} + 1}`);
    expect(toLatex(parseExpression("sin^2 x + cos^2 x"))).toBe(String.raw`\sin^{2}(x) + \cos^{2}(x)`);
    expect(toLatex(distribute(parseExpression("3(x-2)+4")))).toBe("3x - 6 + 4");
    expect(toLatex(simplify(parseExpression("3x + 2x - 5 + 7")))).toBe("5x + 2");
    expect(toLatex(simplify(parseExpression("sin(pi/2) + cos(pi)")))).toBe("0");
    expect(toPlainText(parseExpression("e^(2t) sqrt(t)"))).toBe("e^(2·t)·√(t)");
  });

  it("rejects unsupported notation with a clear message", () => {
    expect(() => parseExpression(String.raw`\lim_{x \to 0} x`)).toThrow(/Unsupported notation/);
    expect(() => parseExpression("x +")).toThrow();
  });
});

describe("generator registry", () => {
  it("exposes five generators and detects the likely type", () => {
    expect(solutionGenerators.map((generator) => generator.id)).toEqual(["linear-equation", "quadratic", "derivative", "integral", "linear-system"]);
    expect(detectSolutionGenerator("d/dx x^3 sin(x)").id).toBe("derivative");
    expect(detectSolutionGenerator("int_0^1 x^2 dx").id).toBe("integral");
    expect(detectSolutionGenerator("x^2 - 5x + 6 = 0").id).toBe("quadratic");
    expect(detectSolutionGenerator("2x + 3y = 8; x - y = 1").id).toBe("linear-system");
    expect(detectSolutionGenerator("det [[1,2],[3,4]]").id).toBe("linear-system");
    expect(detectSolutionGenerator("3(x-2)+4 = 2x+7").id).toBe("linear-equation");
    expect(getSolutionGenerator("nope")).toBeUndefined();
    expect(generateSolution("nope", "x")).toEqual({ ok: false, message: "Unknown solution type." });
  });
});

describe("linear equation generator", () => {
  it("solves 3(x-2)+4 = 2x+7 with verified steps", async () => {
    const doc = generate("linear-equation", "3(x-2)+4 = 2x+7");
    expect(doc.answer).toBe("x = 9");
    expect(doc.steps.map((step) => step.math)).toEqual([
      String.raw`3\left(x - 2\right) + 4 = 2x + 7`,
      "3x - 6 + 4 = 2x + 7",
      "3x - 2 = 2x + 7",
      "x - 2 = 7",
      "x = 9",
    ]);
    expect(doc.source).toEqual({ kind: "generator", generator: "linear-equation", input: "3(x-2)+4 = 2x+7" });
    await expectAllChecked(doc);
  });

  it("handles fractions, other variables and degenerate cases", async () => {
    expect(generate("linear-equation", String.raw`\frac{x}{2} + 1 = 4`).answer).toBe("x = 6");
    expect(generate("linear-equation", "5t - 3 = 2t + 9").answer).toBe("t = 4");
    expect(generate("linear-equation", "2x + 1 = 2x + 5").answer).toMatch(/No solution/);
    expect(generate("linear-equation", "2x + 1 = 2x + 1").answer).toMatch(/Every value/);
    await expectAllChecked(generate("linear-equation", "-2x = 6"));
  });

  it("refuses non-linear or multi-variable input with a message", () => {
    expect(generateSolution("linear-equation", "x^2 = 4")).toMatchObject({ ok: false, message: expect.stringMatching(/isn't linear/) });
    expect(generateSolution("linear-equation", "x + y = 2")).toMatchObject({ ok: false, message: expect.stringMatching(/several variables/) });
    expect(generateSolution("linear-equation", "hello")).toMatchObject({ ok: false });
  });
});

describe("quadratic generator", () => {
  it("factors rational roots", async () => {
    const doc = generate("quadratic", "x^2 - 5x + 6 = 0");
    expect(doc.steps.map((step) => step.math)).toContain(String.raw`\left(x - 2\right)\left(x - 3\right) = 0`);
    expect(doc.answer).toBe(String.raw`x = 2 \quad\text{or}\quad x = 3`);
    await expectAllChecked(doc);
    await expectAllChecked(generate("quadratic", "2x^2 + 5x - 3 = 0"));
    await expectAllChecked(generate("quadratic", "x^2 = 4"));
  });

  it("uses the quadratic formula for irrational roots", async () => {
    const doc = generate("quadratic", "x^2 - 4x + 1 = 0");
    expect(doc.answer).toMatch(/^x = 2 \\pm \\sqrt\{3\}/);
    expect(doc.steps.some((step) => /Discriminant/.test(step.note ?? ""))).toBe(true);
    await expectAllChecked(doc);
  });

  it("writes complex roots as a ± bi", async () => {
    const doc = generate("quadratic", "x^2 - 5x + 7 = 0");
    expect(doc.answer).toBe(String.raw`x = \frac{5}{2} \pm \frac{1}{2}\sqrt{3}\,i`);
    await expectAllChecked(doc);
    expect(generate("quadratic", "x^2 + 4 = 0").answer).toBe(String.raw`x = \pm 2\,i`);
  });

  it("handles repeated roots and fractional coefficients", async () => {
    const repeated = generate("quadratic", "x^2 - 6x + 9 = 0");
    expect(repeated.answer).toBe("x = 3");
    await expectAllChecked(repeated);
    await expectAllChecked(generate("quadratic", "0.5x^2 - x - 1 = 0"));
  });

  it("refuses non-quadratic input", () => {
    expect(generateSolution("quadratic", "x + 1 = 0")).toMatchObject({ ok: false, message: expect.stringMatching(/linear/) });
    expect(generateSolution("quadratic", "x^3 = 1")).toMatchObject({ ok: false, message: expect.stringMatching(/Degree 3/) });
  });
});

describe("derivative generator", () => {
  it("applies the product and chain rules step by step", async () => {
    const doc = generate("derivative", "d/dx x^3 sin(x)");
    expect(doc.steps[0].note).toMatch(/Product rule/);
    expect(doc.answer).toBe(String.raw`\frac{d}{dx}\left(x^{3}\sin(x)\right) = x^{3}\cos(x) + 3x^{2}\sin(x)`);
    await expectAllChecked(doc);

    const chain = generate("derivative", "d/dx sin(x^2)");
    expect(chain.steps[0].note).toMatch(/Chain rule/);
    expect(chain.answer).toBe(String.raw`\frac{d}{dx}\left(\sin(x^{2})\right) = 2x\cos(x^{2})`);
    await expectAllChecked(chain);
  });

  it("covers quotient, exponential, log, root and trig rules", async () => {
    const quotient = generate("derivative", String.raw`\frac{d}{dx}\frac{\ln(x)}{x^2 + 1}`);
    expect(quotient.steps[0].note).toMatch(/Quotient rule/);
    await expectAllChecked(quotient);
    await expectAllChecked(generate("derivative", String.raw`d/dt e^{2t} \sqrt{t}`));
    await expectAllChecked(generate("derivative", "d/dx tan(3x)"));
    await expectAllChecked(generate("derivative", "x^4 - 3x^2 + 5"));
    await expectAllChecked(generate("derivative", "d/dx 2^x"));
    await expectAllChecked(generate("derivative", "derivative of 1/x"));
  });

  it("reads the variable from the input", () => {
    expect(parseDerivativeInput("d/dt t^2").v).toBe("t");
    expect(parseDerivativeInput("f(u) = u^2").v).toBe("u");
    expect(parseDerivativeInput("y^2").v).toBe("y");
    expect(parseDerivativeInput("x y").v).toBe("x");
    expect(() => parseDerivativeInput("a b")).toThrow(/Which variable/);
    expect(generateSolution("derivative", "d/dx x^x")).toMatchObject({ ok: false, message: expect.stringMatching(/x\^x/) });
  });
});

describe("integral generator", () => {
  it("evaluates a polynomial integral with the Fundamental Theorem of Calculus", async () => {
    const doc = generate("integral", "int_0^1 x^2 dx");
    expect(doc.answer).toBe(String.raw`\int_{0}^{1} x^{2}\,dx = \frac{1}{3}`);
    expect(doc.steps.map((step) => step.math)).toEqual([
      String.raw`\frac{d}{dx}\left(\frac{x^{3}}{3}\right) = x^{2}`,
      String.raw`\int_{0}^{1} x^{2}\,dx = \left(\frac{1^{3}}{3}\right) - \left(\frac{0^{3}}{3}\right)`,
      String.raw`= \frac{1}{3}`,
    ]);
    expect(doc.steps[2].note).toMatch(/Simpson's rule gives ≈ 0\.333333/);
    await expectAllChecked(doc);
    const poly = generate("integral", "int_0^2 (3x^2 - 2x + 1) dx");
    expect(poly.answer).toMatch(/= 6$/);
    await expectAllChecked(poly);
  });

  it("handles trig, exponential, reciprocal and root integrands", async () => {
    expect(generate("integral", String.raw`\int_0^{\pi} \sin(x)\,dx`).answer).toMatch(/= 2$/);
    await expectAllChecked(generate("integral", String.raw`\int_0^{\pi} \sin(x)\,dx`));
    expect(generate("integral", "int_1^e 1/x dx").answer).toMatch(/= 1$/);
    expect(generate("integral", "integral of cos(2x) from 0 to pi/4").answer).toMatch(/= \\frac\{1\}\{2\}$/);
    expect(generate("integral", "int_0^4 sqrt(x) dx").answer).toMatch(/= \\frac\{16\}\{3\}$/);
    await expectAllChecked(generate("integral", "int_0^4 sqrt(x) dx"));
  });

  it("falls back to a labelled numeric value when no rule applies", async () => {
    const doc = generate("integral", "int_0^1 e^(-x^2) dx");
    expect(doc.steps).toHaveLength(1);
    expect(doc.steps[0].note).toMatch(/numeric/i);
    expect(doc.answer).toMatch(/numeric/);
    await expectAllChecked(doc);
  });

  it("rejects indefinite integrals and singular integrands", () => {
    expect(generateSolution("integral", "int x^2 dx")).toMatchObject({ ok: false, message: expect.stringMatching(/bounds/) });
    expect(generateSolution("integral", "int_{-1}^{1} 1/x dx")).toMatchObject({ ok: false, message: expect.stringMatching(/undefined between the bounds/) });
    expect(parseIntegralInput("∫_0^1 x dx").v).toBe("x");
    expect(integrateNumerically((x) => x * x, 0, 1)).toBeCloseTo(1 / 3, 9);
  });
});

describe("linear system generator", () => {
  it("solves a 2×2 system by elimination", async () => {
    const doc = generate("linear-system", "2x + 3y = 8; x - y = 1");
    expect(doc.answer).toBe(String.raw`x = \frac{11}{5},\; y = \frac{6}{5}`);
    await expectAllChecked(doc);
  });

  it("solves a 3×3 system", async () => {
    const doc = generate("linear-system", "x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2");
    expect(doc.answer).toBe(String.raw`x = 1,\; y = 2,\; z = 3`);
    await expectAllChecked(doc);
  });

  it("computes determinants and a 2×2 inverse, labelling matrix lines honestly", async () => {
    const det = generate("linear-system", "det [[1,2],[3,4]]");
    expect(det.answer).toBe(String.raw`\det A = -2`);
    const checked = await expectAllChecked(det, ["given", "matrix"]);
    expect(checked.steps[1].check?.status).toBe("verified");

    const det3 = generate("linear-system", String.raw`\det\begin{pmatrix}1&2&3\\4&5&6\\7&8&10\end{pmatrix}`);
    expect(det3.answer).toBe(String.raw`\det A = -3`);
    await expectAllChecked(det3, ["given", "matrix"]);

    const inverse = generate("linear-system", "inverse [[2,1],[5,3]]");
    expect(inverse.answer).toBe(String.raw`A^{-1} = \begin{pmatrix} 3 & -1 \\ -5 & 2 \end{pmatrix}`);
  });

  it("refuses singular systems and bad input", () => {
    expect(generateSolution("linear-system", "x + y = 2; x + y = 3")).toMatchObject({ ok: false, message: expect.stringMatching(/unique solution/) });
    expect(generateSolution("linear-system", "x + y = 2")).toMatchObject({ ok: false });
    expect(generateSolution("linear-system", "inverse [[1,2],[2,4]]").ok && generate("linear-system", "inverse [[1,2],[2,4]]").answer).toMatch(/No inverse/);
  });
});
