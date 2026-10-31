import {
  asRational,
  freeVariables,
  parseEquation,
  parseExpression,
  rationalToLatex,
  rAdd,
  rDiv,
  rIsOne,
  rIsZero,
  rMul,
  rNeg,
  rSub,
  rat,
  toLatex,
  type Expr,
  type Rational,
} from "../expression";
import { buildDocument, fail, safely, step, type GeneratorResult, type SolutionGenerator } from "./generator-types";

// ---------------------------------------------------------------------------
// Linear forms in several variables
// ---------------------------------------------------------------------------

type LinearForm = { coefficients: Map<string, Rational>; constant: Rational };

function linearForm(e: Expr): LinearForm | undefined {
  switch (e.k) {
    case "num":
      return { coefficients: new Map(), constant: e.v };
    case "var":
      return { coefficients: new Map([[e.name, rat(1)]]), constant: rat(0) };
    case "const":
      return undefined;
    case "neg": {
      const inner = linearForm(e.arg);
      return inner ? scaleForm(inner, rat(-1)) : undefined;
    }
    case "add": {
      let acc: LinearForm = { coefficients: new Map(), constant: rat(0) };
      for (const term of e.terms) {
        const form = linearForm(term);
        if (!form) {
          return undefined;
        }
        acc = addForms(acc, form);
      }
      return acc;
    }
    case "mul": {
      let coef = rat(1);
      let variablePart: LinearForm | undefined;
      for (const factor of e.factors) {
        const r = asRational(factor);
        if (r) {
          coef = rMul(coef, r);
          continue;
        }
        if (variablePart) {
          return undefined;
        }
        variablePart = linearForm(factor);
        if (!variablePart) {
          return undefined;
        }
      }
      return scaleForm(variablePart ?? { coefficients: new Map(), constant: rat(1) }, coef);
    }
    case "div": {
      const d = asRational(e.den);
      const n = linearForm(e.num);
      return d && n && !rIsZero(d) ? scaleForm(n, rDiv(rat(1), d)) : undefined;
    }
    default:
      return undefined;
  }
}

function scaleForm(form: LinearForm, s: Rational): LinearForm {
  const coefficients = new Map<string, Rational>();
  form.coefficients.forEach((value, name) => coefficients.set(name, rMul(value, s)));
  return { coefficients, constant: rMul(form.constant, s) };
}

function addForms(a: LinearForm, b: LinearForm): LinearForm {
  const coefficients = new Map(a.coefficients);
  b.coefficients.forEach((value, name) => coefficients.set(name, rAdd(coefficients.get(name) ?? rat(0), value)));
  return { coefficients, constant: rAdd(a.constant, b.constant) };
}

/** An equation Σ aᵢ·vᵢ = c. */
type Row = { coefficients: Rational[]; constant: Rational };

function rowLatex(row: Row, vars: string[]): string {
  const terms: string[] = [];
  row.coefficients.forEach((coef, index) => {
    if (rIsZero(coef)) {
      return;
    }
    const v = vars[index];
    const magnitude = rationalToLatex({ n: Math.abs(coef.n), d: coef.d });
    const body = Math.abs(coef.n) === 1 && coef.d === 1 ? v : `${magnitude}${v}`;
    terms.push(terms.length === 0 ? (coef.n < 0 ? `-${body}` : body) : coef.n < 0 ? ` - ${body}` : ` + ${body}`);
  });
  const left = terms.length ? terms.join("") : "0";
  return `${left} = ${rationalToLatex(row.constant)}`;
}

function scaleRow(row: Row, s: Rational): Row {
  return { coefficients: row.coefficients.map((c) => rMul(c, s)), constant: rMul(row.constant, s) };
}

function subtractRows(a: Row, b: Row): Row {
  return { coefficients: a.coefficients.map((c, i) => rSub(c, b.coefficients[i])), constant: rSub(a.constant, b.constant) };
}

function plain(value: Rational): string {
  return value.d === 1 ? String(value.n) : `${value.n}/${value.d}`;
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

function splitEquations(input: string): string[] {
  return input
    .replace(/\\begin\{(?:cases|aligned|array)\}|\\end\{(?:cases|aligned|array)\}/g, "")
    .replace(/&/g, "")
    .split(/\\\\|;|\n|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

type Matrix = Rational[][];

function parseMatrix(input: string): Matrix | undefined {
  const text = input.trim();
  const env = /\\begin\{[pbv]?matrix\}([\s\S]*?)\\end\{[pbv]?matrix\}/.exec(text);
  let rows: string[][] | undefined;
  if (env) {
    // Rows end with \\ in LaTeX; a lone backslash before a number is tolerated for hand-typed input.
    rows = env[1]
      .split(/\\\\|\\(?=\s*-?[0-9(])/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split("&").map((cell) => cell.trim()));
  } else {
    const nested = /\[\s*\[([\s\S]*)\]\s*\]/.exec(text);
    if (nested) {
      rows = nested[1].split(/\]\s*,\s*\[/).map((row) => row.split(",").map((cell) => cell.trim()));
    } else {
      const body = /\(([^()]*)\)|\[([^[\]]*)\]/.exec(text);
      const inner = body ? (body[1] ?? body[2]) : undefined;
      if (inner && inner.includes(";")) {
        rows = inner.split(";").map((row) => row.split(/,|\s+/).map((cell) => cell.trim()).filter(Boolean));
      }
    }
  }
  if (!rows || rows.length === 0) {
    return undefined;
  }
  const matrix: Matrix = [];
  for (const row of rows) {
    const values: Rational[] = [];
    for (const cell of row) {
      const r = asRational(parseExpression(cell));
      if (!r) {
        throw new Error(`Matrix entries must be numbers (found “${cell}”).`);
      }
      values.push(r);
    }
    matrix.push(values);
  }
  const size = matrix[0].length;
  if (!matrix.every((row) => row.length === size)) {
    throw new Error("Every matrix row must have the same number of entries.");
  }
  return matrix;
}

function matrixLatex(matrix: Matrix, env = "pmatrix"): string {
  return `\\begin{${env}} ${matrix.map((row) => row.map(rationalToLatex).join(" & ")).join(" \\\\ ")} \\end{${env}}`;
}

// ---------------------------------------------------------------------------
// Determinant and inverse
// ---------------------------------------------------------------------------

function det2(m: Matrix): Rational {
  return rSub(rMul(m[0][0], m[1][1]), rMul(m[0][1], m[1][0]));
}

function minor(m: Matrix, row: number, col: number): Matrix {
  return m.filter((_, r) => r !== row).map((cells) => cells.filter((_, c) => c !== col));
}

function detN(m: Matrix): Rational {
  if (m.length === 1) {
    return m[0][0];
  }
  if (m.length === 2) {
    return det2(m);
  }
  let total = rat(0);
  m[0].forEach((entry, col) => {
    const sign = col % 2 === 0 ? rat(1) : rat(-1);
    total = rAdd(total, rMul(rMul(sign, entry), detN(minor(m, 0, col))));
  });
  return total;
}

function product(a: Rational, b: Rational): string {
  const wrapNeg = (r: Rational) => (r.n < 0 ? `\\left(${rationalToLatex(r)}\\right)` : rationalToLatex(r));
  return `${wrapNeg(a)} \\cdot ${wrapNeg(b)}`;
}

function generateDeterminant(input: string, matrix: Matrix, wantInverse: boolean): GeneratorResult {
  const n = matrix.length;
  if (n !== matrix[0].length) {
    return fail("Determinants and inverses need a square matrix.");
  }
  if (n < 2 || n > 3) {
    return fail("Only 2×2 and 3×3 matrices are supported here.");
  }
  const steps = [];
  const title = wantInverse ? `Invert a ${n}×${n} matrix` : `Determinant of a ${n}×${n} matrix`;
  const problem = `${wantInverse ? "Find $A^{-1}$ for" : "Find $\\det A$ for"} $A = ${matrixLatex(matrix)}$.`;

  let determinant: Rational;
  if (n === 2) {
    const [[a, b], [c, d]] = matrix;
    const ad = rMul(a, d);
    const bc = rMul(b, c);
    determinant = rSub(ad, bc);
    steps.push(step(`\\det A = ${matrixLatex(matrix, "vmatrix")} = ad - bc`, "For a 2×2 matrix the determinant is ad − bc (down-right product minus up-right product). Matrix notation itself isn't machine-checked; the arithmetic below is."));
    steps.push(step(`${product(a, d)} - ${product(b, c)} = ${rationalToLatex(ad)} ${bc.n < 0 ? "+" : "-"} ${rationalToLatex({ n: Math.abs(bc.n), d: bc.d })} = ${rationalToLatex(determinant)}`, "Multiply, then subtract."));
  } else {
    const [row] = matrix;
    const minors = row.map((_, col) => minor(matrix, 0, col));
    const minorDets = minors.map(det2);
    determinant = detN(matrix);
    steps.push(
      step(
        `\\det A = ${rationalToLatex(row[0])}${matrixLatex(minors[0], "vmatrix")} - ${rationalToLatex(row[1])}${matrixLatex(minors[1], "vmatrix")} + ${rationalToLatex(row[2])}${matrixLatex(minors[2], "vmatrix")}`,
        "Cofactor expansion along the first row with alternating signs + − +. Matrix notation isn't machine-checked; the arithmetic below is.",
      ),
    );
    const minorArithmetic = minors.map((m) => `\\left(${product(m[0][0], m[1][1])} - ${product(m[0][1], m[1][0])}\\right)`);
    const signed = (r: Rational) => (r.n < 0 ? `\\left(${rationalToLatex(r)}\\right)` : rationalToLatex(r));
    steps.push(
      step(
        `${signed(row[0])}${minorArithmetic[0]} - ${signed(row[1])}${minorArithmetic[1]} + ${signed(row[2])}${minorArithmetic[2]} = ${signed(row[0])}\\left(${rationalToLatex(minorDets[0])}\\right) - ${signed(row[1])}\\left(${rationalToLatex(minorDets[1])}\\right) + ${signed(row[2])}\\left(${rationalToLatex(minorDets[2])}\\right)`,
        "Evaluate each 2×2 minor.",
      ),
    );
    steps.push(
      step(
        `${signed(row[0])}\\left(${rationalToLatex(minorDets[0])}\\right) - ${signed(row[1])}\\left(${rationalToLatex(minorDets[1])}\\right) + ${signed(row[2])}\\left(${rationalToLatex(minorDets[2])}\\right) = ${rationalToLatex(determinant)}`,
        "Multiply and add.",
      ),
    );
  }

  if (!wantInverse) {
    return buildDocument("linear-system", input, { title, problem, steps, answer: `\\det A = ${rationalToLatex(determinant)}` });
  }
  if (rIsZero(determinant)) {
    return buildDocument("linear-system", input, {
      title,
      problem,
      steps: [...steps, step(`\\det A = 0`, "A matrix with determinant 0 has no inverse.")],
      answer: "\\text{No inverse: } \\det A = 0",
    });
  }
  if (n !== 2) {
    return fail("Inverses are supported for 2×2 matrices; 3×3 inverses aren't generated yet (the determinant steps above still work).");
  }
  const [[a, b], [c, d]] = matrix;
  const adjugate: Matrix = [
    [d, rNeg(b)],
    [rNeg(c), a],
  ];
  const inverse: Matrix = adjugate.map((row) => row.map((entry) => rDiv(entry, determinant)));
  steps.push(step(`A^{-1} = \\frac{1}{\\det A}${matrixLatex(adjugate)} = \\frac{1}{${rationalToLatex(determinant)}}${matrixLatex(adjugate)}`, "Swap the diagonal entries, negate the off-diagonal entries, and divide by the determinant."));
  steps.push(step(`A^{-1} = ${matrixLatex(inverse)}`, "Divide every entry by the determinant."));
  return buildDocument("linear-system", input, { title, problem, steps, answer: `A^{-1} = ${matrixLatex(inverse)}` });
}

// ---------------------------------------------------------------------------
// Elimination
// ---------------------------------------------------------------------------

function generateElimination(input: string, equations: string[]): GeneratorResult {
  const parsed = equations.map((text) => parseEquation(text));
  const vars = [...new Set(parsed.flatMap(({ left, right }) => [...freeVariables(left), ...freeVariables(right)]))].sort();
  if (vars.length < 2) {
    return fail("A system needs at least two variables. For one variable use the “Linear equation” type.");
  }
  if (vars.length > 3) {
    return fail(`Systems with ${vars.length} variables aren't supported yet (2 or 3 work).`);
  }
  if (parsed.length !== vars.length) {
    return fail(`Found ${parsed.length} equation${parsed.length === 1 ? "" : "s"} but ${vars.length} variables (${vars.join(", ")}); a unique solution needs the same number of each.`);
  }
  const rows: Row[] = [];
  for (const { left, right } of parsed) {
    const l = linearForm(left);
    const r = linearForm(right);
    if (!l || !r) {
      return fail("Every equation must be linear in the variables.");
    }
    const diff = addForms(l, scaleForm(r, rat(-1)));
    rows.push({
      coefficients: vars.map((v) => diff.coefficients.get(v) ?? rat(0)),
      constant: rNeg(diff.constant),
    });
  }

  const title = `Solve the system for ${vars.join(", ")}`;
  const problem = `Solve $${rows.map((row) => rowLatex(row, vars)).join("$ and $")}$.`;
  const rewritten = parsed.some(({ left, right }, index) => `${toLatex(left)} = ${toLatex(right)}` !== rowLatex(rows[index], vars));
  const steps = rows.map((row, index) =>
    step(
      rowLatex(row, vars),
      index === 0
        ? rewritten
          ? "Equation (1), written in standard form: variables on the left, constants on the right."
          : "Equation (1) as given."
        : `Equation (${index + 1})${rewritten ? " in standard form" : " as given"}.`,
    ),
  );

  // Forward elimination with readable integer multipliers.
  const working = rows.map((row) => ({ ...row, coefficients: [...row.coefficients] }));
  const labels = working.map((_, index) => `(${index + 1})`);
  const solution: Array<Rational | undefined> = vars.map(() => undefined);

  for (let col = 0; col < vars.length - 1; col += 1) {
    let pivotRow = working.findIndex((row, index) => index >= col && !rIsZero(row.coefficients[col]));
    if (pivotRow === -1) {
      return fail("This system doesn't have a unique solution, so there are no elimination steps to show.");
    }
    if (pivotRow !== col) {
      [working[col], working[pivotRow]] = [working[pivotRow], working[col]];
      [labels[col], labels[pivotRow]] = [labels[pivotRow], labels[col]];
      pivotRow = col;
    }
    const pivot = working[col];
    for (let r = col + 1; r < working.length; r += 1) {
      const target = working[r];
      if (rIsZero(target.coefficients[col])) {
        continue;
      }
      // Scale both so the column coefficients match, then subtract.
      const pc = pivot.coefficients[col];
      const tc = target.coefficients[col];
      const lcmValue = rat((Math.abs(pc.n * tc.n) / gcd(Math.abs(pc.n), Math.abs(tc.n))) * 1, 1);
      const mPivot = rDiv(rMul(lcmValue, rat(pc.d)), rat(Math.abs(pc.n)));
      const mTarget = rDiv(rMul(lcmValue, rat(tc.d)), rat(Math.abs(tc.n)));
      const scaledPivot = scaleRow(pivot, mPivot);
      const scaledTarget = scaleRow(target, mTarget);
      const sameSign = Math.sign(pc.n) === Math.sign(tc.n);
      const eliminated = sameSign ? subtractRows(scaledTarget, scaledPivot) : { coefficients: scaledTarget.coefficients.map((c, i) => rAdd(c, scaledPivot.coefficients[i])), constant: rAdd(scaledTarget.constant, scaledPivot.constant) };
      if (!rIsOne(mPivot)) {
        steps.push(step(rowLatex(scaledPivot, vars), `Multiply equation ${labels[col]} by ${plain(mPivot)} so the ${vars[col]} coefficients match.`));
      }
      if (!rIsOne(mTarget)) {
        steps.push(step(rowLatex(scaledTarget, vars), `Multiply equation ${labels[r]} by ${plain(mTarget)}.`));
      }
      steps.push(
        step(
          rowLatex(eliminated, vars),
          `${sameSign ? "Subtract" : "Add"} the two equations to eliminate ${vars[col]}.`,
        ),
      );
      working[r] = eliminated;
      labels[r] = `(${steps.length})`;
    }
  }

  // Back substitution.
  for (let i = vars.length - 1; i >= 0; i -= 1) {
    const row = working[i];
    const lead = row.coefficients[i];
    if (rIsZero(lead)) {
      return fail("This system doesn't have a unique solution, so there are no elimination steps to show.");
    }
    let constant = row.constant;
    const substituted: string[] = [];
    for (let j = i + 1; j < vars.length; j += 1) {
      const coef = row.coefficients[j];
      const value = solution[j];
      if (!rIsZero(coef) && value) {
        constant = rSub(constant, rMul(coef, value));
        substituted.push(`${vars[j]} = ${plain(value)}`);
      }
    }
    if (substituted.length > 0) {
      const partial: Row = {
        coefficients: row.coefficients.map((c, index) => (index === i ? c : rat(0))),
        constant,
      };
      steps.push(step(rowLatex(partial, vars), `Substitute ${substituted.join(" and ")} into the equation and move the constants to the right.`));
    }
    const value = rDiv(constant, lead);
    solution[i] = value;
    if (!rIsOne(lead) || substituted.length === 0) {
      steps.push(step(`${vars[i]} = ${rationalToLatex(value)}`, rIsOne(lead) ? `Read off ${vars[i]}.` : `Divide both sides by ${plain(lead)}.`));
    }
  }

  const answer = vars.map((v, index) => `${v} = ${rationalToLatex(solution[index] as Rational)}`).join(",\\; ");
  steps.push(step(answer, "Collect the solution. Each line above holds when these values are substituted back."));
  return buildDocument("linear-system", input, { title, problem, steps, answer });
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function generateLinearSystem(input: string): GeneratorResult {
  return safely(() => {
    const text = input.trim();
    if (!text) {
      return fail("Type a system like 2x + 3y = 8; x - y = 1, or det [[1,2],[3,4]].");
    }
    const wantsInverse = /\binv(?:erse)?\b|\^\{?-1\}?/i.test(text);
    const wantsDeterminant = /\bdet\b|\\det|determinant/i.test(text);
    const matrix = parseMatrix(text);
    if (matrix && (wantsInverse || wantsDeterminant || !text.includes("="))) {
      return generateDeterminant(text, matrix, wantsInverse);
    }
    const equations = splitEquations(text);
    if (equations.length < 2) {
      return fail("Separate the equations with “;” or new lines, for example 2x + 3y = 8; x - y = 1.");
    }
    return generateElimination(text, equations);
  });
}

export const linearSystemGenerator: SolutionGenerator = {
  id: "linear-system",
  label: "Linear system / matrix",
  description: "Solve 2×2 or 3×3 systems by elimination, or find a determinant or 2×2 inverse.",
  placeholder: "2x + 3y = 8; x - y = 1",
  examples: ["2x + 3y = 8; x - y = 1", "x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2", "det [[1,2],[3,4]]", "inverse [[2,1],[5,3]]"],
  generate: generateLinearSystem,
};
