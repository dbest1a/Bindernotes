import type {
  AtomInventory,
  BalanceEquationResult,
  BalancedEquation,
  ConservationResult,
} from "@/lib/chemistry/chemistry-types";
import { balanceEquation } from "@/lib/chemistry/equation-balancer";

function addInventory(target: AtomInventory, source: AtomInventory, multiplier: number) {
  Object.entries(source).forEach(([symbol, count]) => {
    target[symbol] = (target[symbol] ?? 0) + count * multiplier;
  });
}

function buildDifferences(reactantAtoms: AtomInventory, productAtoms: AtomInventory) {
  const symbols = new Set([...Object.keys(reactantAtoms), ...Object.keys(productAtoms)]);
  return Object.fromEntries(
    [...symbols]
      .map((symbol) => [symbol, (reactantAtoms[symbol] ?? 0) - (productAtoms[symbol] ?? 0)] as const)
      .filter(([, difference]) => difference !== 0),
  );
}

export function checkEquationConservation(input: BalanceEquationResult | string): ConservationResult {
  const balanced: BalanceEquationResult = typeof input === "string" ? balanceEquation(input) : input;
  if (!balanced.ok) {
    return balanced;
  }

  return checkBalancedEquationConservation(balanced);
}

export function checkBalancedEquationConservation(balanced: BalancedEquation): ConservationResult {
  const reactantAtoms: AtomInventory = {};
  const productAtoms: AtomInventory = {};
  let reactantCharge = 0;
  let productCharge = 0;

  balanced.reactants.forEach((term, index) => {
    const coefficient = balanced.coefficients[index] ?? 1;
    addInventory(reactantAtoms, term.atoms, coefficient);
    reactantCharge += term.charge * coefficient;
  });

  balanced.products.forEach((term, index) => {
    const coefficient = balanced.coefficients[balanced.reactants.length + index] ?? 1;
    addInventory(productAtoms, term.atoms, coefficient);
    productCharge += term.charge * coefficient;
  });

  const differences = buildDifferences(reactantAtoms, productAtoms);

  return {
    ok: true,
    atomsConserved: Object.keys(differences).length === 0,
    chargeConserved: reactantCharge === productCharge,
    reactantAtoms,
    productAtoms,
    reactantCharge,
    productCharge,
    differences,
  };
}
