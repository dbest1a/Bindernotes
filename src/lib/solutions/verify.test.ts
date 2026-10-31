import { beforeAll, describe, expect, it } from "vitest";
import { checkSolution, checkStep, checkStepMaths, setVerifierWorkerEnabled } from "./verify";
import { expandPlusMinus, looksLikeProse } from "./verify-core";
import type { SolutionDocument } from "./solution-types";

const doc = (...maths: string[]): SolutionDocument => ({
  version: 1,
  steps: maths.map((math, index) => ({ id: `s${index}`, math })),
});

beforeAll(() => {
  // No Web Worker in the test environment: exercise the main-thread fallback explicitly.
  setVerifierWorkerEnabled(false);
});

describe("checkSolution", () => {
  it("verifies a correct identity at random points", async () => {
    const [check] = await checkStepMaths([String.raw`\sin^2(x) + \cos^2(x) = 1`]);
    expect(check.status).toBe("verified");
    expect(check.method).toBe("identity");
    expect(check.detail).toMatch(/random points/);
  });

  it("verifies derivative identities and flags a wrong derivative with evidence", async () => {
    const checks = await checkStepMaths([
      String.raw`\frac{d}{dx}\left(x^{3}\sin(x)\right) = x^{3}\cos(x) + 3x^{2}\sin(x)`,
      String.raw`\frac{d}{dx}\left(x^{3}\right) = 2x^{2}`,
    ]);
    expect(checks[0].status).toBe("verified");
    expect(checks[1].status).toBe("mismatch");
    expect(checks[1].detail).toMatch(/left side ≈ .* right side ≈/);
  });

  it("verifies an integral equality numerically and reports wrong values", async () => {
    const checks = await checkStepMaths([String.raw`\int_0^1 x^2\,dx = \frac{1}{3}`, String.raw`\int_0^{\pi/2} \cos(x)\,dx = 1.5`]);
    expect(checks[0]).toMatchObject({ status: "verified", method: "numeric" });
    expect(checks[0].detail).toMatch(/0\.333333/);
    expect(checks[1].status).toBe("mismatch");
    expect(checks[1].detail).toMatch(/Left ≈ 1, right ≈ 1\.5/);
  });

  it("leaves prose, inequalities, chemistry and lone expressions unchecked with reasons", async () => {
    const checks = await checkStepMaths([
      "Then we divide both sides by 2",
      String.raw`\text{Divide both sides by 2}`,
      String.raw`x > 2`,
      String.raw`\ce{2H2 + O2 -> 2H2O}`,
      String.raw`x^2 + 1`,
      String.raw`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`,
    ]);
    expect(checks.map((check) => check.status)).toEqual(["unchecked", "unchecked", "unchecked", "unchecked", "unchecked", "unchecked"]);
    expect(checks.map((check) => check.method)).toEqual(["prose", "prose", "inequality", "chemistry", "expression", "matrix"]);
    checks.forEach((check) => expect(check.detail).toBeTruthy());
  });

  it("checks inequalities between numbers and leaves ones with variables unchecked", async () => {
    const checks = await checkStepMaths([
      String.raw`1.5 > 1.3739`,
      String.raw`0.5 < 0.5837`,
      String.raw`\frac{1}{3} \le 0.34`,
      String.raw`\sqrt{2} > 1.5`,
      String.raw`2 < 2`,
      String.raw`x > 2`,
    ]);
    expect(checks.map((check) => check.status)).toEqual(["verified", "verified", "verified", "mismatch", "unchecked", "unchecked"]);
    expect(checks.map((check) => check.method)).toEqual(Array(6).fill("inequality"));
    expect(checks[0].detail).toBe("The numbers compare as written: 1.5 > 1.3739.");
    expect(checks[3].detail).toBe("Left ≈ 1.41421, right ≈ 1.5, so > doesn't hold.");
    expect(checks[5].detail).toMatch(/with variables/);
  });

  it("treats a solved equation chain as equivalent lines and confirms the roots", async () => {
    const result = await checkSolution(
      doc(String.raw`x^2 - 5x + 6 = 0`, String.raw`(x-2)(x-3) = 0`, String.raw`x = 2 \quad\text{or}\quad x = 3`),
    );
    const statuses = result.steps.map((step) => step.check?.status);
    expect(statuses).toEqual(["unchecked", "verified", "verified"]);
    expect(result.steps[0].check?.method).toBe("given");
    expect(result.steps[2].check?.detail).toMatch(/x = 2 and x = 3 all satisfy the starting equation/);
  });

  it("catches a wrong root by substitution", async () => {
    const result = await checkSolution(doc(String.raw`x^2 - 5x + 6 = 0`, String.raw`x = 2 \quad\text{or}\quad x = 4`));
    expect(result.steps[1].check?.status).toBe("mismatch");
    expect(result.steps[1].check?.detail).toMatch(/x = 4 does not satisfy/);
  });

  it("verifies ± lines and complex roots", async () => {
    const result = await checkSolution(doc(String.raw`x^2 - 5x + 7 = 0`, String.raw`x = \frac{5 \pm \sqrt{-3}}{2}`));
    expect(result.steps[1].check?.status).toBe("verified");
    expect(result.steps[1].check?.detail).toMatch(/0\.866025i/);
  });

  it("does not claim equivalence when a root may have been lost", async () => {
    const result = await checkSolution(doc(String.raw`x^2 = 2x`, String.raw`x = 2`));
    expect(result.steps[1].check?.status).toBe("unchecked");
    expect(result.steps[1].check?.method).toBe("partial");
  });

  it("accepts repeated roots through the power-ratio rule", async () => {
    const result = await checkSolution(doc(String.raw`(x - 3)^2 = 0`, String.raw`x - 3 = 0`, String.raw`x = 3`));
    expect(result.steps.map((step) => step.check?.status)).toEqual(["unchecked", "verified", "verified"]);
  });

  it("continues '= …' lines from the previous expression", async () => {
    const checks = await checkStepMaths([String.raw`\frac{d}{dx}\left(x^2\right) = 2 \cdot \frac{d}{dx}\left(x\right) \cdot x`, String.raw`= 2x`]);
    expect(checks.map((check) => check.status)).toEqual(["verified", "verified"]);
  });

  it("checks linear systems by substituting the final answer", async () => {
    const result = await checkSolution(
      doc(String.raw`2x + 3y = 8`, String.raw`x - y = 1`, String.raw`3x - 3y = 3`, String.raw`5x = 11`, String.raw`x = \frac{11}{5},\; y = \frac{6}{5}`),
    );
    expect(result.steps.map((step) => step.check?.status)).toEqual(["unchecked", "unchecked", "verified", "verified", "verified"]);
    expect(result.steps[4].check?.detail).toMatch(/satisfies the starting equations/);
    const wrong = await checkSolution(doc(String.raw`2x + 3y = 8`, String.raw`x - y = 1`, String.raw`x = 2,\; y = 1`));
    expect(wrong.steps[2].check?.status).toBe("mismatch");
  });

  it("accepts ≈ lines within rounding", async () => {
    const checks = await checkStepMaths([String.raw`\int_0^1 e^{-x^2}\,dx \approx 0.746824`, String.raw`\pi \approx 3.2`]);
    expect(checks[0]).toMatchObject({ status: "verified", method: "approx" });
    expect(checks[1].status).toBe("mismatch");
  });

  it("checks a single step in the context of the document", async () => {
    const document = doc(String.raw`3(x-2)+4 = 2x+7`, String.raw`3x - 2 = 2x + 7`, String.raw`x = 9`);
    const check = await checkStep(document, "s2");
    expect(check.status).toBe("verified");
    expect(await checkStep(document, "missing")).toMatchObject({ status: "unchecked" });
  });

  it("reports a timeout as an error instead of hanging", async () => {
    let calls = 0;
    const checks = await checkStepMaths([String.raw`\sin(x) = \sin(x)`], {
      stepBudgetMs: 1,
      now: () => {
        calls += 1;
        return calls * 1000;
      },
    });
    expect(checks[0].status).toBe("error");
    expect(checks[0].method).toBe("timeout");
  });
});

describe("helpers", () => {
  it("detects prose but not math function names", () => {
    expect(looksLikeProse("Then we divide both sides")).toBe(true);
    expect(looksLikeProse(String.raw`\sin(x) + \cos(x) = 1`)).toBe(false);
    expect(looksLikeProse("sin(x) = cos(x)")).toBe(false);
    expect(looksLikeProse(String.raw`x = 2 \text{ or } x = 3`)).toBe(false);
  });

  it("expands one ± into an or", () => {
    expect(expandPlusMinus(String.raw`x = 1 \pm 2`)).toBe(String.raw`x = 1 + 2 \lor x = 1 - 2`);
    expect(expandPlusMinus(String.raw`a \pm b \pm c`)).toBeUndefined();
    expect(expandPlusMinus("x = 1")).toBe("x = 1");
  });
});
