import { solveEquilibrium, validateMixture, type AqueousMixture, type EquilibriumResult } from "./equilibrium";
import { finite, positive } from "./numerics";

export interface TitrationExperiment {
  analyte: AqueousMixture;
  initialVolume: number;
  titrantConcentration: number;
  titrant: "acid" | "base";
}
export interface ExactTitrationPoint { volume: number; pH: number }
export interface TitrationMilestones {
  equivalenceVolumes: number[];
  halfEquivalenceVolumes: number[];
  interpretation: string;
}
function validate(experiment: TitrationExperiment): void {
  validateMixture(experiment.analyte);
  positive(experiment.initialVolume, "Starting volume");
  positive(experiment.titrantConcentration, "Titrant concentration");
}

/** n = CV, with dilution by V0 + V; strong titrant supplies a monovalent counterion. Volumes use m³. */
export function titrationAtVolume(experiment: TitrationExperiment, volume: number): EquilibriumResult {
  validate(experiment);
  finite(volume, "Added volume", 0);
  const dilution = experiment.initialVolume / (experiment.initialVolume + volume);
  return solveEquilibrium({
    ...experiment.analyte,
    families: experiment.analyte.families?.map((family) => ({ ...family, concentration: family.concentration * dilution })),
    spectators: [
      ...experiment.analyte.spectators?.map((ion) => ({ ...ion, concentration: ion.concentration * dilution })) ?? [],
      { id: "titrant-counterion", charge: experiment.titrant === "base" ? 1 : -1, concentration: experiment.titrantConcentration * volume / (experiment.initialVolume + volume) },
    ],
  });
}

/** Formal stoichiometric endpoints, ordered by pKa. Overlapping/mixed equilibria need not show separate inflections. */
export function titrationMilestones(experiment: TitrationExperiment): TitrationMilestones {
  validate(experiment);
  const { analyte, initialVolume, titrantConcentration } = experiment;
  const direction = experiment.titrant === "base" ? 1 : -1;
  let baseMoles = -(analyte.spectators ?? []).reduce((sum, ion) => sum + ion.charge * ion.concentration * initialVolume, 0)
    - (analyte.families ?? []).reduce((sum, family) => sum + family.protonatedCharge * family.concentration * initialVolume, 0);
  const amounts = [baseMoles];
  const stages = (analyte.families ?? []).flatMap((family) => family.pKa.map((pKa) => ({ pKa, amount: family.concentration * initialVolume }))).sort((left, right) => left.pKa - right.pKa);
  stages.forEach((stage, index) => {
    baseMoles += stage.amount;
    if (index === stages.length - 1 || stages[index + 1].pKa !== stage.pKa) amounts.push(baseMoles);
  });
  const positiveVolumes = (volumes: number[]) => [...new Set(volumes.filter((volume) => volume > 1e-15))].sort((left, right) => left - right);
  const boundaries = amounts.map((amount) => direction * amount / titrantConcentration).sort((left, right) => left - right);
  return {
    equivalenceVolumes: positiveVolumes(boundaries),
    // Midway between neighbouring stage boundaries, even when the first boundary lies before the starting point.
    halfEquivalenceVolumes: positiveVolumes(boundaries.slice(1).map((volume, index) => (volume + boundaries[index]) / 2)),
    interpretation: "Formal stoichiometric markers; mixed or overlapping dissociation steps may not give distinct curve inflections or pH = pKa at half volume.",
  };
}

/** Adaptive midpoint refinement resolves jumps to a default 0.015-pH interpolation error, bounded by maxPoints. */
export function generateExactTitrationCurve(experiment: TitrationExperiment, maximumVolume: number, options: { tolerance?: number; maxPoints?: number } = {}): ExactTitrationPoint[] {
  validate(experiment);
  positive(maximumVolume, "Graph volume range");
  const tolerance = positive(options.tolerance ?? 0.015, "Graph tolerance");
  const maxPoints = Math.floor(finite(options.maxPoints ?? 1200, "Maximum graph points", 32));
  const cache = new Map<number, number>();
  const evaluate = (volume: number) => {
    if (!cache.has(volume)) cache.set(volume, titrationAtVolume(experiment, volume).pH);
    return cache.get(volume)!;
  };
  const markers = titrationMilestones(experiment);
  const seeds = new Set(Array.from({ length: 25 }, (_, index) => maximumVolume * index / 24));
  for (const volume of [...markers.equivalenceVolumes, ...markers.halfEquivalenceVolumes]) {
    for (const offset of [0, -0.001, -0.0001, 0.0001, 0.001]) {
      const seed = volume + offset * maximumVolume;
      if (seed >= 0 && seed <= maximumVolume) seeds.add(seed);
    }
  }
  const volumes = [...seeds].sort((left, right) => left - right);
  volumes.forEach(evaluate);
  const refine = (left: number, right: number, depth: number) => {
    if (depth > 24 || cache.size >= maxPoints) return;
    const middle = (left + right) / 2;
    const midPH = evaluate(middle);
    if (Math.abs(midPH - (evaluate(left) + evaluate(right)) / 2) > tolerance || Math.abs(evaluate(left) - evaluate(right)) > 0.3) {
      refine(left, middle, depth + 1);
      refine(middle, right, depth + 1);
    }
  };
  volumes.slice(1).forEach((volume, index) => refine(volumes[index], volume, 0));
  return [...cache].sort(([left], [right]) => left - right).map(([volume, pH]) => ({ volume, pH }));
}
