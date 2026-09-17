import { periodicTableElements } from "@/lib/chemistry/periodic-table-data";

export type PeriodicElement = {
  symbol: string;
  name: string;
  atomicMass: number;
};

export const periodicTable: Record<string, PeriodicElement> = Object.fromEntries(
  periodicTableElements
    .filter((element) => Number.isFinite(element.atomicMass))
    .map((element) => [
      element.symbol,
      {
        symbol: element.symbol,
        name: element.name,
        atomicMass: element.atomicMass,
      },
    ]),
);

export function isKnownElement(symbol: string) {
  return Boolean(periodicTable[symbol]);
}
