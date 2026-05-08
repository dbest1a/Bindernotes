import { describe, expect, it } from "vitest";
import {
  checkStoichiometryAttempt,
  solveStoichiometryProblem,
} from "@/lib/chemistry/stoichiometry";

describe("chemistry stoichiometry engine", () => {
  it("builds a deterministic unit ladder for gram-to-gram stoichiometry", () => {
    const result = solveStoichiometryProblem({
      equation: "H2 + O2 -> H2O",
      given: { formula: "H2", quantity: 4.032, unit: "g" },
      target: { formula: "H2O", unit: "g" },
      significantFigures: 4,
    });

    expect(result).toMatchObject({
      ok: true,
      balancedEquation: "2 H2 + O2 -> 2 H2O",
      conceptTags: expect.arrayContaining(["molar_mass", "mole_ratio", "unit_conversion"]),
      finalAnswer: { formula: "H2O", unit: "g", value: expect.closeTo(36.03, 2) },
    });

    if (result.ok) {
      expect(result.steps.map((step) => step.kind)).toEqual([
        "balance_equation",
        "given_to_moles",
        "mole_ratio",
        "moles_to_target",
      ]);
    }
  });

  it("tags common mistakes without storing private working text", () => {
    const attempt = checkStoichiometryAttempt({
      expected: {
        equation: "H2 + O2 -> H2O",
        given: { formula: "H2", quantity: 4.032, unit: "g" },
        target: { formula: "H2O", unit: "g" },
      },
      submitted: {
        balancedEquation: "H2 + O2 -> H2O",
        finalAnswer: 8,
        usedMoleBridge: false,
        moleRatioOrientation: "flipped",
        cancelledUnits: false,
      },
    });

    expect(attempt.mistakeTags).toEqual(
      expect.arrayContaining([
        "equation_not_balanced",
        "mole_ratio_flipped",
        "skipped_mole_bridge",
        "unit_not_cancelled",
      ]),
    );
    expect(JSON.stringify(attempt.savedSummary)).not.toMatch(/body|private|scratch/i);
  });
});
