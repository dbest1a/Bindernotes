import {
  add,
  asRational,
  containsDeriv,
  containsVar,
  deriv,
  div,
  fn,
  freeVariables,
  isNumValue,
  mul,
  neg,
  num,
  numR,
  parseExpression,
  pow,
  rIsOne,
  rIsZero,
  rMul,
  rSub,
  rat,
  simplify,
  toLatex,
  toPlainText,
  type Expr,
} from "../expression";
import { buildDocument, fail, safely, step, type GeneratorResult, type SolutionGenerator } from "./generator-types";

const MAX_RULE_STEPS = 40;

type RuleApplication = { expr: Expr; note: string };

/** Light cleanup that keeps the structure readable without combining like terms. */
export function tidy(e: Expr): Expr {
  switch (e.k) {
    case "num":
    case "const":
    case "var":
      return e;
    case "deriv":
      return deriv(tidy(e.arg), e.v);
    case "fn":
      return fn(e.name, tidy(e.arg));
    case "neg": {
      const arg = tidy(e.arg);
      if (arg.k === "num") {
        return numR(rat(-arg.v.n, arg.v.d));
      }
      if (arg.k === "neg") {
        return arg.arg;
      }
      return neg(arg);
    }
    case "div": {
      const n = tidy(e.num);
      const d = tidy(e.den);
      if (isNumValue(d, 1)) {
        return n;
      }
      if (isNumValue(n, 0)) {
        return num(0);
      }
      const folded = asRational(div(n, d));
      return folded ? numR(folded) : div(n, d);
    }
    case "pow": {
      const base = tidy(e.base);
      const exp = tidy(e.exp);
      if (isNumValue(exp, 1)) {
        return base;
      }
      if (isNumValue(exp, 0)) {
        return num(1);
      }
      const folded = asRational(pow(base, exp));
      return folded ? numR(folded) : pow(base, exp);
    }
    case "mul": {
      let coef = rat(1);
      const rest: Expr[] = [];
      const push = (f: Expr) => {
        if (f.k === "mul") {
          f.factors.forEach(push);
          return;
        }
        const r = asRational(f);
        if (r) {
          coef = rMul(coef, r);
          return;
        }
        if (f.k === "neg") {
          coef = rMul(coef, rat(-1));
          push(f.arg);
          return;
        }
        rest.push(f);
      };
      e.factors.map(tidy).forEach(push);
      if (rIsZero(coef)) {
        return num(0);
      }
      if (rest.length === 0) {
        return numR(coef);
      }
      const body = rest.length === 1 ? rest[0] : mul(...rest);
      if (rIsOne(coef)) {
        return body;
      }
      if (coef.n === -1 && coef.d === 1) {
        return neg(body);
      }
      return mul(numR(coef), ...rest);
    }
    case "add": {
      const terms: Expr[] = [];
      const push = (t: Expr) => {
        if (t.k === "add") {
          t.terms.forEach(push);
          return;
        }
        if (isNumValue(t, 0)) {
          return;
        }
        terms.push(t);
      };
      e.terms.map(tidy).forEach(push);
      return terms.length === 0 ? num(0) : add(...terms);
    }
  }
}

/** Replaces the first pending derivative (leftmost, outermost) using one rule. */
function applyOneRule(e: Expr, v: string): RuleApplication | undefined {
  if (e.k === "deriv") {
    return differentiateNode(e.arg, v);
  }
  const recurse = (child: Expr): RuleApplication | undefined => applyOneRule(child, v);
  switch (e.k) {
    case "add":
      for (let i = 0; i < e.terms.length; i += 1) {
        const result = recurse(e.terms[i]);
        if (result) {
          const terms = [...e.terms];
          terms[i] = result.expr;
          return { expr: add(...terms), note: result.note };
        }
      }
      return undefined;
    case "mul":
      for (let i = 0; i < e.factors.length; i += 1) {
        const result = recurse(e.factors[i]);
        if (result) {
          const factors = [...e.factors];
          factors[i] = result.expr;
          return { expr: mul(...factors), note: result.note };
        }
      }
      return undefined;
    case "neg": {
      const result = recurse(e.arg);
      return result ? { expr: neg(result.expr), note: result.note } : undefined;
    }
    case "div": {
      const n = recurse(e.num);
      if (n) {
        return { expr: div(n.expr, e.den), note: n.note };
      }
      const d = recurse(e.den);
      return d ? { expr: div(e.num, d.expr), note: d.note } : undefined;
    }
    case "pow": {
      const b = recurse(e.base);
      if (b) {
        return { expr: pow(b.expr, e.exp), note: b.note };
      }
      const x = recurse(e.exp);
      return x ? { expr: pow(e.base, x.expr), note: x.note } : undefined;
    }
    case "fn": {
      const result = recurse(e.arg);
      return result ? { expr: fn(e.name, result.expr), note: result.note } : undefined;
    }
    default:
      return undefined;
  }
}

function chain(inner: Expr, v: string, outerDerivative: Expr, outerName: string): RuleApplication {
  if (inner.k === "var" && inner.name === v) {
    return { expr: outerDerivative, note: `${outerName}.` };
  }
  return {
    expr: mul(outerDerivative, deriv(inner, v)),
    note: `Chain rule: ${outerName}, keeping the inside ${toPlain(inner)} the same, then multiply by the derivative of the inside.`,
  };
}

const toPlain = toPlainText;

function differentiateNode(arg: Expr, v: string): RuleApplication {
  if (!containsVar(arg, v)) {
    return { expr: num(0), note: `Constant rule: ${toPlain(arg)} doesn't depend on ${v}, so its derivative is 0.` };
  }
  switch (arg.k) {
    case "var":
      return { expr: num(1), note: `The derivative of ${v} with respect to itself is 1.` };
    case "add":
      return {
        expr: add(...arg.terms.map((t) => deriv(t, v))),
        note: "Sum rule: differentiate term by term.",
      };
    case "neg":
      return { expr: neg(deriv(arg.arg, v)), note: "The minus sign stays in front (constant multiple rule)." };
    case "mul": {
      const constants = arg.factors.filter((f) => !containsVar(f, v));
      const variables = arg.factors.filter((f) => containsVar(f, v));
      if (constants.length > 0) {
        const rest = variables.length === 1 ? variables[0] : mul(...variables);
        return {
          expr: mul(...constants, deriv(rest, v)),
          note: `Constant multiple rule: keep the factor ${toPlain(constants.length === 1 ? constants[0] : mul(...constants))} and differentiate the rest.`,
        };
      }
      const u = variables[0];
      const w = variables.length === 2 ? variables[1] : mul(...variables.slice(1));
      return {
        expr: add(mul(deriv(u, v), w), mul(u, deriv(w, v))),
        note: `Product rule: (u·w)' = u'·w + u·w' with u = ${toPlain(u)} and w = ${toPlain(w)}.`,
      };
    }
    case "div": {
      if (!containsVar(arg.den, v)) {
        return {
          expr: div(deriv(arg.num, v), arg.den),
          note: `Dividing by the constant ${toPlain(arg.den)} is a constant multiple: differentiate the numerator.`,
        };
      }
      if (!containsVar(arg.num, v)) {
        // c / w = c · w^(-1)
        return {
          expr: deriv(mul(arg.num, pow(arg.den, num(-1))), v),
          note: `Rewrite ${toPlain(arg)} as ${toPlain(arg.num)}·(${toPlain(arg.den)})⁻¹ so the power rule applies.`,
        };
      }
      return {
        expr: div(add(mul(deriv(arg.num, v), arg.den), neg(mul(arg.num, deriv(arg.den, v)))), pow(arg.den, num(2))),
        note: `Quotient rule: (u/w)' = (u'·w − u·w') / w² with u = ${toPlain(arg.num)} and w = ${toPlain(arg.den)}.`,
      };
    }
    case "pow": {
      const base = arg.base;
      const exp = arg.exp;
      if (!containsVar(exp, v)) {
        const n = asRational(exp);
        const nMinusOne = n ? numR(rSub(n, rat(1))) : add(exp, num(-1));
        const derivative = mul(exp, pow(base, nMinusOne));
        return chain(base, v, derivative, `Power rule: d/d${v} uⁿ = n·uⁿ⁻¹ with n = ${toPlain(exp)}`);
      }
      if (!containsVar(base, v)) {
        if (base.k === "const" && base.name === "e") {
          return chain(exp, v, fn("exp", exp), `Exponential rule: d/d${v} e^u = e^u`);
        }
        return chain(exp, v, mul(pow(base, exp), fn("ln", base)), `Exponential rule: d/d${v} a^u = a^u · ln a`);
      }
      throw new Error("Expressions with the variable in both the base and the exponent (like x^x) aren't supported yet.");
    }
    case "fn": {
      const u = arg.arg;
      switch (arg.name) {
        case "sin":
          return chain(u, v, fn("cos", u), "d/dx sin u = cos u");
        case "cos":
          return chain(u, v, neg(fn("sin", u)), "d/dx cos u = −sin u");
        case "tan":
          return chain(u, v, div(num(1), pow(fn("cos", u), num(2))), "d/dx tan u = sec² u = 1 / cos² u");
        case "exp":
          return chain(u, v, fn("exp", u), "d/dx e^u = e^u");
        case "ln":
          return chain(u, v, div(num(1), u), "d/dx ln u = 1 / u");
        case "sqrt":
          return chain(u, v, div(num(1), mul(num(2), fn("sqrt", u))), "d/dx √u = 1 / (2√u)");
        case "abs":
          throw new Error("|u| isn't differentiable at 0, so it isn't supported here.");
      }
      break;
    }
    case "deriv":
      throw new Error("Nested derivatives aren't supported yet.");
    default:
      break;
  }
  throw new Error("Couldn't differentiate this expression.");
}

/** Reads inputs like "d/dx x^3 sin(x)", "\frac{d}{dx}(…)", "derivative of …", "f(x) = …" or a bare expression. */
export function parseDerivativeInput(input: string): { expr: Expr; v: string } {
  let text = input.trim();
  let v: string | undefined;
  const fracMatch = /\\frac\s*\{\s*(?:\\mathrm\{)?d(?:\})?\s*\}\s*\{\s*(?:\\mathrm\{)?d(?:\})?\s*([a-zA-Z])\s*\}/.exec(text);
  if (fracMatch) {
    v = fracMatch[1];
    text = text.replace(fracMatch[0], " ");
  }
  const slashMatch = /\bd\s*\/\s*d\s*([a-zA-Z])\b/.exec(text);
  if (slashMatch) {
    v = slashMatch[1];
    text = text.replace(slashMatch[0], " ");
  }
  const wordMatch = /^(?:find\s+)?(?:the\s+)?derivative\s+of\s+/i.exec(text);
  if (wordMatch) {
    text = text.slice(wordMatch[0].length);
  }
  const withRespect = /with\s+respect\s+to\s+([a-zA-Z])/i.exec(text);
  if (withRespect) {
    v = withRespect[1];
    text = text.replace(withRespect[0], " ");
  }
  const defMatch = /^\s*(?:f|g|h|y)\s*(?:\(\s*([a-zA-Z])\s*\))?\s*=\s*/.exec(text);
  if (defMatch) {
    v = v ?? defMatch[1];
    text = text.slice(defMatch[0].length);
  }
  text = text.trim();
  if (!text) {
    throw new Error("Type an expression to differentiate, like d/dx x^3 sin(x).");
  }
  const expr = parseExpression(text);
  const vars = [...freeVariables(expr)];
  if (!v) {
    if (vars.length === 1) {
      v = vars[0];
    } else if (vars.includes("x")) {
      v = "x";
    } else if (vars.length === 0) {
      v = "x";
    } else {
      throw new Error(`Which variable? Write d/dx (or d/dt …) in front: the expression uses ${vars.join(", ")}.`);
    }
  }
  return { expr, v };
}

export function generateDerivative(input: string): GeneratorResult {
  return safely(() => {
    const { expr, v } = parseDerivativeInput(input);
    const original = toLatex(expr);
    const lhs = `\\frac{d}{d${v}}\\left(${original}\\right)`;
    const steps = [];
    let current: Expr = deriv(expr, v);
    let guard = 0;
    while (containsDeriv(current)) {
      guard += 1;
      if (guard > MAX_RULE_STEPS) {
        return fail("This expression needs too many steps to differentiate here.");
      }
      const applied = applyOneRule(current, v);
      if (!applied) {
        break;
      }
      current = tidy(applied.expr);
      steps.push(step(`${lhs} = ${toLatex(current)}`, applied.note));
    }
    const simplified = simplify(current);
    if (toLatex(simplified) !== toLatex(current)) {
      current = simplified;
      steps.push(step(`${lhs} = ${toLatex(current)}`, "Simplify: combine like terms and tidy the coefficients."));
    }
    if (steps.length === 0) {
      steps.push(step(`${lhs} = ${toLatex(current)}`, "Nothing to differentiate."));
    }
    return buildDocument("derivative", input, {
      title: `Differentiate ${toPlain(expr)}`,
      problem: `Find $${lhs}$.`,
      steps,
      answer: `${lhs} = ${toLatex(current)}`,
    });
  });
}

export const derivativeGenerator: SolutionGenerator = {
  id: "derivative",
  label: "Derivative",
  description: "Differentiate rule by rule: sum, product, quotient, chain, power, trig, exp, ln and roots.",
  placeholder: "d/dx x^3 sin(x)",
  examples: ["d/dx x^3 sin(x)", "d/dx sin(x^2)", "d/dx \\frac{\\ln(x)}{x^2 + 1}", "d/dt e^{2t} \\sqrt{t}"],
  generate: generateDerivative,
};
