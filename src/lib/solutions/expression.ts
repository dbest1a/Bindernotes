/**
 * A small, dependency-free expression engine used by the free step generators.
 *
 * It parses plain text ("3(x-2)+4", "d/dx x^3 sin(x)") and simple LaTeX
 * ("\frac{1}{2}x^2", "\sin\left(x\right)"), prints LaTeX for KaTeX, simplifies
 * conservatively, extracts polynomials and evaluates numerically.
 *
 * Verification of the generated steps is done separately by the Compute Engine;
 * this module only has to produce honest, readable steps.
 */

// ---------------------------------------------------------------------------
// Rational numbers
// ---------------------------------------------------------------------------

export type Rational = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function rat(n: number, d = 1): Rational {
  if (d === 0) {
    throw new Error("Division by zero");
  }
  if (!Number.isFinite(n) || !Number.isFinite(d)) {
    throw new Error("Non-finite rational");
  }
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export const rAdd = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const rSub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const rMul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const rDiv = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
export const rNeg = (a: Rational) => rat(-a.n, a.d);
export const rIsZero = (a: Rational) => a.n === 0;
export const rIsOne = (a: Rational) => a.n === 1 && a.d === 1;
export const rIsInt = (a: Rational) => a.d === 1;
export const rEq = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
export const rToNumber = (a: Rational) => a.n / a.d;
export const rSign = (a: Rational) => Math.sign(a.n);
export const rAbs = (a: Rational) => rat(Math.abs(a.n), a.d);

export function rPowInt(a: Rational, e: number): Rational {
  if (!Number.isInteger(e)) {
    throw new Error("Non-integer exponent");
  }
  if (e < 0) {
    return rPowInt(rDiv(rat(1), a), -e);
  }
  let result = rat(1);
  for (let i = 0; i < e; i += 1) {
    result = rMul(result, a);
  }
  return result;
}

/** Converts a decimal string like "2.5" or "-0.125" to a rational. */
export function rationalFromDecimal(text: string): Rational {
  const match = /^(-?)(\d*)(?:\.(\d+))?$/.exec(text.trim());
  if (!match || (!match[2] && !match[3])) {
    throw new Error(`Not a number: ${text}`);
  }
  const whole = match[2] || "0";
  const frac = match[3] || "";
  const scale = 10 ** frac.length;
  const value = Number(whole + frac);
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(scale)) {
    throw new Error(`Number too large: ${text}`);
  }
  return rat(match[1] ? -value : value, scale);
}

export function rationalToLatex(a: Rational): string {
  if (a.d === 1) {
    return String(a.n);
  }
  const sign = a.n < 0 ? "-" : "";
  return `${sign}\\frac{${Math.abs(a.n)}}{${a.d}}`;
}

/** Perfect-square test for non-negative integers. */
export function isqrt(n: number): number | undefined {
  if (n < 0 || !Number.isInteger(n)) {
    return undefined;
  }
  const r = Math.round(Math.sqrt(n));
  return r * r === n ? r : undefined;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type FnName = "sin" | "cos" | "tan" | "exp" | "ln" | "sqrt" | "abs";

export type Expr =
  | { k: "num"; v: Rational }
  | { k: "const"; name: "pi" | "e" }
  | { k: "var"; name: string }
  | { k: "add"; terms: Expr[] }
  | { k: "mul"; factors: Expr[] }
  | { k: "neg"; arg: Expr }
  | { k: "div"; num: Expr; den: Expr }
  | { k: "pow"; base: Expr; exp: Expr }
  | { k: "fn"; name: FnName; arg: Expr }
  /** A pending derivative d/d{v} (…), used by the derivative generator. */
  | { k: "deriv"; arg: Expr; v: string };

export const num = (n: number, d = 1): Expr => ({ k: "num", v: rat(n, d) });
export const numR = (v: Rational): Expr => ({ k: "num", v });
export const variable = (name: string): Expr => ({ k: "var", name });
export const constant = (name: "pi" | "e"): Expr => ({ k: "const", name });
export const add = (...terms: Expr[]): Expr => (terms.length === 1 ? terms[0] : { k: "add", terms });
export const mul = (...factors: Expr[]): Expr => (factors.length === 1 ? factors[0] : { k: "mul", factors });
export const neg = (arg: Expr): Expr => ({ k: "neg", arg });
export const div = (n: Expr, d: Expr): Expr => ({ k: "div", num: n, den: d });
export const pow = (base: Expr, exp: Expr): Expr => ({ k: "pow", base, exp });
export const fn = (name: FnName, arg: Expr): Expr => ({ k: "fn", name, arg });
export const deriv = (arg: Expr, v: string): Expr => ({ k: "deriv", arg, v });
export const sub = (a: Expr, b: Expr): Expr => add(a, neg(b));

export function isNum(e: Expr): e is { k: "num"; v: Rational } {
  return e.k === "num";
}

/** True when the expression is exactly the integer `value`. Not a type guard, so it never narrows the else branch. */
export function isNumValue(e: Expr, value: number): boolean {
  return e.k === "num" && e.v.n === value && e.v.d === 1;
}

export function exprEquals(a: Expr, b: Expr): boolean {
  if (a.k !== b.k) {
    return false;
  }
  switch (a.k) {
    case "num":
      return rEq(a.v, (b as typeof a).v);
    case "const":
      return a.name === (b as typeof a).name;
    case "var":
      return a.name === (b as typeof a).name;
    case "add": {
      const bt = (b as typeof a).terms;
      return a.terms.length === bt.length && a.terms.every((t, i) => exprEquals(t, bt[i]));
    }
    case "mul": {
      const bf = (b as typeof a).factors;
      return a.factors.length === bf.length && a.factors.every((t, i) => exprEquals(t, bf[i]));
    }
    case "neg":
      return exprEquals(a.arg, (b as typeof a).arg);
    case "div":
      return exprEquals(a.num, (b as typeof a).num) && exprEquals(a.den, (b as typeof a).den);
    case "pow":
      return exprEquals(a.base, (b as typeof a).base) && exprEquals(a.exp, (b as typeof a).exp);
    case "fn":
      return a.name === (b as typeof a).name && exprEquals(a.arg, (b as typeof a).arg);
    case "deriv":
      return a.v === (b as typeof a).v && exprEquals(a.arg, (b as typeof a).arg);
  }
}

export function containsVar(e: Expr, name: string): boolean {
  switch (e.k) {
    case "num":
    case "const":
      return false;
    case "var":
      return e.name === name;
    case "add":
      return e.terms.some((t) => containsVar(t, name));
    case "mul":
      return e.factors.some((t) => containsVar(t, name));
    case "neg":
      return containsVar(e.arg, name);
    case "div":
      return containsVar(e.num, name) || containsVar(e.den, name);
    case "pow":
      return containsVar(e.base, name) || containsVar(e.exp, name);
    case "fn":
      return containsVar(e.arg, name);
    case "deriv":
      return containsVar(e.arg, name);
  }
}

export function containsDeriv(e: Expr): boolean {
  switch (e.k) {
    case "deriv":
      return true;
    case "num":
    case "const":
    case "var":
      return false;
    case "add":
      return e.terms.some(containsDeriv);
    case "mul":
      return e.factors.some(containsDeriv);
    case "neg":
    case "fn":
      return containsDeriv(e.arg);
    case "div":
      return containsDeriv(e.num) || containsDeriv(e.den);
    case "pow":
      return containsDeriv(e.base) || containsDeriv(e.exp);
  }
}

export function freeVariables(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.k) {
    case "var":
      out.add(e.name);
      break;
    case "add":
      e.terms.forEach((t) => freeVariables(t, out));
      break;
    case "mul":
      e.factors.forEach((t) => freeVariables(t, out));
      break;
    case "neg":
    case "fn":
    case "deriv":
      freeVariables(e.arg, out);
      break;
    case "div":
      freeVariables(e.num, out);
      freeVariables(e.den, out);
      break;
    case "pow":
      freeVariables(e.base, out);
      freeVariables(e.exp, out);
      break;
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// LaTeX → plain text preprocessing
// ---------------------------------------------------------------------------

function replaceBraced(source: string, command: string, build: (args: string[]) => string, arity: number): string {
  let text = source;
  let index = text.indexOf(command);
  let guard = 0;
  while (index !== -1 && guard < 500) {
    guard += 1;
    let cursor = index + command.length;
    const args: string[] = [];
    let ok = true;
    for (let i = 0; i < arity; i += 1) {
      while (text[cursor] === " ") {
        cursor += 1;
      }
      if (text[cursor] !== "{") {
        ok = false;
        break;
      }
      let depth = 0;
      let end = cursor;
      for (; end < text.length; end += 1) {
        if (text[end] === "{") {
          depth += 1;
        } else if (text[end] === "}") {
          depth -= 1;
          if (depth === 0) {
            break;
          }
        }
      }
      if (end >= text.length) {
        ok = false;
        break;
      }
      args.push(text.slice(cursor + 1, end));
      cursor = end + 1;
    }
    if (!ok) {
      throw new Error(`Couldn't read ${command}`);
    }
    text = text.slice(0, index) + build(args) + text.slice(cursor);
    index = text.indexOf(command);
  }
  return text;
}

/** Converts a LaTeX-ish string into the plain syntax the tokenizer understands. */
export function latexToPlain(input: string): string {
  let text = input
    .replace(/\\dfrac|\\tfrac/g, "\\frac")
    .replace(/\\left|\\right|\\displaystyle|\\,|\\;|\\:|\\!|\\quad|\\qquad|\\ /g, " ")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, " pi ")
    .replace(/\\mathrm\{e\}/g, " e ")
    .replace(/\\mathrm\{d\}/g, " d ")
    .replace(/\\infty/g, " infinity ")
    .replace(/\\operatorname\{([a-z]+)\}/g, " $1 ")
    .replace(/\\(sin|cos|tan|exp|ln|sqrt|log|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, " $1 ")
    .replace(/\\mathrm\{([a-z]+)\}/g, " $1 ")
    .replace(/−/g, "-")
    .replace(/·|×|⋅/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/π/g, " pi ")
    .replace(/√/g, " sqrt ")
    .replace(/∫/g, " int ");

  text = replaceBraced(text, "\\frac", ([a, b]) => `((${a})/(${b}))`, 2);
  text = text.replace(/sqrt\s*\[([^\]]+)\]\s*\{([^{}]*)\}/g, (_m, n: string, body: string) => `((${body})^(1/(${n})))`);
  text = text.replace(/sqrt\s*\{/g, "sqrt(").replace(/\\abs\s*\{|\\lvert|\\lVert/g, "abs(").replace(/\\rvert|\\rVert/g, ")");
  text = text.replace(/\|([^|]+)\|/g, "abs($1)");

  if (/\\[a-zA-Z]+/.test(text)) {
    const cmd = /\\[a-zA-Z]+/.exec(text)?.[0];
    throw new Error(`Unsupported notation: ${cmd}`);
  }
  return text.replace(/\{/g, "(").replace(/\}/g, ")");
}

// ---------------------------------------------------------------------------
// Tokenizer + parser (plain syntax)
// ---------------------------------------------------------------------------

type Token =
  | { t: "num"; text: string }
  | { t: "id"; text: string }
  | { t: "op"; text: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "end" };

const FUNCTION_NAMES = new Set(["sin", "cos", "tan", "exp", "ln", "sqrt", "abs", "log", "sec", "csc", "cot"]);
const WORD_NAMES = new Set(["pi", "e", "infinity", "inf", ...FUNCTION_NAMES]);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9.]/.test(text[j])) {
        j += 1;
      }
      tokens.push({ t: "num", text: text.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < text.length && /[a-zA-Z]/.test(text[j])) {
        j += 1;
      }
      const word = text.slice(i, j);
      if (WORD_NAMES.has(word) || word.length === 1) {
        tokens.push({ t: "id", text: word });
      } else {
        // Greedy split: known words first, otherwise single letters (implicit products).
        let cursor = 0;
        while (cursor < word.length) {
          let matched = false;
          for (let len = Math.min(8, word.length - cursor); len >= 2; len -= 1) {
            const piece = word.slice(cursor, cursor + len);
            if (WORD_NAMES.has(piece)) {
              tokens.push({ t: "id", text: piece });
              cursor += len;
              matched = true;
              break;
            }
          }
          if (!matched) {
            tokens.push({ t: "id", text: word[cursor] });
            cursor += 1;
          }
        }
      }
      i = j;
      continue;
    }
    if (ch === "(" || ch === "[") {
      tokens.push({ t: "lp" });
      i += 1;
      continue;
    }
    if (ch === ")" || ch === "]") {
      tokens.push({ t: "rp" });
      i += 1;
      continue;
    }
    if ("+-*/^".includes(ch)) {
      tokens.push({ t: "op", text: ch });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  tokens.push({ t: "end" });
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    this.pos += 1;
    return token;
  }

  parseAll(): Expr {
    const expr = this.parseSum();
    if (this.peek().t !== "end") {
      throw new Error("Unexpected input after the expression");
    }
    return expr;
  }

  private parseSum(): Expr {
    const terms: Expr[] = [];
    let first = true;
    for (;;) {
      const token = this.peek();
      let sign = 1;
      if (token.t === "op" && (token.text === "+" || token.text === "-")) {
        this.next();
        sign = token.text === "-" ? -1 : 1;
      } else if (!first) {
        break;
      }
      first = false;
      const term = this.parseProduct();
      terms.push(sign < 0 ? neg(term) : term);
    }
    if (terms.length === 0) {
      throw new Error("Expected an expression");
    }
    return add(...terms);
  }

  private startsFactor(token: Token): boolean {
    return token.t === "num" || token.t === "id" || token.t === "lp";
  }

  private parseProduct(): Expr {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token.t === "op" && (token.text === "*" || token.text === "/")) {
        this.next();
        const right = this.parseUnary();
        left = token.text === "*" ? mul(...flattenMul(left), right) : div(left, right);
        continue;
      }
      if (this.startsFactor(token)) {
        const right = this.parseUnary();
        left = mul(...flattenMul(left), right);
        continue;
      }
      break;
    }
    return left;
  }

  private parseUnary(): Expr {
    const token = this.peek();
    if (token.t === "op" && token.text === "-") {
      this.next();
      return neg(this.parseUnary());
    }
    if (token.t === "op" && token.text === "+") {
      this.next();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const base = this.parseAtom();
    const token = this.peek();
    if (token.t === "op" && token.text === "^") {
      this.next();
      const exponent = this.parseUnary();
      return pow(base, exponent);
    }
    return base;
  }

  private parseAtom(): Expr {
    const token = this.next();
    if (token.t === "num") {
      return numR(rationalFromDecimal(token.text));
    }
    if (token.t === "lp") {
      const inner = this.parseSum();
      if (this.next().t !== "rp") {
        throw new Error("Missing closing parenthesis");
      }
      return inner;
    }
    if (token.t === "id") {
      if (FUNCTION_NAMES.has(token.text)) {
        return this.parseFunction(token.text);
      }
      if (token.text === "pi") {
        return constant("pi");
      }
      if (token.text === "e") {
        return constant("e");
      }
      if (token.text === "infinity" || token.text === "inf") {
        throw new Error("Infinity isn't supported here");
      }
      if (token.text.length === 1) {
        return variable(token.text);
      }
      throw new Error(`Unknown symbol "${token.text}"`);
    }
    if (token.t === "end") {
      throw new Error("The expression ends too early");
    }
    throw new Error("Unexpected symbol");
  }

  private parseFunction(name: string): Expr {
    let power: Expr | undefined;
    const maybeCaret = this.peek();
    if (maybeCaret.t === "op" && maybeCaret.text === "^") {
      // sin^2 x
      this.next();
      power = this.parseAtom();
    }
    let arg: Expr;
    if (this.peek().t === "lp") {
      this.next();
      arg = this.parseSum();
      if (this.next().t !== "rp") {
        throw new Error("Missing closing parenthesis");
      }
    } else {
      // TeX-style: \sin x^2 means sin(x^2)
      arg = this.parsePower();
    }
    let result: Expr;
    switch (name) {
      case "sec":
        result = div(num(1), fn("cos", arg));
        break;
      case "csc":
        result = div(num(1), fn("sin", arg));
        break;
      case "cot":
        result = div(fn("cos", arg), fn("sin", arg));
        break;
      case "log":
        throw new Error("Use ln for the natural logarithm; log with other bases isn't supported yet");
      default:
        result = fn(name as FnName, arg);
    }
    return power ? pow(result, power) : result;
  }
}

function flattenMul(e: Expr): Expr[] {
  return e.k === "mul" ? e.factors : [e];
}

/** Parses plain text or simple LaTeX into an expression. Throws on unsupported input. */
export function parseExpression(input: string): Expr {
  const plain = latexToPlain(input);
  if (!plain.trim()) {
    throw new Error("Nothing to read");
  }
  return new Parser(tokenize(plain)).parseAll();
}

/** Splits "lhs = rhs" and parses both sides. */
export function parseEquation(input: string): { left: Expr; right: Expr } {
  const parts = input.split("=");
  if (parts.length !== 2) {
    throw new Error(parts.length < 2 ? "Expected an equation with one equals sign" : "Only one equals sign is supported");
  }
  return { left: parseExpression(parts[0]), right: parseExpression(parts[1]) };
}

// ---------------------------------------------------------------------------
// LaTeX printer
// ---------------------------------------------------------------------------

const FN_LATEX: Record<FnName, string> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  exp: "\\exp",
  ln: "\\ln",
  sqrt: "\\sqrt",
  abs: "",
};

function startsWithDigit(latex: string): boolean {
  return /^[0-9]/.test(latex) || /^\\frac\{[0-9]/.test(latex);
}

function isNegativeLeading(e: Expr): boolean {
  if (e.k === "neg") {
    return true;
  }
  if (e.k === "num") {
    return e.v.n < 0;
  }
  if (e.k === "mul") {
    return isNegativeLeading(e.factors[0]);
  }
  return false;
}

function stripLeadingSign(e: Expr): Expr {
  if (e.k === "neg") {
    return e.arg;
  }
  if (e.k === "num") {
    return numR(rAbs(e.v));
  }
  if (e.k === "mul") {
    return mul(stripLeadingSign(e.factors[0]), ...e.factors.slice(1));
  }
  return e;
}

function wrap(latex: string): string {
  return `\\left(${latex}\\right)`;
}

export function toLatex(e: Expr): string {
  switch (e.k) {
    case "num":
      return rationalToLatex(e.v);
    case "const":
      return e.name === "pi" ? "\\pi" : "e";
    case "var":
      return e.name;
    case "neg": {
      const inner = toLatex(e.arg);
      return e.arg.k === "add" || isNegativeLeading(e.arg) ? `-${wrap(inner)}` : `-${inner}`;
    }
    case "add": {
      let out = "";
      e.terms.forEach((term, index) => {
        const negative = isNegativeLeading(term);
        const body = negative ? stripLeadingSign(term) : term;
        const text = toLatex(body);
        const wrapped = body.k === "add" ? wrap(text) : text;
        if (index === 0) {
          out += negative ? `-${wrapped}` : wrapped;
        } else {
          out += negative ? ` - ${wrapped}` : ` + ${wrapped}`;
        }
      });
      return out;
    }
    case "mul": {
      let out = "";
      let previous: Expr | undefined;
      e.factors.forEach((factor) => {
        let body = toLatex(factor);
        if (factor.k === "add" || factor.k === "neg" || (factor.k === "num" && factor.v.n < 0 && previous)) {
          body = wrap(body);
        }
        if (previous) {
          const needsDot =
            startsWithDigit(body) ||
            body.startsWith("\\frac") ||
            (previous.k === "fn" && previous.name !== "sqrt" && previous.name !== "abs") ||
            (previous.k === "num" && factor.k === "num") ||
            previous.k === "deriv" ||
            factor.k === "div";
          out += needsDot ? ` \\cdot ${body}` : body;
        } else {
          out = body;
        }
        previous = factor;
      });
      return out;
    }
    case "div":
      return `\\frac{${toLatex(e.num)}}{${toLatex(e.den)}}`;
    case "pow": {
      if (e.base.k === "fn" && e.base.name !== "sqrt" && e.base.name !== "abs" && e.base.name !== "exp") {
        // sin^2(x) style
        return `${FN_LATEX[e.base.name]}^{${toLatex(e.exp)}}(${toLatex(e.base.arg)})`;
      }
      let base = toLatex(e.base);
      const needsWrap =
        e.base.k === "add" ||
        e.base.k === "mul" ||
        e.base.k === "neg" ||
        e.base.k === "div" ||
        e.base.k === "pow" ||
        e.base.k === "deriv" ||
        (e.base.k === "fn" && e.base.name === "exp") ||
        (e.base.k === "num" && (e.base.v.n < 0 || e.base.v.d !== 1));
      if (needsWrap) {
        base = wrap(base);
      }
      return `${base}^{${toLatex(e.exp)}}`;
    }
    case "fn": {
      const arg = toLatex(e.arg);
      if (e.name === "sqrt") {
        return `\\sqrt{${arg}}`;
      }
      if (e.name === "abs") {
        return `\\left|${arg}\\right|`;
      }
      if (e.name === "exp") {
        return `e^{${arg}}`;
      }
      return `${FN_LATEX[e.name]}(${arg})`;
    }
    case "deriv":
      return `\\frac{d}{d${e.v}}\\left(${toLatex(e.arg)}\\right)`;
  }
}

/** Readable plain-text form for notes: "x^3·sin(x)", "√(t)", "e^(2t)". */
export function toPlainText(e: Expr): string {
  const paren = (child: Expr, text: string, when: boolean) => (when ? `(${text})` : text);
  switch (e.k) {
    case "num":
      return e.v.d === 1 ? String(e.v.n) : `${e.v.n}/${e.v.d}`;
    case "const":
      return e.name === "pi" ? "π" : "e";
    case "var":
      return e.name;
    case "neg":
      return `−${paren(e.arg, toPlainText(e.arg), e.arg.k === "add")}`;
    case "add":
      return e.terms
        .map((term, index) => {
          const negative = isNegativeLeading(term);
          const body = toPlainText(negative ? stripLeadingSign(term) : term);
          if (index === 0) {
            return negative ? `−${body}` : body;
          }
          return negative ? ` − ${body}` : ` + ${body}`;
        })
        .join("");
    case "mul":
      return e.factors.map((f) => paren(f, toPlainText(f), f.k === "add" || f.k === "neg")).join("·");
    case "div":
      return `${paren(e.num, toPlainText(e.num), e.num.k === "add" || e.num.k === "mul")}/${paren(e.den, toPlainText(e.den), e.den.k !== "num" && e.den.k !== "var")}`;
    case "pow": {
      const base = paren(e.base, toPlainText(e.base), e.base.k !== "num" && e.base.k !== "var" && e.base.k !== "const" && e.base.k !== "fn");
      const exp = toPlainText(e.exp);
      return `${base}^${exp.length > 1 && !/^-?\d+$/.test(exp) ? `(${exp})` : exp}`;
    }
    case "fn":
      if (e.name === "sqrt") {
        return `√(${toPlainText(e.arg)})`;
      }
      if (e.name === "abs") {
        return `|${toPlainText(e.arg)}|`;
      }
      if (e.name === "exp") {
        return `e^(${toPlainText(e.arg)})`;
      }
      return `${e.name}(${toPlainText(e.arg)})`;
    case "deriv":
      return `d/d${e.v}(${toPlainText(e.arg)})`;
  }
}

// ---------------------------------------------------------------------------
// Numeric evaluation (for generator self-checks and tests)
// ---------------------------------------------------------------------------

export function evaluateExpr(e: Expr, env: Record<string, number>): number {
  switch (e.k) {
    case "num":
      return rToNumber(e.v);
    case "const":
      return e.name === "pi" ? Math.PI : Math.E;
    case "var": {
      const value = env[e.name];
      if (value === undefined) {
        throw new Error(`Unbound variable ${e.name}`);
      }
      return value;
    }
    case "add":
      return e.terms.reduce((sum, t) => sum + evaluateExpr(t, env), 0);
    case "mul":
      return e.factors.reduce((prod, t) => prod * evaluateExpr(t, env), 1);
    case "neg":
      return -evaluateExpr(e.arg, env);
    case "div":
      return evaluateExpr(e.num, env) / evaluateExpr(e.den, env);
    case "pow":
      return evaluateExpr(e.base, env) ** evaluateExpr(e.exp, env);
    case "fn": {
      const a = evaluateExpr(e.arg, env);
      switch (e.name) {
        case "sin":
          return Math.sin(a);
        case "cos":
          return Math.cos(a);
        case "tan":
          return Math.tan(a);
        case "exp":
          return Math.exp(a);
        case "ln":
          return Math.log(a);
        case "sqrt":
          return Math.sqrt(a);
        case "abs":
          return Math.abs(a);
      }
      break;
    }
    case "deriv": {
      // Central difference; only used for self-checks.
      const h = 1e-5;
      const x = env[e.v] ?? 0;
      const plus = evaluateExpr(e.arg, { ...env, [e.v]: x + h });
      const minus = evaluateExpr(e.arg, { ...env, [e.v]: x - h });
      return (plus - minus) / (2 * h);
    }
  }
  throw new Error("Cannot evaluate");
}

// ---------------------------------------------------------------------------
// Simplifier (conservative, readable output)
// ---------------------------------------------------------------------------

export function asRational(e: Expr): Rational | undefined {
  if (e.k === "num") {
    return e.v;
  }
  if (e.k === "neg") {
    const inner = asRational(e.arg);
    return inner ? rNeg(inner) : undefined;
  }
  if (e.k === "div") {
    const n = asRational(e.num);
    const d = asRational(e.den);
    return n && d && !rIsZero(d) ? rDiv(n, d) : undefined;
  }
  if (e.k === "mul") {
    let acc = rat(1);
    for (const f of e.factors) {
      const r = asRational(f);
      if (!r) {
        return undefined;
      }
      acc = rMul(acc, r);
    }
    return acc;
  }
  if (e.k === "add") {
    let acc = rat(0);
    for (const t of e.terms) {
      const r = asRational(t);
      if (!r) {
        return undefined;
      }
      acc = rAdd(acc, r);
    }
    return acc;
  }
  if (e.k === "pow") {
    const b = asRational(e.base);
    const x = asRational(e.exp);
    if (b && x && rIsInt(x) && Math.abs(x.n) <= 12 && !(rIsZero(b) && x.n <= 0)) {
      return rPowInt(b, x.n);
    }
  }
  return undefined;
}

/** Splits a product into (rational coefficient, remaining non-numeric factors). */
function splitCoefficient(e: Expr): { coef: Rational; rest: Expr[] } {
  if (e.k === "neg") {
    const inner = splitCoefficient(e.arg);
    return { coef: rNeg(inner.coef), rest: inner.rest };
  }
  const r = asRational(e);
  if (r) {
    return { coef: r, rest: [] };
  }
  if (e.k === "mul") {
    let coef = rat(1);
    const rest: Expr[] = [];
    for (const f of e.factors) {
      const fr = asRational(f);
      if (fr) {
        coef = rMul(coef, fr);
      } else if (f.k === "neg") {
        const inner = splitCoefficient(f);
        coef = rMul(coef, inner.coef);
        rest.push(...inner.rest);
      } else {
        rest.push(f);
      }
    }
    return { coef, rest };
  }
  return { coef: rat(1), rest: [e] };
}

function termKey(rest: Expr[]): string {
  return rest.map((f) => toLatex(f)).sort().join("\u0001");
}

function factorOrder(e: Expr): number {
  switch (e.k) {
    case "num":
      return 0;
    case "const":
      return 1;
    case "var":
      return 2;
    case "pow":
      return e.base.k === "var" || e.base.k === "const" ? 3 : 5;
    case "add":
      return 4;
    case "div":
      return 4;
    case "fn":
      return 6;
    default:
      return 7;
  }
}

function sortFactors(factors: Expr[]): Expr[] {
  return [...factors].sort((a, b) => factorOrder(a) - factorOrder(b) || toLatex(a).localeCompare(toLatex(b)));
}

/** Degree-like ordering so polynomials print as x^2 + x + 1. */
function termOrder(rest: Expr[]): number {
  let degree = 0;
  for (const f of rest) {
    if (f.k === "var") {
      degree += 1;
    } else if (f.k === "pow" && f.base.k === "var") {
      const r = asRational(f.exp);
      degree += r ? rToNumber(r) : 1.5;
    } else if (f.k === "fn" || f.k === "deriv") {
      degree += 0.25;
    }
  }
  return -degree;
}

/** Exact sin/cos of rational multiples of π (denominators 1, 2, 3, 4, 6), else undefined. */
function exactTrig(name: "sin" | "cos", arg: Expr): Expr | undefined {
  let multiple: Rational | undefined;
  if (arg.k === "const" && arg.name === "pi") {
    multiple = rat(1);
  } else {
    const { coef, rest } = splitCoefficient(arg);
    if (rest.length === 1 && rest[0].k === "const" && rest[0].name === "pi") {
      multiple = coef;
    } else if (arg.k === "div" && arg.num.k === "const" && arg.num.name === "pi") {
      const d = asRational(arg.den);
      multiple = d ? rDiv(rat(1), d) : undefined;
    }
  }
  if (!multiple || ![1, 2, 3, 4, 6].includes(multiple.d)) {
    return undefined;
  }
  // Reduce to [0, 2) turns.
  let turns = rat(((multiple.n % (2 * multiple.d)) + 2 * multiple.d) % (2 * multiple.d), multiple.d);
  if (name === "cos") {
    // cos(θ) = sin(θ + π/2)
    turns = rAdd(turns, rat(1, 2));
    turns = rat(((turns.n % (2 * turns.d)) + 2 * turns.d) % (2 * turns.d), turns.d);
  }
  // sin on [0, 2π) with twelfths: value table keyed by numerator over 12.
  const twelfths = rMul(turns, rat(12));
  if (!rIsInt(twelfths)) {
    return undefined;
  }
  const k = twelfths.n % 24;
  const table: Record<number, Expr> = {
    0: num(0),
    2: num(1, 2),
    3: div(fn("sqrt", num(2)), num(2)),
    4: div(fn("sqrt", num(3)), num(2)),
    6: num(1),
    8: div(fn("sqrt", num(3)), num(2)),
    9: div(fn("sqrt", num(2)), num(2)),
    10: num(1, 2),
    12: num(0),
  };
  if (k in table) {
    return table[k];
  }
  if (k - 12 in table) {
    const positive = table[k - 12];
    return positive.k === "num" ? numR(rNeg(positive.v)) : neg(positive);
  }
  return undefined;
}

export function simplify(e: Expr): Expr {
  switch (e.k) {
    case "num":
    case "const":
    case "var":
      return e;
    case "neg": {
      const arg = simplify(e.arg);
      if (arg.k === "num") {
        return numR(rNeg(arg.v));
      }
      if (arg.k === "neg") {
        return arg.arg;
      }
      if (arg.k === "mul" && arg.factors[0].k === "num") {
        return simplify(mul(numR(rNeg(arg.factors[0].v)), ...arg.factors.slice(1)));
      }
      return neg(arg);
    }
    case "fn": {
      const arg = simplify(e.arg);
      const r = asRational(arg);
      if (r) {
        if (e.name === "sqrt" && r.n >= 0) {
          const rn = isqrt(r.n);
          const rd = isqrt(r.d);
          if (rn !== undefined && rd !== undefined) {
            return num(rn, rd);
          }
        }
        if (e.name === "abs") {
          return numR(rAbs(r));
        }
        if (rIsZero(r) && (e.name === "sin" || e.name === "tan")) {
          return num(0);
        }
        if (rIsZero(r) && (e.name === "cos" || e.name === "exp")) {
          return num(1);
        }
        if (rIsOne(r) && e.name === "ln") {
          return num(0);
        }
      }
      if (e.name === "ln" && arg.k === "const" && arg.name === "e") {
        return num(1);
      }
      if (e.name === "abs" && (arg.k === "const" || (arg.k === "fn" && (arg.name === "sqrt" || arg.name === "exp" || arg.name === "abs")))) {
        return arg;
      }
      if (e.name === "exp" && arg.k === "fn" && arg.name === "ln") {
        return arg.arg;
      }
      if (e.name === "sin" || e.name === "cos") {
        const exact = exactTrig(e.name, arg);
        if (exact) {
          return exact;
        }
      }
      return fn(e.name, arg);
    }
    case "deriv":
      return deriv(simplify(e.arg), e.v);
    case "pow": {
      const base = simplify(e.base);
      const exp = simplify(e.exp);
      const folded = asRational(pow(base, exp));
      if (folded) {
        return numR(folded);
      }
      if (isNumValue(exp, 1)) {
        return base;
      }
      if (isNumValue(exp, 0)) {
        return num(1);
      }
      if (isNumValue(base, 1)) {
        return num(1);
      }
      // Exact rational powers of perfect powers: 4^(3/2) = 8, 0^(3/2) = 0, 8^(1/3) = 2.
      if (base.k === "num" && exp.k === "num" && exp.v.d >= 2 && exp.v.d <= 4 && base.v.n >= 0) {
        const root = (value: number, q: number): number | undefined => {
          const candidate = Math.round(value ** (1 / q));
          return candidate ** q === value ? candidate : undefined;
        };
        const rn = root(base.v.n, exp.v.d);
        const rd = root(base.v.d, exp.v.d);
        if (rn !== undefined && rd !== undefined && Math.abs(exp.v.n) <= 12) {
          return numR(rPowInt(rat(rn, rd), exp.v.n));
        }
      }
      if (base.k === "pow") {
        return simplify(pow(base.base, mul(base.exp, exp)));
      }
      return pow(base, exp);
    }
    case "div": {
      const n = simplify(e.num);
      const d = simplify(e.den);
      const folded = asRational(div(n, d));
      if (folded) {
        return numR(folded);
      }
      if (isNumValue(d, 1)) {
        return n;
      }
      if (isNumValue(n, 0)) {
        return num(0);
      }
      if (n.k === "neg") {
        return simplify(neg(div(n.arg, d)));
      }
      // Pull a rational coefficient out: (3x)/2 → (3/2)x
      const dr = asRational(d);
      if (dr) {
        return simplify(mul(numR(rDiv(rat(1), dr)), n));
      }
      return div(n, d);
    }
    case "mul": {
      const factors: Expr[] = [];
      let coef = rat(1);
      const pushFactor = (f: Expr) => {
        if (f.k === "mul") {
          f.factors.forEach(pushFactor);
          return;
        }
        const r = asRational(f);
        if (r) {
          coef = rMul(coef, r);
          return;
        }
        if (f.k === "neg") {
          coef = rNeg(coef);
          pushFactor(f.arg);
          return;
        }
        factors.push(f);
      };
      e.factors.map(simplify).forEach(pushFactor);
      if (rIsZero(coef)) {
        return num(0);
      }
      // Combine equal bases: x * x^2 → x^3
      const merged: Expr[] = [];
      for (const f of factors) {
        const base = f.k === "pow" ? f.base : f;
        const exp = f.k === "pow" ? f.exp : num(1);
        const index = merged.findIndex((m) => exprEquals(m.k === "pow" ? m.base : m, base));
        if (index === -1) {
          merged.push(f);
        } else {
          const m = merged[index];
          const mexp = m.k === "pow" ? m.exp : num(1);
          merged[index] = simplify(pow(base, add(mexp, exp)));
        }
      }
      const sorted = sortFactors(merged.filter((f) => !isNumValue(f, 1)));
      if (sorted.length === 0) {
        return numR(coef);
      }
      // Fold fractions into one: 3 · (1/cos²x) · y → (3y)/cos²x
      if (sorted.some((f) => f.k === "div")) {
        const numerators: Expr[] = [];
        const denominators: Expr[] = [];
        for (const f of sorted) {
          if (f.k === "div") {
            numerators.push(f.num);
            denominators.push(f.den);
          } else {
            numerators.push(f);
          }
        }
        const numerator = simplify(mul(numR(coef), ...numerators));
        const denominator = simplify(mul(...denominators));
        const dr = asRational(denominator);
        if (dr) {
          return simplify(mul(numR(rDiv(rat(1), dr)), numerator));
        }
        return div(numerator, denominator);
      }
      if (rIsOne(coef)) {
        return mul(...sorted);
      }
      if (coef.n === -1 && coef.d === 1) {
        return neg(mul(...sorted));
      }
      return mul(numR(coef), ...sorted);
    }
    case "add": {
      const groups = new Map<string, { coef: Rational; rest: Expr[] }>();
      let constantPart = rat(0);
      const pushTerm = (t: Expr) => {
        if (t.k === "add") {
          t.terms.forEach(pushTerm);
          return;
        }
        const { coef, rest } = splitCoefficient(t);
        if (rest.length === 0) {
          constantPart = rAdd(constantPart, coef);
          return;
        }
        const key = termKey(rest);
        const existing = groups.get(key);
        if (existing) {
          existing.coef = rAdd(existing.coef, coef);
        } else {
          groups.set(key, { coef, rest });
        }
      };
      e.terms.map(simplify).forEach(pushTerm);
      const terms: Expr[] = [];
      const ordered = [...groups.values()]
        .filter((g) => !rIsZero(g.coef))
        .sort((a, b) => termOrder(a.rest) - termOrder(b.rest));
      for (const group of ordered) {
        const body = group.rest.length === 1 ? group.rest[0] : mul(...sortFactors(group.rest));
        if (rIsOne(group.coef)) {
          terms.push(body);
        } else if (group.coef.n === -1 && group.coef.d === 1) {
          terms.push(neg(body));
        } else {
          terms.push(mul(numR(group.coef), ...(body.k === "mul" ? body.factors : [body])));
        }
      }
      if (!rIsZero(constantPart) || terms.length === 0) {
        terms.push(numR(constantPart));
      }
      return add(...terms);
    }
  }
}

// ---------------------------------------------------------------------------
// Polynomials with rational coefficients
// ---------------------------------------------------------------------------

/** Coefficients indexed by degree. */
export type Polynomial = Rational[];

function polyAdd(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    out.push(rAdd(a[i] ?? rat(0), b[i] ?? rat(0)));
  }
  return polyTrim(out);
}

function polyMul(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = Array.from({ length: a.length + b.length - 1 }, () => rat(0));
  a.forEach((ca, i) => {
    b.forEach((cb, j) => {
      out[i + j] = rAdd(out[i + j], rMul(ca, cb));
    });
  });
  return polyTrim(out);
}

function polyScale(a: Polynomial, s: Rational): Polynomial {
  return polyTrim(a.map((c) => rMul(c, s)));
}

function polyTrim(a: Polynomial): Polynomial {
  const out = [...a];
  while (out.length > 1 && rIsZero(out[out.length - 1])) {
    out.pop();
  }
  return out.length ? out : [rat(0)];
}

export function polyDegree(p: Polynomial): number {
  const trimmed = polyTrim(p);
  return trimmed.length === 1 && rIsZero(trimmed[0]) ? -1 : trimmed.length - 1;
}

/** Expands an expression into a polynomial in `v`, or returns undefined if it isn't one. */
export function toPolynomial(e: Expr, v: string): Polynomial | undefined {
  switch (e.k) {
    case "num":
      return [e.v];
    case "const":
      return undefined;
    case "var":
      return e.name === v ? [rat(0), rat(1)] : undefined;
    case "neg": {
      const inner = toPolynomial(e.arg, v);
      return inner ? polyScale(inner, rat(-1)) : undefined;
    }
    case "add": {
      let acc: Polynomial = [rat(0)];
      for (const t of e.terms) {
        const p = toPolynomial(t, v);
        if (!p) {
          return undefined;
        }
        acc = polyAdd(acc, p);
      }
      return acc;
    }
    case "mul": {
      let acc: Polynomial = [rat(1)];
      for (const f of e.factors) {
        const p = toPolynomial(f, v);
        if (!p) {
          return undefined;
        }
        acc = polyMul(acc, p);
      }
      return acc;
    }
    case "div": {
      const n = toPolynomial(e.num, v);
      const d = asRational(e.den);
      return n && d && !rIsZero(d) ? polyScale(n, rDiv(rat(1), d)) : undefined;
    }
    case "pow": {
      const base = toPolynomial(e.base, v);
      const exp = asRational(e.exp);
      if (!base || !exp || !rIsInt(exp) || exp.n < 0 || exp.n > 12) {
        return undefined;
      }
      let acc: Polynomial = [rat(1)];
      for (let i = 0; i < exp.n; i += 1) {
        acc = polyMul(acc, base);
      }
      return acc;
    }
    default:
      return undefined;
  }
}

export function polynomialToExpr(p: Polynomial, v: string): Expr {
  const terms: Expr[] = [];
  for (let degree = p.length - 1; degree >= 0; degree -= 1) {
    const c = p[degree];
    if (rIsZero(c)) {
      continue;
    }
    const power = degree === 0 ? undefined : degree === 1 ? variable(v) : pow(variable(v), num(degree));
    if (!power) {
      terms.push(numR(c));
    } else if (rIsOne(c)) {
      terms.push(power);
    } else if (c.n === -1 && c.d === 1) {
      terms.push(neg(power));
    } else {
      terms.push(mul(numR(c), power));
    }
  }
  return terms.length ? add(...terms) : num(0);
}

/** Linear form a·v + b with rational coefficients, if the expression is linear in v. */
export function toLinear(e: Expr, v: string): { a: Rational; b: Rational } | undefined {
  const p = toPolynomial(e, v);
  if (!p || polyDegree(p) > 1) {
    return undefined;
  }
  return { a: p[1] ?? rat(0), b: p[0] ?? rat(0) };
}

// ---------------------------------------------------------------------------
// Distribution (one expansion step at a time, for readable algebra)
// ---------------------------------------------------------------------------

/** Distributes rational coefficients over sums: 3(x - 2) → 3x - 6. Leaves other structure alone. */
export function distribute(e: Expr): Expr {
  switch (e.k) {
    case "mul": {
      const factors = e.factors.map(distribute);
      const sumIndex = factors.findIndex((f) => f.k === "add");
      if (sumIndex !== -1) {
        const others = factors.filter((_, i) => i !== sumIndex);
        const sum = factors[sumIndex] as { k: "add"; terms: Expr[] };
        if (others.every((f) => asRational(f) !== undefined)) {
          const coef = others.reduce((acc, f) => rMul(acc, asRational(f) as Rational), rat(1));
          return add(...sum.terms.map((t) => simplifyTermCoefficient(mul(numR(coef), t))));
        }
      }
      return mul(...factors);
    }
    case "neg": {
      const inner = distribute(e.arg);
      if (inner.k === "add") {
        return add(...inner.terms.map((t) => simplifyTermCoefficient(neg(t))));
      }
      return neg(inner);
    }
    case "add":
      return add(
        ...e.terms.flatMap((t) => {
          const d = distribute(t);
          return d.k === "add" ? d.terms : [d];
        }),
      );
    case "div":
      return div(distribute(e.num), distribute(e.den));
    default:
      return e;
  }
}

/** Folds numeric coefficients in a single term without touching structure: 3·(−2) → −6, 3·2x → 6x. */
export function simplifyTermCoefficient(t: Expr): Expr {
  const { coef, rest } = splitCoefficient(t);
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
  return mul(numR(coef), ...(body.k === "mul" ? body.factors : [body]));
}

// ---------------------------------------------------------------------------
// Surds: sqrt of a rational in simplest form
// ---------------------------------------------------------------------------

/** Writes sqrt(r) for r ≥ 0 as (coef)·sqrt(radicand) with an integer radicand free of square factors. */
export function simplifySqrt(r: Rational): { coef: Rational; radicand: number } {
  if (r.n < 0) {
    throw new Error("Negative radicand");
  }
  // sqrt(n/d) = sqrt(n·d)/d
  let radicand = r.n * r.d;
  let coef = rat(1, r.d);
  let factor = 2;
  while (factor * factor <= radicand) {
    while (radicand % (factor * factor) === 0) {
      radicand /= factor * factor;
      coef = rMul(coef, rat(factor));
    }
    factor += 1;
  }
  return { coef, radicand };
}
