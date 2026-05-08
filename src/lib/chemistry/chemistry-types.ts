export type AtomInventory = Record<string, number>;

export type ChemistryErrorCode =
  | "EMPTY_FORMULA"
  | "INVALID_TOKEN"
  | "UNKNOWN_ELEMENT"
  | "UNBALANCED_PARENTHESIS"
  | "INVALID_EQUATION"
  | "UNBALANCEABLE_EQUATION"
  | "UNKNOWN_COMPOUND"
  | "INVALID_QUANTITY";

export type ChemistryError = {
  ok: false;
  code: ChemistryErrorCode;
  message: string;
  index?: number;
};

export type FormulaParseSuccess = {
  ok: true;
  formula: string;
  atoms: AtomInventory;
  charge: number;
};

export type FormulaParseResult = FormulaParseSuccess | ChemistryError;

export type ParsedEquationSide = "reactant" | "product";

export type ParsedEquationTerm = {
  formula: string;
  side: ParsedEquationSide;
  atoms: AtomInventory;
  charge: number;
};

export type ParsedChemicalEquation = {
  reactants: ParsedEquationTerm[];
  products: ParsedEquationTerm[];
  terms: ParsedEquationTerm[];
};

export type BalancedEquation = {
  ok: true;
  equation: string;
  balancedEquation: string;
  coefficients: number[];
  reactants: ParsedEquationTerm[];
  products: ParsedEquationTerm[];
};

export type BalanceEquationResult = BalancedEquation | ChemistryError;

export type ConservationResult =
  | {
      ok: true;
      atomsConserved: boolean;
      chargeConserved: boolean;
      reactantAtoms: AtomInventory;
      productAtoms: AtomInventory;
      reactantCharge: number;
      productCharge: number;
      differences: AtomInventory;
    }
  | ChemistryError;

export type ChemistryMistakeTag =
  | "equation_not_balanced"
  | "molar_mass_error"
  | "mole_ratio_flipped"
  | "skipped_mole_bridge"
  | "unit_not_cancelled"
  | "limiting_reactant_wrong"
  | "sig_fig_error";

export type ChemistryConceptTag =
  | "formula_parsing"
  | "molar_mass"
  | "equation_balancing"
  | "mole_ratio"
  | "unit_conversion"
  | "conservation"
  | "acid_base_titration";

export type StoichiometryQuantity = {
  formula: string;
  quantity?: number;
  unit: "g" | "mol";
};

export type StoichiometryStepKind =
  | "balance_equation"
  | "given_to_moles"
  | "mole_ratio"
  | "moles_to_target";

export type StoichiometryStepSummary = {
  kind: StoichiometryStepKind;
  label: string;
  value: number;
  unit: string;
};

export type StoichiometryProblemInput = {
  equation: string;
  given: Required<Pick<StoichiometryQuantity, "formula" | "quantity" | "unit">>;
  target: Pick<StoichiometryQuantity, "formula" | "unit">;
  significantFigures?: number;
};

export type StoichiometrySolution =
  | {
      ok: true;
      balancedEquation: string;
      finalAnswer: {
        formula: string;
        value: number;
        unit: "g" | "mol";
      };
      steps: StoichiometryStepSummary[];
      conceptTags: ChemistryConceptTag[];
    }
  | ChemistryError;

export type TitrationNotebookSection =
  | "hypothesis"
  | "procedure"
  | "calculations"
  | "observations"
  | "errorAnalysis"
  | "conclusion";

export type TitrationNotebook = Record<TitrationNotebookSection, string> & {
  dataTable: string;
};

export type TitrationMeasurement = {
  titrantVolumeMl: number;
  ph: number;
  equivalenceProgress: number;
};

export type TitrationState = {
  labTemplateId: "acid-base-titration-strong-acid-base";
  acidFormula: "HCl";
  baseFormula: "NaOH";
  acidMolarity: number;
  acidVolumeMl: number;
  baseMolarity: number;
  titrantAddedMl: number;
  ph: number;
  measurements: TitrationMeasurement[];
  notebook: TitrationNotebook;
  updatedAt: string;
};

export type TitrationAction =
  | { type: "add_titrant"; volumeMl: number }
  | { type: "reset" }
  | { type: "update_notebook"; section: TitrationNotebookSection; value: string };
