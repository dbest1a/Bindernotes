import { finite, GAS_CONSTANT, positive } from "./numerics";

/** ln(K2/K1)=−ΔH°/R(1/T2−1/T1); constant ΔH° across the interval, temperatures in K, ΔH in J/mol. */
export function vanTHoffK2(k1: number, temperature1: number, temperature2: number, enthalpy: number): number {
  positive(k1, "Starting equilibrium constant");
  positive(temperature1, "Starting temperature in kelvin");
  positive(temperature2, "Final temperature in kelvin");
  finite(enthalpy, "Enthalpy in joules per mole");
  const result = Math.exp(Math.log(k1) - enthalpy / GAS_CONSTANT * (1 / temperature2 - 1 / temperature1));
  if (!Number.isFinite(result) || result === 0) throw new Error("The equilibrium constant is outside the numerical range.");
  return result;
}
export function vanTHoffTemperature2(k1: number, k2: number, temperature1: number, enthalpy: number): number {
  positive(k1, "Starting equilibrium constant"); positive(k2, "Final equilibrium constant"); positive(temperature1, "Starting temperature in kelvin"); finite(enthalpy, "Enthalpy");
  if (enthalpy === 0) throw new Error("A nonzero enthalpy is needed to determine a temperature.");
  return positive(1 / (1 / temperature1 - GAS_CONSTANT * Math.log(k2 / k1) / enthalpy), "Calculated temperature in kelvin");
}
export function vanTHoffEnthalpy(k1: number, k2: number, temperature1: number, temperature2: number): number {
  positive(k1, "Starting equilibrium constant"); positive(k2, "Final equilibrium constant"); positive(temperature1, "Starting temperature in kelvin"); positive(temperature2, "Final temperature in kelvin");
  if (temperature1 === temperature2) throw new Error("Use two different temperatures to determine enthalpy.");
  return -GAS_CONSTANT * Math.log(k2 / k1) / (1 / temperature2 - 1 / temperature1);
}
export interface EquilibriumTemperaturePoint { temperature: number; equilibriumConstant: number }
export interface VanTHoffFit { enthalpy: number; entropy: number; slope: number; intercept: number; rSquared: number }
/** Least-squares ln K=m/T+b, ΔH°=−Rm and ΔS°=Rb. K must be dimensionless and use one standard state. */
export function fitVanTHoff(points: EquilibriumTemperaturePoint[]): VanTHoffFit {
  if (points.length < 2) throw new Error("Enter at least two equilibrium measurements.");
  const rows = points.map((point) => ({ x: 1 / positive(point.temperature, "Temperature in kelvin"), y: Math.log(positive(point.equilibriumConstant, "Equilibrium constant")) }));
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  const varianceX = rows.reduce((sum, row) => sum + (row.x - meanX) ** 2, 0);
  if (varianceX === 0) throw new Error("Use at least two different temperatures.");
  const slope = rows.reduce((sum, row) => sum + (row.x - meanX) * (row.y - meanY), 0) / varianceX;
  const intercept = meanY - slope * meanX;
  const residual = rows.reduce((sum, row) => sum + (row.y - slope * row.x - intercept) ** 2, 0);
  const varianceY = rows.reduce((sum, row) => sum + (row.y - meanY) ** 2, 0);
  return { enthalpy: -GAS_CONSTANT * slope, entropy: GAS_CONSTANT * intercept, slope, intercept, rSquared: varianceY === 0 ? 1 : 1 - residual / varianceY };
}
/** Dimer ⇌ 2 monomer at constant volume and temperature: K = 4x²/(P0 − x), partial pressures in units of the standard pressure. */
export function dimerDissociation(equilibriumConstant: number, initialDimerPressure: number): { extent: number; dimerPressure: number; monomerPressure: number; totalPressure: number; degreeOfDissociation: number } {
  positive(equilibriumConstant, "Equilibrium constant");
  positive(initialDimerPressure, "Starting pressure");
  // Positive root of 4x² + Kx − K P0 = 0 in a cancellation-free form.
  const extent = 2 * equilibriumConstant * initialDimerPressure / (equilibriumConstant + Math.sqrt(equilibriumConstant ** 2 + 16 * equilibriumConstant * initialDimerPressure));
  return { extent, dimerPressure: initialDimerPressure - extent, monomerPressure: 2 * extent, totalPressure: initialDimerPressure + extent, degreeOfDissociation: extent / initialDimerPressure };
}
