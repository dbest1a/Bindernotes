import { familyDistribution, solveEquilibrium, type AcidBaseFamily, type AqueousMixture, type AqueousSpecies } from "./equilibrium";
import { bisectRoot, finite, positive, STANDARD_CONCENTRATION } from "./numerics";

export interface ComplexSolubilityInput {
  ksp: number;
  cumulativeBeta: number[];
  ligandConcentration: number;
  /** Anion X already present from a soluble salt (mol/m³); put that salt's cation in `background.spectators`. */
  commonAnionConcentration?: number;
  metalCharge?: number;
  ligandPKa?: number[];
  anionPKa?: number[];
  background?: AqueousMixture;
}
export interface ComplexSolubilityResult {
  pH: number;
  solubility: number;
  freeMetal: number;
  freeLigand: number;
  species: AqueousSpecies[];
  chargeResidual: number;
  ligandMassResidual: number;
  assumptions: string[];
}

/** Saturated 1:1 MX with excess solid; neutral L binds M, βj=[MLj]/([M][L]^j).
 * Ksp and cumulative β refer to mol/L standard-state ratios; all returned concentrations use mol/m³.
 * Protonated ligand and anion do not bind. No mixed/hydroxo complexes, ion pairing or activity correction.
 */
export function solveComplexSolubility(input: ComplexSolubilityInput): ComplexSolubilityResult {
  positive(input.ksp, "Solubility product");
  const commonAnion = finite(input.commonAnionConcentration ?? 0, "Common-ion concentration", 0);
  finite(input.ligandConcentration, "Total ligand concentration", 0);
  input.cumulativeBeta.forEach((value) => positive(value, "Cumulative formation constant"));
  const charge = input.metalCharge ?? 1;
  if (!Number.isInteger(charge) || charge <= 0) throw new Error("Metal charge must be a positive whole number.");
  if (input.background?.activityModel === "davies") throw new Error("The coupled solubility calculation currently uses ideal activities only.");
  const ligand: AcidBaseFamily = { id: "ligand", concentration: input.ligandConcentration, pKa: input.ligandPKa ?? [], protonatedCharge: input.ligandPKa?.length ?? 0, species: Array.from({ length: (input.ligandPKa?.length ?? 0) + 1 }, (_, index) => `L protonation ${index}`) };
  const anion: AcidBaseFamily = { id: "anion", concentration: 0, pKa: input.anionPKa ?? [], protonatedCharge: (input.anionPKa?.length ?? 0) - charge, species: Array.from({ length: (input.anionPKa?.length ?? 0) + 1 }, (_, index) => `X protonation ${index}`) };
  // Validate names, amounts, pKa values and charges before entering nested roots.
  solveEquilibrium({ ...input.background, families: [...input.background?.families ?? [], { ...ligand, concentration: 0 }, anion] });
  const evaluate = (pH: number) => {
    const ligandFractions = familyDistribution(ligand, pH);
    const anionFractions = familyDistribution(anion, pH);
    const freeLigandFraction = ligandFractions[ligandFractions.length - 1];
    const freeAnionFraction = anionFractions[anionFractions.length - 1];
    const atLigand = (freeLigand: number) => {
      const weights = [1, ...input.cumulativeBeta.map((beta, index) => beta * (freeLigand / STANDARD_CONCENTRATION) ** (index + 1))];
      const alphaMetal = weights.reduce((sum, value) => sum + value, 0);
      // [M]=s/αM, [X]=(c0+s) fX, so s² + c0 s = q with q=c°²Ksp αM/fX. The rationalised root avoids cancellation when c0 is large.
      const q = (STANDARD_CONCENTRATION ** 2) * input.ksp * alphaMetal / freeAnionFraction;
      const solubility = 2 * q / (commonAnion + Math.sqrt(commonAnion ** 2 + 4 * q));
      const complexes = weights.map((weight) => solubility * weight / alphaMetal);
      const unboundLigand = freeLigand / freeLigandFraction;
      const totalLigand = unboundLigand + complexes.reduce((sum, value, index) => sum + index * value, 0);
      return { solubility, complexes, unboundLigand, totalLigand };
    };
    const upper = input.ligandConcentration * freeLigandFraction;
    const freeLigand = upper === 0 ? 0 : bisectRoot((fraction) => atLigand(upper * fraction).totalLigand - input.ligandConcentration, 0, 1, 1e-12) * upper;
    const resolved = atLigand(freeLigand);
    const species: AqueousSpecies[] = resolved.complexes.map((concentration, index) => ({ familyId: "metal", name: index === 0 ? "M" : `ML${index === 1 ? "" : index}`, charge, concentration, fraction: concentration / resolved.solubility }));
    ligandFractions.forEach((fraction, index) => species.push({ familyId: "ligand", name: index === ligandFractions.length - 1 ? "L" : `H${ligandFractions.length - 1 - index}L`, charge: ligand.protonatedCharge - index, concentration: resolved.unboundLigand * fraction, fraction }));
    anionFractions.forEach((fraction, index) => species.push({ familyId: "anion", name: index === anionFractions.length - 1 ? "X" : `H${anionFractions.length - 1 - index}X`, charge: anion.protonatedCharge - index, concentration: (commonAnion + resolved.solubility) * fraction, fraction }));
    for (const family of input.background?.families ?? []) familyDistribution(family, pH).forEach((fraction, index) => species.push({ familyId: family.id, name: family.species[index], charge: family.protonatedCharge - index, concentration: family.concentration * fraction, fraction }));
    for (const ion of input.background?.spectators ?? []) species.push({ familyId: ion.id, name: ion.id, charge: ion.charge, concentration: ion.concentration, fraction: 1 });
    species.push({ familyId: "water", name: "H+", charge: 1, concentration: STANDARD_CONCENTRATION * 10 ** -pH, fraction: 1 }, { familyId: "water", name: "OH−", charge: -1, concentration: STANDARD_CONCENTRATION * 10 ** (pH - (input.background?.pKw ?? 14)), fraction: 1 });
    return { ...resolved, freeLigand, species, chargeResidual: species.reduce((sum, entry) => sum + entry.charge * entry.concentration, 0) };
  };
  const pH = bisectRoot((value) => evaluate(value).chargeResidual, -2, 16);
  const result = evaluate(pH);
  return { pH, solubility: result.solubility, freeMetal: result.complexes[0], freeLigand: result.freeLigand, species: result.species, chargeResidual: result.chargeResidual, ligandMassResidual: result.totalLigand - input.ligandConcentration,
    assumptions: [commonAnion > 0 ? "Excess 1:1 MX solid at saturation; the common anion is the only X present before dissolving." : "Excess 1:1 MX solid at saturation; no initial dissolved metal or X.", "Ideal activities; constants use a 1 mol/L standard state.", "Neutral unprotonated ligand binds; protonated ligand and anion do not form complexes.", "No hydrolysis, competing precipitates, mixed complexes or volume change."] };
}
