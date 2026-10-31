import { bisectRoot, finite, STANDARD_CONCENTRATION } from "./numerics";

/** Analytical and species concentrations use mol/m³. pKa and pKw use the 1 mol/L standard state. */
export interface AcidBaseFamily {
  id: string;
  concentration: number;
  pKa: number[];
  protonatedCharge: number;
  species: string[];
}
export interface SpectatorIon { id: string; charge: number; concentration: number }
export interface AqueousMixture {
  families?: AcidBaseFamily[];
  spectators?: SpectatorIon[];
  pKw?: number;
  activityModel?: "ideal" | "davies";
}
export interface AqueousSpecies {
  familyId: string;
  name: string;
  charge: number;
  concentration: number;
  fraction: number;
}
export interface EquilibriumResult {
  pH: number;
  pOH: number;
  species: AqueousSpecies[];
  ionicStrength: number;
  chargeResidual: number;
  iterations: number;
  activityModel: "ideal" | "davies";
}

/** Sequential base protonation constants reverse to the acid's sequential dissociation constants. */
export function familyFromPKb(input: Omit<AcidBaseFamily, "pKa"> & { pKb: number[] }, pKw = 14): AcidBaseFamily {
  const { pKb, ...family } = input;
  return { ...family, pKa: [...pKb].reverse().map((value) => pKw - value) };
}

/** Davies: log10 γz = −0.509 z²(√I/(1+√I) − 0.3I), I in mol/L, at 25 °C only. */
export function daviesLogGamma(charge: number, ionicStrength: number): number {
  const strengthM = ionicStrength / STANDARD_CONCENTRATION;
  const root = Math.sqrt(strengthM);
  return -0.509 * charge ** 2 * (root / (1 + root) - 0.3 * strengthM);
}

/** αj ∝ 10^(j pH − ΣpKai) γ0/γj. Log weights avoid underflow in polyprotic distributions. */
export function familyDistribution(family: AcidBaseFamily, pH: number, logGamma: (charge: number) => number = () => 0): number[] {
  let sumPKa = 0;
  const weights = [0];
  family.pKa.forEach((value, index) => {
    sumPKa += value;
    weights.push((index + 1) * pH - sumPKa + logGamma(family.protonatedCharge) - logGamma(family.protonatedCharge - index - 1));
  });
  const largest = Math.max(...weights);
  const scaled = weights.map((value) => 10 ** (value - largest));
  const total = scaled.reduce((sum, value) => sum + value, 0);
  return scaled.map((value) => value / total);
}

export function validateMixture(mixture: AqueousMixture): void {
  finite(mixture.pKw ?? 14, "pKw", 0);
  const ids = new Set<string>(["water-h", "water-oh"]);
  for (const item of [...mixture.families ?? [], ...mixture.spectators ?? []]) {
    if (!item.id.trim() || ids.has(item.id)) throw new Error("Give each chemical family or spectator a unique name.");
    ids.add(item.id);
    finite(item.concentration, "Concentration", 0);
    if ("pKa" in item) {
      if (!Number.isInteger(item.protonatedCharge)) throw new Error("The fully protonated species needs a whole-number charge.");
      item.pKa.forEach((value) => finite(value, "pKa"));
      if (item.species.length !== item.pKa.length + 1 || item.species.some((name) => !name.trim())) throw new Error("Provide one species name for each protonation state.");
    } else if (!Number.isInteger(item.charge) || item.charge === 0) throw new Error("Spectator ions need a nonzero whole-number charge.");
  }
}

/** Full electroneutrality: [H+] − [OH−] + Σ z_i C_i = 0; pH = −log10(a_H+). */
export function solveEquilibrium(mixture: AqueousMixture): EquilibriumResult {
  validateMixture(mixture);
  const pKw = mixture.pKw ?? 14;
  const model = mixture.activityModel ?? "ideal";
  let strength = 0;
  let lastPH = Infinity;
  for (let iteration = 1; iteration <= 200; iteration += 1) {
    const logGamma = (charge: number) => model === "davies" ? daviesLogGamma(charge, strength) : 0;
    const evaluate = (pH: number): AqueousSpecies[] => {
      const species: AqueousSpecies[] = [
        { familyId: "water-h", name: "H+", charge: 1, concentration: STANDARD_CONCENTRATION * 10 ** (-pH - logGamma(1)), fraction: 1 },
        { familyId: "water-oh", name: "OH−", charge: -1, concentration: STANDARD_CONCENTRATION * 10 ** (pH - pKw - logGamma(-1)), fraction: 1 },
      ];
      for (const family of mixture.families ?? []) {
        familyDistribution(family, pH, logGamma).forEach((fraction, index) => species.push({
          familyId: family.id, name: family.species[index], charge: family.protonatedCharge - index,
          concentration: family.concentration * fraction, fraction,
        }));
      }
      for (const ion of mixture.spectators ?? []) species.push({ familyId: ion.id, name: ion.id, charge: ion.charge, concentration: ion.concentration, fraction: 1 });
      return species;
    };
    const chargeBalance = (species: AqueousSpecies[]) => species.reduce((sum, entry) => sum + entry.charge * entry.concentration, 0);
    const pH = bisectRoot((value) => chargeBalance(evaluate(value)), -2, 16);
    const species = evaluate(pH);
    const calculatedStrength = species.reduce((sum, entry) => sum + entry.charge ** 2 * entry.concentration / 2, 0);
    if (model === "davies" && calculatedStrength > 500) throw new Error("Davies correction is limited to ionic strengths below 0.5 mol/L; use ideal mode for this mixture.");
    if (model === "ideal" || (Math.abs(pH - lastPH) < 1e-9 && Math.abs(calculatedStrength - strength) < 1e-8 * Math.max(calculatedStrength, 1e-6))) {
      return { pH, pOH: pKw - pH, species, ionicStrength: calculatedStrength, chargeResidual: chargeBalance(species), iterations: iteration, activityModel: model };
    }
    // Fixed-point iteration with damping couples ionic strength and activities without changing analytical totals.
    strength = (strength + calculatedStrength) / 2;
    lastPH = pH;
  }
  throw new Error("Activity correction did not settle. Try ideal mode or a more dilute solution.");
}
