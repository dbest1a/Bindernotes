export type ChemistryConceptCard = {
  id: string;
  title: string;
  unit: string;
  tags: string[];
  misconception: string;
  check: string;
};

export const chemistryConceptCards: ChemistryConceptCard[] = [
  {
    id: "mole-bridge",
    title: "The mole bridge",
    unit: "Stoichiometry",
    tags: ["AP.CED.1", "GenChem.stoichiometry"],
    misconception: "Students often jump grams to grams without converting through moles.",
    check: "Can you name the two conversion factors on either side of the mole ratio?",
  },
  {
    id: "trend-effective-nuclear-charge",
    title: "Effective nuclear charge",
    unit: "Periodic trends",
    tags: ["AP.SAP.1", "GenChem.atomic-structure"],
    misconception: "A larger atom is not always more reactive or more electronegative.",
    check: "Across a period, what happens to attraction between valence electrons and the nucleus?",
  },
  {
    id: "strong-vs-concentrated",
    title: "Strong is not concentrated",
    unit: "Acid-base",
    tags: ["AP.SAP.9", "GenChem.acid-base"],
    misconception: "Strong acid means complete ionization, not necessarily a large amount of acid.",
    check: "How can a dilute strong acid have a higher pH than a concentrated weak acid?",
  },
];
