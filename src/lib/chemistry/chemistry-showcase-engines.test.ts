import { describe, expect, it } from "vitest";
import { calculateStrongAcidBase, getPhScaleLabel } from "@/lib/chemistry/acid-base";
import { generateKineticsDataset } from "@/lib/chemistry/kinetics";
import { findElement, getTrendScore } from "@/lib/chemistry/periodic-table-data";
import { calculateHeatTransfer } from "@/lib/chemistry/thermochemistry";
import { generateStrongAcidStrongBaseCurve } from "@/lib/chemistry/titration";

describe("chemistry showcase deterministic helpers", () => {
  it("finds elements by name, symbol, and atomic number", () => {
    expect(findElement("Carbon")?.symbol).toBe("C");
    expect(findElement("Na")?.name).toBe("Sodium");
    expect(findElement("26")?.symbol).toBe("Fe");
    expect(getTrendScore(findElement("O")!, "electronegativity")).toBeGreaterThan(getTrendScore(findElement("S")!, "electronegativity"));
  });

  it("calculates acid-base, titration, kinetics, and calorimetry data without network calls", () => {
    const acid = calculateStrongAcidBase({ kind: "acid", concentrationM: 0.01 });
    expect(acid.ph).toBeCloseTo(2);
    expect(getPhScaleLabel(acid.ph)).toBe("strongly acidic");
    expect(generateStrongAcidStrongBaseCurve({ acidMolarity: 0.1, acidVolumeMl: 25, baseMolarity: 0.1 }).some((point) => point.equivalence)).toBe(true);
    expect(generateKineticsDataset({ order: 1, initialConcentrationM: 1, rateConstant: 0.02 })[1].concentrationM).toBeLessThan(1);
    expect(calculateHeatTransfer({ massG: 100, specificHeatJPerGC: 4.184, deltaTemperatureC: 8 })).toBeCloseTo(3347.2);
  });
});
