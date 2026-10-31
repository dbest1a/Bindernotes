import {
  distribute,
  exprEquals,
  freeVariables,
  mul,
  numR,
  parseEquation,
  polynomialToExpr,
  rationalToLatex,
  rIsOne,
  rIsZero,
  rSub,
  rDiv,
  toLatex,
  toLinear,
  variable,
  type Expr,
  type Rational,
} from "../expression";
import { buildDocument, fail, safely, step, type GeneratorResult, type SolutionGenerator } from "./generator-types";

function linearExpr(a: Rational, b: Rational, v: string): Expr {
  return polynomialToExpr([b, a], v);
}

function plainRational(value: Rational): string {
  const magnitude = Math.abs(value.n);
  return value.d === 1 ? String(magnitude) : `${magnitude}/${value.d}`;
}

export function generateLinearEquation(input: string): GeneratorResult {
  return safely(() => {
    const { left, right } = parseEquation(input);
    const names = [...new Set([...freeVariables(left), ...freeVariables(right)])];
    if (names.length === 0) {
      return fail("There is no variable to solve for. Try something like 3(x-2)+4 = 2x+7.");
    }
    if (names.length > 1) {
      return fail(`This equation has several variables (${names.join(", ")}). Use the “Linear system” type for systems.`);
    }
    const v = names[0];
    const leftLinear = toLinear(left, v);
    const rightLinear = toLinear(right, v);
    if (!leftLinear || !rightLinear) {
      return fail(`This isn't linear in ${v}. For quadratics use the “Quadratic equation” type.`);
    }

    const title = `Solve for ${v}`;
    const problem = `Solve $${toLatex(left)} = ${toLatex(right)}$ for $${v}$.`;
    const steps = [step(`${toLatex(left)} = ${toLatex(right)}`, "Start with the equation as given.")];
    let currentLeft = left;
    let currentRight = right;

    const distributedLeft = distribute(left);
    const distributedRight = distribute(right);
    if (!exprEquals(distributedLeft, left) || !exprEquals(distributedRight, right)) {
      currentLeft = distributedLeft;
      currentRight = distributedRight;
      steps.push(step(`${toLatex(currentLeft)} = ${toLatex(currentRight)}`, "Distribute: multiply out the brackets."));
    }

    const { a, b } = leftLinear;
    const { a: c, b: d } = rightLinear;
    const collectedLeft = linearExpr(a, b, v);
    const collectedRight = linearExpr(c, d, v);
    if (toLatex(currentLeft) !== toLatex(collectedLeft) || toLatex(currentRight) !== toLatex(collectedRight)) {
      currentLeft = collectedLeft;
      currentRight = collectedRight;
      steps.push(step(`${toLatex(currentLeft)} = ${toLatex(currentRight)}`, "Combine like terms on each side."));
    }

    const slope = rSub(a, c);
    if (rIsZero(slope)) {
      if (rIsZero(rSub(b, d))) {
        steps.push(step(`${toLatex(collectedLeft)} = ${toLatex(collectedLeft)}`, `Both sides are identical, so every value of ${v} works.`));
        return buildDocument("linear-equation", input, {
          title,
          problem,
          steps,
          answer: `\\text{Every value of } ${v} \\text{ is a solution}`,
        });
      }
      const cTerm = toLatex(mul(numR(c), variable(v)));
      steps.push(
        step(
          `${toLatex(collectedLeft)} - ${cTerm} = ${toLatex(collectedRight)} - ${cTerm}`,
          `Subtract ${plainRational(c)}${v} from both sides: the ${v} terms cancel completely, leaving ${plainRational(b)} = ${plainRational(d)}, which is false.`,
        ),
      );
      return buildDocument("linear-equation", input, {
        title,
        problem,
        steps,
        answer: `\\text{No solution: } ${rationalToLatex(b)} \\neq ${rationalToLatex(d)}`,
      });
    }

    // Move the variable terms to the left.
    if (!rIsZero(c)) {
      currentLeft = linearExpr(slope, b, v);
      currentRight = numR(d);
      steps.push(
        step(
          `${toLatex(currentLeft)} = ${toLatex(currentRight)}`,
          c.n < 0
            ? `Add ${plainRational(c)}${v} to both sides so the ${v} terms are together.`
            : `Subtract ${plainRational(c)}${v} from both sides so the ${v} terms are together.`,
        ),
      );
    }

    // Move the constants to the right.
    if (!rIsZero(b)) {
      currentLeft = linearExpr(slope, { n: 0, d: 1 }, v);
      currentRight = numR(rSub(d, b));
      steps.push(
        step(
          `${toLatex(currentLeft)} = ${toLatex(currentRight)}`,
          b.n < 0 ? `Add ${plainRational(b)} to both sides.` : `Subtract ${plainRational(b)} from both sides.`,
        ),
      );
    }

    const solution = rDiv(rSub(d, b), slope);
    if (!rIsOne(slope)) {
      steps.push(
        step(
          `${v} = ${rationalToLatex(solution)}`,
          slope.n === -1 && slope.d === 1 ? "Multiply both sides by −1." : `Divide both sides by ${slope.n < 0 ? "−" : ""}${plainRational(slope)}.`,
        ),
      );
    } else if (steps.length === 1) {
      steps.push(step(`${v} = ${rationalToLatex(solution)}`, "The equation is already solved."));
    }

    return buildDocument("linear-equation", input, {
      title,
      problem,
      steps,
      answer: `${v} = ${rationalToLatex(solution)}`,
    });
  });
}

export const linearEquationGenerator: SolutionGenerator = {
  id: "linear-equation",
  label: "Linear equation",
  description: "Solve an equation with one variable, step by step.",
  placeholder: "3(x-2)+4 = 2x+7",
  examples: ["3(x-2)+4 = 2x+7", "5t - 3 = 2t + 9", "\\frac{x}{2} + 1 = 4"],
  generate: generateLinearEquation,
};
