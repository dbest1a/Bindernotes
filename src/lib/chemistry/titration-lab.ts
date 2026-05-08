import type {
  TitrationAction,
  TitrationMeasurement,
  TitrationNotebook,
  TitrationState,
} from "@/lib/chemistry/chemistry-types";

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

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(50, value));
}

function safeNegativeLog10(concentration: number) {
  return -Math.log10(Math.max(concentration, 1e-14));
}

export function calculateStrongAcidStrongBasePh(input: {
  acidMolarity: number;
  acidVolumeMl: number;
  baseMolarity: number;
  baseVolumeMl: number;
}) {
  const acidMoles = input.acidMolarity * (input.acidVolumeMl / 1000);
  const baseMoles = input.baseMolarity * (input.baseVolumeMl / 1000);
  const totalLiters = Math.max((input.acidVolumeMl + input.baseVolumeMl) / 1000, 0.000001);
  const difference = acidMoles - baseMoles;

  if (Math.abs(difference) < 1e-10) {
    return 7;
  }

  if (difference > 0) {
    return safeNegativeLog10(difference / totalLiters);
  }

  const poh = safeNegativeLog10(Math.abs(difference) / totalLiters);
  return 14 - poh;
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

  const nextAdded = clampVolume(state.titrantAddedMl + action.volumeMl);
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
