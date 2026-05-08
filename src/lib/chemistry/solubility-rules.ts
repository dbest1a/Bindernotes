export type SolubilityRule = {
  id: string;
  summary: string;
  examples: string[];
};

export const solubilityRules: SolubilityRule[] = [
  {
    id: "nitrates-alkali-ammonium",
    summary: "All nitrates, alkali metal salts, and ammonium salts are soluble.",
    examples: ["NaNO3", "KCl", "NH4Cl"],
  },
  {
    id: "halides-exceptions",
    summary: "Most chloride, bromide, and iodide salts are soluble except with Ag+, Pb2+, and Hg2^2+.",
    examples: ["NaCl soluble", "AgCl precipitates"],
  },
  {
    id: "sulfates-exceptions",
    summary: "Most sulfates are soluble except BaSO4, PbSO4, SrSO4, and low-solubility CaSO4.",
    examples: ["CuSO4 soluble", "BaSO4 precipitates"],
  },
  {
    id: "carbonates-phosphates",
    summary: "Carbonates and phosphates are usually insoluble unless paired with alkali metals or ammonium.",
    examples: ["CaCO3 precipitates", "Na3PO4 soluble"],
  },
];
