import type { AtomInventory, ChemistryError, FormulaParseResult } from "@/lib/chemistry/chemistry-types";
import { isKnownElement } from "@/lib/chemistry/periodic-table";

function chemistryError(code: ChemistryError["code"], message: string, index?: number): ChemistryError {
  return { ok: false, code, message, index };
}

function mergeAtoms(target: AtomInventory, source: AtomInventory, multiplier = 1) {
  Object.entries(source).forEach(([symbol, count]) => {
    target[symbol] = (target[symbol] ?? 0) + count * multiplier;
  });
}

function parseNumber(source: string, index: number) {
  let cursor = index;
  while (/\d/.test(source[cursor] ?? "")) {
    cursor += 1;
  }

  if (cursor === index) {
    return { value: 1, next: index };
  }

  const value = Number(source.slice(index, cursor));
  return { value, next: cursor };
}

function extractCharge(source: string) {
  const caret = source.match(/\^(\d*)([+-])$/);
  if (caret) {
    const magnitude = caret[1] ? Number(caret[1]) : 1;
    return {
      body: source.slice(0, -caret[0].length),
      charge: caret[2] === "+" ? magnitude : -magnitude,
    };
  }

  const sign = source.match(/([+-])$/);
  if (!sign) {
    return { body: source, charge: 0 };
  }

  const withoutSign = source.slice(0, -1);
  const singleElementIon = withoutSign.match(/^([A-Z][a-z]?)(\d+)$/);
  if (singleElementIon && isKnownElement(singleElementIon[1])) {
    const magnitude = Number(singleElementIon[2]);
    return {
      body: singleElementIon[1],
      charge: sign[1] === "+" ? magnitude : -magnitude,
    };
  }

  return {
    body: withoutSign,
    charge: sign[1] === "+" ? 1 : -1,
  };
}

export function parseFormula(input: string): FormulaParseResult {
  const formula = input.replace(/\s+/g, "");
  if (!formula) {
    return chemistryError("EMPTY_FORMULA", "Enter a chemical formula before calculating.");
  }

  const { body, charge } = extractCharge(formula);
  if (!body) {
    return chemistryError("INVALID_TOKEN", "A charge must be attached to a chemical formula.");
  }

  const stack: AtomInventory[] = [{}];
  let index = 0;

  while (index < body.length) {
    const char = body[index];

    if (char === "(") {
      stack.push({});
      index += 1;
      continue;
    }

    if (char === ")") {
      if (stack.length === 1) {
        return chemistryError("UNBALANCED_PARENTHESIS", "Closing parenthesis has no matching opening parenthesis.", index);
      }

      const group = stack.pop() ?? {};
      const parsedCount = parseNumber(body, index + 1);
      mergeAtoms(stack[stack.length - 1], group, parsedCount.value);
      index = parsedCount.next;
      continue;
    }

    if (!/[A-Z]/.test(char)) {
      return chemistryError("INVALID_TOKEN", `Unexpected token "${char}" in formula.`, index);
    }

    let symbol = char;
    if (/[a-z]/.test(body[index + 1] ?? "")) {
      symbol += body[index + 1];
      index += 1;
    }

    if (!isKnownElement(symbol)) {
      return chemistryError("UNKNOWN_ELEMENT", `${symbol} is not in the local periodic table.`, index);
    }

    const parsedCount = parseNumber(body, index + 1);
    if (parsedCount.value <= 0) {
      return chemistryError("INVALID_TOKEN", "Atom counts must be positive integers.", index);
    }

    mergeAtoms(stack[stack.length - 1], { [symbol]: parsedCount.value });
    index = parsedCount.next;
  }

  if (stack.length > 1) {
    return chemistryError("UNBALANCED_PARENTHESIS", "Formula has an opening parenthesis without a matching close.");
  }

  return {
    ok: true,
    formula,
    atoms: stack[0],
    charge,
  };
}
