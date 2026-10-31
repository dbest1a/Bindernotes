/**
 * Honest, local verification of worked-solution steps with the Cortex Compute Engine.
 *
 * This module is pure logic shared by the Web Worker and the main-thread fallback.
 * It never marks a step "verified" without numeric evidence:
 *
 * - Identities (A = B with free variables) are evaluated at random points.
 * - Pure numeric equalities (integrals, sums, arithmetic) are evaluated directly.
 * - Consecutive equations that are *not* identities (x² − 5x + 6 = 0 → (x−2)(x−3) = 0 → x = 2 or x = 3)
 *   are treated as a chain of conditions; a line is verified when its left−right
 *   difference is a constant multiple of the previous line's (same solution set),
 *   checked at random points, or when the final answer is substituted back.
 * - Prose, inequalities, chemistry and anything the engine can't evaluate stay "unchecked"
 *   with a plain-language reason.
 */

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { StepCheck } from "./solution-types";

/** The boxed expression type is not re-exported by the package root in 0.175, so derive it. */
type BoxedExpression = NonNullable<ReturnType<ComputeEngine["parse"]>>;

/** Operands of a function expression (undefined for symbols and numbers). */
function opsOf(expr: BoxedExpression): readonly BoxedExpression[] | undefined {
  const ops = (expr as unknown as { ops?: readonly BoxedExpression[] | null }).ops;
  return ops ?? undefined;
}

/** The name of a symbol expression, or undefined for anything else. */
function symbolOf(expr: BoxedExpression): string | undefined {
  const symbol = (expr as unknown as { symbol?: string | null }).symbol;
  return typeof symbol === "string" && symbol.length > 0 ? symbol : undefined;
}

export type CheckOptions = {
  /** Time budget per step in milliseconds. */
  stepBudgetMs?: number;
  /** Clock used for the time box (injectable for tests). */
  now?: () => number;
  /** Seed for the deterministic sample points. */
  seed?: number;
};

const DEFAULT_STEP_BUDGET_MS = 500;
const RELATIVE_TOLERANCE = 1e-8;
const CLEAR_MISMATCH_TOLERANCE = 1e-6;
/** Lines written with ≈ are accepted when they agree to about four significant figures. */
const APPROX_TOLERANCE = 5e-4;
const MIN_VALID_POINTS = 4;

type Complex = { re: number; im: number };

type SamplePoint = Record<string, number>;

type InequalityOperator = "Less" | "LessEqual" | "Greater" | "GreaterEqual" | "NotEqual";

const INEQUALITY_SYMBOLS: Record<InequalityOperator, string> = {
  Less: "<",
  LessEqual: "≤",
  Greater: ">",
  GreaterEqual: "≥",
  NotEqual: "≠",
};

function isInequalityOperator(operator: string): operator is InequalityOperator {
  return Object.hasOwn(INEQUALITY_SYMBOLS, operator);
}

type Classified =
  | { kind: "empty" }
  | { kind: "prose" }
  | { kind: "chemistry" }
  | { kind: "matrix" }
  | { kind: "unreadable"; reason: string }
  | { kind: "inequality"; expr: BoxedExpression; op: InequalityOperator; latex: string }
  | { kind: "expression"; expr: BoxedExpression }
  | {
      kind: "equation";
      expr: BoxedExpression;
      chains: BoxedExpression[][];
      connective: "single" | "or" | "and";
      /** The line used ≈, so the comparison tolerates rounding to about 4 significant figures. */
      approximate?: boolean;
    }
  | { kind: "implication"; parts: Classified[] };

type Condition = {
  /** Factors whose product is zero exactly on the solution set. */
  factors: BoxedExpression[];
  vars: string[];
  stepIndex: number;
};

type Assignment = Record<string, Complex>;

type PairResult =
  | { kind: "agree"; vars: string[]; points: number; sample?: SamplePoint; value?: Complex }
  | { kind: "disagree"; vars: string[]; sample?: SamplePoint; left: Complex; right: Complex }
  | { kind: "close"; vars: string[] }
  | { kind: "undecidable"; reason: string }
  | { kind: "timeout" };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_RANGES: Array<[number, number]> = [
  [-1, 1],
  [-6, 6],
  [0.05, 4],
  [-40, 40],
];

const EXTRA_POSITIVE_RANGE: [number, number] = [0.05, 20];

function samplePoints(vars: string[], random: () => number, extraPositive = false): SamplePoint[] {
  const points: SamplePoint[] = [];
  const ranges = extraPositive ? [EXTRA_POSITIVE_RANGE, EXTRA_POSITIVE_RANGE, EXTRA_POSITIVE_RANGE, EXTRA_POSITIVE_RANGE] : SAMPLE_RANGES;
  for (const [lo, hi] of ranges) {
    for (let i = 0; i < 2; i += 1) {
      const point: SamplePoint = {};
      for (const name of vars) {
        // Avoid suspiciously round values and exact zero.
        let value = lo + (hi - lo) * random();
        if (Math.abs(value) < 1e-3) {
          value += 0.137;
        }
        point[name] = value;
      }
      points.push(point);
    }
  }
  return points;
}

function magnitude(c: Complex): number {
  return Math.hypot(c.re, c.im);
}

function complexSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

function approxEqual(a: Complex, b: Complex, tolerance = RELATIVE_TOLERANCE): boolean {
  const scale = Math.max(1, magnitude(a), magnitude(b));
  return magnitude(complexSub(a, b)) <= tolerance * scale;
}

function clearlyDifferent(a: Complex, b: Complex): boolean {
  const scale = Math.max(1, magnitude(a), magnitude(b));
  return magnitude(complexSub(a, b)) > CLEAR_MISMATCH_TOLERANCE * scale;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Math.abs(value) < 1e-12) {
    return "0";
  }
  const rounded = Number(value.toPrecision(6));
  return String(rounded);
}

export function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-9 * Math.max(1, Math.abs(c.re))) {
    return formatNumber(c.re);
  }
  if (Math.abs(c.re) < 1e-12) {
    return `${formatNumber(c.im)}i`;
  }
  const sign = c.im < 0 ? "−" : "+";
  return `${formatNumber(c.re)} ${sign} ${formatNumber(Math.abs(c.im))}i`;
}

function formatPoint(point: SamplePoint): string {
  return Object.entries(point)
    .map(([name, value]) => `${name} = ${formatNumber(value)}`)
    .join(", ");
}

function formatAssignment(assignment: Assignment): string {
  return Object.entries(assignment)
    .map(([name, value]) => `${name} = ${formatComplex(value)}`)
    .join(", ");
}

const KNOWN_WORDS = new Set([
  "sin", "cos", "tan", "sec", "csc", "cot", "ln", "log", "exp", "sqrt", "det", "lim", "max", "min",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "mod", "and", "or",
]);

/** Heuristic: a run of three or more plain letters that isn't a math function is prose. */
export function looksLikeProse(latex: string): boolean {
  const withoutCommands = latex
    .replace(/\\text\s*\{\s*(or|and)\s*\}/gi, " ")
    .replace(/\\(?:operatorname|mathrm|mathit|mathbf)\{[^{}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ");
  if (/\\text\s*\{/.test(latex) && /\\text\s*\{[^}]*[a-zA-Z]{3,}[^}]*\}/.test(withoutCommands) && !/=/.test(latex)) {
    return true;
  }
  const words = withoutCommands.match(/[a-zA-Z]{3,}/g) ?? [];
  return words.some((word) => !KNOWN_WORDS.has(word.toLowerCase()));
}

const CALCULUS_PATTERN = /\\frac\s*\{\s*(?:\\mathrm\{)?d(?:\})?\s*\}|\\int|\\sum|\\prod|\\lim|\\partial|\\mathrm\{d\}/;

/** Normalises connective spellings so the engine sees \lor / \land. */
export function normaliseLatex(raw: string): string {
  return raw
    .replace(/\\displaystyle|\\quad|\\qquad|\\;|\\:|\\!|~/g, " ")
    .replace(/\\text\s*\{\s*or\s*\}|\\vee|\\lor|\\mathrm\{or\}|\\textrm\{or\}|\\mbox\{or\}/gi, " \\lor ")
    .replace(/\\text\s*\{\s*and\s*\}|\\wedge|\\land|\\mathrm\{and\}/gi, " \\land ")
    .replace(/\\left\s*\[/g, "\\left(")
    .replace(/\\right\s*\]/g, "\\right)")
    .trim();
}

/** Expands the first ± (or ∓) into an explicit "or" of two alternatives. */
export function expandPlusMinus(latex: string): string | undefined {
  const count = (latex.match(/\\pm|\\mp/g) ?? []).length;
  if (count === 0) {
    return latex;
  }
  if (count > 1) {
    return undefined;
  }
  const plus = latex.replace(/\\pm/, "+").replace(/\\mp/, "-");
  const minus = latex.replace(/\\pm/, "-").replace(/\\mp/, "+");
  return `${plus} \\lor ${minus}`;
}

const IMPLICATION_SPLIT = /\\implies|\\Longrightarrow|\\Rightarrow|\\iff|\\Leftrightarrow|\\Longleftrightarrow|\\therefore|\\to\b|\\rightarrow\b/;

// ---------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------

export class SolutionChecker implements Iterator<StepCheck> {
  private readonly budget: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly classified: Classified[];
  private readonly finalSolutions: Assignment[] | undefined;
  private readonly givenUnits: Condition[] = [];
  private readonly expectedGivenCount: number;
  private previousCondition: Condition | undefined;
  private lastExpression: BoxedExpression | undefined;
  private index = 0;
  private deadline = 0;

  constructor(
    private readonly ce: ComputeEngine,
    private readonly maths: string[],
    options: CheckOptions = {},
  ) {
    this.budget = options.stepBudgetMs ?? DEFAULT_STEP_BUDGET_MS;
    this.now = options.now ?? (() => Date.now());
    this.random = mulberry32(options.seed ?? 20261031);
    this.classified = [];
    let previous: BoxedExpression | undefined;
    for (const math of maths) {
      const classified = this.classify(math, previous);
      this.classified.push(classified);
      previous = lastExpressionOf(classified) ?? previous;
    }
    this.finalSolutions = this.findFinalSolutions();
    const solutionVars = this.finalSolutions?.[0] ? Object.keys(this.finalSolutions[0]).length : 1;
    this.expectedGivenCount = Math.max(1, solutionVars);
  }

  [Symbol.iterator](): Iterator<StepCheck> {
    return this;
  }

  get length(): number {
    return this.maths.length;
  }

  next(): IteratorResult<StepCheck> {
    if (this.index >= this.maths.length) {
      return { done: true, value: undefined };
    }
    const stepIndex = this.index;
    this.index += 1;
    this.deadline = this.now() + this.budget;
    let check: StepCheck;
    try {
      check = this.checkClassified(this.classified[stepIndex], stepIndex);
    } catch (error) {
      check = {
        status: "error",
        method: "engine",
        detail: `The math engine couldn't process this step${error instanceof Error && error.message ? ` (${error.message.slice(0, 120)})` : ""}.`,
      };
    }
    return { done: false, value: check };
  }

  // ----- classification ----------------------------------------------------

  private classify(raw: string, previous: BoxedExpression | undefined): Classified {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { kind: "empty" };
    }
    if (/\\ce\s*\{/.test(trimmed)) {
      return { kind: "chemistry" };
    }
    if (/\\begin\s*\{\s*[pbvB]?matrix\s*\}|\\det\b/.test(trimmed)) {
      return { kind: "matrix" };
    }
    if (IMPLICATION_SPLIT.test(trimmed)) {
      const parts: Classified[] = [];
      let prev = previous;
      for (const segment of trimmed.split(IMPLICATION_SPLIT)) {
        const classified = this.classify(segment, prev);
        parts.push(classified);
        prev = lastExpressionOf(classified) ?? prev;
      }
      return { kind: "implication", parts };
    }
    let latex = normaliseLatex(trimmed);
    if (looksLikeProse(latex)) {
      return { kind: "prose" };
    }
    if (latex.startsWith("=")) {
      if (!previous) {
        return { kind: "unreadable", reason: "This line starts with “=” but there is no earlier expression to continue from." };
      }
      latex = `${previous.latex} ${latex}`;
    }
    const expanded = expandPlusMinus(latex);
    if (expanded === undefined) {
      return { kind: "unreadable", reason: "Lines with more than one ± sign can't be checked yet." };
    }
    latex = expanded;
    const approximate = /\\approx/.test(latex);
    if (approximate) {
      latex = latex.replace(/\\approx/g, "=");
    }

    let expr: BoxedExpression;
    try {
      expr = this.ce.parse(latex);
    } catch {
      return { kind: "unreadable", reason: "Couldn't read this line as math." };
    }
    if (!expr.isValid) {
      return { kind: "unreadable", reason: "Couldn't read this line as math (check the LaTeX)." };
    }
    const op = expr.operator;
    if (op === "Less" || op === "LessEqual" || op === "Greater" || op === "GreaterEqual" || op === "NotEqual") {
      return { kind: "inequality", expr, op, latex };
    }
    if (op === "Equal") {
      return { kind: "equation", expr, chains: [[...(opsOf(expr) ?? [])]], connective: "single", approximate };
    }
    const branches = opsOf(expr);
    if ((op === "Or" || op === "And" || op === "Tuple" || op === "Sequence" || op === "List") && branches && branches.length > 0) {
      if (branches.every((branch) => branch.operator === "Equal" && (opsOf(branch)?.length ?? 0) >= 2)) {
        return {
          kind: "equation",
          expr,
          chains: branches.map((branch) => [...(opsOf(branch) ?? [])]),
          connective: op === "Or" ? "or" : "and",
          approximate,
        };
      }
      return { kind: "unreadable", reason: "Only equations joined with “or” / “and” can be checked." };
    }
    return { kind: "expression", expr };
  }

  // ----- final answer discovery -------------------------------------------

  private findFinalSolutions(): Assignment[] | undefined {
    for (let i = this.classified.length - 1; i >= 0; i -= 1) {
      const item = this.classified[i];
      const candidates = item.kind === "implication" ? [...item.parts].reverse() : [item];
      for (const candidate of candidates) {
        if (candidate.kind !== "equation") {
          continue;
        }
        const assignments = this.solutionsFromEquation(candidate);
        if (assignments) {
          return assignments;
        }
      }
      if (item.kind === "equation" || item.kind === "implication") {
        return undefined;
      }
    }
    return undefined;
  }

  /** Reads "x = 2", "x = 2 or x = 3", "x = 1 and y = 2" into assignments. */
  private solutionsFromEquation(item: Extract<Classified, { kind: "equation" }>): Assignment[] | undefined {
    const parsed: Array<{ name: string; value: Complex }> = [];
    for (const chain of item.chains) {
      if (chain.length !== 2) {
        return undefined;
      }
      const [lhs, rhs] = chain;
      const lhsSymbol = symbolOf(lhs);
      const rhsSymbol = symbolOf(rhs);
      let name: string | undefined;
      let valueExpr: BoxedExpression | undefined;
      if (lhsSymbol && rhs.unknowns.length === 0) {
        name = lhsSymbol;
        valueExpr = rhs;
      } else if (rhsSymbol && lhs.unknowns.length === 0) {
        name = rhsSymbol;
        valueExpr = lhs;
      }
      if (!name || !valueExpr) {
        return undefined;
      }
      const value = this.toComplex(valueExpr);
      if (!value) {
        return undefined;
      }
      parsed.push({ name, value });
    }
    if (parsed.length === 0) {
      return undefined;
    }
    if (item.connective === "and") {
      const assignment: Assignment = {};
      for (const entry of parsed) {
        assignment[entry.name] = entry.value;
      }
      return [assignment];
    }
    return parsed.map((entry) => ({ [entry.name]: entry.value }));
  }

  // ----- evaluation --------------------------------------------------------

  private timedOut(): boolean {
    return this.now() > this.deadline;
  }

  private toComplex(expr: BoxedExpression): Complex | undefined {
    const numeric = expr.N();
    const re = numeric.re;
    const im = numeric.im;
    if (typeof re !== "number" || !Number.isFinite(re)) {
      return undefined;
    }
    return { re, im: typeof im === "number" && Number.isFinite(im) ? im : 0 };
  }

  private prepare(expr: BoxedExpression): BoxedExpression {
    try {
      return expr.evaluate();
    } catch {
      return expr;
    }
  }

  private evaluateAt(expr: BoxedExpression, point: Record<string, number | Complex>): Complex | undefined {
    try {
      const substitution: Record<string, number | BoxedExpression> = {};
      for (const [name, value] of Object.entries(point)) {
        substitution[name] = typeof value === "number" ? value : this.ce.number({ re: value.re, im: value.im });
      }
      return this.toComplex(expr.subs(substitution));
    } catch {
      return undefined;
    }
  }

  private comparePair(left: BoxedExpression, right: BoxedExpression, tolerance = RELATIVE_TOLERANCE): PairResult {
    const vars = [...new Set([...left.unknowns, ...right.unknowns])].sort();
    const preparedLeft = this.prepare(left);
    const preparedRight = this.prepare(right);
    if (this.timedOut()) {
      return { kind: "timeout" };
    }
    const differ = (a: Complex, b: Complex) => (tolerance > CLEAR_MISMATCH_TOLERANCE ? !approxEqual(a, b, tolerance) : clearlyDifferent(a, b));
    if (vars.length === 0) {
      const a = this.toComplex(preparedLeft);
      const b = this.toComplex(preparedRight);
      if (!a || !b) {
        return { kind: "undecidable", reason: "Couldn't evaluate both sides numerically." };
      }
      if (approxEqual(a, b, tolerance)) {
        return { kind: "agree", vars, points: 1, value: a };
      }
      if (differ(a, b)) {
        return { kind: "disagree", vars, left: a, right: b };
      }
      return { kind: "close", vars };
    }

    let valid = 0;
    let sample: SamplePoint | undefined;
    let close = false;
    const tryPoints = (points: SamplePoint[]): PairResult | undefined => {
      for (const point of points) {
        if (this.timedOut()) {
          return { kind: "timeout" };
        }
        const a = this.evaluateAt(preparedLeft, point);
        const b = this.evaluateAt(preparedRight, point);
        if (!a || !b) {
          continue;
        }
        valid += 1;
        sample = sample ?? point;
        if (approxEqual(a, b, tolerance)) {
          continue;
        }
        if (differ(a, b)) {
          return { kind: "disagree", vars, sample: point, left: a, right: b };
        }
        close = true;
      }
      return undefined;
    };
    const first = tryPoints(samplePoints(vars, this.random));
    if (first) {
      return first;
    }
    if (valid < MIN_VALID_POINTS) {
      const second = tryPoints(samplePoints(vars, this.random, true));
      if (second) {
        return second;
      }
    }
    if (valid < MIN_VALID_POINTS) {
      return {
        kind: "undecidable",
        reason:
          valid === 0
            ? `Couldn't evaluate both sides numerically (symbols: ${vars.join(", ")}).`
            : `Couldn't evaluate both sides at enough points (only ${valid} worked; ${MIN_VALID_POINTS} are needed).`,
      };
    }
    if (close) {
      return { kind: "close", vars };
    }
    return { kind: "agree", vars, points: valid, sample };
  }

  // ----- step logic ----------------------------------------------------------

  private checkClassified(item: Classified, stepIndex: number): StepCheck {
    switch (item.kind) {
      case "empty":
        return { status: "unchecked", method: "empty", detail: "This step is empty." };
      case "prose":
        return { status: "unchecked", method: "prose", detail: "This looks like text, not an equation, so there is nothing to check." };
      case "chemistry":
        return { status: "unchecked", method: "chemistry", detail: "Chemical equations can't be checked yet." };
      case "matrix":
        return {
          status: "unchecked",
          method: "matrix",
          detail: "Matrix and determinant notation can't be checked yet. Lines of plain arithmetic are checked.",
        };
      case "inequality":
        return this.checkInequality(item);
      case "unreadable":
        return { status: "unchecked", method: "unreadable", detail: item.reason };
      case "expression":
        this.lastExpression = item.expr;
        return { status: "unchecked", method: "expression", detail: "No equals sign to check. Start the next line with “=” to continue this expression." };
      case "implication": {
        const checks = item.parts.map((part) => this.checkClassified(part, stepIndex));
        const informative = checks.filter((check) => check.method !== "given");
        const pool = informative.length > 0 ? informative : checks;
        let worst: StepCheck | undefined;
        for (const check of pool) {
          worst = worst ? worse(worst, check) : check;
        }
        return worst ?? { status: "unchecked", method: "empty", detail: "This step is empty." };
      }
      case "equation":
        return this.checkEquation(item, stepIndex);
    }
  }

  /** Comparisons of plain numbers (1.5 > 1.3739, a chain like 0 < 0.2 ≤ 1) are checked; with variables they are not. */
  private checkInequality(item: Extract<Classified, { kind: "inequality" }>): StepCheck {
    // The canonical form turns a > b into b < a; report the sides in the order they were written.
    let op = item.op;
    let operands = opsOf(item.expr) ?? [];
    try {
      const written = this.ce.parse(item.latex, { form: "raw" });
      const writtenOperands = opsOf(written);
      if (isInequalityOperator(written.operator) && writtenOperands && writtenOperands.length >= 2) {
        op = written.operator;
        operands = writtenOperands.map((operand) => operand.canonical);
      }
    } catch {
      // Keep the canonical order.
    }
    if (operands.length < 2 || operands.some((operand) => operand.unknowns.length > 0)) {
      return {
        status: "unchecked",
        method: "inequality",
        detail: "Inequalities with variables can't be checked yet. Lines comparing numbers are checked.",
      };
    }
    const values: number[] = [];
    for (const operand of operands) {
      const value = this.toComplex(this.prepare(operand));
      if (!value || Math.abs(value.im) > RELATIVE_TOLERANCE * Math.max(1, Math.abs(value.re))) {
        return { status: "unchecked", method: "inequality", detail: "Couldn't evaluate both sides as real numbers." };
      }
      values.push(value.re);
    }
    const symbol = INEQUALITY_SYMBOLS[op];
    const shown = values.map(formatNumber).join(` ${symbol} `);
    for (let index = 0; index + 1 < values.length; index += 1) {
      const left = values[index];
      const right = values[index + 1];
      const scale = Math.max(1, Math.abs(left), Math.abs(right));
      // Positive when the relation holds with room to spare.
      const margin = op === "Less" || op === "LessEqual" ? right - left : op === "NotEqual" ? Math.abs(right - left) : left - right;
      const strict = op === "Less" || op === "Greater" || op === "NotEqual";
      if (margin > RELATIVE_TOLERANCE * scale || (!strict && margin >= -RELATIVE_TOLERANCE * scale)) {
        continue;
      }
      if (op !== "NotEqual" && margin < -CLEAR_MISMATCH_TOLERANCE * scale) {
        return { status: "mismatch", method: "inequality", detail: `Left ≈ ${formatNumber(left)}, right ≈ ${formatNumber(right)}, so ${symbol} doesn't hold.` };
      }
      return { status: "unchecked", method: "inequality", detail: `The two sides are too close to tell (≈ ${formatNumber(left)}).` };
    }
    return { status: "verified", method: "inequality", detail: `The numbers compare as written: ${shown}.` };
  }

  private checkEquation(item: Extract<Classified, { kind: "equation" }>, stepIndex: number): StepCheck {
    const raw = this.maths[stepIndex] ?? "";
    const isCalculus = CALCULUS_PATTERN.test(raw);
    const conditionFactors: BoxedExpression[] = [];
    const vars = new Set<string>();
    let identityPoints = 0;
    let identityVars: string[] = [];
    let sample: SamplePoint | undefined;
    let numericValue: Complex | undefined;
    let pairsChecked = 0;

    const tolerance = item.approximate ? APPROX_TOLERANCE : RELATIVE_TOLERANCE;
    for (const chain of item.chains) {
      this.lastExpression = chain[chain.length - 1];
      for (let i = 0; i + 1 < chain.length; i += 1) {
        const left = chain[i];
        const right = chain[i + 1];
        const result = this.comparePair(left, right, tolerance);
        pairsChecked += 1;
        switch (result.kind) {
          case "timeout":
            return { status: "error", method: "timeout", detail: `Checking this step took longer than ${this.budget} ms, so it was stopped.` };
          case "undecidable":
            return { status: "unchecked", method: "unevaluable", detail: result.reason };
          case "close":
            return { status: "unchecked", method: "rounding", detail: "The two sides differ by a tiny amount, probably rounding. Can't confirm they are equal." };
          case "agree":
            identityPoints = Math.max(identityPoints, result.points);
            identityVars = result.vars.length > identityVars.length ? result.vars : identityVars;
            sample = sample ?? result.sample;
            numericValue = numericValue ?? result.value;
            break;
          case "disagree": {
            if (isCalculus || result.vars.length === 0) {
              return {
                status: "mismatch",
                method: result.vars.length === 0 ? "numeric" : "identity",
                detail: result.sample
                  ? `At ${formatPoint(result.sample)} the left side ≈ ${formatComplex(result.left)} but the right side ≈ ${formatComplex(result.right)}.`
                  : `Left ≈ ${formatComplex(result.left)}, right ≈ ${formatComplex(result.right)}.`,
              };
            }
            result.vars.forEach((v) => vars.add(v));
            conditionFactors.push(this.ce.box(["Subtract", left, right]));
            break;
          }
        }
      }
    }

    if (pairsChecked === 0) {
      return { status: "unchecked", method: "unreadable", detail: "Couldn't find two sides to compare." };
    }

    if (conditionFactors.length === 0) {
      // Everything agreed: an identity or a numeric equality.
      const rounding = item.approximate ? " (≈ accepted within rounding to about 4 significant figures)" : "";
      if (identityVars.length === 0) {
        return {
          status: "verified",
          method: item.approximate ? "approx" : "numeric",
          detail: numericValue
            ? `Both sides evaluate to ${formatComplex(numericValue)}${rounding}.`
            : `Both sides evaluate to the same number${rounding}.`,
        };
      }
      return {
        status: "verified",
        method: item.approximate ? "approx" : "identity",
        detail: `Both sides agree at ${identityPoints} random points (${identityVars.join(", ")} between −40 and 40)${rounding}.`,
      };
    }

    const condition: Condition = { factors: conditionFactors, vars: [...vars].sort(), stepIndex };
    return this.checkCondition(condition, item);
  }

  private checkCondition(condition: Condition, item: Extract<Classified, { kind: "equation" }>): StepCheck {
    const previous = this.previousCondition;
    this.previousCondition = condition;
    const isSolutionLine = this.solutionsFromEquation(item) !== undefined;

    // Multi-variable systems: the first N condition lines are the given equations.
    const needsMoreGiven = this.givenUnits.length < this.expectedGivenCount && !isSolutionLine;
    if (!previous || (needsMoreGiven && condition.vars.length > 1)) {
      this.givenUnits.push(condition);
      return { status: "unchecked", method: "given", detail: "Starting equation. Later lines are checked against it." };
    }

    // Single-variable chains: same solution set ⇔ constant non-zero ratio of the products.
    if (condition.vars.length <= 1 && previous.vars.length <= 1) {
      const ratio = this.ratioTest(previous, condition);
      if (ratio.kind === "timeout") {
        return { status: "error", method: "timeout", detail: `Checking this step took longer than ${this.budget} ms, so it was stopped.` };
      }
      if (ratio.kind === "constant") {
        const base = `Same solutions as the previous line: the two sides' difference is a constant multiple (×${formatComplex(ratio.ratio)}) of the previous one at ${ratio.points} random points.`;
        if (isSolutionLine) {
          const satisfied = this.checkSolutionsAgainstGiven();
          if (satisfied.kind === "fail") {
            return { status: "mismatch", method: "substitution", detail: satisfied.detail };
          }
          if (satisfied.kind === "pass") {
            return { status: "verified", method: "equivalent", detail: `${satisfied.detail} ${base}` };
          }
        }
        return { status: "verified", method: "equivalent", detail: base };
      }
      if (ratio.kind === "distinct") {
        return { status: "mismatch", method: "equivalent", detail: ratio.detail };
      }
    }

    // Fall back to substituting the final answer, when there is one.
    const systemMode = this.expectedGivenCount > 1;
    const substitution = this.substituteSolutions(condition);
    if (substitution.kind === "fail") {
      return { status: "mismatch", method: "substitution", detail: substitution.detail };
    }
    if (substitution.kind === "pass") {
      const given = this.checkSolutionsAgainstGiven();
      if (given.kind === "fail") {
        return { status: "mismatch", method: "substitution", detail: given.detail };
      }
      if (systemMode && given.kind === "pass") {
        // Systems: every line must hold at the final answer, and the answer must satisfy every given equation.
        return {
          status: "verified",
          method: "substitution",
          detail: isSolutionLine ? given.detail : `${substitution.detail} ${given.detail}`,
        };
      }
      if (isSolutionLine) {
        return {
          status: "unchecked",
          method: "partial",
          detail: `${given.kind === "pass" ? given.detail : substitution.detail} But I can't confirm these are the only solutions: the previous line might have more.`,
        };
      }
      return {
        status: "unchecked",
        method: "equivalence",
        detail: `${substitution.detail} But I can't confirm this line has exactly the same solutions as the previous one.`,
      };
    }
    return {
      status: "unchecked",
      method: "equivalence",
      detail: "Can't check this kind of step yet: I couldn't confirm it has the same solutions as the previous line.",
    };
  }

  private ratioTest(
    previous: Condition,
    current: Condition,
  ): { kind: "constant"; ratio: Complex; points: number } | { kind: "distinct"; detail: string } | { kind: "inconclusive" } | { kind: "timeout" } {
    const vars = [...new Set([...previous.vars, ...current.vars])].sort();
    if (vars.length === 0) {
      return { kind: "inconclusive" };
    }
    const prevProduct = this.prepare(this.ce.box(["Multiply", ...previous.factors]));
    const currProduct = this.prepare(this.ce.box(["Multiply", ...current.factors]));
    // Evaluate both products once per point; the ratio tests below reuse these values.
    const pairs: Array<{ point: SamplePoint; a: Complex; b: Complex }> = [];
    const collect = (samples: SamplePoint[]): string | undefined => {
      for (const point of samples) {
        if (this.timedOut()) {
          return "timeout";
        }
        const a = this.evaluateAt(prevProduct, point);
        const b = this.evaluateAt(currProduct, point);
        if (!a || !b) {
          continue;
        }
        const aZero = magnitude(a) < 1e-9;
        const bZero = magnitude(b) < 1e-9;
        if (aZero && bZero) {
          continue;
        }
        if (aZero !== bZero) {
          const where = formatPoint(point);
          return aZero ? `${where} solves the previous line but not this one.` : `${where} solves this line but not the previous one.`;
        }
        pairs.push({ point, a, b });
      }
      return undefined;
    };
    let outcome = collect(samplePoints(vars, this.random));
    if (outcome === undefined && pairs.length < MIN_VALID_POINTS) {
      outcome = collect(samplePoints(vars, this.random, true));
    }
    if (outcome === "timeout") {
      return { kind: "timeout" };
    }
    if (outcome !== undefined) {
      return { kind: "distinct", detail: outcome };
    }
    if (pairs.length < MIN_VALID_POINTS) {
      return { kind: "inconclusive" };
    }
    // f = c·g^k or f^k = c·g (k = 1, 2, 3) ⇒ identical zero sets. k = 1 is the plain equivalence test;
    // k = 2, 3 cover repeated roots such as (x − 3)² = 0 → x − 3 = 0.
    const complexPow = (z: Complex, k: number): Complex => {
      let out: Complex = { re: 1, im: 0 };
      for (let i = 0; i < k; i += 1) {
        out = { re: out.re * z.re - out.im * z.im, im: out.re * z.im + out.im * z.re };
      }
      return out;
    };
    const constantRatio = (transformA: (z: Complex) => Complex, transformB: (z: Complex) => Complex): Complex | undefined => {
      let ratio: Complex | undefined;
      for (const { a, b } of pairs) {
        const r = complexDiv(transformA(a), transformB(b));
        if (!Number.isFinite(r.re) || !Number.isFinite(r.im)) {
          return undefined;
        }
        if (!ratio) {
          ratio = r;
        } else if (!approxEqual(ratio, r, CLEAR_MISMATCH_TOLERANCE)) {
          return undefined;
        }
      }
      return ratio;
    };
    const identity = (z: Complex) => z;
    const plain = constantRatio(identity, identity);
    if (plain) {
      return { kind: "constant", ratio: plain, points: pairs.length };
    }
    for (const k of [2, 3]) {
      const powered = constantRatio(identity, (z) => complexPow(z, k)) ?? constantRatio((z) => complexPow(z, k), identity);
      if (powered) {
        return { kind: "constant", ratio: powered, points: pairs.length };
      }
    }
    return { kind: "inconclusive" };
  }

  private substituteSolutions(condition: Condition): { kind: "pass"; detail: string } | { kind: "fail"; detail: string } | { kind: "none" } {
    const solutions = this.finalSolutions;
    if (!solutions || solutions.length === 0) {
      return { kind: "none" };
    }
    const product = this.prepare(this.ce.box(["Multiply", ...condition.factors]));
    const described: string[] = [];
    for (const assignment of solutions) {
      if (!condition.vars.every((v) => v in assignment)) {
        return { kind: "none" };
      }
      const value = this.evaluateAt(product, assignment);
      if (!value) {
        return { kind: "none" };
      }
      const scale = Math.max(1, ...condition.vars.map((v) => magnitude(assignment[v])));
      if (magnitude(value) > CLEAR_MISMATCH_TOLERANCE * scale) {
        return {
          kind: "fail",
          detail: `${formatAssignment(assignment)} does not satisfy this line (left − right ≈ ${formatComplex(value)}).`,
        };
      }
      described.push(formatAssignment(assignment));
    }
    return { kind: "pass", detail: `Holds at the final answer (${described.join("; ")}) by substitution.` };
  }

  private checkSolutionsAgainstGiven(): { kind: "pass"; detail: string } | { kind: "fail"; detail: string } | { kind: "none" } {
    const solutions = this.finalSolutions;
    if (!solutions || solutions.length === 0 || this.givenUnits.length === 0) {
      return { kind: "none" };
    }
    for (const given of this.givenUnits) {
      const product = this.prepare(this.ce.box(["Multiply", ...given.factors]));
      for (const assignment of solutions) {
        if (!given.vars.every((v) => v in assignment)) {
          return { kind: "none" };
        }
        const value = this.evaluateAt(product, assignment);
        if (!value) {
          return { kind: "none" };
        }
        const scale = Math.max(1, ...given.vars.map((v) => magnitude(assignment[v])));
        if (magnitude(value) > CLEAR_MISMATCH_TOLERANCE * scale) {
          return {
            kind: "fail",
            detail: `${formatAssignment(assignment)} does not satisfy the starting equation (left − right ≈ ${formatComplex(value)}).`,
          };
        }
      }
    }
    const list = solutions.map(formatAssignment);
    const verb = solutions.length === 1 ? "satisfies" : "all satisfy";
    return {
      kind: "pass",
      detail: `${list.join(" and ")} ${verb} the starting equation${this.givenUnits.length > 1 ? "s" : ""} (checked by substitution).`,
    };
  }
}

function lastExpressionOf(item: Classified): BoxedExpression | undefined {
  if (item.kind === "expression") {
    return item.expr;
  }
  if (item.kind === "equation") {
    const chain = item.chains[item.chains.length - 1];
    return chain?.[chain.length - 1];
  }
  if (item.kind === "implication") {
    for (let i = item.parts.length - 1; i >= 0; i -= 1) {
      const found = lastExpressionOf(item.parts[i]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

const SEVERITY: Record<StepCheck["status"], number> = { verified: 0, unchecked: 1, error: 2, mismatch: 3 };

function worse(a: StepCheck, b: StepCheck): StepCheck {
  return SEVERITY[b.status] > SEVERITY[a.status] ? b : a;
}

/** Runs the checker synchronously over every step (used by the worker). */
export function checkStepsSync(ce: ComputeEngine, maths: string[], options?: CheckOptions): StepCheck[] {
  const checker = new SolutionChecker(ce, maths, options);
  const results: StepCheck[] = [];
  for (const check of checker) {
    results.push(check);
  }
  return results;
}
