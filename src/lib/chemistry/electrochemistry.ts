import { FARADAY_CONSTANT, GAS_CONSTANT, finite, positive } from "./numerics";

export interface HalfReaction { standardPotential: number; electrons: number; reactionQuotient: number }
/** Reduction potential E=E°−RT ln(Q)/(nF). Q is dimensionless: omit pure solids/liquids. */
export function nernstPotential(reaction: HalfReaction, temperature = 298.15): number {
  finite(reaction.standardPotential, "Standard potential");
  positive(reaction.electrons, "Electron count");
  if (!Number.isInteger(reaction.electrons)) throw new Error("Electron count must be a whole number.");
  positive(reaction.reactionQuotient, "Reaction quotient");
  positive(temperature, "Temperature in kelvin");
  return reaction.standardPotential - GAS_CONSTANT * temperature * Math.log(reaction.reactionQuotient) / (reaction.electrons * FARADAY_CONSTANT);
}
/** Ecell=Ecathode−Eanode; both supplied half-reactions are written as reductions. */
export function cellPotential(cathode: HalfReaction, anode: HalfReaction, temperature = 298.15): number {
  return nernstPotential(cathode, temperature) - nernstPotential(anode, temperature);
}
/** ΔG=−nFE, J/mol of the balanced cell reaction. */
export function gibbsEnergy(potential: number, electrons: number): number {
  finite(potential, "Cell potential");
  positive(electrons, "Electron count");
  if (!Number.isInteger(electrons)) throw new Error("Electron count must be a whole number.");
  return -electrons * FARADAY_CONSTANT * potential;
}
/** ln K=nFE°/(RT). Return lnK as well as K to expose overflow honestly. */
export function equilibriumFromPotential(standardPotential: number, electrons: number, temperature = 298.15): { equilibriumConstant: number; lnK: number } {
  positive(temperature, "Temperature in kelvin");
  const lnK = -gibbsEnergy(standardPotential, electrons) / (GAS_CONSTANT * temperature);
  return { equilibriumConstant: Math.exp(lnK), lnK };
}
