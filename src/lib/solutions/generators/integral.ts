import {
  add,
  asRational,
  containsVar,
  distribute,
  div,
  evaluateExpr,
  fn,
  freeVariables,
  mul,
  neg,
  num,
  numR,
  parseExpression,
  pow,
  rAdd,
  rIsOne,
  rIsZero,
  rMul,
  rNeg,
  rat,
  simplify,
  toLatex,
  toLinear,
  toPlainText,
  type Expr,
  type Rational,
} from "../expression";
import { buildDocument, fail, safely, step, type GeneratorResult, type SolutionGenerator } from "./generator-types";

type ParsedIntegral = { integrand: Expr; lower: Expr; upper: Expr; v: string };

function stripBraces(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;
}

/** Reads "int_0^1 x^2 dx", "\int_{0}^{\pi} \sin(x)\,dx", "∫ x^2 dx from 0 to 1" or "integral of x^2 from 0 to 1". */
export function parseIntegralInput(input: string): ParsedIntegral {
  let text = input.trim().replace(/\u222b/g, "\\int ");
  let lower: string | undefined;
  let upper: string | undefined;

  const fromTo = /\bfrom\s+(.+?)\s+to\s+(.+?)\s*$/i.exec(text);
  if (fromTo) {
    lower = fromTo[1];
    upper = fromTo[2];
    text = text.slice(0, fromTo.index);
  }
  text = text.replace(/^(?:find\s+)?(?:the\s+)?(?:definite\s+)?integral\s+of\s+/i, "\\int ");

  const intMatch = /\\?int(?![a-zA-Z])/.exec(text);
  if (!intMatch) {
    throw new Error("Type an integral like int_0^1 x^2 dx.");
  }
  let rest = text.slice(intMatch.index + intMatch[0].length);

  const readBound = (marker: "_" | "^"): string | undefined => {
    const trimmed = rest.trimStart();
    if (!trimmed.startsWith(marker)) {
      return undefined;
    }
    let body = trimmed.slice(1).trimStart();
    if (body.startsWith("{")) {
      let depth = 0;
      for (let i = 0; i < body.length; i += 1) {
        if (body[i] === "{") depth += 1;
        if (body[i] === "}") depth -= 1;
        if (depth === 0) {
          const value = body.slice(1, i);
          rest = body.slice(i + 1);
          return value;
        }
      }
      throw new Error("Unbalanced braces in the integral bounds.");
    }
    const simple = /^(-?[0-9.]+|\\pi|pi|[a-zA-Z]|\(([^()]*)\))/.exec(body);
    if (!simple) {
      throw new Error("Couldn't read the integral bounds. Use int_{a}^{b} … dx.");
    }
    rest = body.slice(simple[0].length);
    body = simple[2] ?? simple[1];
    return body;
  };

  for (let i = 0; i < 2; i += 1) {
    const low = readBound("_");
    if (low !== undefined) {
      lower = low;
      continue;
    }
    const high = readBound("^");
    if (high !== undefined) {
      upper = high;
    }
  }

  const dMatch = /(?:\\,|\\;|\s)*(?:\\mathrm\{d\}|d)\s*([a-zA-Z])\s*$/.exec(rest);
  let v: string;
  if (dMatch) {
    v = dMatch[1];
    rest = rest.slice(0, dMatch.index);
  } else {
    v = "x";
  }
  const integrand = parseExpression(rest);
  const vars = [...freeVariables(integrand)];
  if (!dMatch && vars.length === 1) {
    v = vars[0];
  }
  if (vars.some((name) => name !== v)) {
    throw new Error(`The integrand uses ${vars.filter((name) => name !== v).join(", ")}; only ${v} is allowed.`);
  }
  if (lower === undefined || upper === undefined) {
    throw new Error("Only definite integrals are supported: add bounds like int_0^1 … dx.");
  }
  const lowerExpr = parseExpression(stripBraces(lower));
  const upperExpr = parseExpression(stripBraces(upper));
  if (freeVariables(lowerExpr).size || freeVariables(upperExpr).size) {
    throw new Error("The bounds must be numbers (π is fine).");
  }
  return { integrand, lower: lowerExpr, upper: upperExpr, v };
}

type Antiderivative = { F: Expr; rule: string };

/** Antiderivative of a single term, or undefined when no rule applies. */
function antiderivativeOfTerm(term: Expr, v: string): Antiderivative | undefined {
  // Separate a rational coefficient from the rest.
  let coef = rat(1);
  let body: Expr = term;
  if (term.k === "neg") {
    coef = rat(-1);
    body = term.arg;
  }
  if (body.k === "mul") {
    const constants = body.factors.filter((f) => !containsVar(f, v));
    const rest = body.factors.filter((f) => containsVar(f, v));
    if (constants.some((f) => asRational(f) === undefined)) {
      return undefined;
    }
    coef = constants.reduce((acc, f) => rMul(acc, asRational(f) as Rational), coef);
    if (rest.length === 0) {
      body = num(1);
    } else if (rest.length === 1) {
      body = rest[0];
    } else {
      return undefined;
    }
  }
  const scale = (F: Expr, rule: string): Antiderivative => ({
    F: rIsOne(coef) ? F : coef.n === -1 && coef.d === 1 ? neg(F) : mul(numR(coef), F),
    rule,
  });

  if (!containsVar(body, v)) {
    const c = asRational(body);
    if (!c) {
      return undefined;
    }
    coef = rMul(coef, c);
    return scale({ k: "var", name: v }, "∫ c dx = c·x");
  }
  if (body.k === "var") {
    return scale(div(pow(body, num(2)), num(2)), "Power rule: ∫ x dx = x²/2");
  }
  // u = linear inner expression (a·v + b), used by every chain-style rule below.
  const linearInner = (inner: Expr): { a: Rational } | undefined => {
    const linear = toLinear(inner, v);
    return linear && !rIsZero(linear.a) ? { a: linear.a } : undefined;
  };
  const overA = (F: Expr, a: Rational): Expr => (rIsOne(a) ? F : div(F, numR(a)));

  if (body.k === "pow") {
    const n = asRational(body.exp);
    const inner = linearInner(body.base);
    if (n && inner) {
      if (n.n === -1 && n.d === 1) {
        return scale(overA(fn("ln", fn("abs", body.base)), inner.a), "∫ 1/u du = ln|u| (divide by the inner slope)");
      }
      const nPlusOne = rAdd(n, rat(1));
      return scale(overA(div(pow(body.base, numR(nPlusOne)), numR(nPlusOne)), inner.a), `Power rule: ∫ uⁿ du = uⁿ⁺¹/(n+1) with n = ${n.d === 1 ? n.n : `${n.n}/${n.d}`}`);
    }
    if (body.base.k === "const" && body.base.name === "e") {
      const expInner = linearInner(body.exp);
      if (expInner) {
        return scale(overA(body, expInner.a), "∫ eᵘ du = eᵘ (divide by the inner slope)");
      }
    }
    return undefined;
  }
  if (body.k === "div") {
    const n = asRational(body.num);
    const inner = linearInner(body.den);
    if (n && inner) {
      coef = rMul(coef, n);
      return scale(overA(fn("ln", fn("abs", body.den)), inner.a), "∫ 1/u du = ln|u|");
    }
    const denominatorPower = body.den.k === "pow" ? asRational(body.den.exp) : undefined;
    if (n && body.den.k === "pow" && denominatorPower && linearInner(body.den.base)) {
      coef = rMul(coef, n);
      return antiderivativeOfTerm(mul(numR(coef), pow(body.den.base, numR(rNeg(denominatorPower)))), v);
    }
    return undefined;
  }
  if (body.k === "fn") {
    const inner = linearInner(body.arg);
    if (!inner) {
      return undefined;
    }
    switch (body.name) {
      case "sin":
        return scale(overA(neg(fn("cos", body.arg)), inner.a), "∫ sin u du = −cos u");
      case "cos":
        return scale(overA(fn("sin", body.arg), inner.a), "∫ cos u du = sin u");
      case "exp":
        return scale(overA(fn("exp", body.arg), inner.a), "∫ eᵘ du = eᵘ");
      case "sqrt":
        return scale(overA(div(mul(num(2), pow(body.arg, num(3, 2))), num(3)), inner.a), "∫ √u du = (2/3)·u^(3/2)");
      default:
        return undefined;
    }
  }
  return undefined;
}

/** Adaptive Simpson quadrature for the honest numeric fallback. */
export function integrateNumerically(f: (x: number) => number, a: number, b: number): number | undefined {
  const simpson = (l: number, r: number, fl: number, fm: number, fr: number) => ((r - l) / 6) * (fl + 4 * fm + fr);
  const recurse = (l: number, r: number, fl: number, fm: number, fr: number, whole: number, depth: number): number => {
    const m = (l + r) / 2;
    const lm = (l + m) / 2;
    const rm = (m + r) / 2;
    const flm = f(lm);
    const frm = f(rm);
    const leftArea = simpson(l, m, fl, flm, fm);
    const rightArea = simpson(m, r, fm, frm, fr);
    const delta = leftArea + rightArea - whole;
    if (depth > 18 || Math.abs(delta) <= 1e-11 * 15) {
      return leftArea + rightArea + delta / 15;
    }
    return recurse(l, m, fl, flm, fm, leftArea, depth + 1) + recurse(m, r, fm, frm, fr, rightArea, depth + 1);
  };
  const fa = f(a);
  const fb = f(b);
  const fm = f((a + b) / 2);
  if (![fa, fb, fm].every(Number.isFinite)) {
    return undefined;
  }
  const result = recurse(a, b, fa, fm, fb, simpson(a, b, fa, fm, fb), 0);
  return Number.isFinite(result) ? result : undefined;
}

function substituteLatex(F: Expr, v: string, value: Expr): string {
  return toLatex(replaceVar(F, v, value));
}

function replaceVar(e: Expr, v: string, value: Expr): Expr {
  switch (e.k) {
    case "var":
      return e.name === v ? value : e;
    case "num":
    case "const":
      return e;
    case "add":
      return add(...e.terms.map((t) => replaceVar(t, v, value)));
    case "mul":
      return mul(...e.factors.map((t) => replaceVar(t, v, value)));
    case "neg":
      return neg(replaceVar(e.arg, v, value));
    case "div":
      return div(replaceVar(e.num, v, value), replaceVar(e.den, v, value));
    case "pow":
      return pow(replaceVar(e.base, v, value), replaceVar(e.exp, v, value));
    case "fn":
      return fn(e.name, replaceVar(e.arg, v, value));
    case "deriv":
      return e;
  }
}

export function generateIntegral(input: string): GeneratorResult {
  return safely(() => {
    const parsed = parseIntegralInput(input);
    const { v, lower, upper } = parsed;
    const integralLatex = (body: Expr) =>
      `\\int_{${toLatex(lower)}}^{${toLatex(upper)}} ${body.k === "add" ? `\\left(${toLatex(body)}\\right)` : toLatex(body)}\\,d${v}`;
    const title = "Evaluate the definite integral";
    const problem = `Evaluate $${integralLatex(parsed.integrand)}$.`;
    const steps = [];

    let integrand = parsed.integrand;
    const expanded = simplify(distribute(integrand));
    if (toLatex(expanded) !== toLatex(integrand)) {
      integrand = expanded;
      steps.push(step(`${integralLatex(parsed.integrand)} = ${integralLatex(integrand)}`, "Expand and tidy the integrand first."));
    }

    const terms = integrand.k === "add" ? integrand.terms : [integrand];
    const parts: Antiderivative[] = [];
    for (const term of terms) {
      const part = antiderivativeOfTerm(term, v);
      if (!part) {
        parts.length = 0;
        break;
      }
      parts.push(part);
    }

    const a = evaluateExpr(lower, {});
    const b = evaluateExpr(upper, {});
    const f = (x: number) => evaluateExpr(integrand, { [v]: x });

    if (parts.length === 0) {
      const value = integrateNumerically(f, a, b);
      if (value === undefined) {
        return fail("No antiderivative rule applies, and the numeric integral didn't converge (maybe the integrand blows up between the bounds).");
      }
      const rounded = Number(value.toPrecision(6));
      steps.push(
        step(
          `${integralLatex(parsed.integrand)} \\approx ${rounded}`,
          "No antiderivative rule applies here, so this is a numeric value (adaptive Simpson's rule). Labelled numeric: not an exact answer.",
        ),
      );
      return buildDocument("integral", input, { title, problem, steps, answer: `\\approx ${rounded} \\;\\text{(numeric)}` });
    }

    // Guard: ln|u| needs the bounds on the same side of the singularity.
    const uses1OverU = parts.some((part) => part.rule.includes("ln|u|"));
    if (uses1OverU) {
      const samples = [a, (a + b) / 2, b].map(f);
      if (!samples.every(Number.isFinite)) {
        return fail("The integrand is undefined between the bounds, so the integral doesn't exist as a plain number.");
      }
    }

    const F = parts.length === 1 ? parts[0].F : add(...parts.map((part) => part.F));
    if (terms.length > 1) {
      steps.push(
        step(
          `${integralLatex(integrand)} = ${terms.map((term) => integralLatex(term)).join(" + ").replace(/\+ \\int_\{([^}]*)\}\^\{([^}]*)\} -/g, "- \\int_{$1}^{$2} ")}`,
          "Split the integral term by term (sum rule).",
        ),
      );
    }
    terms.forEach((term, index) => {
      const part = parts[index];
      steps.push(
        step(
          `\\frac{d}{d${v}}\\left(${toLatex(part.F)}\\right) = ${toLatex(term)}`,
          `Antiderivative of ${toPlainText(term)}: F(${v}) = ${toPlainText(part.F)} by ${part.rule}. Check it by differentiating.`,
        ),
      );
    });

    const upperValue = substituteLatex(F, v, upper);
    const lowerValue = substituteLatex(F, v, lower);
    steps.push(
      step(
        `${integralLatex(integrand)} = \\left(${upperValue}\\right) - \\left(${lowerValue}\\right)`,
        `Fundamental Theorem of Calculus: the integral equals F(${toPlainText(upper)}) − F(${toPlainText(lower)}).`,
      ),
    );

    const exact = simplify(add(replaceVar(F, v, upper), neg(replaceVar(F, v, lower))));
    const numeric = evaluateExpr(exact, {});
    const cross = integrateNumerically(f, a, b);
    const crossText = cross !== undefined ? ` Numeric cross-check: Simpson's rule gives ≈ ${Number(cross.toPrecision(6))}.` : "";
    steps.push(step(`= ${toLatex(exact)}`, `Simplify.${crossText}`));
    if (exact.k !== "num" && Number.isFinite(numeric)) {
      steps.push(step(`${toLatex(exact)} \\approx ${Number(numeric.toPrecision(6))}`, "Decimal approximation (rounded to 6 significant figures)."));
    }

    return buildDocument("integral", input, {
      title,
      problem,
      steps,
      answer: `${integralLatex(parsed.integrand)} = ${toLatex(exact)}`,
    });
  });
}

export const integralGenerator: SolutionGenerator = {
  id: "integral",
  label: "Definite integral",
  description: "Antiderivative steps with the Fundamental Theorem of Calculus and a numeric cross-check.",
  placeholder: "int_0^1 x^2 dx",
  examples: ["int_0^1 x^2 dx", "\\int_0^{\\pi} \\sin(x)\\,dx", "int_1^e 1/x dx", "int_0^2 (3x^2 - 2x + 1) dx"],
  generate: generateIntegral,
};
