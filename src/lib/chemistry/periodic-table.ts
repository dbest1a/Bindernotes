export type PeriodicElement = {
  symbol: string;
  name: string;
  atomicMass: number;
};

export const periodicTable: Record<string, PeriodicElement> = {
  H: { symbol: "H", name: "Hydrogen", atomicMass: 1.008 },
  He: { symbol: "He", name: "Helium", atomicMass: 4.0026 },
  Li: { symbol: "Li", name: "Lithium", atomicMass: 6.94 },
  Be: { symbol: "Be", name: "Beryllium", atomicMass: 9.0122 },
  B: { symbol: "B", name: "Boron", atomicMass: 10.81 },
  C: { symbol: "C", name: "Carbon", atomicMass: 12.011 },
  N: { symbol: "N", name: "Nitrogen", atomicMass: 14.007 },
  O: { symbol: "O", name: "Oxygen", atomicMass: 15.999 },
  F: { symbol: "F", name: "Fluorine", atomicMass: 18.998 },
  Ne: { symbol: "Ne", name: "Neon", atomicMass: 20.18 },
  Na: { symbol: "Na", name: "Sodium", atomicMass: 22.99 },
  Mg: { symbol: "Mg", name: "Magnesium", atomicMass: 24.305 },
  Al: { symbol: "Al", name: "Aluminum", atomicMass: 26.982 },
  Si: { symbol: "Si", name: "Silicon", atomicMass: 28.085 },
  P: { symbol: "P", name: "Phosphorus", atomicMass: 30.974 },
  S: { symbol: "S", name: "Sulfur", atomicMass: 32.06 },
  Cl: { symbol: "Cl", name: "Chlorine", atomicMass: 35.45 },
  Ar: { symbol: "Ar", name: "Argon", atomicMass: 39.948 },
  K: { symbol: "K", name: "Potassium", atomicMass: 39.098 },
  Ca: { symbol: "Ca", name: "Calcium", atomicMass: 40.078 },
  Cr: { symbol: "Cr", name: "Chromium", atomicMass: 51.996 },
  Mn: { symbol: "Mn", name: "Manganese", atomicMass: 54.938 },
  Fe: { symbol: "Fe", name: "Iron", atomicMass: 55.845 },
  Cu: { symbol: "Cu", name: "Copper", atomicMass: 63.546 },
  Zn: { symbol: "Zn", name: "Zinc", atomicMass: 65.38 },
  Br: { symbol: "Br", name: "Bromine", atomicMass: 79.904 },
  Ag: { symbol: "Ag", name: "Silver", atomicMass: 107.8682 },
  I: { symbol: "I", name: "Iodine", atomicMass: 126.904 },
  Ba: { symbol: "Ba", name: "Barium", atomicMass: 137.327 },
  Pb: { symbol: "Pb", name: "Lead", atomicMass: 207.2 },
};

export function isKnownElement(symbol: string) {
  return Boolean(periodicTable[symbol]);
}
