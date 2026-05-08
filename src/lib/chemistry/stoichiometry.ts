import type {
  ChemistryConceptTag,
  ChemistryMistakeTag,
  StoichiometryProblemInput,
  StoichiometrySolution,
  StoichiometryStepSummary,
} from "@/lib/chemistry/chemistry-types";
import { balanceEquation } from "@/lib/chemistry/equation-balancer";
import { calculateMolarMass } from "@/lib/chemistry/molar-mass";

function roundToSigFigs(value: number, significantFigures = 4) {
  if (!Number.isFinite(value) || value === 0) {
    return value;
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const factor = 10 ** (significantFigures - exponent - 1);
  return Math.round(value * factor) / factor;
}

function findCoefficient(formula: string, formulas: string[], coefficients: number[]) {
  const index = formulas.findIndex((candidate) => candidate === formula);
  return index >= 0 ? coefficients[index] : null;
}

export function solveStoichiometryProblem(input: StoichiometryProblemInput): StoichiometrySolution {
  if (input.given.quantity <= 0) {
    return { ok: false, code: "INVALID_QUANTITY", message: "Given quantity must be greater than zero." };
  }

  const balanced = balanceEquation(input.equation);
  if (!balanced.ok) {
    return balanced;
  }

  const formulas = [...balanced.reactants, ...balanced.products].map((term) => term.formula);
  const givenCoefficient = findCoefficient(input.given.formula, formulas, balanced.coefficients);
  const targetCoefficient = findCoefficient(input.target.formula, formulas, balanced.coefficients);
  if (!givenCoefficient || !targetCoefficient) {
    return {
      ok: false,
      code: "UNKNOWN_COMPOUND",
      message: "The given and target formulas must both appear in the balanced equation.",
    };
  }

  const givenMolarMass = calculateMolarMass(input.given.formula);
  const targetMolarMass = calculateMolarMass(input.target.formula);
  if (!givenMolarMass.ok) {
    return givenMolarMass;
  }
  if (!targetMolarMass.ok) {
    return targetMolarMass;
  }

  const givenMoles =
    input.given.unit === "mol" ? input.given.quantity : input.given.quantity / givenMolarMass.gramsPerMole;
  const targetMoles = givenMoles * (targetCoefficient / givenCoefficient);
  const targetValue =
    input.target.unit === "mol" ? targetMoles : targetMoles * targetMolarMass.gramsPerMole;

  const steps: StoichiometryStepSummary[] = [
    {
      kind: "balance_equation",
      label: `Balance equation: ${balanced.balancedEquation}`,
      value: 1,
      unit: "balanced",
    },
    {
      kind: "given_to_moles",
      label:
        input.given.unit === "mol"
          ? `Start with moles of ${input.given.formula}.`
          : `Convert grams of ${input.given.formula} to moles.`,
      value: givenMoles,
      unit: `mol ${input.given.formula}`,
    },
    {
      kind: "mole_ratio",
      label: `Use ${targetCoefficient}:${givenCoefficient} mole ratio from the balanced equation.`,
      value: targetMoles,
      unit: `mol ${input.target.formula}`,
    },
    {
      kind: "moles_to_target",
      label:
        input.target.unit === "mol"
          ? `Keep answer in moles of ${input.target.formula}.`
          : `Convert moles of ${input.target.formula} to grams.`,
      value: targetValue,
      unit: `${input.target.unit} ${input.target.formula}`,
    },
  ];

  return {
    ok: true,
    balancedEquation: balanced.balancedEquation,
    finalAnswer: {
      formula: input.target.formula,
      value: roundToSigFigs(targetValue, input.significantFigures),
      unit: input.target.unit,
    },
    steps,
    conceptTags: ["equation_balancing", "molar_mass", "mole_ratio", "unit_conversion"],
  };
}

export function checkStoichiometryAttempt(input: {
  expected: Omit<StoichiometryProblemInput, "significantFigures">;
  submitted: {
    balancedEquation?: string;
    finalAnswer?: number;
    usedMoleBridge?: boolean;
    moleRatioOrientation?: "correct" | "flipped" | "unknown";
    cancelledUnits?: boolean;
    significantFiguresOk?: boolean;
  };
}) {
  const solution = solveStoichiometryProblem({
    ...input.expected,
    significantFigures: 4,
  });
  const mistakeTags: ChemistryMistakeTag[] = [];
  const conceptTags: ChemistryConceptTag[] = ["molar_mass", "mole_ratio", "unit_conversion"];

  if (input.submitted.balancedEquation) {
    const normalizedSubmitted = input.submitted.balancedEquation.replace(/\s+/g, " ").trim();
    const normalizedExpected = solution.ok ? solution.balancedEquation.replace(/\s+/g, " ").trim() : "";
    if (!solution.ok || normalizedSubmitted !== normalizedExpected) {
      mistakeTags.push("equation_not_balanced");
    }
  } else {
    mistakeTags.push("equation_not_balanced");
  }

  if (!input.submitted.usedMoleBridge) {
    mistakeTags.push("skipped_mole_bridge");
  }

  if (input.submitted.moleRatioOrientation === "flipped") {
    mistakeTags.push("mole_ratio_flipped");
  }

  if (!input.submitted.cancelledUnits) {
    mistakeTags.push("unit_not_cancelled");
  }

  if (input.submitted.significantFiguresOk === false) {
    mistakeTags.push("sig_fig_error");
  }

  if (solution.ok && typeof input.submitted.finalAnswer === "number") {
    const relativeError = Math.abs(input.submitted.finalAnswer - solution.finalAnswer.value) / solution.finalAnswer.value;
    if (relativeError > 0.05 && !mistakeTags.includes("molar_mass_error")) {
      mistakeTags.push("molar_mass_error");
    }
  }

  return {
    mistakeTags,
    conceptTags,
    savedSummary: {
      expectedFinalAnswer: solution.ok ? solution.finalAnswer : null,
      submittedFinalAnswer: input.submitted.finalAnswer ?? null,
      mistakeTags,
      conceptTags,
    },
  };
}
