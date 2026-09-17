import type {
  TitrationAction,
  TitrationMeasurement,
  TitrationNotebook,
  TitrationState,
} from "@/lib/chemistry/chemistry-types";
import { calculateStrongAcidBase } from "@/lib/chemistry/acid-base";
import { finite, nonnegative, positive } from "@/lib/chemistry/calculation-validation";

function nowIso() {
  return new Date().toISOString();
}

function emptyNotebook(): TitrationNotebook {
  return {
    hypothesis: "",
    procedure: "",
    dataTable: "",
    calculations: "",
    observations: "",
    errorAnalysis: "",
    conclusion: "",
  };
}

export function calculateStrongAcidStrongBasePh(input: {
  acidMolarity: number;
  acidVolumeMl: number;
  baseMolarity: number;
  baseVolumeMl: number;
}) {
  positive(input.acidMolarity, "Acid molarity");
  positive(input.baseMolarity, "Base molarity");
  positive(input.acidVolumeMl, "Initial acid volume");
  nonnegative(input.baseVolumeMl, "Added base volume");
  const totalVolumeMl = finite(input.acidVolumeMl + input.baseVolumeMl, "Total volume");
  const difference = input.acidMolarity * (input.acidVolumeMl / totalVolumeMl)
    - input.baseMolarity * (input.baseVolumeMl / totalVolumeMl);
  return calculateStrongAcidBase({ kind: difference < 0 ? "base" : "acid", concentrationM: Math.abs(difference) }).ph;
}

function buildMeasurement(
  state: Omit<TitrationState, "measurements" | "notebook" | "updatedAt" | "ph">,
): TitrationMeasurement {
  const equivalenceVolume = (state.acidMolarity * state.acidVolumeMl) / state.baseMolarity;
  const ph = calculateStrongAcidStrongBasePh({
    acidMolarity: state.acidMolarity,
    acidVolumeMl: state.acidVolumeMl,
    baseMolarity: state.baseMolarity,
    baseVolumeMl: state.titrantAddedMl,
  });

  return {
    titrantVolumeMl: Number(state.titrantAddedMl.toFixed(2)),
    ph: Number(ph.toFixed(2)),
    equivalenceProgress: Number((state.titrantAddedMl / equivalenceVolume).toFixed(3)),
  };
}

export function createTitrationInitialState(): TitrationState {
  const baseState = {
    labTemplateId: "acid-base-titration-strong-acid-base" as const,
    acidFormula: "HCl" as const,
    baseFormula: "NaOH" as const,
    acidMolarity: 0.1,
    acidVolumeMl: 25,
    baseMolarity: 0.1,
    titrantAddedMl: 0,
  };
  const initialPh = calculateStrongAcidStrongBasePh({
    acidMolarity: baseState.acidMolarity,
    acidVolumeMl: baseState.acidVolumeMl,
    baseMolarity: baseState.baseMolarity,
    baseVolumeMl: 0,
  });

  return {
    ...baseState,
    ph: Number(initialPh.toFixed(2)),
    measurements: [],
    notebook: emptyNotebook(),
    updatedAt: nowIso(),
  };
}

export function titrationReducer(state: TitrationState, action: TitrationAction): TitrationState {
  if (action.type === "restore") return action.state;
  if (action.type === "reset") {
    return createTitrationInitialState();
  }

  if (action.type === "update_notebook") {
    return {
      ...state,
      notebook: {
        ...state.notebook,
        [action.section]: action.value,
      },
      updatedAt: nowIso(),
    };
  }

  nonnegative(state.titrantAddedMl, "Existing titrant volume");
  nonnegative(action.volumeMl, "Added titrant volume");
  const nextAdded = Math.min(50, finite(state.titrantAddedMl + action.volumeMl, "Total titrant volume"));
  if (nextAdded === state.titrantAddedMl) return state;
  const nextCore = {
    labTemplateId: state.labTemplateId,
    acidFormula: state.acidFormula,
    baseFormula: state.baseFormula,
    acidMolarity: state.acidMolarity,
    acidVolumeMl: state.acidVolumeMl,
    baseMolarity: state.baseMolarity,
    titrantAddedMl: nextAdded,
  };
  const measurement = buildMeasurement(nextCore);

  return {
    ...state,
    titrantAddedMl: nextAdded,
    ph: measurement.ph,
    measurements: [...state.measurements, measurement],
    updatedAt: nowIso(),
  };
}
