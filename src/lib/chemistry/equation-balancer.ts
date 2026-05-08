import type {
  BalanceEquationResult,
  BalancedEquation,
  ChemistryError,
  ParsedChemicalEquation,
  ParsedEquationTerm,
} from "@/lib/chemistry/chemistry-types";
import { parseFormula } from "@/lib/chemistry/formula-parser";

function chemistryError(code: ChemistryError["code"], message: string): ChemistryError {
  return { ok: false, code, message };
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function lcm(left: number, right: number) {
  return Math.abs(left * right) / gcd(left, right);
}

class Fraction {
  readonly numerator: number;
  readonly denominator: number;

  constructor(numerator: number, denominator = 1) {
    if (denominator === 0) {
      throw new Error("Zero denominator.");
    }
    const sign = denominator < 0 ? -1 : 1;
    const divisor = gcd(numerator, denominator);
    this.numerator = (numerator / divisor) * sign;
    this.denominator = Math.abs(denominator / divisor);
  }

  static zero() {
    return new Fraction(0);
  }

  static one() {
    return new Fraction(1);
  }

  get isZero() {
    return this.numerator === 0;
  }

  add(other: Fraction) {
    return new Fraction(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  subtract(other: Fraction) {
    return this.add(other.multiply(new Fraction(-1)));
  }

  multiply(other: Fraction) {
    return new Fraction(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  divide(other: Fraction) {
    return new Fraction(this.numerator * other.denominator, this.denominator * other.numerator);
  }
}

function splitEquation(input: string) {
  const arrowMatch = input.match(/(->|=>|=)/);
  if (!arrowMatch || arrowMatch.index == null) {
    return null;
  }

  const left = input.slice(0, arrowMatch.index);
  const right = input.slice(arrowMatch.index + arrowMatch[0].length);
  return { left, right };
}

function cleanTerm(term: string) {
  return term.trim().replace(/^\d+\s*/, "");
}

function parseSide(source: string, side: ParsedEquationTerm["side"]) {
  return source
    .split("+")
    .map(cleanTerm)
    .filter(Boolean)
    .map((formula): ParsedEquationTerm | ChemistryError => {
      const parsed = parseFormula(formula);
      if (!parsed.ok) {
        return parsed;
      }
      return {
        formula,
        side,
        atoms: parsed.atoms,
        charge: parsed.charge,
      };
    });
}

export function parseChemicalEquation(equation: string): ParsedChemicalEquation | ChemistryError {
  const parts = splitEquation(equation);
  if (!parts) {
    return chemistryError("INVALID_EQUATION", "Use an equation arrow like H2 + O2 -> H2O.");
  }

  const reactants = parseSide(parts.left, "reactant");
  const products = parseSide(parts.right, "product");
  const firstError = [...reactants, ...products].find(
    (term): term is ChemistryError => "ok" in term && term.ok === false,
  );
  if (firstError) {
    return firstError;
  }

  if (reactants.length === 0 || products.length === 0) {
    return chemistryError("INVALID_EQUATION", "A chemical equation needs reactants and products.");
  }

  return {
    reactants: reactants as ParsedEquationTerm[],
    products: products as ParsedEquationTerm[],
    terms: [...(reactants as ParsedEquationTerm[]), ...(products as ParsedEquationTerm[])],
  };
}

function buildMatrix(parsed: ParsedChemicalEquation) {
  const atomSymbols = Array.from(new Set(parsed.terms.flatMap((term) => Object.keys(term.atoms)))).sort();
  const rows = [
    ...atomSymbols.map((symbol) =>
      parsed.terms.map((term) => {
        const sign = term.side === "reactant" ? 1 : -1;
        return sign * (term.atoms[symbol] ?? 0);
      }),
    ),
  ];

  if (parsed.terms.some((term) => term.charge !== 0)) {
    rows.push(parsed.terms.map((term) => (term.side === "reactant" ? 1 : -1) * term.charge));
  }

  return rows;
}

function nullspaceVector(matrix: number[][]): number[] | null {
  const rowCount = matrix.length;
  const columnCount = matrix[0]?.length ?? 0;
  if (columnCount < 2) {
    return null;
  }

  const rref = matrix.map((row) => row.map((value) => new Fraction(value)));
  const pivotColumns: number[] = [];
  let pivotRow = 0;

  for (let column = 0; column < columnCount && pivotRow < rowCount; column += 1) {
    const row = rref.findIndex((candidate, index) => index >= pivotRow && !candidate[column].isZero);
    if (row === -1) {
      continue;
    }

    [rref[pivotRow], rref[row]] = [rref[row], rref[pivotRow]];
    const pivot = rref[pivotRow][column];
    rref[pivotRow] = rref[pivotRow].map((value) => value.divide(pivot));

    for (let otherRow = 0; otherRow < rowCount; otherRow += 1) {
      if (otherRow === pivotRow || rref[otherRow][column].isZero) {
        continue;
      }
      const factor = rref[otherRow][column];
      rref[otherRow] = rref[otherRow].map((value, index) =>
        value.subtract(factor.multiply(rref[pivotRow][index])),
      );
    }

    pivotColumns.push(column);
    pivotRow += 1;
  }

  const freeColumns = [...Array(columnCount).keys()].filter((column) => !pivotColumns.includes(column));
  if (freeColumns.length === 0) {
    return null;
  }

  const solution = Array.from({ length: columnCount }, () => Fraction.zero());
  freeColumns.forEach((column) => {
    solution[column] = Fraction.one();
  });

  pivotColumns.forEach((column, row) => {
    let value = Fraction.zero();
    freeColumns.forEach((freeColumn) => {
      value = value.subtract(rref[row][freeColumn].multiply(solution[freeColumn]));
    });
    solution[column] = value;
  });

  let denominatorLcm = 1;
  solution.forEach((value) => {
    denominatorLcm = lcm(denominatorLcm, value.denominator);
  });

  let integers = solution.map((value) => value.numerator * (denominatorLcm / value.denominator));
  const common = integers.reduce((current, value) => gcd(current, value), 0) || 1;
  integers = integers.map((value) => value / common);

  if (integers.every((value) => value <= 0)) {
    integers = integers.map((value) => -value);
  }

  return integers.every((value) => Number.isInteger(value) && value > 0) ? integers : null;
}

function formatBalancedEquation(parsed: ParsedChemicalEquation, coefficients: number[]) {
  const formatTerm = (term: ParsedEquationTerm, coefficient: number) =>
    coefficient === 1 ? term.formula : `${coefficient} ${term.formula}`;
  const reactants = parsed.reactants.map((term, index) => formatTerm(term, coefficients[index]));
  const products = parsed.products.map((term, index) =>
    formatTerm(term, coefficients[parsed.reactants.length + index]),
  );
  return `${reactants.join(" + ")} -> ${products.join(" + ")}`;
}

export function balanceEquation(equation: string): BalanceEquationResult {
  const parsed = parseChemicalEquation(equation);
  if (!("terms" in parsed)) {
    return parsed;
  }

  const coefficients = nullspaceVector(buildMatrix(parsed));
  if (!coefficients) {
    return chemistryError("UNBALANCEABLE_EQUATION", "This equation could not be balanced with positive integers.");
  }

  const result: BalancedEquation = {
    ok: true,
    equation,
    coefficients,
    reactants: parsed.reactants,
    products: parsed.products,
    balancedEquation: formatBalancedEquation(parsed, coefficients),
  };
  return result;
}
