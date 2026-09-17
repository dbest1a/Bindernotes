import type { ChemistryError } from "@/lib/chemistry/chemistry-types";
import { parseFormula } from "@/lib/chemistry/formula-parser";
import { periodicTable } from "@/lib/chemistry/periodic-table";

export type MolarMassResult =
  | {
      ok: true;
      formula: string;
      gramsPerMole: number;
      atomBreakdown: Record<string, { count: number; atomicMass: number; subtotal: number }>;
    }
  | ChemistryError;

export function calculateMolarMass(formula: string): MolarMassResult {
  const parsed = parseFormula(formula);
  if (!parsed.ok) {
    return parsed;
  }

  const atomBreakdown = Object.fromEntries(
    Object.entries(parsed.atoms).map(([symbol, count]) => {
      const atomicMass = periodicTable[symbol].atomicMass;
      return [symbol, { count, atomicMass, subtotal: count * atomicMass }];
    }),
  );
  const gramsPerMole = Object.values(atomBreakdown).reduce((sum, item) => sum + item.subtotal, 0);

  return {
    ok: true,
    formula: parsed.formula,
    gramsPerMole,
    atomBreakdown,
  };
}
