import { describe, expect, it } from "vitest";
import {
  calculateStrongAcidStrongBasePh,
  calculateTitrationPh,
  classifyTitrationVolume,
  createTitrationInitialState,
  generateTitrationCurve,
  getTitrationGraphMaxMl,
  getTitrationMarkers,
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

  it("keeps the strong acid default and agrees with the shortcut formula", () => {
    const initial = createTitrationInitialState();
    expect(initial.acidKind).toBe("strong");
    expect(initial.pKa).toEqual([]);
    expect(initial.ph).toBeCloseTo(1, 2);
    expect(getTitrationMarkers(initial)).toEqual({ equivalenceMl: [expect.closeTo(25, 8)], halfEquivalenceMl: [] });
    expect(calculateTitrationPh(initial, 25)).toBeCloseTo(7, 6);
    expect(calculateTitrationPh(initial, 30)).toBeCloseTo(11.96, 2);
  });

  it("titrates a weak monoprotic acid exactly, with pH = pKa at half-equivalence", () => {
    const state = titrationReducer(createTitrationInitialState(), { type: "configure_acid", acidKind: "weak-monoprotic", pKa: [4.76] });
    expect(state.acidFormula).toBe("HA");
    const markers = getTitrationMarkers(state);
    expect(markers.equivalenceMl[0]).toBeCloseTo(25, 8);
    expect(markers.halfEquivalenceMl[0]).toBeCloseTo(12.5, 8);
    expect(calculateTitrationPh(state, 12.5)).toBeCloseTo(4.76, 2);
    expect(calculateTitrationPh(state, 0)).toBeCloseTo(2.88, 2);
    expect(calculateTitrationPh(state, 25)).toBeCloseTo(8.73, 2);
    expect(calculateTitrationPh(state, 30)).toBeCloseTo(11.96, 2);
  });

  it("titrates a diprotic acid with two equivalence points and a wider graph", () => {
    const state = titrationReducer(createTitrationInitialState(), { type: "configure_acid", acidKind: "weak-diprotic", pKa: [3.4, 7.85] });
    const markers = getTitrationMarkers(state);
    expect(markers.equivalenceMl).toEqual([expect.closeTo(25, 8), expect.closeTo(50, 8)]);
    expect(markers.halfEquivalenceMl).toEqual([expect.closeTo(12.5, 8), expect.closeTo(37.5, 8)]);
    expect(getTitrationGraphMaxMl(state)).toBe(65);
    expect(classifyTitrationVolume(markers, 37.5)).toBe("half-equivalence");
    expect(classifyTitrationVolume(markers, 30)).toBe("between");
    expect(classifyTitrationVolume(markers, 60)).toBe("past");
    const curve = generateTitrationCurve(state);
    expect(curve.at(-1)?.volumeMl).toBeCloseTo(65, 8);
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index].ph).toBeGreaterThanOrEqual(curve[index - 1].ph - 1e-9);
    }
    const moved = titrationReducer(state, { type: "add_titrant", volumeMl: 5 });
    expect(moved.ph).toBe(Number(calculateTitrationPh(state, 5).toFixed(2)));
  });

  it("restarts the titration when the acid changes and keeps pKa values valid", () => {
    const started = titrationReducer(createTitrationInitialState(), { type: "add_titrant", volumeMl: 5 });
    const weak = titrationReducer(started, { type: "configure_acid", acidKind: "weak-monoprotic" });
    expect(weak.measurements).toHaveLength(0);
    expect(weak.titrantAddedMl).toBe(0);
    expect(weak.pKa).toEqual([4.76]);
    const clamped = titrationReducer(weak, { type: "configure_acid", acidKind: "weak-diprotic", pKa: [Number.NaN, 99] });
    expect(clamped.pKa).toEqual([3.4, 14]);
    expect(titrationReducer(clamped, { type: "configure_acid", acidKind: "strong" }).pKa).toEqual([]);
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
