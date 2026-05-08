export type DemoReaction = {
  id: string;
  equation: string;
  type: "synthesis" | "decomposition" | "combustion" | "single replacement" | "double replacement" | "precipitation" | "acid-base";
  observation: string;
};

export const demoReactions: DemoReaction[] = [
  { id: "water-formation", equation: "H2 + O2 -> H2O", type: "synthesis", observation: "Hydrogen and oxygen form water when ignited." },
  { id: "methane-combustion", equation: "CH4 + O2 -> CO2 + H2O", type: "combustion", observation: "A hydrocarbon burns to carbon dioxide and water." },
  { id: "silver-chloride", equation: "NaCl + AgNO3 -> AgCl + NaNO3", type: "precipitation", observation: "A white silver chloride precipitate forms." },
  { id: "neutralization", equation: "HCl + NaOH -> NaCl + H2O", type: "acid-base", observation: "Strong acid and strong base neutralize to salt and water." },
  { id: "iron-oxide", equation: "Fe + O2 -> Fe2O3", type: "synthesis", observation: "Iron combines with oxygen to form iron(III) oxide." },
];
