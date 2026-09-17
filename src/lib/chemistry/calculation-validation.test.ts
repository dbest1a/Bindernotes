import { describe, expect, it } from "vitest";
import { calculateHendersonHasselbalch, calculateStrongAcidBase } from "@/lib/chemistry/acid-base";
import { calculateDilution } from "@/lib/chemistry/dilution";
import { generateKineticsDataset } from "@/lib/chemistry/kinetics";
import { solveStoichiometryProblem } from "@/lib/chemistry/stoichiometry";
import { calculateHeatTransfer } from "@/lib/chemistry/thermochemistry";
import { generateStrongAcidStrongBaseCurve } from "@/lib/chemistry/titration";
import {
  calculateStrongAcidStrongBasePh,
  createTitrationInitialState,
  titrationReducer,
} from "@/lib/chemistry/titration-lab";

describe("chemistry calculation domains", () => {
  it("includes water autoionization in very dilute strong acids and bases at 25 C", () => {
    // Independent charge balance / Kw reference values, not values from another production helper.
    const acid = calculateStrongAcidBase({ kind: "acid", concentrationM: 1e-8 });
    expect(acid.ph).toBeCloseTo(6.978294313542887, 12);
    expect(acid.hydronium).toBeCloseTo(1.0512492197250393e-7, 18);
    expect(acid.hydronium - acid.hydroxide).toBeCloseTo(1e-8, 18);
    expect(calculateStrongAcidBase({ kind: "base", concentrationM: 1e-8 }).ph).toBeCloseTo(
      7.021705686457113,
      12,
    );
    expect(calculateStrongAcidBase({ kind: "acid", concentrationM: 0 }).ph).toBe(7);
  });

  it.each([-1, NaN, Infinity, -Infinity])("rejects invalid acid concentration %s", (concentrationM) => {
    expect(() => calculateStrongAcidBase({ kind: "acid", concentrationM })).toThrow(RangeError);
  });

  it("rejects invalid buffer domains and computes a ten-to-one buffer ratio", () => {
    expect(calculateHendersonHasselbalch({ pKa: 4.75, conjugateBaseM: 0.1, weakAcidM: 0.01 })).toBeCloseTo(
      5.75,
      12,
    );
    for (const weakAcidM of [0, -1, NaN, Infinity]) {
      expect(() => calculateHendersonHasselbalch({ pKa: 4.75, conjugateBaseM: 0.1, weakAcidM })).toThrow(
        RangeError,
      );
    }
  });

  it("preserves the dilute-acid result in a titration instead of rounding all small mole differences to neutral", () => {
    expect(
      calculateStrongAcidStrongBasePh({
        acidMolarity: 1e-8,
        acidVolumeMl: 25,
        baseMolarity: 0.1,
        baseVolumeMl: 0,
      }),
    ).toBeCloseTo(6.978294313542887, 12);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid initial titration volume %s", (acidVolumeMl) => {
    expect(() =>
      calculateStrongAcidStrongBasePh({
        acidMolarity: 0.1,
        acidVolumeMl,
        baseMolarity: 0.1,
        baseVolumeMl: 0,
      }),
    ).toThrow(RangeError);
  });

  it.each([0, -1, NaN, Infinity, 1e-12])("rejects invalid or unbounded titration step %s", (stepMl) => {
    expect(() =>
      generateStrongAcidStrongBaseCurve({ acidMolarity: 0.1, acidVolumeMl: 25, baseMolarity: 0.1, stepMl }),
    ).toThrow(RangeError);
  });

  it("validates dilution domains without replacing zero or missing inputs", () => {
    expect(calculateDilution({ stockM: 1, targetM: 0.1, targetVolumeMl: 250 }).stockVolumeMl).toBe(25);
    expect(calculateDilution({ stockM: 1, targetM: 0, targetVolumeMl: 250 }).stockVolumeMl).toBe(0);
    expect(() => calculateDilution({ stockM: 0.1, targetM: 1, targetVolumeMl: 250 })).toThrow(
      /cannot exceed/i,
    );
    for (const stockM of [0, -1, NaN, Infinity]) {
      expect(() => calculateDilution({ stockM, targetM: 0.1, targetVolumeMl: 250 })).toThrow(RangeError);
    }
  });

  it.each([0, -1, 1.5, NaN, Infinity, 10001])("bounds kinetics sample counts %s", (points) => {
    expect(() =>
      generateKineticsDataset({ order: 1, initialConcentrationM: 1, rateConstant: 0.1, points }),
    ).toThrow(RangeError);
  });

  it("places the actual equivalence point in range instead of labeling an adjacent sample", () => {
    const input = { acidMolarity: 0.1, acidVolumeMl: 26.3, baseMolarity: 0.1, stepMl: 2.5 };
    const curve = generateStrongAcidStrongBaseCurve(input);
    expect(curve.filter((point) => point.equivalence)).toEqual([
      { volumeMl: 26.3, ph: 7, equivalence: true },
    ]);
    expect(
      generateStrongAcidStrongBaseCurve({ ...input, maxBaseVolumeMl: 10 }).every(
        (point) => point.volumeMl <= 10,
      ),
    ).toBe(true);
  });

  it("rejects invalid titrant additions rather than resetting an existing experiment to zero", () => {
    const state = titrationReducer(createTitrationInitialState(), { type: "add_titrant", volumeMl: 5 });
    for (const volumeMl of [-1, NaN, Infinity]) {
      expect(() => titrationReducer(state, { type: "add_titrant", volumeMl })).toThrow(RangeError);
    }
  });

  it("uses independent integrated-rate-law examples, preserving small concentrations", () => {
    const common = { initialConcentrationM: 1, points: 3, durationS: 20 };
    expect(
      generateKineticsDataset({ ...common, order: 0, rateConstant: 0.01 }).map(
        (point) => point.concentrationM,
      ),
    ).toEqual([1, 0.9, 0.8]);
    expect(
      generateKineticsDataset({ ...common, order: 1, rateConstant: Math.LN2 / 10 })[2].concentrationM,
    ).toBeCloseTo(0.25, 12);
    expect(generateKineticsDataset({ ...common, order: 2, rateConstant: 0.1 })[2].concentrationM).toBeCloseTo(
      1 / 3,
      12,
    );
    expect(
      generateKineticsDataset({ ...common, order: 1, rateConstant: 0, initialConcentrationM: 1e-12 })[2]
        .concentrationM,
    ).toBe(1e-12);
  });

  it.each([-1, NaN, Infinity])("rejects invalid kinetic rates %s", (rateConstant) => {
    expect(() => generateKineticsDataset({ order: 1, initialConcentrationM: 1, rateConstant })).toThrow(
      RangeError,
    );
  });

  it("validates calorimetry but allows cooling and zero temperature change", () => {
    expect(calculateHeatTransfer({ massG: 1, specificHeatJPerGC: 4.184, deltaTemperatureC: -2 })).toBe(
      -8.368,
    );
    expect(calculateHeatTransfer({ massG: 1, specificHeatJPerGC: 4.184, deltaTemperatureC: 0 })).toBe(0);
    for (const massG of [0, -1, NaN, Infinity]) {
      expect(() => calculateHeatTransfer({ massG, specificHeatJPerGC: 4.184, deltaTemperatureC: 2 })).toThrow(
        RangeError,
      );
    }
  });

  it("checks every scientific numeric field and rejects output overflow", () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(() => calculateHendersonHasselbalch({ pKa: invalid, conjugateBaseM: 1, weakAcidM: 1 })).toThrow(
        RangeError,
      );
      expect(() => calculateHendersonHasselbalch({ pKa: 4, conjugateBaseM: invalid, weakAcidM: 1 })).toThrow(
        RangeError,
      );
      for (const field of ["acidMolarity", "baseMolarity", "baseVolumeMl"] as const) {
        expect(() =>
          calculateStrongAcidStrongBasePh({
            acidMolarity: 0.1,
            acidVolumeMl: 25,
            baseMolarity: 0.1,
            baseVolumeMl: 5,
            [field]: invalid,
          }),
        ).toThrow(RangeError);
      }
      for (const field of ["specificHeatJPerGC", "deltaTemperatureC"] as const) {
        expect(() =>
          calculateHeatTransfer({
            massG: 1,
            specificHeatJPerGC: 4.184,
            deltaTemperatureC: 2,
            [field]: invalid,
          }),
        ).toThrow(RangeError);
      }
      for (const field of ["initialConcentrationM", "durationS"] as const) {
        expect(() =>
          generateKineticsDataset({
            order: 1,
            initialConcentrationM: 1,
            rateConstant: 0.01,
            [field]: invalid,
          }),
        ).toThrow(RangeError);
      }
    }
    expect(() =>
      calculateHeatTransfer({
        massG: Number.MAX_VALUE,
        specificHeatJPerGC: Number.MAX_VALUE,
        deltaTemperatureC: 1,
      }),
    ).toThrow(RangeError);
    expect(() => generateKineticsDataset({ order: 1, initialConcentrationM: 0, rateConstant: 0 })).toThrow(
      RangeError,
    );
    expect(() => calculateHendersonHasselbalch({ pKa: 4, conjugateBaseM: 0, weakAcidM: 1 })).toThrow(
      RangeError,
    );
  });

  it.each([NaN, Infinity, -Infinity, 0, -1])("rejects invalid stoichiometry quantities %s", (quantity) => {
    expect(
      solveStoichiometryProblem({
        equation: "N2 + H2 -> NH3",
        given: { formula: "H2", quantity, unit: "mol" },
        target: { formula: "NH3", unit: "mol" },
      }),
    ).toMatchObject({ ok: false, code: "INVALID_QUANTITY" });
  });

  it("calculates a known mole ratio and rejects invalid significant figures", () => {
    const input = {
      equation: "N2 + H2 -> NH3",
      given: { formula: "H2", quantity: 6, unit: "mol" as const },
      target: { formula: "NH3", unit: "mol" as const },
    };
    expect(solveStoichiometryProblem(input)).toMatchObject({ ok: true, finalAnswer: { value: 4 } });
    for (const significantFigures of [0, -1, 1.5, NaN, Infinity]) {
      expect(solveStoichiometryProblem({ ...input, significantFigures })).toMatchObject({ ok: false });
    }
  });
});
