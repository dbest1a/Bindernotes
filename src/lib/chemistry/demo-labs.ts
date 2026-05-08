export type ChemistryLabTemplate = {
  id: string;
  title: string;
  objective: string;
  safety: string[];
  reagents: string[];
};

export const chemistryLabTemplates: ChemistryLabTemplate[] = [
  {
    id: "acid-base-titration-unknown-acid",
    title: "Find the concentration of an unknown monoprotic acid",
    objective: "Use a standardized NaOH titrant and pH curve to estimate the concentration of an unknown acid.",
    safety: ["Wear goggles.", "Label acid and base glassware.", "Do not run this outside a supervised lab."],
    reagents: ["Unknown monoprotic acid", "0.100 M NaOH", "Phenolphthalein indicator", "Distilled water"],
  },
];
