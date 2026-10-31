import { describe, expect, it } from "vitest";
import { cellPotential, equilibriumFromPotential, gibbsEnergy, nernstPotential } from "@/lib/chemistry/electrochemistry";
import { solveEquilibrium, familyFromPKb, type AcidBaseFamily } from "@/lib/chemistry/equilibrium";
import {
  generateExactTitrationCurve,
  titrationAtVolume,
  titrationMilestones,
  type TitrationExperiment,
} from "@/lib/chemistry/exact-titration";
import { bisectRoot } from "@/lib/chemistry/numerics";
import { solveComplexSolubility } from "@/lib/chemistry/solubility";
import {
  dimerDissociation,
  fitVanTHoff,
  vanTHoffEnthalpy,
  vanTHoffK2,
  vanTHoffTemperature2,
} from "@/lib/chemistry/thermodynamics";

// Concentrations are mol/m³ (numerically equal to mmol/L); volumes are m³.
const triproticAcid: AcidBaseFamily = {
  id: "A",
  concentration: 2,
  pKa: [2.25, 7.05, 12.05],
  protonatedCharge: 0,
  species: ["H3A", "H2A−", "HA2−", "A3−"],
};

const diproticTitration: TitrationExperiment = {
  analyte: {
    families: [{ id: "H2A", concentration: 80, pKa: [3.4, 7.85], protonatedCharge: 0, species: ["H2A", "HA−", "A2−"] }],
  },
  initialVolume: 25e-6,
  titrantConcentration: 100,
  titrant: "base",
};

const molar = (species: { name: string; concentration: number }[], name: string) => {
  const entry = species.find((item) => item.name === name);
  if (!entry) throw new Error(`Missing species ${name}`);
  return entry.concentration / 1000;
};

describe("Q9 exact pH of 2.00 mM Na₂HA", () => {
  const result = solveEquilibrium({ families: [triproticAcid], spectators: [{ id: "Na+", charge: 1, concentration: 4 }] });

  it("reproduces the verified pH and species table", () => {
    expect(result.pH).toBeCloseTo(9.13818, 4);
    expect(result.pH.toFixed(3)).toBe("9.138");
    expect(molar(result.species, "H2A−")).toBeCloseTo(1.62e-5, 7);
    expect(molar(result.species, "HA2−")).toBeCloseTo(1.98e-3, 5);
    expect(molar(result.species, "A3−")).toBeCloseTo(2.43e-6, 8);
    expect(molar(result.species, "OH−")).toBeCloseTo(1.375e-5, 7);
  });

  it("does not follow the naive or the amphiprotic shortcut formulas", () => {
    expect(Math.abs(result.pH - (7.05 + 12.05) / 2)).toBeGreaterThan(0.4);
    const kw = 1e-14;
    const [k2, k3, c] = [10 ** -7.05, 10 ** -12.05, 2e-3];
    const shortcut = -Math.log10(Math.sqrt((k2 * (k3 * c + kw)) / (k2 + c)));
    expect(shortcut.toFixed(3)).toBe("9.140");
    expect(result.pH.toFixed(3)).not.toBe(shortcut.toFixed(3));
  });

  it("satisfies the charge balance and keeps the carbon-like mass balance", () => {
    expect(Math.abs(result.chargeResidual)).toBeLessThan(1e-8);
    const total = result.species.filter((item) => item.familyId === "A").reduce((sum, item) => sum + item.concentration, 0);
    expect(total).toBeCloseTo(2, 10);
    expect(result.pH + result.pOH).toBeCloseTo(14, 10);
  });

  it("lets Davies activities shift the pH slightly and report ionic strength", () => {
    const davies = solveEquilibrium({ families: [triproticAcid], spectators: [{ id: "Na+", charge: 1, concentration: 4 }], activityModel: "davies" });
    expect(davies.ionicStrength).toBeGreaterThan(result.ionicStrength * 0.99);
    expect(Math.abs(davies.pH - result.pH)).toBeGreaterThan(1e-3);
    expect(Math.abs(davies.pH - result.pH)).toBeLessThan(0.3);
  });

  it("handles a base family given by pKb", () => {
    const family = familyFromPKb({ id: "NH3", concentration: 100, protonatedCharge: 1, species: ["NH4+", "NH3"], pKb: [4.75] });
    expect(family.pKa[0]).toBeCloseTo(9.25, 10);
    expect(solveEquilibrium({ families: [family] }).pH).toBeCloseTo(11.12, 2);
  });
});

describe("Q10 diprotic acid titration with NaOH", () => {
  const ph = (volumeMl: number) => titrationAtVolume(diproticTitration, volumeMl * 1e-6).pH;

  it("reproduces the verified curve", () => {
    const key: [number, string][] = [[0, "2.26"], [10, "3.41"], [20, "5.63"], [30, "7.85"], [40, "10.17"], [45, "11.85"]];
    for (const [volume, expected] of key) expect(ph(volume).toFixed(2)).toBe(expected);
    expect(ph(30)).toBeCloseTo(7.85, 3);
  });

  it("finds both equivalence and half-equivalence volumes", () => {
    const milestones = titrationMilestones(diproticTitration);
    expect(milestones.equivalenceVolumes.map((volume) => volume * 1e6)).toEqual([expect.closeTo(20, 8), expect.closeTo(40, 8)]);
    expect(milestones.halfEquivalenceVolumes.map((volume) => volume * 1e6)).toEqual([expect.closeTo(10, 8), expect.closeTo(30, 8)]);
  });

  it("has non-decreasing pH as base is added", () => {
    const curve = generateExactTitrationCurve(diproticTitration, 50e-6);
    expect(curve.length).toBeGreaterThan(25);
    expect(curve[0].volume).toBe(0);
    expect(curve[curve.length - 1].volume).toBeCloseTo(50e-6, 12);
    for (let index = 1; index < curve.length; index += 1) expect(curve[index].pH).toBeGreaterThanOrEqual(curve[index - 1].pH - 1e-9);
  });

  it("closes the charge balance at every point", () => {
    for (const volume of [0, 5, 12.5, 20, 33, 40, 50]) {
      const result = titrationAtVolume(diproticTitration, volume * 1e-6);
      const scale = result.species.reduce((sum, item) => sum + Math.abs(item.charge) * item.concentration, 0);
      expect(Math.abs(result.chargeResidual) / scale).toBeLessThan(1e-8);
    }
  });

  it("handles a strong acid titrated with a strong base and a weak base titrated with acid", () => {
    const strong: TitrationExperiment = {
      analyte: { spectators: [{ id: "Cl-", charge: -1, concentration: 100 }] },
      initialVolume: 25e-6,
      titrantConcentration: 100,
      titrant: "base",
    };
    expect(titrationAtVolume(strong, 0).pH).toBeCloseTo(1, 2);
    expect(titrationAtVolume(strong, 25e-6).pH).toBeCloseTo(7, 6);
    expect(titrationAtVolume(strong, 30e-6).pH).toBeCloseTo(11.96, 2);
    expect(titrationMilestones(strong).equivalenceVolumes[0]).toBeCloseTo(25e-6, 12);
    const ammonia: TitrationExperiment = {
      analyte: { families: [familyFromPKb({ id: "NH3", concentration: 100, protonatedCharge: 1, species: ["NH4+", "NH3"], pKb: [4.75] })] },
      initialVolume: 25e-6,
      titrantConcentration: 100,
      titrant: "acid",
    };
    expect(titrationAtVolume(ammonia, 12.5e-6).pH).toBeCloseTo(9.25, 1);
    expect(titrationAtVolume(ammonia, 25e-6).pH).toBeLessThan(5.5);
  });

  it("puts the half-equivalence of a partly neutralised acid where pH = pKa", () => {
    const buffer: TitrationExperiment = {
      analyte: { families: [{ id: "HA", concentration: 100, pKa: [5], protonatedCharge: 0, species: ["HA", "A−"] }], spectators: [{ id: "Na+", charge: 1, concentration: 50 }] },
      initialVolume: 25e-6,
      titrantConcentration: 100,
      titrant: "base",
    };
    const milestones = titrationMilestones(buffer);
    expect(milestones.equivalenceVolumes[0]).toBeCloseTo(12.5e-6, 12);
    expect(milestones.halfEquivalenceVolumes).toEqual([]);
  });
});

describe("Q11 AgCl in ammonia with a common ion", () => {
  const input = {
    ksp: 1.9e-10,
    cumulativeBeta: [10 ** 3.25, 10 ** 7.1],
    ligandConcentration: 250,
    commonAnionConcentration: 10,
    background: { spectators: [{ id: "Na+", charge: 1, concentration: 10 }] },
  };
  const result = solveComplexSolubility(input);

  it("reproduces solubility, free ammonia and silver speciation", () => {
    expect(result.solubility / 1000).toBeCloseTo(7.53e-3, 5);
    expect(result.freeLigand / 1000).toBeCloseTo(0.2349, 4);
    expect(result.freeMetal / 1000).toBeCloseTo(1.08e-8, 10);
    const chloride = molar(result.species, "X");
    expect(chloride).toBeCloseTo(0.01753, 5);
    expect(result.species.find((item) => item.name === "ML2")!.fraction).toBeCloseTo(0.9994, 4);
    expect(result.species.find((item) => item.name === "ML")!.fraction).toBeCloseTo(6.0e-4, 5);
    expect(result.species.find((item) => item.name === "M")!.fraction).toBeCloseTo(1.4e-6, 7);
  });

  it("balances charge, ligand and the solubility product", () => {
    expect(Math.abs(result.chargeResidual)).toBeLessThan(1e-7);
    expect(Math.abs(result.ligandMassResidual)).toBeLessThan(1e-7);
    expect((result.freeMetal / 1000) * molar(result.species, "X")).toBeCloseTo(1.9e-10, 14);
    expect(result.pH).toBeCloseTo(7, 6);
  });

  it("shows the common-ion and ammonia trends", () => {
    const withoutCommonIon = solveComplexSolubility({ ...input, commonAnionConcentration: 0, background: undefined });
    expect(withoutCommonIon.solubility).toBeGreaterThan(result.solubility);
    expect(solveComplexSolubility({ ...input, ligandConcentration: 500 }).solubility).toBeGreaterThan(result.solubility);
    expect(solveComplexSolubility({ ...input, cumulativeBeta: [], ligandConcentration: 0 }).solubility).toBeLessThan(0.01);
  });

  it("rejects impossible inputs", () => {
    expect(() => solveComplexSolubility({ ...input, ksp: 0 })).toThrow(/greater than zero/);
    expect(() => solveComplexSolubility({ ...input, metalCharge: 1.5 })).toThrow(/whole number/);
    expect(() => solveComplexSolubility({ ...input, commonAnionConcentration: -1 })).toThrow(/Common-ion/);
  });
});

describe("Q12 Nernst: permanganate against Ag/AgCl", () => {
  const ksp = 1.8e-10;
  const h = 10 ** -2.3;
  const cathode = { standardPotential: 1.512, electrons: 5, reactionQuotient: 0.002 / (0.01 * h ** 8) };
  // Ag⁺ + e⁻ → Ag with [Ag⁺] = Ksp/[Cl⁻]; Q = 1/[Ag⁺].
  const anode = { standardPotential: 0.7996, electrons: 1, reactionQuotient: 0.025 / ksp };

  it("reproduces E°(AgCl/Ag), each electrode and the cell potential", () => {
    expect(nernstPotential({ standardPotential: 0.7996, electrons: 1, reactionQuotient: 1 / ksp })).toBeCloseTo(0.2231, 4);
    expect(nernstPotential(cathode)).toBeCloseTo(1.30256, 4);
    expect(nernstPotential(anode)).toBeCloseTo(0.31789, 4);
    const cell = cellPotential(cathode, anode);
    expect(cell).toBeCloseTo(0.98468, 4);
    expect(cell.toFixed(3)).toBe("0.985");
  });

  it("reproduces ΔG and log K for the five-electron reaction", () => {
    expect(gibbsEnergy(cellPotential(cathode, anode), 5) / 1000).toBeCloseTo(-475.0, 0);
    const standardCell = 1.512 - (0.7996 + (8.314462 * 298.15 * Math.log(ksp)) / 96485.33);
    expect(standardCell).toBeCloseTo(1.2889, 4);
    const { lnK } = equilibriumFromPotential(standardCell, 5);
    expect(lnK / Math.LN10).toBeCloseTo(108.9, 1);
  });

  it("returns E° when Q = 1 and falls 59 mV per decade for a one-electron couple", () => {
    expect(nernstPotential({ standardPotential: 0.34, electrons: 2, reactionQuotient: 1 })).toBeCloseTo(0.34, 12);
    const step = nernstPotential({ standardPotential: 0, electrons: 1, reactionQuotient: 1 }) - nernstPotential({ standardPotential: 0, electrons: 1, reactionQuotient: 10 });
    expect(step).toBeCloseTo(0.05916, 4);
  });

  it("rejects unphysical inputs", () => {
    expect(() => nernstPotential({ ...cathode, reactionQuotient: 0 })).toThrow(/greater than zero/);
    expect(() => nernstPotential({ ...cathode, electrons: 1.5 })).toThrow(/whole number/);
    expect(() => nernstPotential(cathode, -5)).toThrow(/kelvin/);
    expect(() => gibbsEnergy(Number.NaN, 2)).toThrow(/finite/);
  });
});

describe("Q13 van ’t Hoff for N₂O₄ ⇌ 2NO₂", () => {
  const [k1, t1, enthalpy] = [0.142, 298.15, 58300];

  it("reproduces the temperature where K = 1 and K at 340.0 K", () => {
    expect(vanTHoffTemperature2(k1, 1, t1, enthalpy)).toBeCloseTo(325.135, 2);
    expect(vanTHoffK2(k1, t1, 340, enthalpy)).toBeCloseTo(2.5673, 3);
  });

  it("solves the rigid-vessel ICE table", () => {
    const state = dimerDissociation(vanTHoffK2(k1, t1, 340, enthalpy), 0.4);
    expect(state.extent).toBeCloseTo(0.27885, 4);
    expect(state.totalPressure).toBeCloseTo(0.679, 3);
    expect(state.degreeOfDissociation).toBeCloseTo(0.697, 3);
    expect(state.monomerPressure).toBeCloseTo(0.558, 3);
    expect(state.dimerPressure).toBeCloseTo(0.121, 3);
    expect(state.monomerPressure ** 2 / state.dimerPressure).toBeCloseTo(vanTHoffK2(k1, t1, 340, enthalpy), 10);
  });

  it("recovers enthalpy and entropy from the van ’t Hoff line", () => {
    expect(vanTHoffEnthalpy(k1, vanTHoffK2(k1, t1, 340, enthalpy), t1, 340)).toBeCloseTo(enthalpy, 6);
    const temperatures = [290, 300, 310, 320, 330, 340];
    const fit = fitVanTHoff(temperatures.map((temperature) => ({ temperature, equilibriumConstant: vanTHoffK2(k1, t1, temperature, enthalpy) })));
    expect(fit.slope).toBeCloseTo(-7012, 0);
    expect(fit.enthalpy).toBeCloseTo(enthalpy, 4);
    expect(fit.entropy).toBeCloseTo(179.31, 1);
    expect(fit.rSquared).toBeCloseTo(1, 12);
    expect(fit.enthalpy / fit.entropy).toBeCloseTo(325.135, 1);
  });

  it("rejects bad inputs", () => {
    expect(() => vanTHoffK2(0, t1, 340, enthalpy)).toThrow(/greater than zero/);
    expect(() => vanTHoffEnthalpy(k1, 1, 300, 300)).toThrow(/different temperatures/);
    expect(() => vanTHoffTemperature2(k1, 1, t1, 0)).toThrow(/nonzero enthalpy/);
    expect(() => fitVanTHoff([{ temperature: 300, equilibriumConstant: 1 }])).toThrow(/at least two/);
    expect(() => fitVanTHoff([{ temperature: 300, equilibriumConstant: 1 }, { temperature: 300, equilibriumConstant: 2 }])).toThrow(/different temperatures/);
    expect(() => dimerDissociation(1, 0)).toThrow(/greater than zero/);
  });
});

describe("shared numerics and validation", () => {
  it("brackets a root or says why it cannot", () => {
    expect(bisectRoot((value) => value ** 2 - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 9);
    expect(() => bisectRoot((value) => value ** 2 + 1, 0, 2)).toThrow(/No equilibrium was bracketed/);
    expect(() => bisectRoot(() => Number.NaN, 0, 2)).toThrow(/numerical range/);
  });

  it("rejects malformed mixtures with clear messages", () => {
    const base: AcidBaseFamily = { id: "A", concentration: 1, pKa: [4], protonatedCharge: 0, species: ["HA", "A−"] };
    expect(() => solveEquilibrium({ families: [{ ...base, concentration: -1 }] })).toThrow(/Concentration/);
    expect(() => solveEquilibrium({ families: [{ ...base, species: ["HA"] }] })).toThrow(/one species name/);
    expect(() => solveEquilibrium({ families: [base, base] })).toThrow(/unique/);
    expect(() => solveEquilibrium({ families: [{ ...base, protonatedCharge: 0.5 }] })).toThrow(/whole-number/);
    expect(() => solveEquilibrium({ spectators: [{ id: "X", charge: 0, concentration: 1 }] })).toThrow(/nonzero/);
    expect(() => solveEquilibrium({ families: [{ ...base, pKa: [Number.NaN] }] })).toThrow(/pKa/);
    expect(() => titrationAtVolume({ ...diproticTitration, initialVolume: 0 }, 1e-6)).toThrow(/Starting volume/);
    expect(() => titrationAtVolume(diproticTitration, -1e-6)).toThrow(/Added volume/);
    expect(() => titrationAtVolume({ ...diproticTitration, titrantConcentration: Number.NaN }, 1e-6)).toThrow(/Titrant concentration/);
    expect(() => generateExactTitrationCurve(diproticTitration, 0)).toThrow(/Graph volume range/);
  });
});
