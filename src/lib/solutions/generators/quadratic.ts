import {
  freeVariables,
  isqrt,
  parseEquation,
  polyDegree,
  polynomialToExpr,
  rationalToLatex,
  rDiv,
  rIsInt,
  rIsOne,
  rIsZero,
  rMul,
  rNeg,
  rToNumber,
  rat,
  simplifySqrt,
  sub,
  toLatex,
  toPolynomial,
  type Rational,
} from "../expression";
import { OR, buildDocument, fail, safely, step, type GeneratorResult, type SolutionGenerator } from "./generator-types";

function gcdAll(values: number[]): number {
  const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
  return values.reduce((acc, value) => gcd(acc, Math.abs(value)), 0) || 1;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcdAll([a, b]);
}

function plain(value: Rational): string {
  return value.d === 1 ? String(value.n) : `${value.n}/${value.d}`;
}

/** Wraps negatives and fractions in parentheses so substituted numbers read clearly. */
function parenthesize(value: Rational): string {
  const latex = rationalToLatex(value);
  return value.n < 0 || value.d !== 1 ? `\\left(${latex}\\right)` : latex;
}

function signedTerm(value: Rational): string {
  return value.n < 0 ? `- ${rationalToLatex({ n: -value.n, d: value.d })}` : `+ ${rationalToLatex(value)}`;
}

/** Writes a root p/q as the linear factor q·v − p with integer coefficients (no outer parentheses). */
function linearFactorBody(root: Rational, v: string): string {
  const coef = root.d === 1 ? "" : String(root.d);
  return `${coef}${v} ${signedTerm(rat(-root.n))}`;
}

const wrapFactor = (body: string) => `\\left(${body}\\right)`;

/** (B ± C·√d) / A in LaTeX; d = 1 means no radical; imaginary adds i. */
function radicalForm(B: number, C: number, d: number, A: number, imaginary: boolean): string {
  const radical = d === 1 ? "" : `\\sqrt{${d}}`;
  const unit = imaginary ? "i" : "";
  const coefText = C === 1 && (radical || unit) ? "" : String(C);
  const spread = `${coefText}${radical}${radical && unit ? "\\," : ""}${unit}`;
  const numerator = B === 0 ? `\\pm ${spread}` : `${B} \\pm ${spread}`;
  return A === 1 ? numerator : `\\frac{${numerator}}{${A}}`;
}

export function generateQuadratic(input: string): GeneratorResult {
  return safely(() => {
    const { left, right } = parseEquation(input);
    const names = [...new Set([...freeVariables(left), ...freeVariables(right)])];
    if (names.length !== 1) {
      return fail(names.length === 0 ? "There is no variable to solve for." : `Expected one variable but found ${names.join(", ")}.`);
    }
    const v = names[0];
    const poly = toPolynomial(sub(left, right), v);
    if (!poly) {
      return fail(`This isn't a polynomial equation in ${v}.`);
    }
    const degree = polyDegree(poly);
    if (degree < 2) {
      return fail("This equation is linear, not quadratic. Use the “Linear equation” type.");
    }
    if (degree > 2) {
      return fail(`Degree ${degree} equations aren't supported yet; this generator handles quadratics.`);
    }

    const title = `Solve the quadratic for ${v}`;
    const problem = `Solve $${toLatex(left)} = ${toLatex(right)}$.`;
    const steps = [step(`${toLatex(left)} = ${toLatex(right)}`, "Start with the equation as given.")];

    let a = poly[2];
    let b = poly[1] ?? rat(0);
    let c = poly[0] ?? rat(0);
    if (a.n < 0) {
      a = rNeg(a);
      b = rNeg(b);
      c = rNeg(c);
    }
    const standardLatex = `${toLatex(polynomialToExpr([c, b, a], v))} = 0`;
    if (steps[0].math !== standardLatex) {
      steps.push(
        step(
          standardLatex,
          poly[2].n < 0
            ? "Move everything to one side and multiply by −1 so the leading coefficient is positive (standard form)."
            : "Move everything to one side: standard form ax² + bx + c = 0.",
        ),
      );
    }

    if (!rIsInt(a) || !rIsInt(b) || !rIsInt(c)) {
      const factor = [a.d, b.d, c.d].reduce(lcm, 1);
      a = rMul(a, rat(factor));
      b = rMul(b, rat(factor));
      c = rMul(c, rat(factor));
      steps.push(step(`${toLatex(polynomialToExpr([c, b, a], v))} = 0`, `Multiply both sides by ${factor} to clear the fractions.`));
    }

    const ai = a.n;
    const bi = b.n;
    const ci = c.n;
    const discriminant = bi * bi - 4 * ai * ci;
    const fourAC = 4 * ai * ci;
    steps.push(
      step(
        `${parenthesize(b)}^{2} - 4 \\cdot ${parenthesize(a)} \\cdot ${parenthesize(c)} = ${bi * bi} ${fourAC < 0 ? "+" : "-"} ${Math.abs(fourAC)} = ${discriminant}`,
        `Discriminant Δ = b² − 4ac with a = ${ai}, b = ${bi}, c = ${ci}. ${
          discriminant > 0 ? "Δ > 0: two real roots." : discriminant === 0 ? "Δ = 0: one repeated real root." : "Δ < 0: two complex roots."
        }`,
      ),
    );

    const sqrtDisc = discriminant >= 0 ? isqrt(discriminant) : undefined;
    if (sqrtDisc !== undefined) {
      // Rational roots → factor.
      const roots = [rat(-bi - sqrtDisc, 2 * ai), rat(-bi + sqrtDisc, 2 * ai)].sort((p, q) => rToNumber(p) - rToNumber(q));
      const [r1, r2] = roots;
      const leading = rDiv(a, rat(r1.d * r2.d));
      const leadingText = rIsOne(leading) ? "" : rationalToLatex(leading);
      if (sqrtDisc === 0) {
        steps.push(step(`${leadingText}${wrapFactor(linearFactorBody(r1, v))}^{2} = 0`, "Δ = 0, so the quadratic is a perfect square."));
        steps.push(step(`${linearFactorBody(r1, v)} = 0`, "A square is zero only when its base is zero."));
        steps.push(step(`${v} = ${rationalToLatex(r1)}`, `Solve the linear equation for ${v}.`));
        return buildDocument("quadratic", input, { title, problem, steps, answer: `${v} = ${rationalToLatex(r1)}` });
      }
      steps.push(
        step(
          `${leadingText}${wrapFactor(linearFactorBody(r1, v))}${wrapFactor(linearFactorBody(r2, v))} = 0`,
          `Factor: the roots are ${plain(r1)} and ${plain(r2)}, so each gives a linear factor. Multiply the factors back out to check.`,
        ),
      );
      steps.push(step(`${linearFactorBody(r1, v)} = 0${OR}${linearFactorBody(r2, v)} = 0`, "A product is zero only when one of the factors is zero (zero-product property)."));
      const answer = `${v} = ${rationalToLatex(r1)}${OR}${v} = ${rationalToLatex(r2)}`;
      steps.push(step(answer, "Solve each linear factor."));
      return buildDocument("quadratic", input, { title, problem, steps, answer });
    }

    // Quadratic formula.
    const negB = -bi;
    const twoA = 2 * ai;
    steps.push(
      step(
        `${v} = \\frac{-${parenthesize(b)} \\pm \\sqrt{${discriminant}}}{2 \\cdot ${parenthesize(a)}}`,
        "Quadratic formula: x = (−b ± √Δ) / 2a. Substitute a, b and Δ.",
      ),
    );

    if (discriminant < 0) {
      const { coef, radicand } = simplifySqrt(rat(-discriminant));
      steps.push(step(`${v} = ${radicalForm(negB, 1, -discriminant, twoA, true)}`, "√(−k) = √k · i because i² = −1."));
      if (coef.n !== 1) {
        steps.push(
          step(
            `${v} = ${radicalForm(negB, coef.n, radicand, twoA, true)}`,
            radicand === 1 ? `Simplify the radical: √${-discriminant} = ${coef.n}.` : `Simplify the radical: √${-discriminant} = ${coef.n}√${radicand}.`,
          ),
        );
      }
      const realPart = rat(negB, twoA);
      const imagPart = rat(coef.n, twoA);
      const imagCoef = rIsOne(imagPart) ? "" : rationalToLatex(imagPart);
      const radical = radicand === 1 ? "" : `\\sqrt{${radicand}}`;
      const imagText = `${imagCoef}${radical}${imagCoef || radical ? "\\," : ""}i`;
      const final = rIsZero(realPart) ? `${v} = \\pm ${imagText}` : `${v} = ${rationalToLatex(realPart)} \\pm ${imagText}`;
      const g = gcdAll([negB, coef.n, twoA]);
      steps.push(step(final, g > 1 ? `Divide every term by ${g} and write the answer as a ± bi.` : "Write the answer in the form a ± bi."));
      return buildDocument("quadratic", input, { title, problem, steps, answer: final });
    }

    const { coef, radicand } = simplifySqrt(rat(discriminant));
    steps.push(step(`${v} = ${radicalForm(negB, 1, discriminant, twoA, false)}`, "Tidy the signs."));
    if (coef.n !== 1) {
      steps.push(step(`${v} = ${radicalForm(negB, coef.n, radicand, twoA, false)}`, `Simplify the radical: √${discriminant} = ${coef.n}√${radicand}.`));
    }
    const g = gcdAll([negB, coef.n, twoA]);
    let final = radicalForm(negB / g, coef.n / g, radicand, twoA / g, false);
    if (g > 1) {
      steps.push(step(`${v} = ${final}`, `Divide numerator and denominator by ${g}.`));
    }
    final = `${v} = ${final}`;
    const approx = (sign: number) => Number(((negB + sign * coef.n * Math.sqrt(radicand)) / twoA).toPrecision(5));
    return buildDocument("quadratic", input, {
      title,
      problem,
      steps,
      answer: `${final} \\quad\\left(${v} \\approx ${approx(-1)} \\text{ or } ${approx(1)}\\right)`,
    });
  });
}

export const quadraticGenerator: SolutionGenerator = {
  id: "quadratic",
  label: "Quadratic equation",
  description: "Factor when the roots are rational; otherwise use the quadratic formula, including complex roots.",
  placeholder: "x^2 - 5x + 6 = 0",
  examples: ["x^2 - 5x + 6 = 0", "2x^2 + 5x - 3 = 0", "x^2 - 4x + 1 = 0", "x^2 - 5x + 7 = 0"],
  generate: generateQuadratic,
};
