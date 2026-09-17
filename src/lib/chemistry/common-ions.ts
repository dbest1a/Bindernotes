export type CommonIon = {
  formula: string;
  name: string;
  charge: number;
  category: "metal-cation" | "polyatomic-cation" | "nonmetal-anion" | "polyatomic-anion";
};

export const commonIons: CommonIon[] = [
  { formula: "Na+", name: "Sodium", charge: 1, category: "metal-cation" },
  { formula: "K+", name: "Potassium", charge: 1, category: "metal-cation" },
  { formula: "Mg2+", name: "Magnesium", charge: 2, category: "metal-cation" },
  { formula: "Ca2+", name: "Calcium", charge: 2, category: "metal-cation" },
  { formula: "Fe2+", name: "Iron(II)", charge: 2, category: "metal-cation" },
  { formula: "Fe3+", name: "Iron(III)", charge: 3, category: "metal-cation" },
  { formula: "NH4+", name: "Ammonium", charge: 1, category: "polyatomic-cation" },
  { formula: "Cl-", name: "Chloride", charge: -1, category: "nonmetal-anion" },
  { formula: "Br-", name: "Bromide", charge: -1, category: "nonmetal-anion" },
  { formula: "O2-", name: "Oxide", charge: -2, category: "nonmetal-anion" },
  { formula: "OH-", name: "Hydroxide", charge: -1, category: "polyatomic-anion" },
  { formula: "NO3-", name: "Nitrate", charge: -1, category: "polyatomic-anion" },
  { formula: "SO4^2-", name: "Sulfate", charge: -2, category: "polyatomic-anion" },
  { formula: "CO3^2-", name: "Carbonate", charge: -2, category: "polyatomic-anion" },
  { formula: "PO4^3-", name: "Phosphate", charge: -3, category: "polyatomic-anion" },
];
