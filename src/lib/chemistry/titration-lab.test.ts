import { describe, expect, it } from "vitest";
import {
  calculateStrongAcidStrongBasePh,
  createTitrationInitialState,
  titrationReducer,
} from "@/lib/chemistry/titration-lab";

describe("acid-base titration lab engine", () => {
  it("calculates strong acid and strong base pH before, at, and after equivalence", () => {
    expect(
      calculateStrongAcidStrongBasePh({
        acidMolarity: 0.1,
        acidVolumeMl: 25,
        baseMolarity: 0.1,
        baseVolumeMl: 0,
      }),
    ).toBeCloseTo(1, 2);
    expect(
      calculateStrongAcidStrongBasePh({
        acidMolarity: 0.1,
        acidVolumeMl: 25,
        baseMolarity: 0.1,
        baseVolumeMl: 25,
      }),
    ).toBeCloseTo(7, 2);
    expect(
      calculateStrongAcidStrongBasePh({
        acidMolarity: 0.1,
        acidVolumeMl: 25,
        baseMolarity: 0.1,
        baseVolumeMl: 30,
      }),
    ).toBeCloseTo(11.96, 2);
  });

  it("records controlled checkpoints instead of per-frame logs", () => {
    const initial = createTitrationInitialState();
    const withTitrant = titrationReducer(initial, { type: "add_titrant", volumeMl: 5 });
    const withConclusion = titrationReducer(withTitrant, {
      type: "update_notebook",
      section: "conclusion",
      value: "Endpoint was reached after a gradual pH jump.",
    });

    expect(withTitrant.measurements).toHaveLength(1);
    expect(withTitrant.titrantAddedMl).toBe(5);
    expect(withConclusion.notebook.conclusion).toMatch(/endpoint/i);
    expect(withConclusion).not.toHaveProperty("frameLog");
  });
});
